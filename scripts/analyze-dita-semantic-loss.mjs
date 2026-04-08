#!/usr/bin/env node
/**
 * DITA-to-MDX Semantic Loss Analyzer
 * Scans all MDX files in docs/user-guide/ and catalogs conversion artifacts.
 * Outputs a downloadable JSON report.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const USER_GUIDE = join(ROOT, 'docs', 'user-guide');
const OUTPUT = join(ROOT, 'static', 'dita-semantic-loss-report.json');

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

function extractFrontmatter(content) {
  const norm = content.replace(/\r\n/g, '\n');
  const m = norm.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    // skip continuation lines (indented)
    if (/^\s/.test(line) && !line.includes(':')) continue;
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      // strip YAML quotes
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1);
      }
      fm[key] = val;
    }
  }
  return fm;
}

function getBody(content) {
  const norm = content.replace(/\r\n/g, '\n');
  const m = norm.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1] : content;
}

// ── detection functions ──────────────────────────────────────────────────────

function detectDuplicatedContent(body) {
  const issues = [];
  // Pattern: bullet list items followed by the same text as plain paragraphs
  const bulletLists = [...body.matchAll(/^- (.+)$/gm)];
  const bulletTexts = bulletLists.map(m => m[1].trim());
  
  for (const text of bulletTexts) {
    if (text.length < 10) continue; // skip short items
    // Check if this text appears as a standalone line (not in a bullet)
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escaped}$`, 'gm');
    const matches = [...body.matchAll(re)];
    if (matches.length > 1) {
      issues.push({
        type: 'DUPLICATED_LIST_CONTENT',
        severity: 'HIGH',
        text: text.slice(0, 80),
        occurrences: matches.length,
        ditaOrigin: '<ul><li> or <ol><li> with lost nesting'
      });
    }
  }
  
  // Also detect numbered list items duplicated
  const numberedItems = [...body.matchAll(/^\d+\.\s+(.+)$/gm)];
  for (const m of numberedItems) {
    const text = m[1].trim();
    if (text.length < 15) continue;
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escaped}$`, 'gm');
    const matches = [...body.matchAll(re)];
    if (matches.length > 1) {
      issues.push({
        type: 'DUPLICATED_STEP_CONTENT',
        severity: 'HIGH',
        text: text.slice(0, 80),
        occurrences: matches.length,
        ditaOrigin: '<steps>/<step>/<cmd> with <info> or <stepresult>'
      });
    }
  }
  
  return issues;
}

function detectMissingAdmonitions(body) {
  const issues = [];
  const patterns = [
    { re: /\b(?:Note|NOTE)[:\s]+(.{10,80})/g, type: 'note', dita: '<note>' },
    { re: /\b(?:Warning|WARNING)[:\s]+(.{10,80})/g, type: 'warning', dita: '<note type="warning">' },
    { re: /\b(?:Caution|CAUTION)[:\s]+(.{10,80})/g, type: 'caution', dita: '<note type="caution">' },
    { re: /\b(?:Important|IMPORTANT)[:\s]+(.{10,80})/g, type: 'important', dita: '<note type="important">' },
    { re: /\b(?:Tip|TIP)[:\s]+(.{10,80})/g, type: 'tip', dita: '<note type="tip">' },
    { re: /\bremember[:\s]+/gi, type: 'note', dita: '<note>' },
    { re: /\bensure that\b/gi, type: 'important', dita: '<note type="important">' },
  ];
  
  for (const { re, type, dita } of patterns) {
    const matches = [...body.matchAll(re)];
    for (const m of matches) {
      // Skip if already in an admonition
      if (body.slice(Math.max(0, m.index - 20), m.index).includes(':::')) continue;
      issues.push({
        type: 'MISSING_ADMONITION',
        severity: 'HIGH',
        admonitionType: type,
        text: m[0].slice(0, 80),
        ditaOrigin: dita
      });
    }
  }
  return issues;
}

function detectLostTaskStructure(body, filename) {
  const issues = [];
  const isTask = basename(filename).startsWith('t-');
  
  if (isTask) {
    // Check for prerequisites pattern
    const hasPrereq = /\b(?:prerequisite|before you begin|before starting|prior to)\b/i.test(body);
    const hasPrereqTag = /:::info|<Prereq|## Prerequisite/i.test(body);
    if (hasPrereq && !hasPrereqTag) {
      issues.push({
        type: 'MISSING_PREREQ',
        severity: 'MEDIUM',
        ditaOrigin: '<prereq>',
        suggestion: 'Wrap in <Prereq> component or :::info admonition'
      });
    }
    
    // Check for result/postreq patterns
    const hasResult = /\b(?:the result|after completing|once complete|when finished)\b/i.test(body);
    if (hasResult) {
      issues.push({
        type: 'MISSING_RESULT',
        severity: 'LOW',
        ditaOrigin: '<result> or <postreq>',
        suggestion: 'Wrap in <TaskResult> component'
      });
    }
    
    // Check for numbered steps without proper structure
    const numberedSteps = [...body.matchAll(/^\d+\.\s/gm)];
    if (numberedSteps.length > 0) {
      // Check if there's contextual text between steps that might be info/stepresult
      const lines = body.split('\n');
      let inStep = false;
      let orphanedLines = 0;
      for (const line of lines) {
        if (/^\d+\.\s/.test(line)) {
          inStep = true;
        } else if (inStep && line.trim() && !/^[-*]\s/.test(line) && !/^\d+\.\s/.test(line) && !line.startsWith('#') && !line.startsWith('|')) {
          orphanedLines++;
        }
      }
      if (orphanedLines > 2) {
        issues.push({
          type: 'ORPHANED_STEP_CONTENT',
          severity: 'HIGH',
          orphanedLines,
          ditaOrigin: '<info>, <stepresult>, or <substep> within <step>',
          suggestion: 'Content between steps may be lost step info/results'
        });
      }
    }
  }
  return issues;
}

function detectLostUISemantics(body) {
  const issues = [];
  
  // Bold text that looks like UI elements
  const boldUI = [...body.matchAll(/\*\*([^*]+)\*\*/g)];
  let uiControlCount = 0;
  let menuCascadeCount = 0;
  
  for (const m of boldUI) {
    const text = m[1];
    // Detect menu cascades (e.g., "File > Save" patterns)
    if (text.includes('>') || text.includes('→')) {
      menuCascadeCount++;
    }
    // UI controls (buttons, tabs, dialog names)
    if (/\b(tab|button|dialog|window|screen|menu|checkbox|dropdown|panel|click|select)\b/i.test(body.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50))) {
      uiControlCount++;
    }
  }
  
  if (uiControlCount > 0) {
    issues.push({
      type: 'LOST_UICONTROL',
      severity: 'MEDIUM',
      count: uiControlCount,
      ditaOrigin: '<uicontrol>',
      note: 'Bold text used for UI elements—semantic distinction lost'
    });
  }
  if (menuCascadeCount > 0) {
    issues.push({
      type: 'LOST_MENUCASCADE',
      severity: 'MEDIUM',
      count: menuCascadeCount,
      ditaOrigin: '<menucascade><uicontrol>'
    });
  }
  
  // Keyboard shortcuts in plain text
  const kbdPatterns = [...body.matchAll(/\b(?:Press|press|Type|type|Enter|enter)\s+([\w+]+(?:\s*\+\s*\w+)*)/g)];
  if (kbdPatterns.length > 0) {
    issues.push({
      type: 'LOST_KBD',
      severity: 'LOW',
      count: kbdPatterns.length,
      examples: kbdPatterns.slice(0, 3).map(m => m[0]),
      ditaOrigin: '<userinput> or keyboard shortcut markup'
    });
  }
  
  return issues;
}

