#!/usr/bin/env node
/**
 * fix-descriptions.mjs
 * Fixes TRUNCATED_DESCRIPTION and EMPTY_DESCRIPTION issues by extracting
 * the first meaningful sentence from body content and updating frontmatter.
 *
 * Usage:
 *   node scripts/fix-descriptions.mjs --dry-run   # preview changes
 *   node scripts/fix-descriptions.mjs              # apply changes
 */

import fs from 'fs';
import path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const report = JSON.parse(fs.readFileSync('static/dita-semantic-loss-report.json', 'utf8'));

// Collect files that have open TRUNCATED_DESCRIPTION or EMPTY_DESCRIPTION
const targetFiles = new Map();
for (const f of report.files) {
  for (const issue of f.issues) {
    if (!issue.resolved && ['TRUNCATED_DESCRIPTION', 'EMPTY_DESCRIPTION'].includes(issue.type)) {
      if (!targetFiles.has(f.path)) targetFiles.set(f.path, []);
      targetFiles.get(f.path).push(issue);
    }
  }
}

console.log(`Found ${targetFiles.size} files with description issues (dry-run: ${DRY_RUN})\n`);

/**
 * Extract a clean description from body content.
 * - Takes the first non-empty paragraph after frontmatter
 * - Strips markdown formatting (bold, links, code, admonitions)
 * - Takes the first 1-2 sentences, capped at ~160 chars
 * - Escapes YAML special characters
 */
function extractDescription(body) {
  // Split into paragraphs, skip empty ones, headings, list items, admonitions, imports, code blocks
  const paragraphs = body.split(/\n\n+/);
  let candidate = '';

  for (const p of paragraphs) {
    const trimmed = p.trim();
    // Skip non-prose content
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (/^\d+\.\s/.test(trimmed)) continue; // numbered list
    if (trimmed.startsWith(':::')) continue;
    if (trimmed.startsWith('```')) continue;
    if (trimmed.startsWith('import ')) continue;
    if (trimmed.startsWith('|')) continue; // table
    if (trimmed.startsWith('<')) continue; // JSX/HTML
    // Skip lines that are ONLY a list
    if (/^[-*]\s/.test(trimmed) && !trimmed.includes('. ')) continue;

    candidate = trimmed;
    break;
  }

  if (!candidate) return null;

  // Strip markdown formatting
  let clean = candidate
    .replace(/\r?\n/g, ' ')          // join lines
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1')     // italic
    .replace(/`([^`]+)`/g, '$1')       // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/\u00A0/g, ' ')          // non-breaking spaces
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim();

  // Take first 1-2 sentences up to ~160 chars
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (sentences) {
    let result = sentences[0].trim();
    if (result.length < 80 && sentences.length > 1) {
      result += ' ' + sentences[1].trim();
    }
    // Cap at 160 chars at a word boundary
    if (result.length > 160) {
      result = result.slice(0, 157).replace(/\s+\S*$/, '') + '...';
    }
    return result;
  }

  // No sentence boundary found — take first 160 chars
  if (clean.length > 160) {
    clean = clean.slice(0, 157).replace(/\s+\S*$/, '') + '...';
  }
  return clean || null;
}

/**
 * Escape a string for YAML frontmatter value.
 * Wrap in quotes if it contains special chars.
 */
function yamlEscape(str) {
  if (/[:#{}\[\]&*?|>!%@`,]/.test(str) || str.startsWith("'") || str.startsWith('"')) {
    // Use single quotes, escaping internal single quotes
    return "'" + str.replace(/'/g, "''") + "'";
  }
  return str;
}

const changelog = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  totalFiles: targetFiles.size,
  filesModified: 0,
  totalFixes: 0,
  fixes: [],
};

for (const [filePath, issues] of targetFiles) {
  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP (not found): ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fmEnd = content.indexOf('---', 4);
  if (fmEnd === -1) continue;

  const frontmatter = content.slice(0, fmEnd + 3);
  const body = content.slice(fmEnd + 3).trim();

  const newDesc = extractDescription(body);
  if (!newDesc) {
    console.log(`  SKIP (no body): ${filePath}`);
    continue;
  }

  // Replace description in frontmatter
  // Handle multiline YAML descriptions (with \ continuation or indentation)
  const descPattern = /description:\s*(?:'[^']*'|"[^"]*"|[\s\S]*?)(?=\n[a-z_])/;
  const descMatch = frontmatter.match(descPattern);
  if (!descMatch) {
    console.log(`  SKIP (no desc field): ${filePath}`);
    continue;
  }

  const oldDesc = descMatch[0];
  const newDescLine = `description: ${yamlEscape(newDesc)}`;

  if (oldDesc.trim() === newDescLine.trim()) {
    continue; // already correct
  }

  const newFrontmatter = frontmatter.replace(oldDesc, newDescLine);
  const newContent = newFrontmatter + '\n' + body + '\n';

  const fix = {
    file: filePath,
    oldDescription: oldDesc.replace('description:', '').trim().slice(0, 100),
    newDescription: newDesc.slice(0, 100),
    issueTypes: issues.map(i => i.type),
  };

  console.log(`  FIX: ${path.basename(filePath)}`);
  console.log(`    old: ${fix.oldDescription.slice(0, 80)}`);
  console.log(`    new: ${fix.newDescription.slice(0, 80)}`);

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, newContent);
  }

  changelog.fixes.push(fix);
  changelog.filesModified++;
  changelog.totalFixes += issues.length;
}

console.log(`\nDone. Modified: ${changelog.filesModified}, Fixes: ${changelog.totalFixes}`);

// Write changelog
fs.writeFileSync(
  'static/fix-descriptions-changelog.json',
  JSON.stringify(changelog, null, 2)
);
