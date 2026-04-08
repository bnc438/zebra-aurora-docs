#!/usr/bin/env node
/**
 * Rejoin Fragmented Sentences (v2)
 *
 * Fixes sentences broken by DITA <uicontrol> tags stripped during conversion.
 * The converter produced:
 *   Navigate to the\nAdmin Settings\nmenu from the\nHome\nscreen.
 * Instead of:
 *   Navigate to the **Admin Settings** menu from the **Home** screen.
 *
 * Algorithm: Walk lines. When a line ends with a dangling word (the, click, etc.)
 * and the NEXT line is a short Capitalized UI label, join them. Bold-wrap the
 * UI label. Then check if the line AFTER the label is lowercase continuation text
 * and join that too. Repeat.
 *
 * Usage:  node scripts/rejoin-fragmented-sentences.mjs [--dry-run]
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const USER_GUIDE = join(ROOT, 'docs', 'user-guide');
const CHANGELOG = join(ROOT, 'static', 'rejoin-changelog.json');

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

function splitFrontmatterAndBody(content) {
  const norm = content.replace(/\r\n/g, '\n');
  const m = norm.match(/^(---\n[\s\S]*?\n---)\n?([\s\S]*)$/);
  if (!m) return { frontmatter: '', body: norm, lineEnding: content.includes('\r\n') ? '\r\n' : '\n' };
  return { frontmatter: m[1], body: m[2], lineEnding: content.includes('\r\n') ? '\r\n' : '\n' };
}

// Words that dangle at end of line when a <uicontrol> tag follows
const DANGLING_WORDS = new Set([
  'the', 'a', 'an', 'in', 'for', 'and', 'or', 'to', 'on', 'of', 'as', 'by',
  'at', 'with', 'from', 'into', 'their', 'its', 'your', 'this', 'that',
  'click', 'select', 'enable', 'configure', 'using', 'enter', 'type', 'press',
  'between', 'over', 'before', 'after', 'under', 'is', 'are', 'access',
  'toggle', 'check', 'named', 'called', 'labeled', 'entitled', 'titled',
]);

function isSkipLine(line) {
  const t = line.trim();
  return t === '' || t.startsWith('#') || t.startsWith('|') || t.startsWith('```') ||
    t.startsWith(':::') || t.startsWith('---') || t.startsWith('import ') ||
    t.startsWith('export ') || t.startsWith('<') || t.startsWith('![');
}

/**
 * Determines if a line looks like a former <uicontrol> value:
 * - Short (1-5 words)
 * - Starts with uppercase or backtick
 * - Not a list item, heading, etc.
 * - Not a full sentence start
 */