function detectMissingImages(body) {
  const issues = [];
  const textRefs = [...body.matchAll(/\b(?:as shown|following (?:image|figure|screenshot)|see the (?:image|figure)|displayed below|shown below|image below)\b/gi)];
  const hasImageTag = /<img|<ZoomableImage|!\[/.test(body);
  
  if (textRefs.length > 0 && !hasImageTag) {
    issues.push({
      type: 'MISSING_IMAGE_REFERENCE',
      severity: 'MEDIUM',
      count: textRefs.length,
      examples: textRefs.slice(0, 3).map(m => m[0]),
      ditaOrigin: '<image> or <fig>',
      note: 'Text references an image but no image tag found'
    });
  }
  return issues;
}

function detectMalformedTables(body) {
  const issues = [];

  // Known table header words that appear as standalone lines in broken tables
  const TABLE_HEADERS = new Set([
    'Item', 'Description', 'Setting', 'Settings', 'Parameter', 'Value',
    'Command', 'Response', 'Problem', 'Solution', 'Section', 'Argument',
    'Optional', 'Feature', 'Function', 'Mode', 'Type', 'Name', 'Format',
    'Status', 'Result', 'UI Element', 'Action', 'Condition', 'Option',
    'Details', 'Field',
  ]);

  const lines = body.split('\n');
  const hasProperTable = /^\|.+\|$/m.test(body) && /^\|[-: |]+\|$/m.test(body);

  // ── Detect broken table headers (two consecutive header words on standalone lines) ──
  const brokenTables = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const curr = lines[i].trim();
    const next = lines[i + 1].trim();
    if (TABLE_HEADERS.has(curr) && TABLE_HEADERS.has(next) &&
        !lines[i].includes('|') && !lines[i].startsWith('#') && !lines[i].startsWith('-')) {
      // Found a broken table header pair — now count how many data rows follow
      const headerLine = i;
      const headers = [curr, next];

      // Look for additional header words
      let j = i + 2;
      while (j < lines.length && TABLE_HEADERS.has(lines[j].trim())) {
        headers.push(lines[j].trim());
        j++;
      }

      // Count data lines that follow (until next heading, blank-blank, or end)
      let dataLines = 0;
      let k = j;
      let consecutiveBlanks = 0;
      while (k < lines.length) {
        const l = lines[k].trim();
        if (l.startsWith('#')) break;
        if (l === '') {
          consecutiveBlanks++;
          // Two blank lines in a row likely means end of table section
          if (consecutiveBlanks >= 2) break;
        } else {
          consecutiveBlanks = 0;
          dataLines++;
        }
        k++;
      }

      // Estimate number of rows: data lines / number of columns
      const estimatedColumns = headers.length;
      const estimatedRows = Math.ceil(dataLines / estimatedColumns);

      brokenTables.push({
        line: headerLine + 1,
        headers,
        estimatedColumns,
        estimatedRows,
        dataLines,
        endLine: k
      });

      // Skip past this table to avoid double-counting
      i = k - 1;
    }
  }

  if (brokenTables.length > 0) {
    const totalCells = brokenTables.reduce((sum, t) => sum + t.dataLines, 0);
    issues.push({
      type: 'BROKEN_TABLE_STRUCTURE',
      severity: 'HIGH',
      tableCount: brokenTables.length,
      totalDataCells: totalCells,
      ditaOrigin: '<table>, <simpletable>, or <properties> converted without pipe delimiters',
      note: 'Table headers and data appear as plain text on separate lines instead of Markdown pipe-delimited tables',
      tables: brokenTables.map(t => ({
        line: t.line,
        headers: t.headers,
        estimatedRows: t.estimatedRows,
        estimatedColumns: t.estimatedColumns
      }))
    });
  }

  // ── Detect orphan table-header words (single header word on its own line) ──
  let orphanHeaderCount = 0;
  const orphanExamples = [];
  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i].trim();
    if (TABLE_HEADERS.has(curr) && !lines[i].includes('|') &&
        !lines[i].startsWith('#') && !lines[i].startsWith('-')) {
      // Already counted in broken table pairs above? skip
      const alreadyCounted = brokenTables.some(t => i >= t.line - 1 && i < t.line - 1 + t.headers.length);
      if (!alreadyCounted) {
        orphanHeaderCount++;
        if (orphanExamples.length < 3) {
          orphanExamples.push({ line: i + 1, text: curr });
        }
      }
    }
  }

  if (orphanHeaderCount > 0) {
    issues.push({
      type: 'ORPHAN_TABLE_HEADERS',
      severity: 'MEDIUM',
      count: orphanHeaderCount,
      ditaOrigin: '<table> or <simpletable> column headers appearing as standalone text',
      note: 'Individual table header words appear on their own lines, separated from their data',
      examples: orphanExamples
    });
  }

  // ── Check if file has NO proper Markdown tables despite having table-like content ──
  if (!hasProperTable && (brokenTables.length > 0 || orphanHeaderCount >= 2)) {
    issues.push({
      type: 'NO_MARKDOWN_TABLES',
      severity: 'HIGH',
      ditaOrigin: '<table> or <simpletable>',
      note: 'File contains table-like content but zero properly formatted Markdown tables'
    });
  }

  return issues;
}

