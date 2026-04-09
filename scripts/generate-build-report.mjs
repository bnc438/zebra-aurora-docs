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
  // Skip placeholder patterns like [YYYY-MM-DD]
  if (/\[/.test(value) || /TODO|TBD/i.test(value)) return null;
  const ts = Date.parse(value.trim());
  return Number.isNaN(ts) ? null : ts;
}

// ---------------------------------------------------------------------------
// UX Metrics: Microsoft Clarity section
// ---------------------------------------------------------------------------
const DAY_MS = 86_400_000; // milliseconds in one day (shared with freshness buckets below)
/**
 * Fetches UX metrics from the Microsoft Clarity Export API.
 * Requires env vars: CLARITY_API_KEY, CLARITY_PROJECT_ID.
 * Falls back to static mock seed data when env vars are absent or the API fails.
 *
 * @returns {Promise<object>} Clarity metrics object.
 */
async function buildClaritySection() {
  const apiKey   = process.env.CLARITY_API_KEY;
  const projectId = process.env.CLARITY_PROJECT_ID;

  if (apiKey && projectId) {
    try {
      const endDate   = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
      const url =
        `https://www.clarity.ms/export/api/v1/${projectId}/metrics` +
        `?startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        sessions:           data.totalSessions       ?? 0,
        pageViews:          data.totalPageViews       ?? 0,
        rageClicks:         data.totalRageClicks      ?? 0,
        deadClicks:         data.totalDeadClicks      ?? 0,
        avgScrollDepth:     data.averageScrollDepth   ?? 0,
        avgSessionDuration: data.averageSessionDuration ?? 0,
        pagesPerSession:    data.pagesPerSession ?? 0,
        topPages:           Array.isArray(data.topPages) ? data.topPages : [],
        hasMockData:        false,
        fetchedAt:          new Date().toISOString(),
        dateRange:          { startDate, endDate },
      };
    } catch (err) {
      console.warn(`[build-report] Clarity API error: ${err.message} — using mock data`);
    }
  } else {
    console.log('[build-report] CLARITY_API_KEY / CLARITY_PROJECT_ID not set — using mock Clarity data');
  }

  // Mock seed data — representative of a small technical-documentation site.
  return {
    sessions:           1240,
    pageViews:          3870,
    rageClicks:         47,
    deadClicks:         83,
    avgScrollDepth:     62,
    avgSessionDuration: 184,
    pagesPerSession:    3.1,
    topPages: [
      { url: '/docs/aurora-js-about-this-guide', views: 410 },
      { url: '/docs/licensing',                  views: 287 },
      { url: '/docs/aurora-js-getting-started',  views: 198 },
      { url: '/docs/release-notes',              views: 162 },
      { url: '/docs/aurora-js-barcode-reading',  views: 124 },
    ],
    hasMockData: true,
    fetchedAt:   null,
    dateRange:   null,
  };
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
// JIRA section — live fetch when env vars present, otherwise mock seed data
// ---------------------------------------------------------------------------
// Regex for extracting JIRA ticket keys from PR titles/bodies
const JIRA_TICKET_RE = /([A-Z]+-\d+)/g;
/**
 * buildJiraSection()
 *
 * When JIRA_BASE_URL + JIRA_TOKEN + JIRA_EPIC_KEY are all set, this function
 * calls the JIRA REST API v3 to retrieve real epic + ticket data and optionally
 * the GitHub API to build the PR↔ticket linkage table.
 *
 * When the env vars are absent it returns deterministic mock data so the
 * dashboard UI is fully functional and reviewable without any credentials.
 *
 * Shape returned:
 * {
 *   isMock: boolean,
 *   epic: { key, summary, status, startDate, dueDate },
 *   tickets: { open, inProgress, done, total },
 *   velocity: number,          // tickets closed per week (last 4 weeks)
 *   jiraLinks: Array<{         // JIRA ↔ PR ↔ files table rows
 *     jiraKey, summary, status, prNumber, prTitle, prUrl, files
 *   }>,
 *   serviceRequest: {          // placeholder — wire to JQL in the future
 *     isMock: true,
 *     srAvgDays: null,
 *     srCount: null,
 *     srP95Days: null,
 *   },
 * }
 */
async function buildJiraSection(config) {
  const { jiraBaseUrl, projectKey, epicKey, ghOwner, ghRepo } = config?.jira || {};
  const jiraToken = process.env.JIRA_TOKEN || '';
  const jiraEmail = process.env.JIRA_EMAIL || '';
  const ghToken   = process.env.GH_TOKEN   || '';

  const canUseLive = jiraBaseUrl && jiraToken && jiraEmail && epicKey;

  // ── Shared service-request placeholder (always mock for now) ──────────────
  const serviceRequest = {
    isMock: true,
    srAvgDays: null,
    srCount: null,
    srP95Days: null,
    note: "Connect JIRA JQL filter `type = 'Service Request'` to populate",
  };

  if (!canUseLive) {
    // ── Mock seed data ────────────────────────────────────────────────────────
    const today = new Date();
    const epicStart = new Date(today);
    epicStart.setDate(today.getDate() - 28);
    const epicDue   = new Date(today);
    epicDue.setDate(today.getDate() + 14);

    return {
      isMock: true,
      epic: {
        key:       epicKey || `${projectKey || 'AURORA'}-42`,
        summary:   'Q2 Documentation Sprint',
        status:    'In Progress',
        startDate: epicStart.toISOString().slice(0, 10),
        dueDate:   epicDue.toISOString().slice(0, 10),
      },
      tickets: { open: 8, inProgress: 5, done: 12, total: 25 },
      velocity: 3,
      jiraLinks: [
        {
          jiraKey: `${projectKey || 'AURORA'}-43`,
          summary: 'Update licensing documentation',
          status:  'In Progress',
          jiraUrl:  null,
          prNumber: 87,
          prTitle: 'docs: update licensing page',
          prUrl:   `https://github.com/${ghOwner || 'org'}/${ghRepo || 'repo'}/pull/87`,
          files:   ['docs/licensing/overview.mdx', 'docs/licensing/faq.md'],
        },
        {
          jiraKey: `${projectKey || 'AURORA'}-44`,
          summary: 'Add SDK quick-start guide',
          status:  'Done',
          jiraUrl:  null,
          prNumber: 91,
          prTitle: 'docs: sdk quick-start',
          prUrl:   `https://github.com/${ghOwner || 'org'}/${ghRepo || 'repo'}/pull/91`,
          files:   ['docs/sdk/quickstart.mdx'],
        },
        {
          jiraKey: `${projectKey || 'AURORA'}-45`,
          summary: 'Refresh API reference for v3',
          status:  'Open',
          jiraUrl:  null,
          prNumber: null,
          prTitle: null,
          prUrl:   null,
          files:   [],
        },
        {
          jiraKey: `${projectKey || 'AURORA'}-46`,
          summary: 'Fix broken anchors in security guide',
          status:  'Done',
          jiraUrl:  null,
          prNumber: 94,
          prTitle: 'fix: broken anchors in security guide',
          prUrl:   `https://github.com/${ghOwner || 'org'}/${ghRepo || 'repo'}/pull/94`,
          files:   ['docs/security/index.mdx', 'docs/security/hardening.md'],
        },
        {
          jiraKey: `${projectKey || 'AURORA'}-47`,
          summary: 'Add glossary for scanner terminology',
          status:  'Open',
          jiraUrl:  null,
          prNumber: null,
          prTitle: null,
          prUrl:   null,
          files:   [],
        },
      ],
      serviceRequest,
    };
  }

  // ── Live JIRA fetch ───────────────────────────────────────────────────────
  const authHeader = `Basic ${Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64')}`;
  const headers    = { Authorization: authHeader, Accept: 'application/json' };

  async function jiraGet(path) {
    const res = await fetch(`${jiraBaseUrl}/rest/api/3/${path}`, { headers });
    if (!res.ok) throw new Error(`JIRA ${path}: HTTP ${res.status}`);
    return res.json();
  }

  // Epic details
  const epicIssue = await jiraGet(`issue/${epicKey}?fields=summary,status,customfield_10015,duedate`);
  const epicData  = {
    key:       epicKey,
    summary:   epicIssue.fields.summary,
    status:    epicIssue.fields.status?.name || 'Unknown',
    startDate: epicIssue.fields.customfield_10015 || null,
    dueDate:   epicIssue.fields.duedate || null,
  };

  // Tickets in epic (JQL)
  const jql = encodeURIComponent(`"Epic Link" = ${epicKey} OR parent = ${epicKey}`);
  const searchResult = await jiraGet(`search?jql=${jql}&maxResults=200&fields=summary,status,resolutiondate`);
  const allTickets   = searchResult.issues || [];

  const ticketCounts = { open: 0, inProgress: 0, done: 0, total: allTickets.length };
  const now30 = Date.now() - 28 * 86_400_000;
  let closedLast4w = 0;
  for (const t of allTickets) {
    const cat = t.fields.status?.statusCategory?.name || '';
    if      (cat === 'Done')        { ticketCounts.done++; }
    else if (cat === 'In Progress') { ticketCounts.inProgress++; }
    else                            { ticketCounts.open++; }
    if (t.fields.resolutiondate && new Date(t.fields.resolutiondate).getTime() > now30) {
      closedLast4w++;
    }
  }
  const velocity = Number((closedLast4w / 4).toFixed(1));

  // JIRA ↔ PR linkage via GitHub API (optional)
  const jiraLinks = [];
  if (ghOwner && ghRepo && ghToken) {
    const ghHeaders = { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github+json' };
    const prsRes = await fetch(
      `https://api.github.com/repos/${ghOwner}/${ghRepo}/pulls?state=all&per_page=100`,
      { headers: ghHeaders }
    );
    if (prsRes.ok) {
      const prs = await prsRes.json();
      // Build a map of ticket key → JIRA details from the already-fetched epic tickets
      const ticketCache = {};
      for (const t of allTickets) {
        ticketCache[t.key] = {
          summary: t.fields.summary,
          status:  t.fields.status?.name || 'Unknown',
        };
      }
      for (const pr of prs) {
        const body  = `${pr.title || ''} ${pr.body || ''}`;
        // Reset lastIndex before each use since the regex is stateful
        JIRA_TICKET_RE.lastIndex = 0;
        const keys  = [...new Set([...body.matchAll(JIRA_TICKET_RE)].map((m) => m[1]))];
        if (!keys.length) continue;
        const filesRes = await fetch(
          `https://api.github.com/repos/${ghOwner}/${ghRepo}/pulls/${pr.number}/files`,
          { headers: ghHeaders }
        );
        const changedFiles = filesRes.ok
          ? (await filesRes.json()).map((f) => f.filename)
          : [];
        for (const key of keys) {
          // Use cached details; fall back to a single API call only for tickets outside the epic
          let summary = key;
          let status  = 'Unknown';
          if (ticketCache[key]) {
            ({ summary, status } = ticketCache[key]);
          } else {
            try {
              const issue = await jiraGet(`issue/${key}?fields=summary,status`);
              summary = issue.fields.summary;
              status  = issue.fields.status?.name || 'Unknown';
              ticketCache[key] = { summary, status };
            } catch { /* skip if ticket not accessible */ }
          }
          jiraLinks.push({
            jiraKey:  key,
            summary,
            status,
            jiraUrl:  `${jiraBaseUrl}/browse/${key}`,
            prNumber: pr.number,
            prTitle:  pr.title,
            prUrl:    pr.html_url,
            files:    changedFiles,
          });
        }
      }
    }
  }

  return { isMock: false, epic: epicData, tickets: ticketCounts, velocity, jiraLinks, serviceRequest };
}

