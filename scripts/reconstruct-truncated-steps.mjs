#!/usr/bin/env node
/**
 * Reconstruct Truncated Steps
 *
 * Fixes the DITA conversion artifact where numbered/bullet list items were
 * truncated at inline <uicontrol> tags, and the full text was emitted as
 * plain paragraphs below the list.
 *
 * Pattern detected:
 *   1. Select the              ← stub (truncated at <uicontrol>)
 *   2. Click                   ← stub
 *   3. Configure the size...   ← sometimes full if no <uicontrol>
 *   Select the **Data Formatting** tab...   ← full step 1
 *   Click **Edit Rules**...                  ← full step 2
 *
 * Algorithm:
 *   1. Find a run of consecutive numbered steps where most are truncated
 *   2. Collect the plain-text paragraphs that follow the list
 *   3. Match each stub to its full-text counterpart by prefix matching
 *   4. Replace stubs with full text; remove the duplicate paragraphs
 *
 * Also handles bullet list stubs with the same pattern.
 *
 * Usage:  node scripts/reconstruct-truncated-steps.mjs [--dry-run]
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const USER_GUIDE = join(ROOT, 'docs', 'user-guide');
const CHANGELOG = join(ROOT, 'static', 'reconstruct-steps-changelog.json');

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

// ── Dangling detection ───────────────────────────────────────────────────────

const DANGLING_WORDS = new Set([
  'the', 'a', 'an', 'in', 'for', 'and', 'or', 'to', 'on', 'of', 'as', 'by',
  'at', 'with', 'from', 'into', 'this', 'that', 'your',
  'click', 'select', 'enable', 'configure', 'using', 'enter', 'type', 'press',
  'between', 'over', 'before', 'after', 'under', 'access', 'toggle',
  'observe', 'navigate',
]);

function isStubLine(text) {
  // A stub is a numbered or bullet line that ends with a dangling word
  // (i.e., was truncated at a <uicontrol> boundary)
  const trimmed = text.trim();
  const lastWord = trimmed.match(/(\S+)$/);
  if (!lastWord) return false;
  const word = lastWord[1].toLowerCase().replace(/[.,;:!?]+$/, '');
  return DANGLING_WORDS.has(word);
}

function getNumberedStepText(line) {
  const m = line.match(/^\s*(\d+)\.\s+(.*)/);
  if (!m) return null;
  return { num: parseInt(m[1]), text: m[2].trim(), full: line };
}

function getBulletText(line) {
  const m = line.match(/^\s*[-*]\s+(.*)/);
  if (!m) return null;
  return { text: m[1].trim(), full: line };
}

function isSkipLine(line) {
  const t = line.trim();
  return t.startsWith('#') || t.startsWith('|') || t.startsWith('```') ||
    t.startsWith(':::') || t.startsWith('---') || t.startsWith('import ') ||
    t.startsWith('export ') || t.startsWith('<') || t.startsWith('![');
}

// ── Matching logic ───────────────────────────────────────────────────────────

/**
 * Normalize text for prefix matching: lowercase, strip bold, strip extra spaces.
 */
