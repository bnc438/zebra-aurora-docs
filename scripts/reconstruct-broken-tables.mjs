#!/usr/bin/env node
/**
 * PASS-04: Broken Table Reconstruction
 * Reconstructs DITA <simpletable>/<table> content that was converted to plain text
 * back into proper Markdown pipe-delimited tables.
 *
 * Pattern detected: consecutive header words (e.g. "Setting\nDescription") followed
 * by alternating key/description blocks separated by blank lines.
 *
 * Usage:
 *   node scripts/reconstruct-broken-tables.mjs              # dry-run
 *   node scripts/reconstruct-broken-tables.mjs --apply       # apply changes
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const USER_GUIDE = join(ROOT, 'docs', 'user-guide');
const CHANGELOG = join(ROOT, 'static', 'reconstruct-tables-changelog.json');

const DRY_RUN = !process.argv.includes('--apply');

// ── Known header pairs ──────────────────────────────────────────────────────
const HEADER_WORDS = new Set([
  'Item', 'Description', 'Setting', 'Settings', 'Parameter', 'Value',
  'Command', 'Response', 'Problem', 'Solution', 'Section', 'Argument',
  'Optional', 'Feature', 'Function', 'Mode', 'Type', 'Name', 'Format',
  'Status', 'Result', 'Action', 'Condition', 'Option', 'Details', 'Field',
]);

// Words that start a description sentence (NOT a row key)
const DESCRIPTION_STARTERS = /^(This |The |A |An |Use |Select |Enable |Displays? |Provides? |Determines? |Configure |When |If |For |Perform |Force |Open |Assign |Activate |View the |Observe |Switch |Reboot |Disconnect |Buffer |Run the |Type `|Depending |While |Enabling |It |You |To |In |On |Upon |- |Sets? |Shows? |Allows? |Indicates? |Specifies? |Controls? |Defines? |Creates? |Lists? |Adjusts? |Enter |Click |Drag |Navigate |Tap |Press |Check |Uncheck |Clear |Specify |Upload |Download |Deploy |Start |Stop |Manage |Update |Delete |Remove |Add |Edit |Save |Cancel |Close |Expand |Collapse |Verify |Confirm |Accept |Reject |Scan |Read |Write |Send |Receive )/i;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function walkMdx(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files = files.concat(await walkMdx(full));
    else if (e.name.endsWith('.mdx')) files.push(full);
  }
  return files;
}

function getBody(content) {
  const norm = content.replace(/\r\n/g, '\n');
  const m = norm.match(/^---\n[\s\S]*?\n---\n/);
  return m ? norm.slice(m[0].length) : norm;
}

function getFrontmatter(content) {
  const norm = content.replace(/\r\n/g, '\n');
  const m = norm.match(/^---\n[\s\S]*?\n---\n/);
  return m ? m[0] : '';
}

/**
 * Determine if a line looks like a table row key (setting name / parameter name).
 * Row keys are short noun phrases in Title Case.
 */
function isRowKey(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return false;
  if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('#')) return false;
  if (trimmed.startsWith('|')) return false;
  if (trimmed.startsWith(':::')) return false;
  if (trimmed.startsWith('```')) return false;
  if (trimmed.startsWith('![')) return false;
  // If it's clearly a sentence / description line, it's not a key
  if (DESCRIPTION_STARTERS.test(trimmed)) return false;
  // Check for sentence endings — keys usually don't end with period, but descriptions do
  // Exception: abbreviations like "ms." or single-word values
  if (trimmed.endsWith('.') && trimmed.length > 30) return false;
  // Lines that are just commas or conjunctions (fragmented sentences)
  if (/^[,;:]$/.test(trimmed)) return false;
  if (/^(and|or|but|with|from|to|of|in|on|at|by|for|per)$/i.test(trimmed)) return false;
  return true;
}

/**
 * Escape pipe characters in cell content for Markdown tables.
 */
