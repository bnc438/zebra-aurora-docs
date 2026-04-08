#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const UG = join(ROOT, 'docs', 'user-guide');

function walk(dir) {
  let files = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p));
    else if (e.name.endsWith('.mdx')) files.push(p);
  }
  return files;
}

const HEADERS = new Set([
  'Item', 'Description', 'Setting', 'Settings', 'Parameter', 'Value',
  'Command', 'Response', 'Problem', 'Solution', 'Section', 'Argument',
  'Optional', 'Feature', 'Function', 'Mode', 'Type', 'Name', 'Format',
  'Status', 'Result', 'Action', 'Condition', 'Option', 'Details', 'Field',
]);

const files = walk(UG);
let totalBullets = 0;
const filesWithBullets = [];

for (const fp of files) {
  const rel = relative(ROOT, fp).replace(/\\/g, '/');
  let orig;
  try {
    orig = execSync(`git show HEAD:"${rel}"`, { encoding: 'utf-8' });
  } catch {
    continue;
  }

  const lines = orig.replace(/\r\n/g, '\n').split('\n');
  let inTable = false;
  let bulletCount = 0;
  const bulletExamples = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (HEADERS.has(t) && i + 1 < lines.length && HEADERS.has(lines[i + 1].trim())) {
      inTable = true;
      continue;
    }
    if (inTable && (t.startsWith('## ') || t.startsWith('# '))) {
      inTable = false;
    }
    if (inTable && t.startsWith('- ')) {
      bulletCount++;
      if (bulletExamples.length < 5) {
        bulletExamples.push({ line: i + 1, text: t.slice(0, 100) });
      }
    }
  }

  if (bulletCount > 0) {
    totalBullets += bulletCount;
    filesWithBullets.push({ file: rel, count: bulletCount, examples: bulletExamples });
  }
}

console.log('Files with bullets inside table regions:', filesWithBullets.length);
console.log('Total bullet items in table cells:', totalBullets);
console.log();
for (const f of filesWithBullets.sort((a, b) => b.count - a.count)) {
  console.log(`${f.file}: ${f.count} bullets`);
  for (const ex of f.examples) {
    console.log(`  L${ex.line}: ${ex.text}`);
  }
}

// Now check current files: are those bullets still present, or were they flattened?
console.log('\n--- Checking current state ---');
let currentBullets = 0;
for (const fp of files) {
  const content = readFileSync(fp, 'utf-8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  // Count bullets that are inside table rows (lines starting with |)
  for (const line of lines) {
    if (line.startsWith('|') && line.includes('- ')) {
      // Check if there's a "- " that looks like a list item inside a cell
      const cells = line.split('|').filter(c => c.trim());
      for (const cell of cells) {
        const matches = cell.match(/(?:^|\s)- [A-Z]/g);
        if (matches) currentBullets += matches.length;
      }
    }
  }
}
console.log('Bullet-like items inside current table cells:', currentBullets);
console.log('Items flattened (list structure lost):', totalBullets - currentBullets);