function isUIControlLine(line) {
  const t = line.trim();
  if (!t || isSkipLine(line)) return false;
  if (/^[-*]\s/.test(t) || /^\d+\.\s/.test(t)) return false;

  const words = t.split(/\s+/);
  if (words.length > 5) return false;

  // Must start with uppercase, backtick, or be all-caps
  if (!/^[A-Z`]/.test(t)) return false;

  // Reject sentence starters: "Uppercase word + lowercase word" patterns that
  // look like normal prose. UI labels are typically Title Case throughout.
  // e.g., "Select the" is a sentence, "Admin Settings" is a UI label
  if (words.length >= 2 && /^[a-z]/.test(words[1]) &&
      !/^(USB|TCP|IP|HID|RS|FTP|GPIO|ISBT|AROI|PLC|SSI|CDC|GS20|FS10|FS20|FS40|FS42|FS80|XS20|LED|NPN|PNP|POE|RNDIS)$/i.test(words[0])) {
    return false;
  }

  return true;
}

/**
 * Determines if a line is continuation text (lowercase start, or starts with punctuation).
 */
function isContinuation(line) {
  const t = line.trim();
  if (!t || isSkipLine(line)) return false;
  if (/^[-*]\s/.test(t) || /^\d+\.\s/.test(t)) return false;
  return /^[a-z,;.:)\]]/.test(t);
}

function endsDangling(text) {
  const t = text.trimEnd();
  const m = t.match(/(\S+)$/);
  if (!m) return false;
  // Strip trailing bold markers for check
  const word = m[1].replace(/\*+$/, '').toLowerCase();
  return DANGLING_WORDS.has(word);
}

function boldWrap(text) {
  const t = text.trim();
  if (/^\*\*.*\*\*$/.test(t)) return t;
  if (/^`.*`$/.test(t)) return t;
  return `**${t}**`;
}

/**
 * Main rejoin algorithm.
 */
function rejoinFragments(body) {
  const lines = body.split('\n');
  const result = [];
  const changes = [];
  let inCodeBlock = false;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      i++;
      continue;
    }
    if (inCodeBlock || isSkipLine(line)) {
      result.push(line);
      i++;
      continue;
    }

    if (!endsDangling(line)) {
      result.push(line);
      i++;
      continue;
    }

    // Try: DANGLING + UICONTROL [+ continuation [+ DANGLING + UICONTROL ...]]
    const startIdx = i;
    let assembled = line.trimEnd();
    let j = i + 1;
    let consumed = false;

    while (j < lines.length) {
      const nextTrimmed = (lines[j] || '').trim();

      if (!nextTrimmed || isSkipLine(lines[j])) break;

      if (isUIControlLine(lines[j])) {
        assembled += ' ' + boldWrap(nextTrimmed);
        j++;
        consumed = true;

        // Check what follows the UI control
        if (j < lines.length) {
          const afterTrimmed = (lines[j] || '').trim();

          // Lone punctuation
          if (/^[.,;:]$/.test(afterTrimmed)) {
            assembled += afterTrimmed;
            j++;
            break;
          }

          // Continuation text
          if (isContinuation(lines[j])) {
            assembled += ' ' + afterTrimmed;
            j++;
            if (endsDangling(afterTrimmed)) continue; // chain
            break;
          }
        }

        // Check if we can chain (assembled ends dangling)
        if (endsDangling(assembled)) continue;
        break;

      } else if (isContinuation(lines[j])) {
        assembled += ' ' + nextTrimmed;
        j++;
        consumed = true;
        if (endsDangling(nextTrimmed)) continue;
        break;
      } else {
        break;
      }
    }

    if (consumed) {
      const leadingMatch = line.match(/^(\s*(?:[-*]\s+|\d+\.\s+)?)/);
      const leading = leadingMatch ? leadingMatch[1] : '';
      const cleanText = assembled.replace(/ {2,}/g, ' ').trim();
      result.push(leading + cleanText);
      changes.push({
        action: 'REJOIN',
        startLine: startIdx + 1,
        endLine: j,
        linesConsumed: j - startIdx,
        result: (leading + cleanText).slice(0, 150)
      });
      i = j;
    } else {
      result.push(line);
      i++;
    }
  }

  return { body: result.join('\n'), changes };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = await walkMdx(USER_GUIDE);
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Rejoining fragmented sentences in ${files.length} files...\n`);

  const changelog = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    totalFiles: files.length,
    filesModified: 0,
    totalRejoins: 0,
    totalLinesRecovered: 0,
    files: []
  };

  for (const filepath of files) {
    const content = await readFile(filepath, 'utf-8');
    const relPath = relative(ROOT, filepath).replace(/\\/g, '/');
    const { frontmatter, body: originalBody, lineEnding } = splitFrontmatterAndBody(content);

    const { body: rejoinedBody, changes } = rejoinFragments(originalBody);

    if (changes.length > 0) {
      changelog.filesModified++;
      const linesRecovered = changes.reduce((sum, c) => sum + c.linesConsumed - 1, 0);
      changelog.totalRejoins += changes.length;
      changelog.totalLinesRecovered += linesRecovered;
      changelog.files.push({
        path: relPath,
        rejoins: changes.length,
        linesRecovered,
        changes
      });

      if (!DRY_RUN) {
        const newContent = frontmatter + '\n' + rejoinedBody;
        const finalContent = lineEnding === '\r\n' ? newContent.replace(/\n/g, '\r\n') : newContent;
        await writeFile(filepath, finalContent, 'utf-8');
      }

      console.log(`  ${DRY_RUN ? '[would modify]' : '✓'} ${relPath} (${changes.length} rejoins, ${linesRecovered} lines recovered)`);
      for (const c of changes.slice(0, 5)) {
        console.log(`      L${c.startLine}-${c.endLine}: ${c.result}`);
      }
      if (changes.length > 5) console.log(`      ... and ${changes.length - 5} more`);
    }
  }

  await writeFile(CHANGELOG, JSON.stringify(changelog, null, 2), 'utf-8');

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Sentence Rejoin ${DRY_RUN ? '(DRY RUN)' : 'Complete'}`);
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Files processed:     ${files.length}`);
  console.log(`  Files modified:      ${changelog.filesModified}`);
  console.log(`  Total rejoins:       ${changelog.totalRejoins}`);
  console.log(`  Lines recovered:     ${changelog.totalLinesRecovered}`);
  console.log(`  Changelog: ${relative(ROOT, CHANGELOG)}`);
  console.log('══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