function escapeCell(text) {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

/**
 * Find all broken table regions in a file body.
 * Returns array of { startLine, endLine, headers, rows } objects.
 */
function findBrokenTables(body) {
  const lines = body.split('\n');
  const tables = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const curr = lines[i].trim();
    const next = lines[i + 1].trim();

    // Look for consecutive header words
    if (!HEADER_WORDS.has(curr) || !HEADER_WORDS.has(next)) continue;
    if (lines[i].includes('|') || lines[i].startsWith('#')) continue;

    // Collect any additional header words
    const headers = [curr, next];
    let j = i + 2;
    while (j < lines.length && HEADER_WORDS.has(lines[j].trim())) {
      headers.push(lines[j].trim());
      j++;
    }

    // Skip blank lines after headers
    while (j < lines.length && lines[j].trim() === '') j++;

    // Determine table end: next ## heading, or triple blank, or EOF
    let endLine = j;
    let consecutiveBlanks = 0;
    for (let k = j; k < lines.length; k++) {
      const l = lines[k].trim();
      if (l.startsWith('## ') || l.startsWith('# ')) {
        endLine = k;
        break;
      }
      if (l === '') {
        consecutiveBlanks++;
        if (consecutiveBlanks >= 3) {
          endLine = k - 2;
          break;
        }
      } else {
        consecutiveBlanks = 0;
      }
      endLine = k + 1;
    }

    // Now parse the data region into rows
    const dataLines = lines.slice(j, endLine);
    const rows = parseTableRows(dataLines, headers.length, headers);

    if (rows.length > 0) {
      tables.push({
        startLine: i,        // 0-indexed line of first header
        endLine,             // 0-indexed line after table content
        headerStartLine: i,
        headers,
        rows,
        originalLines: lines.slice(i, endLine)
      });

      // Skip past this table
      i = endLine - 1;
    }
  }

  return tables;
}

/**
 * Parse data lines after headers into table rows.
 * 
 * Strategy for 2-column tables (most common):
 *   - Group content into blocks separated by blank lines
 *   - Each block that starts with a "key-like" line is a new row
 *   - The key is column 1; everything else in that block is column 2
 *   - If a block starts with a description-like line, it's a continuation of the previous row's description
 */
function parseTableRows(dataLines, numCols, headers) {
  // For tables where both columns are sentence-like (Problem/Solution, Command/Response),
  // use alternating assignment rather than key/description detection.
  const ALTERNATING_HEADERS = new Set([
    'Command', 'Response',
  ]);
  const isAlternating = headers.every(h => ALTERNATING_HEADERS.has(h));

  if (numCols !== 2 || isAlternating) {
    return parseAlternatingRows(dataLines, numCols);
  }

  // 2-column parsing (Setting/Description pattern)
  const rows = [];
  let currentKey = null;
  let currentDesc = [];

  function flushRow() {
    if (currentKey !== null) {
      const desc = currentDesc.join(' ').trim();
      rows.push([currentKey, desc]);
    }
    currentKey = null;
    currentDesc = [];
  }

  // First pass: split data into individual semantic lines, respecting blank-line boundaries.
  // Key pattern observed: "Desc\nKey\n(blank)\nDesc\nKey\n(blank)..."
  // where a key and the previous row's description can be in the same "block" (no blank between them).
  // We scan line-by-line and detect key/description transitions.

  for (const rawLine of dataLines) {
    const trimmed = rawLine.trim();

    if (trimmed === '') {
      // Blank line — potential row boundary marker
      continue;
    }

    if (isRowKey(trimmed)) {
      // This line looks like a row key.
      // But is it actually a key or a short description? Heuristic:
      //   - If we have no current key yet → definitely a key
      //   - If we have a key but no description yet → key (previous key was standalone, flush it)
      //   - If we have a key AND a description → this is a new key (flush previous row)
      if (!currentKey) {
        currentKey = trimmed;
      } else if (currentDesc.length === 0) {
        // Previous key had no description — might be a multi-word key on two lines,
        // or the previous key truly has no description.
        // If combining them is still short, merge; otherwise flush and start new.
        const combined = currentKey + ' ' + trimmed;
        if (combined.length < 60 && isRowKey(combined)) {
          currentKey = combined;
        } else {
          flushRow();
          currentKey = trimmed;
        }
      } else {
        // We have key + description, and now see a new key → flush
        flushRow();
        currentKey = trimmed;
      }
    } else {
      // Description line
      if (currentKey) {
        currentDesc.push(trimmed);
      } else {
        // Description before any key — skip (orphaned header area content)
      }
    }
  }
  flushRow();

  // Fallback: if key/description parsing found no rows, try alternating assignment
  if (rows.length === 0) {
    return parseAlternatingRows(dataLines, numCols);
  }

  return rows;
}

