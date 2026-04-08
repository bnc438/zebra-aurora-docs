#!/usr/bin/env node
/**
 * scripts/generate-build-report.mjs
 * ============================================================================
 * Walks all .mdx/.md files in docs/, parses frontmatter, analyses content,
 * makes educated guesses for missing taxonomy fields, and outputs
 * static/build-report.json.
 *
 * Guessed values are clearly flagged with `_guessed: true` in the per-doc
 * `guesses` map so authors can review and promote them into actual frontmatter.
 *
 * Usage:
 *   node scripts/generate-build-report.mjs
 *
 * Output:
 *   static/build-report.json
 *
 * Design for portability:
 *   Drop this script + dashboard.config.js into any Docusaurus repo and run
 *   `node scripts/generate-build-report.mjs` from the repo root.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

const workspaceRoot = path.resolve(__dirname, '..');
const docsRoot = path.join(workspaceRoot, 'docs');
const outputPath = path.join(workspaceRoot, 'static', 'build-report.json');
const wcagReportPath = path.join(workspaceRoot, 'static', 'wcag-compliance-report.json');
const epicReleaseMetricsPath = path.join(workspaceRoot, 'static', 'data', 'epic-release-metrics.json');
const userSatisfactionMetricsPath = path.join(workspaceRoot, 'static', 'data', 'user-satisfaction-metrics.json');
const configPath = path.join(workspaceRoot, 'dashboard.config.js');
const docusaurusConfigPath = path.join(workspaceRoot, 'docusaurus.config.js');
const sidebarPath = path.join(workspaceRoot, 'sidebars.js');
const srcDir = path.join(workspaceRoot, 'src');
const githubDir = path.join(workspaceRoot, '.github');
const workflowsDir = path.join(githubDir, 'workflows');
const branchProtectionScriptPath = path.join(githubDir, 'setup-branch-protection.sh');
const copilotInstructionsPath = path.join(githubDir, 'copilot-instructions.md');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const GITHUB_API_TIMEOUT_MS = Number(process.env.GITHUB_API_TIMEOUT_MS || 10_000);

const GITHUB_ACTION_GATES = [
  { id: 'ENG-01', file: 'eng-01-build.yml', gate: 'Production Build', requiresPullRequest: true },
  { id: 'ENG-08', file: 'eng-08-e2e.yml', gate: 'Playwright E2E', requiresPullRequest: true },
  { id: 'ENG-09', file: 'eng-09-links.yml', gate: 'Internal Links', requiresPullRequest: true, requiresNightly: true, requiresAutoIssue: true },
  { id: 'ENG-10', file: 'eng-10-lighthouse.yml', gate: 'Lighthouse CI', requiresPullRequest: true },
  { id: 'ENG-14', file: 'eng-14-security.yml', gate: 'Security Audit', requiresPullRequest: true, requiresWeekly: true, requiresAutoIssue: true },
];

const GITHUB_ACTION_SUGGESTED_GATES = [
  {
    id: 'ENG-03',
    file: 'eng-03-import-integrity.yml',
    gate: 'MDX + Import Integrity',
    avoidRisk: 'Prevents unresolved MDX imports and component references from reaching main.',
    implementation: [
      'Create .github/workflows/eng-03-import-integrity.yml',
      'Run npm ci and npm run build with strict import checks',
      'Add required status check in branch protection as "ENG-03 Import Integrity"',
    ],
  },
  {
    id: 'A11Y-CHECK',
    file: 'a11y-smoke.yml',
    gate: 'Accessibility Smoke',
    avoidRisk: 'Prevents severe accessibility regressions on core pages before merge.',
    implementation: [
      'Create .github/workflows/a11y-smoke.yml',
      'Run axe/pa11y checks on top routes in CI',
      'Fail workflow on critical a11y violations and publish report artifact',
    ],
  },
  {
    id: 'DEPENDABOT',
    file: '.github/dependabot.yml',
    gate: 'Automated Dependency Updates',
    avoidRisk: 'Reduces CVE backlog and dependency drift by opening update PRs automatically.',
    implementation: [
      'Create .github/dependabot.yml with npm ecosystem updates',
      'Set weekly schedule and target default branch',
      'Enable auto-merge policy for patch updates if desired',
    ],
    isConfigFile: true,
  },
  {
    id: 'ENG-12',
    file: 'eng-12-i18n.yml',
    gate: 'i18n Build Verification (Placeholder)',
    avoidRisk: 'Prevents untranslated keys and broken locale builds when translations are introduced.',
    implementation: [
      'Enable additional locales under i18n.locales in docusaurus.config.js',
      'Create .github/workflows/eng-12-i18n.yml to build every locale',
      'Fail on raw key IDs and missing locale fallback checks',
    ],
    requiresLocales: true,
  },
];

// ---------------------------------------------------------------------------
// Load dashboard config (graceful fallback if absent)
// ---------------------------------------------------------------------------
let dashboardConfig;
try {
  dashboardConfig = require(configPath);
} catch {
  dashboardConfig = { fields: [], placeholderPattern: /\[.*?\]|TODO|TBD/i, taxonomyFields: [] }; // Flags placeholder/incomplete text
}

const { fields: configFields, placeholderPattern, taxonomyFields } = dashboardConfig;

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------
export function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && /\.(mdx|md)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function walkSrc(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSrc(fullPath));
    } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Frontmatter parser (handles strings, quoted strings, inline YAML arrays,
// block YAML arrays, inline comments, and comment-only lines)
// ---------------------------------------------------------------------------
export function parseFrontMatter(content) {
  if (!content.startsWith('---\n')) {
    return { frontMatter: {}, body: content };
  }
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontMatter: {}, body: content };
  }
  const raw = content.slice(4, end);
  const body = content.slice(end + 5);
  const frontMatter = parseYamlBlock(raw);
  return { frontMatter, body };
}

/**
 * Minimal YAML block parser sufficient for Docusaurus MDX frontmatter.
 * Handles: strings, quoted strings, inline arrays, block arrays, comments.
 * @param {string} raw - Raw YAML text between the `---` delimiters
 * @returns {Record<string, string|string[]|null>}
 */
