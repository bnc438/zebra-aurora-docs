#!/usr/bin/env node
/**
 * Detect fragmented sentences caused by DITA inline tags
 * being converted to line breaks in MDX.
 *
 * Pattern: a line ending without punctuation, followed by a short line
 * (the former tag content), followed by continuation text.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const USER_GUIDE = join(ROOT, 'docs', 'user-guide');

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
  const m = norm.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1] : content;
}

/**
 * Detect lines that look like they were inline DITA elements broken into
 * their own lines. Patterns:
 *
 * 1. Line ends with a preposition/article/conjunction (the, in, for, and, or, to, on, of, a, an)
 *    next line is short content that was formerly an inline tag.
 *
 * 2. A short standalone line (1-5 words) sandwiched between text lines,
 *    where the line before ends mid-sentence and the line after continues.
 *
 * 3. Lines ending with "the", "a", "in", etc. followed by a line that was
 *    bold-wrapped or is a UI term.
 */
function detectFragmentedSentences(body, relPath) {
  const lines = body.split('\n');
  const fragments = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const curr = lines[i];
    const next = lines[i + 1];
    const afterNext = i + 2 < lines.length ? lines[i + 2] : '';

    // Skip lines inside tables, code blocks, frontmatter, headings, lists
    if (curr.startsWith('|') || curr.startsWith('```') || curr.startsWith('#') ||
        curr.startsWith('---') || curr.startsWith(':::') || curr.trim() === '') continue;
    if (next.trim() === '' || next.startsWith('|') || next.startsWith('```') ||
        next.startsWith('#') || next.startsWith('---') || next.startsWith('-') ||
        next.startsWith(':::')) continue;

    const currTrimmed = curr.trimEnd();
    const nextTrimmed = next.trim();

    // Pattern 1: Line ends with a dangling preposition/article/conjunction
    const danglingEnd = /\b(the|in|for|and|or|to|on|of|a|an|is|are|as|by|at|with|from|into|their|its|your|our|this|that|click|select|enable|configure|using|enter|type|press|between|over|before|after)$/i;
    if (danglingEnd.test(currTrimmed)) {
      // next line is probably the tag content
      const nextWords = nextTrimmed.split(/\s+/).length;
      if (nextWords <= 6) {
        fragments.push({
          line: i + 1,
          danglingWord: currTrimmed.match(danglingEnd)[1],
          brokenContent: nextTrimmed,
          context: `${currTrimmed} | ${nextTrimmed} | ${afterNext.trim()}`.slice(0, 120),
          type: 'DANGLING_PREPOSITION'
        });
      }
    }

    // Pattern 2: Short orphan line (1-4 words, not a heading/list) between text
    if (i > 0) {
      const prev = lines[i - 1];
      const prevTrimmed = prev.trimEnd();
      const currWords = currTrimmed.split(/\s+/).length;

      if (currWords >= 1 && currWords <= 4 &&
          !curr.startsWith('-') && !curr.startsWith('#') && !curr.startsWith('|') &&
          !curr.startsWith('```') && !curr.startsWith(':::') && !/^\d+\./.test(curr) &&
          !prev.trim().startsWith('-') && !prev.trim().startsWith('#') &&
          prevTrimmed !== '' && currTrimmed !== '' &&
          // prev line ends mid-sentence (no period, colon, pipe)
          !/[.!?:;|]$/.test(prevTrimmed) &&
          // next line continues (starts lowercase or with punctuation)
          (/^[a-z,;.]/.test(afterNext.trim()) || afterNext.trim() === '')) {

        // Avoid false positives on standalone terms in tables/lists
        if (!fragments.some(f => f.line === i + 1)) {
          fragments.push({
            line: i + 1,
            brokenContent: currTrimmed,
            context: `${prevTrimmed} | ${currTrimmed} | ${afterNext.trim()}`.slice(0, 120),
            type: 'ORPHAN_INLINE'
          });
        }
      }
    }
  }

  return fragments;
}

async function main() {
  const files = await walkMdx(USER_GUIDE);
  let totalFragments = 0;
  let filesWithFragments = 0;
  const allResults = [];

  for (const filepath of files) {
    const content = await readFile(filepath, 'utf-8');
    const relPath = relative(ROOT, filepath).replace(/\\/g, '/');
    const body = getBody(content);
    const fragments = detectFragmentedSentences(body, relPath);

    if (fragments.length > 0) {
      filesWithFragments++;
      totalFragments += fragments.length;
      allResults.push({ path: relPath, count: fragments.length, fragments });
    }
  }

  allResults.sort((a, b) => b.count - a.count);

  console.log(`\n════════════════════════════════════════════════`);
  console.log(`  Fragmented Sentence Detection`);
  console.log(`════════════════════════════════════════════════`);
  console.log(`  Files scanned:       ${files.length}`);
  console.log(`  Files with breaks:   ${filesWithFragments}`);
  console.log(`  Total fragments:     ${totalFragments}`);
  console.log(`────────────────────────────────────────────────`);

  // Show top 15 files
  console.log(`\n  Top affected files:`);
  for (const r of allResults.slice(0, 15)) {
    console.log(`    ${r.count.toString().padStart(3)} fragments  ${r.path}`);
    for (const f of r.fragments.slice(0, 3)) {
      console.log(`        L${f.line}: [${f.type}] "${f.context}"`);
    }
  }

  // Type breakdown
  const byType = {};
  for (const r of allResults) {
    for (const f of r.fragments) {
      byType[f.type] = (byType[f.type] || 0) + 1;
    }
  }
  console.log(`\n  By type:`);
  for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t}: ${c}`);
  }

  // Dangling word frequency
  const byWord = {};
  for (const r of allResults) {
    for (const f of r.fragments) {
      if (f.danglingWord) byWord[f.danglingWord.toLowerCase()] = (byWord[f.danglingWord.toLowerCase()] || 0) + 1;
    }
  }
  console.log(`\n  Most frequent dangling words:`);
  for (const [w, c] of Object.entries(byWord).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`    "${w}": ${c}`);
  }
  console.log(`════════════════════════════════════════════════\n`);
}

main().catch(console.error);
