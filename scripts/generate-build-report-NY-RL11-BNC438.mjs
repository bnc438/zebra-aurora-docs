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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

const workspaceRoot = path.resolve(__dirname, '..');
const docsRoot = path.join(workspaceRoot, 'docs');
const outputPath = path.join(workspaceRoot, 'static', 'build-report.json');
const configPath = path.join(workspaceRoot, 'dashboard.config.js');

// ---------------------------------------------------------------------------
// Load dashboard config (graceful fallback if absent)
// ---------------------------------------------------------------------------
let dashboardConfig;
try {
  dashboardConfig = require(configPath);
} catch {
  dashboardConfig = { fields: [], placeholderPattern: /\[.*?\]|TODO|TBD/i, taxonomyFields: [] };
}

const {
  fields: configFields,
  placeholderPattern,
  taxonomyFields,
  dashboardTiles = {},
} = dashboardConfig;

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
// Accessibility (a11y) static analysis
// ---------------------------------------------------------------------------
/**
 * Analyse a doc body for common accessibility issues detectable via static
 * analysis: missing image alt text, non-descriptive link text, heading skips.
 */
export function analyzeA11y(body) {
  const issues = [];

  // Images with empty alt text: ![](url) or ![ ](url)
  const imgNoAlt = (body.match(/!\[\s*\]\([^)]+\)/g) || []).length;
  if (imgNoAlt > 0) issues.push({ type: 'img_no_alt', count: imgNoAlt });

  // Non-descriptive link text: [here](…) [click here](…) [learn more](…) etc.
  const genericLinks = (
    body.match(/\[(click here|here|this|more|learn more|read more|link|click|details|info)\]\([^)]+\)/gi) || []
  ).length;
  if (genericLinks > 0) issues.push({ type: 'non_descriptive_link', count: genericLinks });

  // Heading level skips (e.g. ## → #### without ### in between)
  const headingLevels = [...body.matchAll(/^(#{1,6})\s+\S/gm)].map((m) => m[1].length);
  let skips = 0;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) skips++;
  }
  if (skips > 0) issues.push({ type: 'heading_skip', count: skips });

  // Empty headings: a heading marker with no following text
  const emptyHeadings = (body.match(/^#{1,6}\s*$/gm) || []).length;
  if (emptyHeadings > 0) issues.push({ type: 'empty_heading', count: emptyHeadings });

  return issues;
}

// ---------------------------------------------------------------------------
// Build stability analysis (per-doc)
// ---------------------------------------------------------------------------
/**
 * Detect per-doc issues that affect build stability or final correctness:
 * missing required frontmatter, broken relative image refs, invalid dates.
 */
export function analyzeBuildStability(frontMatter, body, filePath) {
  const issues = [];

  // Missing required frontmatter fields
  const missingRequired = configFields
    .filter((f) => f.required)
    .filter((f) => {
      const val = frontMatter[f.key];
      return val === undefined || val === null || val === '' ||
        (Array.isArray(val) && val.length === 0);
    })
    .map((f) => f.key);
  if (missingRequired.length > 0) {
    issues.push({ type: 'missing_required', fields: missingRequired });
  }

  // Broken relative image references (./path or ../path only)
  const relImgMatches = [...body.matchAll(/!\[[^\]]*\]\((\.\.\/[^)\s#?]+|\.\.[^/][^)\s#?]*|\.[\/][^)\s#?]+)/g)];
  for (const m of relImgMatches) {
    const ref = m[1];
    const resolved = path.resolve(path.dirname(filePath), ref);
    if (!fs.existsSync(resolved)) {
      issues.push({ type: 'broken_image_ref', path: ref });
    }
  }

  // Invalid date format in last_reviewed (must be YYYY-MM-DD)
  const lr = frontMatter.last_reviewed;
  if (
    lr && typeof lr === 'string' &&
    !/\[/.test(lr) && !/TODO|TBD/i.test(lr) &&
    !/^\d{4}-\d{2}-\d{2}$/.test(lr.trim())
  ) {
    issues.push({ type: 'invalid_date_format', field: 'last_reviewed', value: String(lr).slice(0, 40) });
  }

  return issues;
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
  // Skip placeholder patterns like [YYYY-MM-DD]
  if (/\[/.test(value) || /TODO|TBD/i.test(value)) return null;
  const ts = Date.parse(value.trim());
  return Number.isNaN(ts) ? null : ts;
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
  const a11yIssues = analyzeA11y(body);
  const buildIssues = analyzeBuildStability(frontMatter, body, filePath);
  const guesses = buildGuesses(frontMatter, filePath, body);
  const completenessScore = scoreCompleteness(frontMatter, guesses);
  const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

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
    /** Static accessibility issues found in the doc body. */
    a11yIssues,
    hasA11yIssues: a11yIssues.length > 0,
    /** Build stability issues: missing required fields, broken refs, invalid dates. */
    buildIssues,
    hasBuildIssues: buildIssues.length > 0,
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
// Accessibility aggregate stats
// ---------------------------------------------------------------------------
const a11yStats = {
  docsWithIssues: docs.filter((d) => d.hasA11yIssues).length,
  imgNoAlt: docs.reduce((s, d) => {
    const issue = d.a11yIssues.find((i) => i.type === 'img_no_alt');
    return s + (issue?.count || 0);
  }, 0),
  nonDescriptiveLinks: docs.reduce((s, d) => {
    const issue = d.a11yIssues.find((i) => i.type === 'non_descriptive_link');
    return s + (issue?.count || 0);
  }, 0),
  headingSkips: docs.reduce((s, d) => {
    const issue = d.a11yIssues.find((i) => i.type === 'heading_skip');
    return s + (issue?.count || 0);
  }, 0),
  emptyHeadings: docs.reduce((s, d) => {
    const issue = d.a11yIssues.find((i) => i.type === 'empty_heading');
    return s + (issue?.count || 0);
  }, 0),
};

// ---------------------------------------------------------------------------
// Build stability aggregate stats
// ---------------------------------------------------------------------------
const urlFreq = {};
for (const d of docs) {
  const u = d.url;
  urlFreq[u] = (urlFreq[u] || 0) + 1;
}
const duplicateSlugs = Object.entries(urlFreq)
  .filter(([, c]) => c > 1)
  .map(([u]) => u);

const titleFreq = {};
for (const d of docs) {
  const t = (d.title || '').trim().toLowerCase();
  if (t) titleFreq[t] = (titleFreq[t] || 0) + 1;
}
const duplicateTitles = Object.entries(titleFreq)
  .filter(([, c]) => c > 1)
  .map(([t]) => t);

const buildStability = {
  docsWithIssues: docs.filter((d) => d.hasBuildIssues).length,
  docsWithMissingRequired: docs.filter((d) =>
    d.buildIssues.some((i) => i.type === 'missing_required')
  ).length,
  brokenImageRefs: docs.filter((d) =>
    d.buildIssues.some((i) => i.type === 'broken_image_ref')
  ).length,
  invalidDateFormats: docs.filter((d) =>
    d.buildIssues.some((i) => i.type === 'invalid_date_format')
  ).length,
  duplicateSlugsCount: duplicateSlugs.length,
  duplicateSlugs: duplicateSlugs.slice(0, 20),
  duplicateTitlesCount: duplicateTitles.length,
  duplicateTitles: duplicateTitles.slice(0, 10),
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const report = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  version: '1.0.0',
  dashboardConfig: {
    sourceFile: 'dashboard.config.js',
    trackedFields: configFields,
    taxonomyFields,
    dashboardTiles,
    placeholderPattern: placeholderPattern?.source || String(placeholderPattern),
  },
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
    dateAnalytics: {
      ...dateAnalytics,
      lastReviewedCount,
      lastReviewedPercent: totalDocs > 0
        ? Number((lastReviewedCount / totalDocs).toFixed(2))
        : 0,
      modifiedByMonth,
    },
    a11yStats,
    buildStability,
  },
  docs,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

console.log(`[build-report] ${totalDocs} docs processed → ${outputPath}`);
console.log(`[build-report] avg completeness: ${(avgCompleteness * 100).toFixed(0)}%`);
console.log(`[build-report] guessed fields: ${totalGuessed} across ${docsWithGuesses} docs`);
console.log(`[build-report] placeholder warnings: ${docsWithPlaceholders} docs`);