export function parseYamlBlock(raw) {
  const result = {};
  const lines = raw.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines and comment-only lines
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    if (!key) { i++; continue; }

    // Strip inline comments from value portion (but preserve URLs http://…)
    let rawValue = trimmed.slice(colonIdx + 1);
    // Only strip inline comments that are preceded by whitespace outside a quoted string
    rawValue = stripInlineComment(rawValue).trim();

    // Inline JSON-style array: `["a","b"]` or `['a','b']`
    if (rawValue.startsWith('[')) {
      result[key] = parseInlineArray(rawValue);
      i++;
      continue;
    }

    // Empty value – might be followed by a YAML block sequence
    if (rawValue === '' || rawValue === null) {
      const items = [];
      i++;
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        if (nextTrimmed.startsWith('- ') || nextTrimmed === '-') {
          const item = nextTrimmed.slice(1).trim().replace(/^['"]|['"]$/g, '').trim();
          if (item) items.push(item);
          i++;
        } else if (!nextTrimmed || nextTrimmed.startsWith('#')) {
          i++;
        } else {
          break;
        }
      }
      result[key] = items.length > 0 ? items : null;
      continue;
    }

    // Quoted or plain string
    result[key] = rawValue.replace(/^['"]|['"]$/g, '').trim();
    i++;
  }

  return result;
}

/** Remove `# comment` suffix outside quoted regions. */
function stripInlineComment(str) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (ch === '#' && !inSingle && !inDouble) {
      return str.slice(0, i);
    }
  }
  return str;
}

/** Parse `["a","b"]` or `['a', 'b']` inline arrays. */
export function parseInlineArray(str) {
  const inner = str.replace(/^\[|\]$/g, '').trim();
  if (!inner) return [];
  return inner
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Placeholder detection
// ---------------------------------------------------------------------------
export function detectPlaceholders(frontMatter, body) {
  const found = [];
  for (const [key, value] of Object.entries(frontMatter)) {
    const text = Array.isArray(value) ? value.join(' ') : String(value ?? '');
    if (placeholderPattern.test(text)) {
      found.push({ field: key, value: text.slice(0, 80) });
    }
  }
  // Also check first 3000 chars of body for placeholder-heavy content
  const bodySnippet = (body || '').slice(0, 3000);
  const bodyMatches = bodySnippet.match(new RegExp(placeholderPattern.source, 'gi')) || [];
  if (bodyMatches.length > 0) {
    found.push({ field: '_body', count: bodyMatches.length });
  }
  return found;
}

// ---------------------------------------------------------------------------
// Intelligent guessing engine
// ---------------------------------------------------------------------------

/** Guess content_type from filename prefix convention. */
export function guessContentType(filename) {
  const base = path.basename(filename).toLowerCase();
  if (base.startsWith('rn-')) return 'Release Notes';
  if (base.startsWith('t-')) return 'Tutorial';
  if (base.startsWith('c-')) return 'Concept';
  if (base.startsWith('r-')) return 'Reference';
  if (base.startsWith('g-')) return 'Guide';
  if (base === 'index.mdx' || base === 'index.md') return 'Index';
  return null;
}

/** Guess device_type from content mentions. */
export function guessDeviceType(title, body) {
  const text = `${title} ${body}`.toLowerCase();
  const smartCameraModels = /vs\d{2}|xs\d{2}|ns42|aurora focus/i;
  const fixedScannerModels = /fs\d{2}|fixed.?scanner/i;
  const hasSmartCamera = smartCameraModels.test(text);
  const hasFixedScanner = fixedScannerModels.test(text);
  if (hasSmartCamera && hasFixedScanner) return 'Smart Camera / Fixed Scanner';
  if (hasSmartCamera) return 'Smart Camera';
  if (hasFixedScanner) return 'Fixed Scanner';
  return null;
}

/** Returns true when the text context suggests job deployment content (but not CI deploy). */
function isJobDeploymentContext(text) {
  return /deploy|job/i.test(text) && !/deploy.*build/i.test(text);
}

/** Guess use_case from title/body keywords. */
export function guessUseCase(title, body) {
  const text = `${title} ${body.slice(0, 2000)}`.toLowerCase();
  const cases = [];
  if (/\bocr\b|optical character/i.test(text)) cases.push('Optical Character Recognition (OCR)');
  if (/barcode|1d.?code|2d.?code|qr.?code/i.test(text)) cases.push('Barcode Reading');
  if (/assembly|verification|presence/i.test(text)) cases.push('Assembly Verification');
  if (/gpio|digital.?i\/o|port/i.test(text)) cases.push('GPIO Control');
  if (/javascript|scripting|script/i.test(text)) cases.push('Application Development');
  if (/tcp|serial|usb.?cdc|ethernet|rs.?232/i.test(text)) cases.push('Communication / Integration');
  if (/licens/i.test(text)) cases.push('Licensing');
  if (/anomaly|deep.?learning|ai\b/i.test(text)) cases.push('Deep Learning / Anomaly Detection');
  if (isJobDeploymentContext(text)) cases.push('Job Deployment');
  return cases.length > 0 ? cases : null;
}

/** Guess role from content_type. */
export function guessRole(contentType) {
  const map = {
    'Tutorial':      ['Integrator/Developer'],
    'Guide':         ['Integrator/Developer', 'Controls Engineer'],
    'Concept':       ['Integrator/Developer', 'Controls Engineer'],
    'Reference':     ['Integrator/Developer'],
    'Release Notes': ['System Administrator', 'Integrator/Developer'],
    'Index':         null,
  };
  return map[contentType] ?? null;
}

/** Guess skill_level from content_type and title. */
export function guessSkillLevel(contentType, title) {
  const t = (title || '').toLowerCase();
  if (/advanced|debug|optim|deep.?learning/i.test(t)) return 'Advanced';
  if (contentType === 'Release Notes' || contentType === 'Index') return 'All';
  if (contentType === 'Reference') return 'Intermediate';
  if (contentType === 'Tutorial' || contentType === 'Guide') return 'Beginner';
  return null;
}

/** Guess status: default Draft if missing and not a known-published type. */
export function guessStatus(contentType, filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base.startsWith('rn-')) return 'Published';
  if (base === 'index.mdx' || base === 'index.md') return 'Published';
  return 'Draft';
}

/**
 * Run all guessers for a single doc.
 * Returns `{ field: guessedValue, ... }` — only fields that are actually missing.
 */