// ---------------------------------------------------------------------------
// Clarity / UX Metrics section — live fetch or mock seed data
// ---------------------------------------------------------------------------
/**
 * buildClaritySection(config)
 *
 * When CLARITY_API_KEY + CLARITY_PROJECT_ID are set, fetches live UX metrics
 * from the Microsoft Clarity Data Export API.  Otherwise returns mock seed data.
 *
 * Shape returned:
 * {
 *   isMock: boolean,
 *   sessions: number,
 *   avgSessionDurationSec: number,
 *   rageClickRate: number,       // 0–1 fraction
 *   deadClickRate: number,       // 0–1 fraction
 *   clickBackRate: number,       // 0–1 fraction
 *   jsErrorCount: number,
 *   scrollDepth: { d25: number, d50: number, d75: number, d100: number }, // fractions
 *   rageClickPages: Array<{ url: string, count: number }>,
 * }
 */
async function buildClaritySection(config) {
  const { clarityProjectId, clarityApiKey } = config?.clarity || {};
  const canUseLive = clarityProjectId && clarityApiKey;

  if (!canUseLive) {
    return {
      isMock: true,
      sessions: 3842,
      avgSessionDurationSec: 127,
      rageClickRate: 0.034,
      deadClickRate: 0.089,
      clickBackRate: 0.112,
      jsErrorCount: 7,
      scrollDepth: { d25: 0.91, d50: 0.72, d75: 0.48, d100: 0.23 },
      rageClickPages: [
        { url: '/docs/sdk/quickstart',      count: 18 },
        { url: '/docs/security/hardening',  count: 11 },
        { url: '/docs/api/reference',       count:  9 },
        { url: '/docs/licensing/overview',  count:  6 },
        { url: '/docs/getting-started',     count:  4 },
      ],
    };
  }

  // ── Live Clarity Data Export API ──────────────────────────────────────────
  // Reference: https://learn.microsoft.com/en-us/clarity/data-export/clarity-data-export-api
  const baseUrl = `https://www.clarity.ms/export-data/api/v1`;
  const authHeaders = { 'Authorization': `Bearer ${clarityApiKey}`, 'Accept': 'application/json' };
  const endDate   = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  async function clarityGet(endpoint) {
    const res = await fetch(`${baseUrl}/${endpoint}`, { headers: authHeaders });
    if (!res.ok) throw new Error(`Clarity ${endpoint}: HTTP ${res.status}`);
    return res.json();
  }

  const [summary, scrollData, rageData] = await Promise.all([
    clarityGet(`project/${clarityProjectId}/summary?startDate=${startDate}&endDate=${endDate}`),
    clarityGet(`project/${clarityProjectId}/scroll-depth?startDate=${startDate}&endDate=${endDate}`),
    clarityGet(`project/${clarityProjectId}/rage-clicks?startDate=${startDate}&endDate=${endDate}&top=5`),
  ]);

  const totalSessions = summary.totalSessionCount || 0;
  return {
    isMock: false,
    sessions:             totalSessions,
    avgSessionDurationSec: Math.round(summary.avgSessionDurationMs / 1000) || 0,
    rageClickRate:        totalSessions > 0 ? (summary.rageClickCount || 0) / totalSessions : 0,
    deadClickRate:        totalSessions > 0 ? (summary.deadClickCount || 0) / totalSessions : 0,
    clickBackRate:        totalSessions > 0 ? (summary.clickBackCount || 0) / totalSessions : 0,
    jsErrorCount:         summary.jsErrorCount || 0,
    scrollDepth: {
      d25:  scrollData.d25  ?? 0,
      d50:  scrollData.d50  ?? 0,
      d75:  scrollData.d75  ?? 0,
      d100: scrollData.d100 ?? 0,
    },
    rageClickPages: (rageData.pages || []).map((p) => ({ url: p.url, count: p.count })),
  };
}
// Clarity (UX metrics)
// ---------------------------------------------------------------------------
const clarity = await buildClaritySection();

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const jira    = await buildJiraSection(dashboardConfig);
const clarity = await buildClaritySection(dashboardConfig);

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
    dateAnalytics: {
      ...dateAnalytics,
      lastReviewedCount,
      lastReviewedPercent: totalDocs > 0
        ? Number((lastReviewedCount / totalDocs).toFixed(2))
        : 0,
      modifiedByMonth,
    },
  },
  jira,
  clarity,
  docs,
  clarity,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

console.log(`[build-report] ${totalDocs} docs processed → ${outputPath}`);
console.log(`[build-report] avg completeness: ${(avgCompleteness * 100).toFixed(0)}%`);
console.log(`[build-report] guessed fields: ${totalGuessed} across ${docsWithGuesses} docs`);
console.log(`[build-report] placeholder warnings: ${docsWithPlaceholders} docs`);
console.log(`[build-report] JIRA section: ${jira.isMock ? 'mock data' : 'live'}`);
console.log(`[build-report] Clarity section: ${clarity.isMock ? 'mock data' : 'live'}`);
console.log(`[build-report] clarity: ${clarity.hasMockData ? 'mock data' : `live (${clarity.sessions} sessions)`}`);