function normalize(text) {
  return text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Check if `fullText` starts with the same words as `stubText`.
 * The stub is truncated, so full should start with stub's content.
 */
function isFullVersionOf(stubText, fullText) {
  const normStub = normalize(stubText);
  const normFull = normalize(fullText);
  if (normStub.length < 3) return false;
  // Full text should start with the stub text (possibly with minor differences)
  if (normFull.startsWith(normStub)) return true;
  // Also check if first N words match (handles minor whitespace diffs)
  const stubWords = normStub.split(' ');
  const fullWords = normFull.split(' ');
  if (stubWords.length < 1) return false;
  const matchCount = stubWords.filter((w, i) => fullWords[i] === w).length;
  return matchCount >= stubWords.length * 0.8 && matchCount >= 2;
}

// ── Core reconstruction ─────────────────────────────────────────────────────

function reconstructSteps(body) {
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
    if (inCodeBlock) {
      result.push(line);
      i++;
      continue;
    }

    // ── Detect numbered step stub blocks ─────────────────────────────────
    const stepInfo = getNumberedStepText(line);
    if (stepInfo && isStubLine(line)) {
      // Collect the full run of consecutive numbered steps
      const stubs = [{ ...stepInfo, lineIdx: i }];
      let j = i + 1;
      while (j < lines.length) {
        const nextStep = getNumberedStepText(lines[j]);
        if (nextStep) {
          stubs.push({ ...nextStep, lineIdx: j });
          j++;
        } else {
          break;
        }
      }

      // Check: do most stubs look truncated?
      const truncatedCount = stubs.filter(s => isStubLine(s.full)).length;
      if (truncatedCount < stubs.length * 0.4 || stubs.length < 2) {
        // Not a stub block, emit as-is
        result.push(line);
        i++;
        continue;
      }

      // Collect the plain-text paragraphs that follow
      const candidateLines = [];
      let k = j;
      while (k < lines.length) {
        const cLine = lines[k].trim();
        if (cLine === '') { k++; continue; } // skip blanks
        if (cLine.startsWith('#') || cLine.startsWith('```') || cLine.startsWith(':::')) break;
        // Stop if we hit another numbered list
        if (/^\d+\.\s/.test(cLine) && candidateLines.length >= stubs.length) break;
        // Stop if we hit a table
        if (cLine.startsWith('|')) break;
        candidateLines.push({ text: cLine, lineIdx: k });
        k++;
        // Safety: don't consume more than 3x stubs count
        if (candidateLines.length > stubs.length * 3) break;
      }

      // Try to match each stub to a candidate
      const matched = new Array(stubs.length).fill(null);
      const usedCandidates = new Set();

      for (let s = 0; s < stubs.length; s++) {
        if (!isStubLine(stubs[s].full)) {
          // This stub already has full text, keep it
          matched[s] = stubs[s].text;
          continue;
        }
        // Find the first unused candidate that starts with this stub's text
        for (let c = 0; c < candidateLines.length; c++) {
          if (usedCandidates.has(c)) continue;
          if (isFullVersionOf(stubs[s].text, candidateLines[c].text)) {
            matched[s] = candidateLines[c].text;
            usedCandidates.add(c);
            break;
          }
        }
      }

      // Check if we got enough matches
      const matchCount = matched.filter(m => m !== null).length;
      if (matchCount < truncatedCount * 0.5) {
        // Not enough matches — skip this block
        result.push(line);
        i++;
        continue;
      }

      // Emit the reconstructed numbered steps
      for (let s = 0; s < stubs.length; s++) {
        const leading = stubs[s].full.match(/^(\s*\d+\.\s+)/)[1]; // preserve "1. " prefix
        if (matched[s]) {
          result.push(leading + matched[s]);
        } else {
          result.push(stubs[s].full); // keep original if no match
        }
      }

      // Collect lines to skip (the consumed candidates)
      const skipLineIdxs = new Set([...usedCandidates].map(c => candidateLines[c].lineIdx));

      // Also check for remaining candidates that are sub-parts of steps
      // (e.g., the continuation fragments between full-text candidates)
      // We skip everything between the step block end and the last consumed candidate
      const lastConsumedIdx = Math.max(...[...usedCandidates].map(c => candidateLines[c].lineIdx), j - 1);

      changes.push({
        action: 'RECONSTRUCT_STEPS',
        startLine: i + 1,
        endLine: lastConsumedIdx + 1,
        stubCount: stubs.length,
        matchedCount: matchCount,
        truncatedCount,
        preview: stubs.slice(0, 3).map((s, idx) => ({
          stub: s.text.slice(0, 60),
          full: (matched[idx] || '(no match)').slice(0, 80)
        }))
      });

      // Emit remaining lines between j and k, skipping consumed candidates
      for (let x = j; x <= lastConsumedIdx; x++) {
        if (!skipLineIdxs.has(x)) {
          // Keep non-consumed lines (they might be sub-info or notes)
          result.push(lines[x]);
        }
      }

      i = lastConsumedIdx + 1;
      continue;
    }

    // ── Detect bullet stub blocks ────────────────────────────────────────
    const bulletInfo = getBulletText(line);
    if (bulletInfo && isStubLine(line)) {
      const stubs = [{ ...bulletInfo, lineIdx: i }];
      let j = i + 1;
      while (j < lines.length) {
        const nextBullet = getBulletText(lines[j]);
        if (nextBullet) {
          stubs.push({ ...nextBullet, lineIdx: j });
          j++;
        } else {
          break;
        }
      }

      const truncatedCount = stubs.filter(s => isStubLine(s.full)).length;
      if (truncatedCount < stubs.length * 0.4 || stubs.length < 2) {
        result.push(line);
        i++;
        continue;
      }

      // Collect candidates
      const candidateLines = [];
      let k = j;
      while (k < lines.length) {
        const cLine = lines[k].trim();
        if (cLine === '') { k++; continue; }
        if (cLine.startsWith('#') || cLine.startsWith('```') || cLine.startsWith(':::')) break;
        if (/^[-*]\s/.test(cLine) && candidateLines.length >= stubs.length) break;
        if (cLine.startsWith('|')) break;
        candidateLines.push({ text: cLine, lineIdx: k });
        k++;
        if (candidateLines.length > stubs.length * 3) break;
      }

      // Match
      const matched = new Array(stubs.length).fill(null);
      const usedCandidates = new Set();
      for (let s = 0; s < stubs.length; s++) {
        if (!isStubLine(stubs[s].full)) {
          matched[s] = stubs[s].text;
          continue;
        }
        for (let c = 0; c < candidateLines.length; c++) {
          if (usedCandidates.has(c)) continue;
          if (isFullVersionOf(stubs[s].text, candidateLines[c].text)) {
            matched[s] = candidateLines[c].text;
            usedCandidates.add(c);
            break;
          }
        }
      }

      const matchCount = matched.filter(m => m !== null).length;
      if (matchCount < truncatedCount * 0.5) {
        result.push(line);
        i++;
        continue;
      }

      for (let s = 0; s < stubs.length; s++) {
        const leading = stubs[s].full.match(/^(\s*[-*]\s+)/)[1];
        if (matched[s]) {
          result.push(leading + matched[s]);
        } else {
          result.push(stubs[s].full);
        }
      }

      const skipLineIdxs = new Set([...usedCandidates].map(c => candidateLines[c].lineIdx));
      const lastConsumedIdx = Math.max(...[...usedCandidates].map(c => candidateLines[c].lineIdx), j - 1);

      changes.push({
        action: 'RECONSTRUCT_BULLETS',
        startLine: i + 1,
        endLine: lastConsumedIdx + 1,
        stubCount: stubs.length,
        matchedCount: matchCount,
        preview: stubs.slice(0, 3).map((s, idx) => ({
          stub: s.text.slice(0, 60),
          full: (matched[idx] || '(no match)').slice(0, 80)
        }))
      });

      for (let x = j; x <= lastConsumedIdx; x++) {
        if (!skipLineIdxs.has(x)) {
          result.push(lines[x]);
        }
      }

      i = lastConsumedIdx + 1;
      continue;
    }

    // Default: pass through
    result.push(line);
    i++;
  }

  return { body: result.join('\n'), changes };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = await walkMdx(USER_GUIDE);
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Reconstructing truncated steps in ${files.length} files...\n`);

  const changelog = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    totalFiles: files.length,
    filesModified: 0,
    totalReconstructions: 0,
    files: []
  };

  for (const filepath of files) {
    const content = await readFile(filepath, 'utf-8');
    const relPath = relative(ROOT, filepath).replace(/\\/g, '/');
    const { frontmatter, body: originalBody, lineEnding } = splitFrontmatterAndBody(content);

    const { body: fixedBody, changes } = reconstructSteps(originalBody);

    if (changes.length > 0) {
      changelog.filesModified++;
      changelog.totalReconstructions += changes.length;
      changelog.files.push({ path: relPath, changes });

      if (!DRY_RUN) {
        const newContent = frontmatter + '\n' + fixedBody;
        const finalContent = lineEnding === '\r\n' ? newContent.replace(/\n/g, '\r\n') : newContent;
        await writeFile(filepath, finalContent, 'utf-8');
      }

      console.log(`  ${DRY_RUN ? '[would modify]' : '✓'} ${relPath}`);
      for (const c of changes) {
        console.log(`      ${c.action} L${c.startLine}-${c.endLine}: ${c.stubCount} stubs, ${c.matchedCount} matched`);
        for (const p of c.preview) {
          console.log(`        stub: "${p.stub}" → full: "${p.full}"`);
        }
      }
    }
  }

  await writeFile(CHANGELOG, JSON.stringify(changelog, null, 2), 'utf-8');

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Step Reconstruction ${DRY_RUN ? '(DRY RUN)' : 'Complete'}`);
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Files processed:        ${files.length}`);
  console.log(`  Files modified:         ${changelog.filesModified}`);
  console.log(`  Total reconstructions:  ${changelog.totalReconstructions}`);
  console.log(`  Changelog: ${relative(ROOT, CHANGELOG)}`);
  console.log('══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
