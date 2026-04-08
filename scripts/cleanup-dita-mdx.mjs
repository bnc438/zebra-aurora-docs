#!/usr/bin/env node
/**
 * DITA-to-MDX Cleanup Script
 * Processes all MDX files in docs/user-guide/ to fix conversion artifacts.
 *
 * What it does:
 *   1. Removes duplicated list/step content (plain-text echoes of bullet/numbered items)
 *   2. Converts inline note/warning/caution patterns to Docusaurus admonitions
 *   3. Fixes orphaned list content (items appearing outside their list)
 *   4. Generates a changelog of all modifications
 *
 * Usage:  node scripts/cleanup-dita-mdx.mjs [--dry-run]
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const USER_GUIDE = join(ROOT, 'docs', 'user-guide');
const CHANGELOG = join(ROOT, 'static', 'dita-cleanup-changelog.json');

// ── helpers ──────────────────────────────────────────────────────────────────

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
  return {
    frontmatter: m[1],
    body: m[2],
    lineEnding: content.includes('\r\n') ? '\r\n' : '\n'
  };
}

// ── cleanup passes ───────────────────────────────────────────────────────────

/**
 * Pass 1: Remove duplicated list content.
 * When a bullet/numbered list is followed by the same items as plain text paragraphs,
 * remove the duplicated plain text.
 */
function removeDuplicatedListContent(body) {
  const changes = [];
  const lines = body.split('\n');
  const result = [];
  
  // Collect all bullet and numbered list items
  const listItems = new Set();
  for (const line of lines) {
    const bulletMatch = line.match(/^- (.+)$/);
    const numMatch = line.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch && bulletMatch[1].trim().length >= 10) {
      listItems.add(bulletMatch[1].trim());
    }
    if (numMatch && numMatch[1].trim().length >= 15) {
      listItems.add(numMatch[1].trim());
    }
  }
  
  if (listItems.size === 0) return { body, changes };
  
  let skipCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Skip if this is a plain paragraph line that duplicates a list item
    if (trimmed.length >= 10 && listItems.has(trimmed) && !/^[-*]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i])) {
      // Verify it's not the ONLY occurrence (i.e., there IS a list version)
      const listVersionExists = lines.some((l, j) => {
        if (j === i) return false;
        const bm = l.match(/^- (.+)$/);
        const nm = l.match(/^\d+\.\s+(.+)$/);
        return (bm && bm[1].trim() === trimmed) || (nm && nm[1].trim() === trimmed);
      });
      
      if (listVersionExists) {
        skipCount++;
        changes.push({
          action: 'REMOVE_DUPLICATE',
          line: i + 1,
          text: trimmed.slice(0, 80)
        });
        continue;
      }
    }
    result.push(lines[i]);
  }
  
  // Clean up excessive blank lines left by removals
  const cleaned = result.join('\n').replace(/\n{3,}/g, '\n\n');
  
  return { body: cleaned, changes };
}

/**
 * Pass 2: Convert inline note/warning/caution patterns to Docusaurus admonitions.
 */