/**
 * Fallback for tables with 3+ columns: simple round-robin assignment.
 */
function parseAlternatingRows(dataLines, numCols) {
  const rows = [];
  const nonBlank = dataLines.filter(l => l.trim() !== '').map(l => l.trim());
  for (let i = 0; i + numCols - 1 < nonBlank.length; i += numCols) {
    const row = [];
    for (let c = 0; c < numCols; c++) {
      row.push(nonBlank[i + c]);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Build a Markdown table string from headers and rows.
 */
function buildMarkdownTable(headers, rows) {
  const lines = [];
  // Header row
  lines.push('| ' + headers.map(h => escapeCell(h)).join(' | ') + ' |');
  // Separator
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  // Data rows
  for (const row of rows) {
    const cells = headers.map((_, i) => {
      const val = row[i] || '';
      // Collapse multi-line descriptions: join with <br/> for paragraph breaks
      return escapeCell(val);
    });
    lines.push('| ' + cells.join(' | ') + ' |');
  }
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = await walkMdx(USER_GUIDE);
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Scanning ${files.length} files for broken tables...\n`);

  const changelog = [];
  let totalTablesReconstructed = 0;
  let totalFilesModified = 0;
  let totalRowsRecovered = 0;

  for (const filePath of files) {
    const raw = await readFile(filePath, 'utf-8');
    const fm = getFrontmatter(raw);
    const body = getBody(raw);
    const tables = findBrokenTables(body);

    if (tables.length === 0) continue;

    const rel = relative(ROOT, filePath).replace(/\\/g, '/');
    const fileChanges = [];
    let newBody = body;

    // Process tables in REVERSE order so line offsets stay valid
    for (let t = tables.length - 1; t >= 0; t--) {
      const table = tables[t];

      if (table.rows.length === 0) continue;

      const mdTable = buildMarkdownTable(table.headers, table.rows);
      const originalText = table.originalLines.join('\n');

      // Replace the original text block with the Markdown table
      const idx = newBody.indexOf(originalText);
      if (idx === -1) continue;

      newBody = newBody.slice(0, idx) + mdTable + newBody.slice(idx + originalText.length);

      totalTablesReconstructed++;
      totalRowsRecovered += table.rows.length;

      fileChanges.push({
        tableIndex: t,
        headers: table.headers,
        rowCount: table.rows.length,
        startLine: table.startLine + 1,
        preview: table.rows.slice(0, 2).map(r => `${r[0]} → ${(r[1] || '').slice(0, 60)}...`)
      });
    }

    if (fileChanges.length > 0) {
      totalFilesModified++;

      if (!DRY_RUN) {
        await writeFile(filePath, fm + newBody, 'utf-8');
      }

      changelog.push({
        file: rel,
        tablesReconstructed: fileChanges.length,
        changes: fileChanges
      });

      console.log(`  ${DRY_RUN ? '[DRY] ' : '✓ '}${rel}: ${fileChanges.length} table(s), ${fileChanges.reduce((s, c) => s + c.rowCount, 0)} rows`);
    }
  }

  // Write changelog
  const report = {
    pass: 'PASS-04',
    name: 'Broken Table Reconstruction',
    dryRun: DRY_RUN,
    timestamp: new Date().toISOString(),
    summary: {
      filesModified: totalFilesModified,
      tablesReconstructed: totalTablesReconstructed,
      rowsRecovered: totalRowsRecovered
    },
    files: changelog
  };

  await writeFile(CHANGELOG, JSON.stringify(report, null, 2), 'utf-8');

  console.log('\n══════════════════════════════════════════');
  console.log(`  PASS-04: Broken Table Reconstruction`);
  console.log(`  Mode:                ${DRY_RUN ? 'DRY RUN' : 'APPLIED'}`);
  console.log(`  Files modified:      ${totalFilesModified}`);
  console.log(`  Tables reconstructed: ${totalTablesReconstructed}`);
  console.log(`  Rows recovered:      ${totalRowsRecovered}`);
  console.log(`  Changelog:           ${relative(ROOT, CHANGELOG)}`);
  console.log('══════════════════════════════════════════\n');
}

main().catch(console.error);