export function buildGuesses(frontMatter, filePath, body) {
  const guesses = {};
  const title = frontMatter.title || path.basename(filePath, path.extname(filePath));

  const contentTypeGuess = guessContentType(filePath);

  if (!frontMatter.content_type && contentTypeGuess) {
    guesses.content_type = contentTypeGuess;
  }

  const effectiveContentType = frontMatter.content_type || contentTypeGuess;

  if (!frontMatter.device_type) {
    const g = guessDeviceType(title, body);
    if (g) guesses.device_type = g;
  }

  if (!frontMatter.use_case || (Array.isArray(frontMatter.use_case) && frontMatter.use_case.length === 0)) {
    const g = guessUseCase(title, body);
    if (g) guesses.use_case = g;
  }

  if (!frontMatter.role || (Array.isArray(frontMatter.role) && frontMatter.role.length === 0)) {
    const g = guessRole(effectiveContentType);
    if (g) guesses.role = g;
  }

  if (!frontMatter.skill_level) {
    const g = guessSkillLevel(effectiveContentType, title);
    if (g) guesses.skill_level = g;
  }

  if (!frontMatter.status) {
    guesses.status = guessStatus(effectiveContentType, filePath);
  }

  return guesses;
}

// ---------------------------------------------------------------------------
// Word count helper
// ---------------------------------------------------------------------------
export function countWords(text) {
  return (text || '').trim().split(/\s+/).filter((w) => w.length > 0).length;
}

// ---------------------------------------------------------------------------
// Section detector (which top-level docs/ subdirectory)
// ---------------------------------------------------------------------------
export function detectSection(filePath) {
  const rel = path.relative(docsRoot, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length === 1) return 'root';
  return parts[0];
}

// ---------------------------------------------------------------------------
// URL builder (mirrors generate-askai-index.mjs)
// ---------------------------------------------------------------------------
function buildDocUrl(filePath, frontMatter) {
  if (frontMatter.slug) {
    const slug = String(frontMatter.slug);
    if (slug.startsWith('/docs/')) return slug;
    if (slug.startsWith('/')) return `/docs${slug}`;
  }
  const rel = path.relative(docsRoot, filePath).replace(/\\/g, '/');
  const noExt = rel.replace(/\.(mdx|md)$/i, '');
  if (noExt.endsWith('/index')) return `/docs/${noExt.slice(0, -6)}`;
  return `/docs/${noExt}`;
}

// ---------------------------------------------------------------------------
// Completeness scorer
// ---------------------------------------------------------------------------
export function scoreCompleteness(frontMatter, guesses) {
  const required = configFields.filter((f) => f.required);
  if (required.length === 0) return 1;

  let filled = 0;
  for (const f of required) {
    const val = frontMatter[f.key];
    const hasValue = val !== undefined && val !== null && val !== '' &&
      !(Array.isArray(val) && val.length === 0);
    if (hasValue) filled++;
  }
  return Number((filled / required.length).toFixed(2));
}

// ---------------------------------------------------------------------------
// Date parsing helper
// ---------------------------------------------------------------------------
/** Parse a date string like YYYY-MM-DD into a timestamp (ms). Returns null if invalid. */
export function parseDateField(value) {
  if (!value || typeof value !== 'string') return null;
  // Skip placeholder patterns (e.g., [YYYY-MM-DD], TODO, TBD)
  if (/\[/.test(value) || /TODO|TBD/i.test(value)) return null;
  const ts = Date.parse(value.trim());
  return Number.isNaN(ts) ? null : ts;
}

function stripHtmlTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeInlineText(value) {
  return stripHtmlTags(value)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();
}

function isNonDescriptiveLinkText(value) {
  return /^(click here|here|read more|more|learn more|this link|link|details)$/i.test(
    normalizeInlineText(value)
  );
}

function parseCssColor(value) {
  if (!value) return null;
  const color = String(value).trim().toLowerCase();

  if (color === 'transparent' || color === 'inherit' || color === 'initial' || color === 'unset') {
    return null;
  }

  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => p.trim());
    if (parts.length < 3) return null;
    const rgb = parts.slice(0, 3).map((part) => {
      if (part.endsWith('%')) {
        return Math.round((Number.parseFloat(part) / 100) * 255);
      }
      return Number.parseFloat(part);
    });
    if (rgb.some((v) => Number.isNaN(v))) return null;
    return rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))));
  }

  return null;
}

function parseInlineStyle(styleValue) {
  const styleMap = new Map();
  for (const declaration of String(styleValue || '').split(';')) {
    const [rawProp, ...rawValueParts] = declaration.split(':');
    if (!rawProp || rawValueParts.length === 0) continue;
    const prop = rawProp.trim().toLowerCase();
    const value = rawValueParts.join(':').trim();
    if (!prop || !value) continue;
    styleMap.set(prop, value);
  }
  return styleMap;
}

function relativeLuminance([r, g, b]) {
  const linear = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foregroundRgb, backgroundRgb) {
  const l1 = relativeLuminance(foregroundRgb);
  const l2 = relativeLuminance(backgroundRgb);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

function analyzeAccessibility(body) {
  const issueCounts = {
    img_no_alt: 0,
    non_descriptive_links: 0,
    heading_skips: 0,
    empty_headings: 0,
    low_contrast_text: 0,
  };

  const markdownImagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  for (const match of body.matchAll(markdownImagePattern)) {
    if (!match[1] || !match[1].trim()) {
      issueCounts.img_no_alt += 1;
    }
  }

  const htmlImagePattern = /<img\b[^>]*>/gi;
  for (const match of body.matchAll(htmlImagePattern)) {
    const tag = match[0];
    const altMatch = tag.match(/\balt\s*=\s*['"]([^'"]*)['"]/i);
    if (!altMatch || !altMatch[1].trim()) {
      issueCounts.img_no_alt += 1;
    }
  }

  const markdownLinkPattern = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
  for (const match of body.matchAll(markdownLinkPattern)) {
    if (isNonDescriptiveLinkText(match[1])) {
      issueCounts.non_descriptive_links += 1;
    }
  }

  const htmlLinkPattern = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of body.matchAll(htmlLinkPattern)) {
    if (isNonDescriptiveLinkText(match[1])) {
      issueCounts.non_descriptive_links += 1;
    }
  }

  let lastHeadingLevel = 0;
  const markdownLines = body.split(/\r?\n/);
  for (const line of markdownLines) {
    const match = line.match(/^\s{0,3}(#{1,6})\s*(.*?)\s*#*\s*$/);
    if (!match) continue;

    const level = match[1].length;
    const headingText = normalizeInlineText(match[2]);
    if (!headingText) {
      issueCounts.empty_headings += 1;
    }
    if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
      issueCounts.heading_skips += 1;
    }
    lastHeadingLevel = level;
  }

  const htmlHeadingPattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  for (const match of body.matchAll(htmlHeadingPattern)) {
    const headingText = normalizeInlineText(match[2]);
    if (!headingText) {
      issueCounts.empty_headings += 1;
    }
  }

  const styledTagPattern = /<([a-z0-9]+)\b[^>]*\bstyle\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  for (const match of body.matchAll(styledTagPattern)) {
    const styleMap = parseInlineStyle(match[2]);
    const fg = parseCssColor(styleMap.get('color'));
    const bg = parseCssColor(styleMap.get('background-color') || styleMap.get('background'));
    if (!fg || !bg) continue;

    if (contrastRatio(fg, bg) < 4.5) {
      issueCounts.low_contrast_text += 1;
    }
  }

  const a11yIssues = Object.entries(issueCounts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type, count }));

  return {
    hasA11yIssues: a11yIssues.length > 0,
    a11yIssues,
  };
}