function convertToAdmonitions(body) {
  const changes = [];
  let result = body;
  
  // Pattern: standalone "Note:" or "NOTE:" paragraphs
  const notePatterns = [
    { re: /^(Note|NOTE):\s*(.+?)(?=\n\n|\n#|\n-|\n\d+\.|\n\||\n$)/gms, type: 'note' },
    { re: /^(Warning|WARNING):\s*(.+?)(?=\n\n|\n#|\n-|\n\d+\.|\n\||\n$)/gms, type: 'warning' },
    { re: /^(Caution|CAUTION):\s*(.+?)(?=\n\n|\n#|\n-|\n\d+\.|\n\||\n$)/gms, type: 'caution' },
    { re: /^(Important|IMPORTANT):\s*(.+?)(?=\n\n|\n#|\n-|\n\d+\.|\n\||\n$)/gms, type: 'danger' },
    { re: /^(Tip|TIP):\s*(.+?)(?=\n\n|\n#|\n-|\n\d+\.|\n\||\n$)/gms, type: 'tip' },
  ];
  
  for (const { re, type } of notePatterns) {
    result = result.replace(re, (match, label, content) => {
      const trimmedContent = content.trim();
      if (trimmedContent.length < 5) return match; // skip tiny matches
      changes.push({
        action: 'CONVERT_ADMONITION',
        type,
        text: trimmedContent.slice(0, 80)
      });
      return `:::${type}\n${trimmedContent}\n:::`;
    });
  }
  
  return { body: result, changes };
}

/**
 * Pass 3: Fix orphaned content after lists.
 * When "remember:" or "ensure that" phrases appear, wrap in a note admonition
 * if they aren't already inside one.
 */
function wrapOrphanedNotes(body) {
  const changes = [];
  let result = body;
  
  // Pattern: "When editing, remember:" followed by bullet list
  result = result.replace(
    /^(When [\w\s]+, remember:)\n((?:- .+\n?)+)/gm,
    (match, intro, list) => {
      changes.push({
        action: 'WRAP_NOTE',
        text: intro
      });
      return `:::note[${intro.replace(/:$/, '')}]\n${list}:::`;
    }
  );
  
  return { body: result, changes };
}

/**
 * Pass 4: Clean up consecutive blank lines and trailing whitespace.
 */
function normalizeWhitespace(body) {
  const changes = [];
  let result = body;
  
  // Remove trailing whitespace on each line
  const before = result;
  result = result.replace(/[ \t]+$/gm, '');
  
  // Collapse 3+ blank lines to 2
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Ensure single trailing newline
  result = result.replace(/\n*$/, '\n');
  
  if (result !== before) {
    changes.push({ action: 'NORMALIZE_WHITESPACE' });
  }
  
  return { body: result, changes };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = await walkMdx(USER_GUIDE);
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Processing ${files.length} MDX files...\n`);
  
  const changelog = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    totalFiles: files.length,
    filesModified: 0,
    totalChanges: 0,
    changesByType: {},
    files: []
  };
  
  let modifiedCount = 0;
  
  for (const filepath of files) {
    const content = await readFile(filepath, 'utf-8');
    const relPath = relative(ROOT, filepath).replace(/\\/g, '/');
    const { frontmatter, body: originalBody, lineEnding } = splitFrontmatterAndBody(content);
    
    let body = originalBody;
    const allChanges = [];
    
    // Apply passes sequentially
    const pass1 = removeDuplicatedListContent(body);
    body = pass1.body;
    allChanges.push(...pass1.changes);
    
    const pass2 = convertToAdmonitions(body);
    body = pass2.body;
    allChanges.push(...pass2.changes);
    
    const pass3 = wrapOrphanedNotes(body);
    body = pass3.body;
    allChanges.push(...pass3.changes);
    
    const pass4 = normalizeWhitespace(body);
    body = pass4.body;
    allChanges.push(...pass4.changes);
    
    // Check if anything changed
    const normalizedOriginal = originalBody.replace(/\r\n/g, '\n');
    if (body !== normalizedOriginal) {
      modifiedCount++;
      
      // Reconstruct file
      const newContent = frontmatter + '\n' + body;
      // Restore original line endings
      const finalContent = lineEnding === '\r\n' ? newContent.replace(/\n/g, '\r\n') : newContent;
      
      if (!DRY_RUN) {
        await writeFile(filepath, finalContent, 'utf-8');
      }
      
      changelog.files.push({
        path: relPath,
        changeCount: allChanges.length,
        changes: allChanges
      });
      changelog.totalChanges += allChanges.length;
      
      for (const c of allChanges) {
        const key = c.action;
        changelog.changesByType[key] = (changelog.changesByType[key] || 0) + 1;
      }
      
      console.log(`  ${DRY_RUN ? '[would modify]' : '✓'} ${relPath} (${allChanges.length} changes)`);
      for (const c of allChanges) {
        if (c.action !== 'NORMALIZE_WHITESPACE') {
          console.log(`      ${c.action}: ${c.text || c.type || ''}`);
        }
      }
    }
  }
  
  changelog.filesModified = modifiedCount;
  
  await writeFile(CHANGELOG, JSON.stringify(changelog, null, 2), 'utf-8');
  
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  DITA-to-MDX Cleanup ${DRY_RUN ? '(DRY RUN)' : 'Complete'}`);
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Files processed:   ${files.length}`);
  console.log(`  Files modified:    ${modifiedCount}`);
  console.log(`  Total changes:     ${changelog.totalChanges}`);
  console.log('──────────────────────────────────────────────────────');
  console.log('  Changes by type:');
  for (const [type, count] of Object.entries(changelog.changesByType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }
  console.log('──────────────────────────────────────────────────────');
  console.log(`  Changelog: ${relative(ROOT, CHANGELOG)}`);
  console.log('══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
