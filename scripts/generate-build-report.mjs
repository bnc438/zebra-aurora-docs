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
  if (/deploy|job/i.test(text) && !/deploy.*build/i.test(text)) cases.push('Job Deployment');
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
// Main: process all docs
// ---------------------------------------------------------------------------
const files = walk(docsRoot);
const docs = [];

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

  docs.push({
    filePath: relPath,
    url,
    title,
    section,
    wordCount,
    completenessScore,
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

// SEO health
const seoHealth = {
  hasTitle:       docs.filter((d) => !!d.frontmatter.title).length,
  hasDescription: docs.filter((d) => !!d.frontmatter.description).length,
  hasKeywords:    docs.filter((d) => {
    const kw = d.frontmatter.keywords;
    return kw && !(Array.isArray(kw) && kw.length === 0);
  }).length,
  hasSlug:        docs.filter((d) => !!d.frontmatter.slug).length,
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const report = {
  generatedAt: new Date().toISOString(),
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
  },
  docs,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

console.log(`[build-report] ${totalDocs} docs processed → ${outputPath}`);
console.log(`[build-report] avg completeness: ${(avgCompleteness * 100).toFixed(0)}%`);
console.log(`[build-report] guessed fields: ${totalGuessed} across ${docsWithGuesses} docs`);
console.log(`[build-report] placeholder warnings: ${docsWithPlaceholders} docs`);