function extractImageRefs(body) {
  const refs = [];

  const markdownImagePattern = /!\[[^\]]*\]\(([^)\s]+)(?:\s+['"][^'"]*['"])?\)/g;
  for (const match of body.matchAll(markdownImagePattern)) {
    refs.push(match[1]);
  }

  const htmlImagePattern = /<img\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  for (const match of body.matchAll(htmlImagePattern)) {
    refs.push(match[1]);
  }

  return refs;
}

function isExternalReference(ref) {
  return /^(?:[a-z]+:)?\/\//i.test(ref) || /^(data:|mailto:|tel:|#)/i.test(ref);
}

function resolveImageRefPath(filePath, ref) {
  const cleanRef = String(ref || '').split('#')[0].split('?')[0].trim();
  if (!cleanRef || isExternalReference(cleanRef) || cleanRef.startsWith('{')) {
    return null;
  }

  if (cleanRef.startsWith('/')) {
    return path.join(workspaceRoot, 'static', cleanRef.replace(/^\//, ''));
  }

  if (cleanRef.startsWith('@site/')) {
    return path.join(workspaceRoot, cleanRef.replace(/^@site\//, ''));
  }

  return path.resolve(path.dirname(filePath), cleanRef);
}

// ---------------------------------------------------------------------------
// ENG-07: SSR guard violation detection (src/ component files)
// ---------------------------------------------------------------------------
const BROWSER_APIS_CHECK = ['window.', 'document.', 'localStorage', 'sessionStorage', 'navigator.'];
const SSR_GUARDS = ['useEffect(', 'useLayoutEffect(', 'BrowserOnly', 'typeof window', 'typeof document', 'ExecutionEnvironment', 'inBrowser'];

function findSsrViolationsInFile(fileText) {
  // Strip block comments, line comments, and template/string literals to reduce false positives
  const cleaned = fileText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '""');

  const hasGuard = SSR_GUARDS.some((g) => cleaned.includes(g));
  if (hasGuard) return [];

  return BROWSER_APIS_CHECK.filter((api) => cleaned.includes(api)).map((api) => api.replace(/\.$/, ''));
}

// ---------------------------------------------------------------------------
// ENG-09 extended: broken internal markdown links (non-image relative links)
// ---------------------------------------------------------------------------
const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff?)$/i;

function findBrokenInternalMarkdownLinks(filePath, body) {
  const broken = [];
  // Match [text](target) but not images ![text](target)
  const linkPattern = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
  for (const match of body.matchAll(linkPattern)) {
    let target = match[2].split('#')[0].split('?')[0].trim();
    if (!target) continue; // pure anchor link
    if (/^(?:[a-z]+:)?\/\//i.test(target)) continue; // external URL
    if (/^(mailto:|tel:|data:)/i.test(target)) continue;
    if (target.startsWith('{')) continue; // JSX expression
    if (IMAGE_EXT_RE.test(target)) continue; // images handled by findBrokenImageRefs

    let resolvedPath;
    if (target.startsWith('/')) {
      // Absolute path — resolve relative to docs root first, then workspace root
      const stripped = target.replace(/^\//, '');
      resolvedPath = path.join(docsRoot, stripped);
    } else if (target.startsWith('@site/')) {
      resolvedPath = path.join(workspaceRoot, target.replace(/^@site\//, ''));
    } else {
      resolvedPath = path.resolve(path.dirname(filePath), target);
    }

    const exists =
      fs.existsSync(resolvedPath) ||
      fs.existsSync(resolvedPath + '.mdx') ||
      fs.existsSync(resolvedPath + '.md') ||
      fs.existsSync(resolvedPath + '/index.mdx') ||
      fs.existsSync(resolvedPath + '/index.md');

    if (!exists) broken.push(target);
  }
  return broken;
}

function findBrokenImageRefs(filePath, body) {
  const brokenRefs = [];
  for (const ref of extractImageRefs(body)) {
    const resolvedPath = resolveImageRefPath(filePath, ref);
    if (!resolvedPath) {
      continue;
    }
    if (!fs.existsSync(resolvedPath)) {
      brokenRefs.push(ref);
    }
  }
  return brokenRefs;
}

function findMissingRequiredFields(frontMatter) {
  return configFields
    .filter((field) => field.required)
    .map((field) => field.key)
    .filter((key) => {
      const value = frontMatter[key];
      return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    });
}

function findInvalidDateFields(frontMatter) {
  return ['last_reviewed', 'date']
    .filter((key) => frontMatter[key] !== undefined && frontMatter[key] !== null && frontMatter[key] !== '')
    .filter((key) => {
      const rawValue = String(frontMatter[key]);
      return !placeholderPattern.test(rawValue) && parseDateField(rawValue) === null;
    });
}

// ---------------------------------------------------------------------------
// Main: process all docs
// ---------------------------------------------------------------------------
const files = walk(docsRoot);
const docs = [];
const nowMs = Date.now();

for (const filePath of files) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontMatter, body } = parseFrontMatter(raw);

  const title = frontMatter.title || path.basename(filePath, path.extname(filePath));
  const url = buildDocUrl(filePath, frontMatter);
  const section = detectSection(filePath);
  const wordCount = countWords(body);
  const placeholders = detectPlaceholders(frontMatter, body);
  const guesses = buildGuesses(frontMatter, filePath, body);
  const completenessScore = scoreCompleteness(frontMatter, guesses);
  const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  const { hasA11yIssues, a11yIssues } = analyzeAccessibility(body);
  const brokenImageRefs = findBrokenImageRefs(filePath, body);
  const brokenInternalLinks = findBrokenInternalMarkdownLinks(filePath, body);
  const missingRequiredFields = findMissingRequiredFields(frontMatter);
  const invalidDateFields = findInvalidDateFields(frontMatter);

  // File system last modified date (always available)
  const stat = fs.statSync(filePath);
  const lastModified = stat.mtime.toISOString();
  const lastModifiedMs = stat.mtime.getTime();

  // Parse last_reviewed frontmatter date
  const lastReviewedMs = parseDateField(frontMatter.last_reviewed);

  docs.push({
    filePath: relPath,
    url,
    title,
    section,
    wordCount,
    completenessScore,
    /** ISO string of file's last modification (from filesystem). */
    lastModified,
    /** Parsed last_reviewed date as ISO string, or null if missing/placeholder. */
    lastReviewed: lastReviewedMs ? new Date(lastReviewedMs).toISOString() : null,
    /** Raw frontmatter parsed from the file. */
    frontmatter: frontMatter,
    /**
     * Auto-filled values for missing fields.
     * Each entry also carries `_guessed: true` so dashboards can highlight them.
     */
    guesses: Object.fromEntries(
      Object.entries(guesses).map(([k, v]) => [k, { value: v, _guessed: true }])
    ),
    /** Keys of fields where a guess was made. For quick iteration. */
    guessedFields: Object.keys(guesses),
    /** Detected placeholder patterns (both in frontmatter values and body). */
    placeholders,
    hasPlaceholders: placeholders.length > 0,
    hasA11yIssues,
    a11yIssues,
    brokenImageRefs,
    brokenInternalLinks,
    missingRequiredFields,
    invalidDateFields,
  });
}

// ---------------------------------------------------------------------------
// Aggregate statistics
// ---------------------------------------------------------------------------
const totalDocs = docs.length;
const totalWords = docs.reduce((s, d) => s + d.wordCount, 0);
const avgWords = totalDocs > 0 ? Math.round(totalWords / totalDocs) : 0;
const avgCompleteness = totalDocs > 0
  ? Number((docs.reduce((s, d) => s + d.completenessScore, 0) / totalDocs).toFixed(2))
  : 0;

// Field coverage: count of docs that have a value for each field
const fieldCoverage = {};
const fieldCoveragePercent = {};
for (const f of configFields) {
  const count = docs.filter((d) => {
    const val = d.frontmatter[f.key];
    return val !== undefined && val !== null && val !== '' &&
      !(Array.isArray(val) && val.length === 0);
  }).length;
  fieldCoverage[f.key] = count;
  fieldCoveragePercent[f.key] = totalDocs > 0 ? Number((count / totalDocs).toFixed(2)) : 0;
}

// Taxonomy value counts
const taxonomy = {};
for (const field of taxonomyFields) {
  const counts = {};
  for (const doc of docs) {
    const effectiveVal = doc.frontmatter[field] !== undefined && doc.frontmatter[field] !== null
      ? doc.frontmatter[field]
      : doc.guesses[field]?.value;

    if (effectiveVal === undefined || effectiveVal === null) continue;

    const values = Array.isArray(effectiveVal) ? effectiveVal : [effectiveVal];
    for (const v of values) {
      const vStr = String(v).trim();
      if (!vStr) continue;
      counts[vStr] = (counts[vStr] || 0) + 1;
    }
  }
  taxonomy[field] = counts;
}

// Section document counts
const sectionCounts = {};
for (const doc of docs) {
  sectionCounts[doc.section] = (sectionCounts[doc.section] || 0) + 1;
}

// Guessing stats
const totalGuessed = docs.reduce((s, d) => s + d.guessedFields.length, 0);
const docsWithGuesses = docs.filter((d) => d.guessedFields.length > 0).length;

// Placeholder stats
const docsWithPlaceholders = docs.filter((d) => d.hasPlaceholders).length;
const placeholderFieldCounts = {};
for (const doc of docs) {
  for (const p of doc.placeholders) {
    const key = p.field;
    placeholderFieldCounts[key] = (placeholderFieldCounts[key] || 0) + 1;
  }
}

// SEO health (single pass)
const seoHealth = { hasTitle: 0, hasDescription: 0, hasKeywords: 0, hasSlug: 0 };
for (const d of docs) {
  if (d.frontmatter.title) seoHealth.hasTitle++;
  if (d.frontmatter.description) seoHealth.hasDescription++;
  const kw = d.frontmatter.keywords;
  if (kw && !(Array.isArray(kw) && kw.length === 0)) seoHealth.hasKeywords++;
  if (d.frontmatter.slug) seoHealth.hasSlug++;
}

// ---------------------------------------------------------------------------
// Date analytics (freshness buckets based on file mtime)
// ---------------------------------------------------------------------------
const DAY_MS = 86_400_000;
const dateAnalytics = { fresh: 0, recent: 0, aging: 0, stale: 0 };
for (const d of docs) {
  const ageMs = nowMs - new Date(d.lastModified).getTime();
  const ageDays = ageMs / DAY_MS;
  if (ageDays < 30)       dateAnalytics.fresh++;
  else if (ageDays < 90)  dateAnalytics.recent++;
  else if (ageDays < 180) dateAnalytics.aging++;
  else                    dateAnalytics.stale++;
}

// lastReviewed coverage
const lastReviewedCount = docs.filter((d) => d.lastReviewed).length;

// Docs authored per month (by file mtime)
const modifiedByMonth = {};
for (const d of docs) {
  const date = new Date(d.lastModified);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  modifiedByMonth[key] = (modifiedByMonth[key] || 0) + 1;
}

// ---------------------------------------------------------------------------
// Load WCAG compliance data if available
// ---------------------------------------------------------------------------
let wcagData = null;
if (fs.existsSync(wcagReportPath)) {
  try {
    wcagData = JSON.parse(fs.readFileSync(wcagReportPath, 'utf-8'));
  } catch (err) {
    console.warn('[build-report] Warning: Could not parse WCAG report:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Load Epic release metrics if available
// ---------------------------------------------------------------------------
let epicReleaseMetricsData = null;
if (fs.existsSync(epicReleaseMetricsPath)) {
  try {
    epicReleaseMetricsData = JSON.parse(fs.readFileSync(epicReleaseMetricsPath, 'utf-8'));
  } catch (err) {
    console.warn('[build-report] Warning: Could not parse epic release metrics:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Load User satisfaction metrics if available
// ---------------------------------------------------------------------------
let userSatisfactionMetricsData = null;
if (fs.existsSync(userSatisfactionMetricsPath)) {
  try {
    userSatisfactionMetricsData = JSON.parse(fs.readFileSync(userSatisfactionMetricsPath, 'utf-8'));
  } catch (err) {
    console.warn('[build-report] Warning: Could not parse user satisfaction metrics:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Accessibility analytics
// ---------------------------------------------------------------------------
const a11yStats = {
  docsWithIssues: docs.filter((d) => d.hasA11yIssues).length,
  imgNoAlt: docs.reduce((sum, doc) => sum + (doc.a11yIssues.find((issue) => issue.type === 'img_no_alt')?.count || 0), 0),
  nonDescriptiveLinks: docs.reduce((sum, doc) => sum + (doc.a11yIssues.find((issue) => issue.type === 'non_descriptive_links')?.count || 0), 0),
  headingSkips: docs.reduce((sum, doc) => sum + (doc.a11yIssues.find((issue) => issue.type === 'heading_skips')?.count || 0), 0),
  emptyHeadings: docs.reduce((sum, doc) => sum + (doc.a11yIssues.find((issue) => issue.type === 'empty_headings')?.count || 0), 0),
  lowContrastText: docs.reduce((sum, doc) => sum + (doc.a11yIssues.find((issue) => issue.type === 'low_contrast_text')?.count || 0), 0),
  ...(wcagData ? {
    wcagCompliance: {
      wcagLevel: wcagData.wcagLevel,
      totalPages: wcagData.pageCount,
      pagesAnalyzed: wcagData.pageCount,
      totalViolations: wcagData.analysis?.totalViolations || 0,
      criticalErrors: wcagData.analysis?.criticalErrors || 0,
      warnings: wcagData.analysis?.warnings || 0,
      notices: wcagData.analysis?.notices || 0,
      levelBreakdown: wcagData.analysis?.levelBreakdown || {},
      topIssues: wcagData.analysis?.topIssues || [],
      recommendations: wcagData.recommendations || [],
      lastAnalyzed: wcagData.timestamp,
    }
  } : {
    wcagCompliance: {
      wcagLevel: 'unknown',
      status: 'Not analyzed. Run "node scripts/analyze-wcag-compliance.mjs" to generate WCAG report.',
    }
  })
};

// ---------------------------------------------------------------------------
// Build stability analytics
// ---------------------------------------------------------------------------
const slugCounts = {};
for (const doc of docs) {
  slugCounts[doc.url] = (slugCounts[doc.url] || 0) + 1;
}
const duplicateSlugs = Object.entries(slugCounts)
  .filter(([, count]) => count > 1)
  .map(([slug]) => slug)
  .sort();

const titleCounts = new Map();
for (const doc of docs) {
  const normalizedTitle = String(doc.title || '').trim().toLowerCase();
  if (!normalizedTitle) continue;
  const entry = titleCounts.get(normalizedTitle) || { title: doc.title, count: 0 };
  entry.count += 1;
  titleCounts.set(normalizedTitle, entry);
}
const duplicateTitles = [...titleCounts.values()]
  .filter((entry) => entry.count > 1)
  .map((entry) => entry.title)
  .sort((a, b) => a.localeCompare(b));

const buildStability = {
  duplicateSlugsCount: duplicateSlugs.length,
  brokenImageRefs: docs.reduce((sum, doc) => sum + doc.brokenImageRefs.length, 0),
  docsWithMissingRequired: docs.filter((doc) => doc.missingRequiredFields.length > 0).length,
  invalidDateFormats: docs.filter((doc) => doc.invalidDateFields.length > 0).length,
  duplicateTitlesCount: duplicateTitles.length,
  duplicateSlugs,
  duplicateTitles,
};

// ---------------------------------------------------------------------------
// Engineering Tests (ENG-07, ENG-09 extended, ENG-11, ENG-13, ENG-14)
// ---------------------------------------------------------------------------

// ENG-07: scan src/ JS/JSX/TS/TSX for bare browser-API usage without SSR guards
const ssrViolationFiles = [];
for (const srcFile of walkSrc(srcDir)) {
  try {
    const text = fs.readFileSync(srcFile, 'utf8');
    const viols = findSsrViolationsInFile(text);
    if (viols.length > 0) {
      ssrViolationFiles.push({
        file: path.relative(workspaceRoot, srcFile).replace(/\\/g, '/'),
        apis: viols,
      });
    }
  } catch { /* skip unreadable */ }
}

// ENG-09 extended: aggregate broken internal markdown links from docs/
const totalBrokenInternalLinks = docs.reduce((sum, d) => sum + (d.brokenInternalLinks?.length || 0), 0);
const docsWithBrokenLinks = docs.filter((d) => d.brokenInternalLinks?.length > 0);

// ENG-11: verify explicit doc IDs in sidebars.js exist in docs/
let sidebarOrphanedCount = 0;
const sidebarOrphanedIds = [];
try {
  const sidebarText = fs.readFileSync(sidebarPath, 'utf8');
  const docIdPattern = /['"]((?:[a-z0-9-]+\/)+[a-z0-9_-]+)['"](?=\s*[,\])}])/g;
  const allDocRelPaths = new Set(
    files.map((f) => path.relative(docsRoot, f).replace(/\\/g, '/').replace(/\.(mdx|md)$/, ''))
  );
  for (const match of sidebarText.matchAll(docIdPattern)) {
    const id = match[1];
    if (!allDocRelPaths.has(id)) {
      sidebarOrphanedIds.push(id);
      sidebarOrphanedCount++;
    }
  }
} catch { /* sidebars.js not found or unreadable */ }

// ENG-13: check if docusaurus.config.js sets a Content-Security-Policy header
let cspConfigured = false;
try {
  const configText = fs.readFileSync(docusaurusConfigPath, 'utf8');
  cspConfigured = /Content-Security-Policy|content-security-policy/i.test(configText);
} catch { /* config not found */ }

// ENG-14: dependency CVE audit via npm audit --json
let cveResult = { criticalCves: null, critical: null, high: null, moderate: null, low: null, error: 'not run' };
try {
  console.log('[build-report] Running npm audit for ENG-14 CVE check...');
  let auditOutput;
  try {
    auditOutput = execSync('npm audit --json', {
      cwd: workspaceRoot,
      timeout: 30_000,
      encoding: 'utf8',
    });
  } catch (e) {
    // npm audit exits non-zero when vulnerabilities are found; stdout still contains valid JSON
    auditOutput = typeof e.stdout === 'string' ? e.stdout : '';
    if (!auditOutput.trim()) throw new Error(String(e.message || 'npm audit produced no output'));
  }
  const auditData = JSON.parse(auditOutput);
  const v = auditData?.metadata?.vulnerabilities || {};
  cveResult = {
    criticalCves: (v.critical || 0) + (v.high || 0),
    critical: v.critical || 0,
    high: v.high || 0,
    moderate: v.moderate || 0,
    low: v.low || 0,
    error: null,
  };
} catch (e) {
  cveResult = { criticalCves: null, error: String(e.message || e).slice(0, 200) };
  console.warn(`[build-report] ENG-14 npm audit unavailable: ${cveResult.error}`);
}

function workflowHasPullRequestTrigger(workflowText) {
  return /\bon\s*:\s*[\s\S]*?\bpull_request\b/i.test(workflowText);
}

function workflowHasScheduledCron(workflowText) {
  return /\bschedule\s*:\s*\n[\s\S]*?\bcron\s*:/i.test(workflowText);
}

function workflowMentionsAutoIssue(workflowText) {
  return /create-issue|gh\s+issue\s+create|peter-evans\/create-issue-from-file/i.test(workflowText);
}

function getConfiguredLocales() {
  try {
    // docusaurus config is CommonJS in this repo
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const docusaurusConfig = require(docusaurusConfigPath);
    const locales = docusaurusConfig?.i18n?.locales;
    return Array.isArray(locales) ? locales : [];
  } catch {
    return [];
  }
}

function getGithubRepoSlug() {
  if (GITHUB_REPO) return GITHUB_REPO;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const docusaurusConfig = require(docusaurusConfigPath);
    const owner = docusaurusConfig?.organizationName;
    const repo = docusaurusConfig?.projectName;
    if (owner && repo) return `${owner}/${repo}`;
  } catch {
    // ignore
  }
  return '';
}

async function fetchJsonWithTimeout(url, token, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 180)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function getRunOutcome(run) {
  if (!run) {
    return { status: 'not_run', label: 'Not run yet' };
  }
  const status = String(run.status || '').toLowerCase();
  const conclusion = String(run.conclusion || '').toLowerCase();

  if (status !== 'completed') {
    return { status: 'in_progress', label: 'In progress' };
  }
  if (conclusion === 'success') {
    return { status: 'passed', label: 'Passed' };
  }
  if (conclusion === 'skipped' || conclusion === 'neutral') {
    return { status: 'neutral', label: conclusion || 'neutral' };
  }
  if (conclusion) {
    return { status: 'failed', label: conclusion };
  }
  return { status: 'unknown', label: 'Unknown' };
}

function computeRunDurationSeconds(run) {
  if (!run) return null;
  const started = run.run_started_at || run.created_at;
  const ended = run.updated_at || run.run_started_at;
  if (!started || !ended) return null;
  const startMs = Date.parse(started);
  const endMs = Date.parse(ended);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 1000);
}

async function fetchGithubGateRunStatus(gates) {
  const repoSlug = getGithubRepoSlug();
  if (!repoSlug || !GITHUB_TOKEN) {
    return {
      available: false,
      reason: 'Set GITHUB_TOKEN and GITHUB_REPO (or organizationName/projectName in docusaurus config).',
      byGate: {},
    };
  }

  const byGate = {};
  await Promise.all(gates.map(async (gate) => {
    const encodedFile = encodeURIComponent(gate.file);
    const url = `https://api.github.com/repos/${repoSlug}/actions/workflows/${encodedFile}/runs?per_page=1`;
    try {
      const data = await fetchJsonWithTimeout(url, GITHUB_TOKEN, GITHUB_API_TIMEOUT_MS);
      const run = Array.isArray(data?.workflow_runs) ? data.workflow_runs[0] : null;
      const outcome = getRunOutcome(run);
      byGate[gate.id] = {
        ...outcome,
        runId: run?.id ?? null,
        runUrl: run?.html_url ?? null,
        branch: run?.head_branch ?? null,
        event: run?.event ?? null,
        createdAt: run?.created_at ?? null,
        durationSec: computeRunDurationSeconds(run),
      };
    } catch (e) {
      byGate[gate.id] = {
        status: 'unavailable',
        label: 'Unavailable',
        error: String(e.message || e).slice(0, 180),
      };
    }
  }));

  return { available: true, reason: null, byGate, repoSlug };
}

const githubActionsGateStatus = GITHUB_ACTION_GATES.map((gate) => {
  const workflowPath = path.join(workflowsDir, gate.file);
  const exists = fs.existsSync(workflowPath);
  if (!exists) {
    return {
      ...gate,
      exists: false,
      hasPullRequest: false,
      hasSchedule: false,
      hasAutoIssue: false,
    };
  }

  let text = '';
  try {
    text = fs.readFileSync(workflowPath, 'utf8');
  } catch {
    text = '';
  }

  return {
    ...gate,
    exists: true,
    hasPullRequest: workflowHasPullRequestTrigger(text),
    hasSchedule: workflowHasScheduledCron(text),
    hasAutoIssue: workflowMentionsAutoIssue(text),
  };
});

const githubGateRunStatus = await fetchGithubGateRunStatus(GITHUB_ACTION_GATES);

const githubActionsGateStatusWithRuns = githubActionsGateStatus.map((gate) => ({
  ...gate,
  latestRun: githubGateRunStatus.byGate?.[gate.id] || {
    status: 'not_run',
    label: 'Not run yet',
  },
}));

const configuredLocales = getConfiguredLocales();
const hasNonEnglishLocales = configuredLocales.some((locale) => locale !== 'en');

const githubActionsSuggestedStatus = GITHUB_ACTION_SUGGESTED_GATES.map((gate) => {
  const targetPath = gate.isConfigFile
    ? path.join(workspaceRoot, gate.file)
    : path.join(workflowsDir, gate.file);
  return {
    ...gate,
    exists: fs.existsSync(targetPath),
    blockedByPrerequisite: !!gate.requiresLocales && !hasNonEnglishLocales,
  };
});

const githubActions = {
  workflowsDirPresent: fs.existsSync(workflowsDir),
  gateStatus: githubActionsGateStatusWithRuns,
  suggestedGateStatus: githubActionsSuggestedStatus,
  plannedGateCount: GITHUB_ACTION_GATES.length,
  configuredGateCount: githubActionsGateStatusWithRuns.filter((g) => g.exists).length,
  pullRequestGateCount: githubActionsGateStatusWithRuns.filter((g) => g.exists && g.hasPullRequest).length,
  nightlyScheduled: githubActionsGateStatusWithRuns.some((g) => g.id === 'ENG-09' && g.exists && g.hasSchedule),
  weeklyScheduled: githubActionsGateStatusWithRuns.some((g) => g.id === 'ENG-14' && g.exists && g.hasSchedule),
  autoIssueEnabledCount: githubActionsGateStatusWithRuns.filter((g) => g.exists && g.hasAutoIssue).length,
  suggestedConfiguredCount: githubActionsSuggestedStatus.filter((g) => g.exists).length,
  runStatusAvailable: githubGateRunStatus.available,
  runStatusRepo: githubGateRunStatus.repoSlug || null,
  runStatusReason: githubGateRunStatus.reason || null,
  runPassedCount: githubActionsGateStatusWithRuns.filter((g) => g.latestRun?.status === 'passed').length,
  runFailedCount: githubActionsGateStatusWithRuns.filter((g) => g.latestRun?.status === 'failed').length,
  runInProgressCount: githubActionsGateStatusWithRuns.filter((g) => g.latestRun?.status === 'in_progress').length,
  runUnknownCount: githubActionsGateStatusWithRuns.filter((g) => ['unknown', 'unavailable', 'not_run'].includes(g.latestRun?.status)).length,
  branchProtectionScriptPresent: fs.existsSync(branchProtectionScriptPath),
  copilotInstructionsPresent: fs.existsSync(copilotInstructionsPath),
  localeCount: configuredLocales.length,
  hasNonEnglishLocales,
  i18nPlaceholderReady: hasNonEnglishLocales,
  requiredChecksTarget: 7,
};

const engineeringTests = {
  // ENG-07: SSR/hydration guard violations in src/
  ssrGuardViolations: ssrViolationFiles.length,
  ssrViolationFiles,
  // ENG-09 extended: broken relative markdown links in docs/
  brokenInternalLinks: totalBrokenInternalLinks,
  docsWithBrokenLinks: docsWithBrokenLinks.length,
  brokenLinkDetail: docsWithBrokenLinks
    .slice(0, 20)
    .map((d) => ({ path: d.filePath, links: d.brokenInternalLinks })),
  // ENG-11: sidebar doc IDs with no matching file
  sidebarOrphanedDocs: sidebarOrphanedCount,
  sidebarOrphanedIds,
  // ENG-13: CSP header present in Docusaurus config
  cspConfigured,
  // ENG-14: npm audit high/critical CVE count
  criticalCves: cveResult.criticalCves,
  cveBreakdown: cveResult.error ? null : {
    critical: cveResult.critical,
    high: cveResult.high,
    moderate: cveResult.moderate,
    low: cveResult.low,
  },
  cveError: cveResult.error,
  githubActions,
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const report = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  version: '1.0.0',
  aggregate: {
    totalDocs,
    totalWords,
    avgWords,
    avgCompleteness,
    guessing: {
      totalGuessedFields: totalGuessed,
      docsWithGuesses,
    },
    placeholders: {
      docsWithPlaceholders,
      byField: placeholderFieldCounts,
    },
    fieldCoverage,
    fieldCoveragePercent,
    taxonomy,
    seoHealth,
    sections: sectionCounts,
    a11yStats,
    epicReleaseMetrics: epicReleaseMetricsData ? {
      skipped: !!epicReleaseMetricsData.skipped,
      epicKey: epicReleaseMetricsData.epicKey || epicReleaseMetricsData.metrics?.epic?.key || null,
      releaseFixVersion: epicReleaseMetricsData.releaseFixVersion || epicReleaseMetricsData.metrics?.epic?.releaseFixVersion || null,
      metrics: epicReleaseMetricsData.metrics || null,
      releaseGate: epicReleaseMetricsData.releaseGate || null,
      sites: epicReleaseMetricsData.sites || [],
      generatedAt: epicReleaseMetricsData.generatedAt || null,
      reason: epicReleaseMetricsData.reason || null,
    } : {
      skipped: true,
      reason: 'No epic release metrics found. Run "npm run epic-metrics" with EPIC_KEY and Jira env vars.',
    },
    userSatisfactionMetrics: userSatisfactionMetricsData ? {
      window: userSatisfactionMetricsData.metrics?.window || null,
      summary: userSatisfactionMetricsData.metrics?.summary || null,
      engagement: userSatisfactionMetricsData.metrics?.engagement || null,
      navigation: userSatisfactionMetricsData.metrics?.navigation || null,
      performance: userSatisfactionMetricsData.metrics?.performance || null,
      ces: userSatisfactionMetricsData.metrics?.ces || null,
      generatedAt: userSatisfactionMetricsData.timestamp || null,
    } : {
      skipped: true,
      reason: 'No user satisfaction metrics found. Run "npm run user-satisfaction-metrics" after client-side events are collected.',
    },
    buildStability,
    engineeringTests,
    dateAnalytics: {
      ...dateAnalytics,
      lastReviewedCount,
      lastReviewedPercent: totalDocs > 0
        ? Number((lastReviewedCount / totalDocs).toFixed(2))
        : 0,
      modifiedByMonth,
    },
  },
  dashboardConfig: {
    sourceFile: path.basename(configPath),
    trackedFields: configFields.map((field) => ({
      key: field.key,
      label: field.label,
      required: field.required,
      isArray: field.isArray,
      chartType: field.chartType,
    })),
    taxonomyFields,
    dashboardTiles: dashboardConfig.dashboardTiles || {},
  },
  docs,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

console.log(`[build-report] ${totalDocs} docs processed → ${outputPath}`);
console.log(`[build-report] avg completeness: ${(avgCompleteness * 100).toFixed(0)}%`);
console.log(`[build-report] guessed fields: ${totalGuessed} across ${docsWithGuesses} docs`);
console.log(`[build-report] placeholder warnings: ${docsWithPlaceholders} docs`);
