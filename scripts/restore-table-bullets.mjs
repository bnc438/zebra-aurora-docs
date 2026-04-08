#!/usr/bin/env node
/**
 * PASS-05: Restore flattened bullet lists inside Markdown table cells.
 *
 * During PASS-04 table reconstruction, unordered lists inside DITA table cells
 * were joined into single-line text.  This script detects those cells and
 * restores bullet formatting using HTML <ul><li> inside the pipe-delimited
 * Markdown table cells (standard Markdown tables cannot contain block elements).
 *
 * Two bullet patterns are handled:
 *   A) Descriptive bullets – items end with a period:
 *        "- Name - desc. - Name2 - desc2."  →  split on ". - "
 *   B) Short / enum bullets – items have no periods:
 *        "- Any - Bright - Dark"  →  split on " - "
 *   C) Intro text followed by bullets:
 *        "Select a polarity: - Any - Bright - Dark"
 */

import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */
const ROOT = path.resolve('docs/user-guide');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.mdx')) out.push(p);
  }
  return out;
}

/**
 * Given a cell string that contains flattened bullets, return an object:
 *   { intro: string|null, items: string[] }
 */
function splitBullets(cell) {
  let intro = null;
  let bulletText = cell;

  // Detect intro text before bullets
  // Pattern: "Some intro text: - First bullet ..."
  //      or: "Some intro text. - First bullet ..."
  const introMatch = cell.match(/^(.+?[:.])(\s+- )/);
  if (introMatch && !cell.startsWith('- ')) {
    intro = introMatch[1].trim();
    bulletText = cell.slice(introMatch[1].length).trim();
  }

  // Remove leading "- " from bullet text
  if (bulletText.startsWith('- ')) {
    bulletText = bulletText.slice(2);
  }

  // Decide split strategy: descriptive (". - ") vs short (" - ")
  // Check if there are periods between dash markers
  const hasPeriodSeparators = /\.\s+-\s+/.test(bulletText);

  let items;
  if (hasPeriodSeparators) {
    // Split on ". - " (period followed by new bullet)
    items = bulletText.split(/\.\s+-\s+/).map((s, i, arr) => {
      // Re-add period to all except last (unless last already has one)
      if (i < arr.length - 1) return s.trim() + '.';
      return s.trim();
    });
  } else {
    // Short items: split on " - "
    items = bulletText.split(/\s+-\s+/).map(s => s.trim());
  }

  // Filter empty items
  items = items.filter(s => s.length > 0);

  return { intro, items };
}

/**
 * Format bullets as HTML for use inside a Markdown table cell.
 */
function formatBulletsHTML(intro, items) {
  if (items.length <= 1) return null; // Not actually a list

  const lis = items.map(it => `<li>${it}</li>`).join('');
  const list = `<ul>${lis}</ul>`;

  if (intro) {
    return `${intro} ${list}`;
  }
  return list;
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */
const files = walk(ROOT);
let totalFiles = 0;
let totalCells = 0;
let totalItems = 0;
const changelog = [];

for (const filePath of files) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  let modified = false;
  const fileChanges = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|') || !line.trim().endsWith('|')) continue;
    // Skip separator rows
    if (/^\|\s*-+\s*\|/.test(line.trim())) continue;
    // Skip header rows (first table row after a blank or after separator)
    // We process all data rows

    const cells = line.split('|');
    // cells[0] is empty (before first |), cells[last] is empty (after last |)
    let rowChanged = false;

    for (let ci = 1; ci < cells.length - 1; ci++) {
      const cell = cells[ci].trim();

      // Detect flattened bullets: cell starts with "- " or has ": - " / ". - " pattern
      const startsWithBullet = cell.startsWith('- ');
      const hasBulletsAfterIntro = /[.:]\s+-\s+[A-Z]/.test(cell);
      const dashCount = (cell.match(/\s-\s/g) || []).length;

      if ((startsWithBullet || hasBulletsAfterIntro) && dashCount >= 2) {
        const { intro, items } = splitBullets(cell);
        const html = formatBulletsHTML(intro, items);

        if (html) {
          cells[ci] = ` ${html} `;
          rowChanged = true;
          totalItems += items.length;
          fileChanges.push({
            line: i + 1,
            column: ci,
            originalLength: cell.length,
            itemCount: items.length,
            preview: cell.slice(0, 80)
          });
        }
      }
    }

    if (rowChanged) {
      lines[i] = cells.join('|');
      modified = true;
      totalCells++;
    }
  }

  if (modified) {
    totalFiles++;
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    changelog.push({ file: relPath, changes: fileChanges });

    if (VERBOSE) {
      console.log(`\n  ${relPath}`);
      fileChanges.forEach(c =>
        console.log(`    L${c.line} col${c.column}: ${c.itemCount} items  "${c.preview}..."`)
      );
    }

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Report                                                            */
/* ------------------------------------------------------------------ */
console.log('\n=== PASS-05: Restore Table Bullets ===');
console.log(`  Mode:            ${DRY_RUN ? 'DRY RUN' : 'APPLIED'}`);
console.log(`  Files modified:  ${totalFiles}`);
console.log(`  Cells restored:  ${totalCells}`);
console.log(`  Bullet items:    ${totalItems}`);

if (!DRY_RUN) {
  fs.writeFileSync(
    'static/restore-bullets-changelog.json',
    JSON.stringify({ pass: 'PASS-05', name: 'Restore Table Bullets', dryRun: DRY_RUN,
      timestamp: new Date().toISOString(),
      summary: { filesModified: totalFiles, cellsRestored: totalCells, bulletItems: totalItems },
      files: changelog
    }, null, 2),
    'utf8'
  );
  console.log('  Changelog:       static/restore-bullets-changelog.json');
}