function detectEmptyOrStubContent(body) {
  const issues = [];
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    issues.push({
      type: 'EMPTY_BODY',
      severity: 'HIGH',
      ditaOrigin: 'Content likely in nested DITA topics not merged into MDX'
    });
  } else if (trimmed.split('\n').filter(l => l.trim()).length <= 2) {
    issues.push({
      type: 'STUB_CONTENT',
      severity: 'MEDIUM',
      bodyLength: trimmed.length,
      ditaOrigin: 'Short description only; body content may be in child topics'
    });
  }
  return issues;
}

function detectTruncatedDescription(fm) {
  const issues = [];
  if (fm.description === "''" || fm.description === '' || !fm.description) {
    issues.push({
      type: 'EMPTY_DESCRIPTION',
      severity: 'MEDIUM',
      ditaOrigin: '<shortdesc>'
    });
  } else if (fm.description && !fm.description.endsWith('.') && !fm.description.endsWith('"') && !fm.description.endsWith("'") && fm.description.length > 5) {
    issues.push({
      type: 'TRUNCATED_DESCRIPTION',
      severity: 'LOW',
      text: fm.description.slice(0, 80),
      ditaOrigin: '<shortdesc> or <abstract>'
    });
  }
  return issues;
}

function detectLostDefinitionLists(body) {
  const issues = [];
  // Pattern: bold term followed by newline then description
  const dlPattern = [...body.matchAll(/^\*\*([^*]+)\*\*\s*\n([^#\-*|\n][^\n]+)/gm)];
  if (dlPattern.length >= 2) {
    issues.push({
      type: 'LOST_DEFINITION_LIST',
      severity: 'MEDIUM',
      count: dlPattern.length,
      ditaOrigin: '<dl><dlentry><dt>/<dd>',
      note: 'Bold terms followed by descriptions may have been definition lists'
    });
  }
  return issues;
}

// Words that dangle at end of line when a <uicontrol> tag was stripped
const DANGLING_WORDS = new Set([
  'the', 'a', 'an', 'in', 'for', 'and', 'or', 'to', 'on', 'of', 'as', 'by',
  'at', 'with', 'from', 'into', 'this', 'that', 'your',
  'click', 'select', 'enable', 'configure', 'using', 'enter', 'type', 'press',
  'between', 'over', 'before', 'after', 'under', 'access', 'toggle',
  'observe', 'navigate',
]);

function detectFragmentedSentences(body) {
  const issues = [];
  const lines = body.split('\n');
  let danglingCount = 0;
  let orphanInlineCount = 0;
  const examples = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const curr = lines[i];
    const next = lines[i + 1];
    if (curr.trim() === '' || next.trim() === '') continue;
    if (curr.startsWith('|') || curr.startsWith('```') || curr.startsWith('#') ||
        curr.startsWith('---') || curr.startsWith(':::')) continue;
    if (next.startsWith('|') || next.startsWith('```') || next.startsWith('#') ||
        next.startsWith('---') || next.startsWith('-') || next.startsWith(':::')) continue;

    const currTrimmed = curr.trimEnd();
    const nextTrimmed = next.trim();
    const nextWords = nextTrimmed.split(/\s+/).length;

    // Pattern 1: Line ends with dangling preposition/verb
    const danglingEnd = /\b(the|in|for|and|or|to|on|of|a|an|is|are|as|by|at|with|from|into|click|select|enable|configure|using|enter|type|press|between|over|before|after|access|toggle|observe|navigate)$/i;
    if (danglingEnd.test(currTrimmed) && nextWords <= 6) {
      danglingCount++;
      if (examples.length < 5) {
        examples.push({
          line: i + 1,
          type: 'DANGLING_PREPOSITION',
          text: `${currTrimmed.slice(-40)} | ${nextTrimmed}`
        });
      }
    }

    // Pattern 2: Short orphan line (1-4 words) between text lines
    if (i > 0 && nextWords >= 1 && nextWords <= 4) {
      const prev = lines[i - 1];
      const prevTrimmed = prev.trimEnd();
      if (prevTrimmed !== '' && !/[.!?:;|]$/.test(prevTrimmed) &&
          !/^[-*#|`:]/.test(curr.trim()) && !/^\d+\./.test(curr.trim())) {
        const currWords = curr.trim().split(/\s+/).length;
        if (currWords >= 1 && currWords <= 4) {
          orphanInlineCount++;
        }
      }
    }
  }

  if (danglingCount > 0) {
    issues.push({
      type: 'FRAGMENTED_UICONTROL',
      severity: 'HIGH',
      count: danglingCount,
      ditaOrigin: '<uicontrol> inline tag converted to line break',
      note: 'Sentences broken where <uicontrol> tags were stripped, creating dangling prepositions',
      examples
    });
  }
  if (orphanInlineCount > 0) {
    issues.push({
      type: 'ORPHAN_INLINE_ELEMENT',
      severity: 'MEDIUM',
      count: orphanInlineCount,
      ditaOrigin: '<uicontrol>, <wintitle>, or <codeph> content on standalone line',
      note: 'Short 1-4 word lines that were formerly inline DITA elements'
    });
  }
  return issues;
}

function detectTruncatedStepStubs(body) {
  const issues = [];
  const lines = body.split('\n');

  // Find runs of consecutive numbered steps where most end with dangling words
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^\s*\d+\.\s+(.*)/);
    if (!m) { i++; continue; }

    // Collect consecutive numbered steps
    const stubs = [];
    let j = i;
    while (j < lines.length && /^\s*\d+\.\s/.test(lines[j])) {
      const stepText = lines[j].match(/^\s*\d+\.\s+(.*)/)[1].trim();
      stubs.push({ text: stepText, line: j + 1 });
      j++;
    }

    if (stubs.length >= 2) {
      const truncatedCount = stubs.filter(s => {
        const lastWord = s.text.match(/(\S+)$/);
        return lastWord && DANGLING_WORDS.has(lastWord[1].toLowerCase().replace(/[.,;:!?]+$/, ''));
      }).length;

      if (truncatedCount >= stubs.length * 0.4) {
        issues.push({
          type: 'TRUNCATED_STEP_STUBS',
          severity: 'HIGH',
          startLine: stubs[0].line,
          stepCount: stubs.length,
          truncatedCount,
          ditaOrigin: '<steps>/<step>/<cmd> truncated at <uicontrol> boundary',
          note: 'Numbered steps truncated where inline <uicontrol> tags appeared; full text emitted as paragraphs below',
          examples: stubs.slice(0, 4).map(s => s.text.slice(0, 60))
        });
      }
    }
    i = j;
  }
  return issues;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = await walkMdx(USER_GUIDE);
  console.log(`Analyzing ${files.length} MDX files in docs/user-guide/...`);
  
  const report = {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    summary: {
      totalIssues: 0,
      bySeverity: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      byType: {},
      ditaElementsLost: new Set(),
    },
    files: [],
    recommendations: []
  };
  
  for (const filepath of files) {
    const content = await readFile(filepath, 'utf-8');
    const relPath = relative(ROOT, filepath).replace(/\\/g, '/');
    const fm = extractFrontmatter(content);
    const body = getBody(content);
    
    const issues = [
      ...detectDuplicatedContent(body),
      ...detectMissingAdmonitions(body),
      ...detectLostTaskStructure(body, filepath),
      ...detectLostUISemantics(body),
      ...detectMissingImages(body),
      ...detectMalformedTables(body),
      ...detectEmptyOrStubContent(body),
      ...detectTruncatedDescription(fm),
      ...detectLostDefinitionLists(body),
      ...detectFragmentedSentences(body),
      ...detectTruncatedStepStubs(body),
    ];
    
    if (issues.length > 0) {
      report.files.push({
        path: relPath,
        fileType: basename(filepath).startsWith('t-') ? 'task' :
                  basename(filepath).startsWith('c-') ? 'concept' :
                  basename(filepath).startsWith('r-') ? 'reference' :
                  basename(filepath).startsWith('g-') ? 'guide' : 'other',
        issueCount: issues.length,
        issues
      });
      
      report.summary.totalIssues += issues.length;
      for (const issue of issues) {
        report.summary.bySeverity[issue.severity] = (report.summary.bySeverity[issue.severity] || 0) + 1;
        report.summary.byType[issue.type] = (report.summary.byType[issue.type] || 0) + 1;
        if (issue.ditaOrigin) report.summary.ditaElementsLost.add(issue.ditaOrigin);
      }
    }
  }
  
  // Convert Set to array for JSON
  report.summary.ditaElementsLost = [...report.summary.ditaElementsLost];
  
  // Sort files by issue count desc
  report.files.sort((a, b) => b.issueCount - a.issueCount);
  
  // ── Cleanup history ───────────────────────────────────────────────────────
  report.cleanupHistory = {
    description: 'Automated cleanup passes applied to remediate DITA conversion artifacts',
    passes: [
      {
        id: 'PASS-01',
        name: 'Duplicate Content Removal',
        script: 'scripts/cleanup-dita-mdx.mjs',
        description: 'Removed plain-text copies of content that already appeared in properly formatted bullet/numbered lists. The DITA converter emitted list item text at both the <li> container level and as child text nodes, causing every list item to appear twice.',
        rootCause: 'DITA <ul>/<ol>/<steps> elements have nested child elements (<p>, <note>, <info>) that the converter extracted separately from the parent <li>/<step> container.',
        filesModified: 193,
        changesApplied: 448,
        issueTypes: ['DUPLICATED_LIST_CONTENT', 'DUPLICATED_STEP_CONTENT'],
        ditaElementsAddressed: ['<ul><li>', '<ol><li>', '<steps>/<step>/<cmd>'],
        impactMetric: { before: { highSeverity: 52 }, after: { highSeverity: 24 }, reduction: '54%' }
      },
      {
        id: 'PASS-02',
        name: 'Fragmented Sentence Rejoining',
        script: 'scripts/rejoin-fragmented-sentences.mjs',
        description: 'Stitched back together sentences broken by DITA <uicontrol> tag stripping. The converter emitted each <uicontrol> value on its own line instead of keeping it inline, fragmenting fluid sentences into 3-10 separate lines.',
        rootCause: 'DITA inline elements (<uicontrol>, <wintitle>, <codeph>) were stripped of tags but their content was emitted as standalone lines rather than kept inline within the parent sentence.',
        filesModified: 81,
        changesApplied: 240,
        linesRecovered: 692,
        issueTypes: ['FRAGMENTED_UICONTROL', 'ORPHAN_INLINE_ELEMENT'],
        ditaElementsAddressed: ['<uicontrol>', '<wintitle>', '<codeph>'],
        impactMetric: { before: { fragments: 638 }, after: { fragments: 184 }, reduction: '71%' },
        technique: 'Bold-wrapped rejoined UI terms (**Admin Settings**) to preserve <uicontrol> semantic distinction'
      },
      {
        id: 'PASS-03',
        name: 'Truncated Step Reconstruction',
        script: 'scripts/reconstruct-truncated-steps.mjs',
        description: 'Reconstructed numbered/bullet list items that were truncated at <uicontrol> tag boundaries. The converter emitted step stubs (e.g., "1. Select the") with the full step text as plain paragraphs below. Matched each stub to its full-text counterpart by prefix matching and merged them.',
        rootCause: 'DITA <step>/<cmd> content was split at inline <uicontrol> tags: the text before the tag became a truncated numbered item, the full text (with tag content) was emitted separately below.',
        filesModified: 26,
        changesApplied: 30,
        issueTypes: ['TRUNCATED_STEP_STUBS'],
        ditaElementsAddressed: ['<steps>/<step>/<cmd>', '<uicontrol> within <cmd>'],
        impactMetric: { before: { fragments: 184 }, after: { fragments: 146 }, reduction: '21%' }
      },
      {
        id: 'PASS-04',
        name: 'Broken Table Reconstruction',
        script: 'scripts/reconstruct-broken-tables.mjs',
        description: 'Reconstructed DITA <simpletable>/<table>/<properties> content that was converted to plain text back into proper Markdown pipe-delimited tables. Detected consecutive header words (e.g., "Setting/Description") followed by alternating key/description blocks and rebuilt them as Markdown tables.',
        rootCause: 'DITA table elements lost all pipe-delimited structure during conversion. Table headers and cell data appeared as plain text on separate lines.',
        filesModified: 49,
        tablesReconstructed: 52,
        rowsRecovered: 276,
        issueTypes: ['BROKEN_TABLE_STRUCTURE', 'NO_MARKDOWN_TABLES', 'ORPHAN_TABLE_HEADERS'],
        ditaElementsAddressed: ['<simpletable>', '<table>', '<properties>', '<sthead>', '<strow>', '<stentry>'],
        impactMetric: { before: { brokenTables: 51, properTables: 0 }, after: { brokenTables: 2, properTables: 49 }, reduction: '96%' },
        technique: 'Pattern-matched consecutive header words, parsed key/description blocks, rebuilt as Markdown pipe-delimited tables. Manually corrected 4-column tables and Problem/Solution tables.'
      }
    ],
    cumulativeImpact: {
      originalFragments: 638,
      remainingFragments: 146,
      totalReduction: '77%',
      originalHighSeverity: 52,
      remainingHighSeverity: 'see current analysis',
      duplicateLinesRemoved: 448,
      sentencesRejoined: 240,
      stepsReconstructed: 30,
      tablesReconstructed: 52,
      tableRowsRecovered: 276
    }
  };

  // ── Remaining issues categorization ────────────────────────────────────────
  report.remainingIssues = {
    description: 'Issues remaining after all automated cleanup passes',
    categories: [
      {
        type: 'Dangling prepositions in complex structures',
        count: 43,
        note: 'Mostly inside table cells or multi-clause sentences where auto-rejoin risked corrupting content',
        autoFixable: false
      },
      {
        type: 'Orphan inline fragments',
        count: 103,
        note: 'Primarily table headers/content misdetected as fragments, code blocks, and edge-case stubs with no prefix match',
        autoFixable: false
      },
      {
        type: 'Unmatched step stubs',
        note: 'Steps where the full-text version had already been partially rejoined, breaking the prefix match',
        autoFixable: false
      },
      {
        type: 'Broken table structures',
        count: report.files.filter(f => f.issues.some(i => i.type === 'BROKEN_TABLE_STRUCTURE')).length,
        note: 'DITA <simpletable>, <table>, and <properties> elements lost all pipe-delimited structure during conversion; headers and data appear as plain text lines',
        autoFixable: false,
        priority: 'HIGH'
      }
    ]
  };

  // Add recommendations
  report.recommendations = [
    {
      id: 'REC-01',
      category: 'Custom Components',
      title: 'Create <DitaSteps> component for procedural content',
      description: 'Wrap numbered procedures in <DitaSteps> to restore <steps>/<step>/<cmd>/<info>/<stepresult> hierarchy',
      impactedDitaElements: ['<steps>', '<step>', '<cmd>', '<info>', '<stepresult>', '<substep>'],
      estimatedFilesImpacted: report.files.filter(f => f.issues.some(i => i.type === 'ORPHANED_STEP_CONTENT' || i.type === 'DUPLICATED_STEP_CONTENT')).length
    },
    {
      id: 'REC-02',
      category: 'Native Admonitions',
      title: 'Convert note/warning/caution text to Docusaurus admonitions',
      description: 'Use :::note, :::warning, :::caution, :::tip, :::info syntax for DITA <note> equivalents',
      impactedDitaElements: ['<note>', '<note type="warning">', '<note type="caution">', '<note type="important">', '<note type="tip">'],
      estimatedFilesImpacted: report.files.filter(f => f.issues.some(i => i.type === 'MISSING_ADMONITION')).length
    },
    {
      id: 'REC-03',
      category: 'Content Cleanup',
      title: 'Remove duplicated list/step content',
      description: 'Delete plain-text copies of content that already appears in properly formatted lists',
      impactedDitaElements: ['<ul>', '<ol>', '<steps>'],
      estimatedFilesImpacted: report.files.filter(f => f.issues.some(i => i.type.startsWith('DUPLICATED'))).length
    },
    {
      id: 'REC-04',
      category: 'Custom Components',
      title: 'Create <Prereq> and <TaskResult> components',
      description: 'Restore DITA prereq/postreq/result sections with semantic components',
      impactedDitaElements: ['<prereq>', '<postreq>', '<result>'],
      estimatedFilesImpacted: report.files.filter(f => f.issues.some(i => i.type === 'MISSING_PREREQ' || i.type === 'MISSING_RESULT')).length
    },
    {
      id: 'REC-05',
      category: 'Custom Components',
      title: 'Create <UIControl> and <MenuCascade> components',
      description: 'Recover <uicontrol> and <menucascade> semantics for UI element references',
      impactedDitaElements: ['<uicontrol>', '<menucascade>', '<wintitle>'],
      estimatedFilesImpacted: report.files.filter(f => f.issues.some(i => i.type === 'LOST_UICONTROL' || i.type === 'LOST_MENUCASCADE')).length
    },
    {
      id: 'REC-06',
      category: 'Content Recovery',
      title: 'Recover missing image references',
      description: 'Locate original DITA image files and add proper <ZoomableImage> or <img> tags',
      impactedDitaElements: ['<image>', '<fig>'],
      estimatedFilesImpacted: report.files.filter(f => f.issues.some(i => i.type === 'MISSING_IMAGE_REFERENCE')).length
    },
    {
      id: 'REC-07',
      category: 'Content Cleanup',
      title: 'Rejoin remaining fragmented sentences',
      description: 'Manually rejoin the ~43 remaining dangling preposition fragments in complex structures (tables, multi-clause sentences)',
      impactedDitaElements: ['<uicontrol>', '<wintitle>'],
      estimatedFilesImpacted: report.files.filter(f => f.issues.some(i => i.type === 'FRAGMENTED_UICONTROL')).length,
      status: 'PARTIALLY_RESOLVED',
      automated: '77% resolved by PASS-02 and PASS-03'
    },
    {
      id: 'REC-08',
      category: 'Content Cleanup',
      title: 'Reconstruct remaining truncated step stubs',
      description: 'Manually fix step stubs that could not be auto-matched to their full-text counterparts',
      impactedDitaElements: ['<steps>/<step>/<cmd>'],
      estimatedFilesImpacted: report.files.filter(f => f.issues.some(i => i.type === 'TRUNCATED_STEP_STUBS')).length,
      status: 'PARTIALLY_RESOLVED',
      automated: 'Majority resolved by PASS-03; edge cases remain'
    },
    {
      id: 'REC-09',
      category: 'Content Recovery',
      title: 'Reconstruct broken Markdown tables from plain-text table remnants',
      description: 'DITA <simpletable>/<table>/<properties> elements were converted to plain text with header words on standalone lines and data as paragraphs. Manually reconstruct as proper Markdown pipe-delimited tables.',
      impactedDitaElements: ['<simpletable>', '<table>', '<properties>', '<sthead>', '<strow>', '<stentry>'],
      estimatedFilesImpacted: report.files.filter(f => f.issues.some(i => i.type === 'BROKEN_TABLE_STRUCTURE')).length,
      status: 'MOSTLY_RESOLVED',
      automated: '96% of broken tables reconstructed by PASS-04; 2 files with residual issues remain'
    }
  ];
  
  await writeFile(OUTPUT, JSON.stringify(report, null, 2), 'utf-8');
  
  // Print summary
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  DITA-to-MDX Semantic Loss Report');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Files analyzed:    ${report.totalFiles}`);
  console.log(`  Files with issues: ${report.files.length}`);
  console.log(`  Total issues:      ${report.summary.totalIssues}`);
  console.log(`  HIGH severity:     ${report.summary.bySeverity.HIGH}`);
  console.log(`  MEDIUM severity:   ${report.summary.bySeverity.MEDIUM}`);
  console.log(`  LOW severity:      ${report.summary.bySeverity.LOW}`);
  console.log('──────────────────────────────────────────────────────');
  console.log('  Issues by type:');
  for (const [type, count] of Object.entries(report.summary.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }
  console.log('──────────────────────────────────────────────────────');
  console.log('  Lost DITA elements:');
  for (const el of report.summary.ditaElementsLost) {
    console.log(`    ${el}`);
  }
  console.log('──────────────────────────────────────────────────────');
  console.log(`  Report saved to: ${relative(ROOT, OUTPUT)}`);
  console.log('══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
