/**
 * scripts/generate-build-report.test.mjs
 * ============================================================================
 * Unit tests for generate-build-report.mjs helper functions.
 *
 * Run with:  node --test scripts/generate-build-report.test.mjs
 * (Node ≥20 built-in test runner; no extra dependencies required.)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseYamlBlock,
  parseInlineArray,
  parseFrontMatter,
  detectPlaceholders,
  countWords,
  detectSection,
  guessContentType,
  guessDeviceType,
  guessUseCase,
  guessRole,
  guessSkillLevel,
  guessStatus,
  buildGuesses,
  scoreCompleteness,
  walk,
} from './generate-build-report.mjs';

// ---------------------------------------------------------------------------
// parseInlineArray
// ---------------------------------------------------------------------------
describe('parseInlineArray', () => {
  test('parses double-quoted values', () => {
    assert.deepEqual(parseInlineArray('["a","b","c"]'), ['a', 'b', 'c']);
  });

  test('parses single-quoted values', () => {
    assert.deepEqual(parseInlineArray("['foo', 'bar']"), ['foo', 'bar']);
  });

  test('returns empty array for empty brackets', () => {
    assert.deepEqual(parseInlineArray('[]'), []);
  });

  test('trims whitespace around items', () => {
    assert.deepEqual(parseInlineArray('[ "x" , "y" ]'), ['x', 'y']);
  });
});

// ---------------------------------------------------------------------------
// parseYamlBlock
// ---------------------------------------------------------------------------
describe('parseYamlBlock', () => {
  test('parses simple key:value pairs', () => {
    const yaml = `title: My Title\nstatus: Published`;
    const result = parseYamlBlock(yaml);
    assert.equal(result.title, 'My Title');
    assert.equal(result.status, 'Published');
  });

  test('strips inline comments', () => {
    const yaml = `version: '9.4' # e.g., 10.0.xxx`;
    const result = parseYamlBlock(yaml);
    assert.equal(result.version, '9.4');
  });

  test('parses inline JSON arrays', () => {
    const yaml = `keywords: ["a", "b", "c"]`;
    const result = parseYamlBlock(yaml);
    assert.deepEqual(result.keywords, ['a', 'b', 'c']);
  });

  test('parses inline single-quoted arrays', () => {
    const yaml = `use_case: ['OCR', 'GPIO']`;
    const result = parseYamlBlock(yaml);
    assert.deepEqual(result.use_case, ['OCR', 'GPIO']);
  });

  test('parses block sequence arrays', () => {
    const yaml = `role:\n  - Integrator/Developer\n  - Controls Engineer`;
    const result = parseYamlBlock(yaml);
    assert.deepEqual(result.role, ['Integrator/Developer', 'Controls Engineer']);
  });

  test('ignores comment-only lines', () => {
    const yaml = `# This is a comment\ntitle: Hello`;
    const result = parseYamlBlock(yaml);
    assert.equal(result.title, 'Hello');
    assert.equal(Object.keys(result).length, 1);
  });

  test('handles empty value as null', () => {
    const yaml = `last_reviewed:`;
    const result = parseYamlBlock(yaml);
    assert.equal(result.last_reviewed, null);
  });

  test('strips surrounding quotes from string values', () => {
    const yaml = `author: 'bnc438'`;
    const result = parseYamlBlock(yaml);
    assert.equal(result.author, 'bnc438');
  });
});

// ---------------------------------------------------------------------------
// parseFrontMatter
// ---------------------------------------------------------------------------
describe('parseFrontMatter', () => {
  test('returns empty frontmatter for content without delimiters', () => {
    const { frontMatter, body } = parseFrontMatter('# Hello\nBody text.');
    assert.deepEqual(frontMatter, {});
    assert.ok(body.includes('# Hello'));
  });

  test('extracts frontmatter and body correctly', () => {
    const content = `---\ntitle: Test Doc\nstatus: Published\n---\n# Body\nSome text.`;
    const { frontMatter, body } = parseFrontMatter(content);
    assert.equal(frontMatter.title, 'Test Doc');
    assert.equal(frontMatter.status, 'Published');
    assert.ok(body.includes('# Body'));
  });

  test('handles missing closing delimiter gracefully', () => {
    const { frontMatter, body } = parseFrontMatter('---\ntitle: Unclosed');
    assert.deepEqual(frontMatter, {});
  });
});

// ---------------------------------------------------------------------------
// detectPlaceholders
// ---------------------------------------------------------------------------
describe('detectPlaceholders', () => {
  test('detects bracket placeholders in frontmatter values', () => {
    const fm = { device_type: '[Device Type]', title: 'Real Title' };
    const results = detectPlaceholders(fm, '');
    assert.ok(results.some((p) => p.field === 'device_type'));
    assert.ok(!results.some((p) => p.field === 'title'));
  });

  test('detects TODO and TBD values', () => {
    const fm = { status: 'TBD', author: 'TODO' };
    const results = detectPlaceholders(fm, '');
    assert.equal(results.length, 2);
  });

  test('detects placeholders in body text', () => {
    const results = detectPlaceholders({}, 'Some [Placeholder] here and [Another].');
    assert.ok(results.some((p) => p.field === '_body'));
  });

  test('returns empty array for clean content', () => {
    const fm = { title: 'Clean Doc', status: 'Published' };
    const results = detectPlaceholders(fm, 'Clean body text with no outstanding issues.');
    assert.equal(results.length, 0);
  });
});

// ---------------------------------------------------------------------------
// countWords
// ---------------------------------------------------------------------------
describe('countWords', () => {
  test('counts words in normal text', () => {
    assert.equal(countWords('Hello world this is a test'), 6);
  });

  test('returns 0 for empty string', () => {
    assert.equal(countWords(''), 0);
  });

  test('handles extra whitespace', () => {
    assert.equal(countWords('  hello   world  '), 2);
  });
});

// ---------------------------------------------------------------------------
// detectSection
// ---------------------------------------------------------------------------
describe('detectSection', () => {
  // Use real paths that exist in the repo so path.relative(docsRoot, ...) works correctly.
  test('returns "root" for top-level docs', () => {
    const p = new URL('../docs/t-aurora-js-about-this-guide.mdx', import.meta.url).pathname;
    assert.equal(detectSection(p), 'root');
  });

  test('returns subdirectory name for nested docs', () => {
    const p = new URL('../docs/licensing/t-aurora-deactivating-a-license.mdx', import.meta.url).pathname;
    assert.equal(detectSection(p), 'licensing');
  });

  test('returns subdirectory name for release-notes', () => {
    const p = new URL('../docs/release-notes/rn-af-release-notes-9-4.mdx', import.meta.url).pathname;
    assert.equal(detectSection(p), 'release-notes');
  });
});

// ---------------------------------------------------------------------------
// Guessing functions
// ---------------------------------------------------------------------------
describe('guessContentType', () => {
  test('recognises t- prefix as Tutorial', () => {
    assert.equal(guessContentType('t-aurora-js-about.mdx'), 'Tutorial');
  });

  test('recognises c- prefix as Concept', () => {
    assert.equal(guessContentType('c-aurora-environment.mdx'), 'Concept');
  });

  test('recognises r- prefix as Reference', () => {
    assert.equal(guessContentType('r-notational-conventions.mdx'), 'Reference');
  });

  test('recognises g- prefix as Guide', () => {
    assert.equal(guessContentType('g-aurora-mac-address.mdx'), 'Guide');
  });

  test('recognises rn- prefix as Release Notes', () => {
    assert.equal(guessContentType('rn-af-release-notes-9-4.mdx'), 'Release Notes');
  });

  test('recognises index files as Index', () => {
    assert.equal(guessContentType('index.mdx'), 'Index');
  });

  test('returns null for unrecognised prefix', () => {
    assert.equal(guessContentType('unknown-file.mdx'), null);
  });
});

describe('guessDeviceType', () => {
  test('returns Smart Camera when VS device mentioned', () => {
    assert.equal(guessDeviceType('VS70 Guide', 'Camera body text'), 'Smart Camera');
  });

  test('returns Fixed Scanner when FS device mentioned', () => {
    assert.equal(guessDeviceType('FS42 Setup', 'Fixed scanner body'), 'Fixed Scanner');
  });

  test('returns combined when both device types mentioned', () => {
    const result = guessDeviceType('Multi device', 'Use with VS40 and FS80 devices.');
    assert.ok(result.includes('Smart Camera') && result.includes('Fixed Scanner'));
  });

  test('returns null for unrecognised content', () => {
    assert.equal(guessDeviceType('Generic guide', 'No device mentions here.'), null);
  });
});

describe('guessUseCase', () => {
  test('returns OCR use case for OCR content', () => {
    const result = guessUseCase('OCR Tutorial', 'optical character recognition');
    assert.ok(Array.isArray(result));
    assert.ok(result.some((u) => u.includes('OCR')));
  });

  test('returns GPIO use case for GPIO content', () => {
    const result = guessUseCase('GPIO Control', 'configure digital I/O ports');
    assert.ok(Array.isArray(result));
    assert.ok(result.some((u) => u.includes('GPIO')));
  });

  test('returns null for generic content', () => {
    assert.equal(guessUseCase('Introduction', 'Welcome to this guide.'), null);
  });
});

describe('guessRole', () => {
  test('returns developer role for Tutorial', () => {
    const r = guessRole('Tutorial');
    assert.ok(Array.isArray(r));
    assert.ok(r.includes('Integrator/Developer'));
  });

  test('returns system admin for Release Notes', () => {
    const r = guessRole('Release Notes');
    assert.ok(Array.isArray(r));
    assert.ok(r.includes('System Administrator'));
  });

  test('returns null for Index', () => {
    assert.equal(guessRole('Index'), null);
  });
});

describe('guessSkillLevel', () => {
  test('returns All for Release Notes', () => {
    assert.equal(guessSkillLevel('Release Notes', 'v9.4'), 'All');
  });

  test('returns Beginner for Tutorial', () => {
    assert.equal(guessSkillLevel('Tutorial', 'Getting Started'), 'Beginner');
  });

  test('returns Advanced for advanced title', () => {
    assert.equal(guessSkillLevel('Tutorial', 'Advanced debugging techniques'), 'Advanced');
  });
});

describe('guessStatus', () => {
  test('returns Published for rn- files', () => {
    assert.equal(guessStatus('Release Notes', 'rn-af-9-4.mdx'), 'Published');
  });

  test('returns Published for index files', () => {
    assert.equal(guessStatus('Index', 'index.mdx'), 'Published');
  });

  test('returns Draft for other files', () => {
    assert.equal(guessStatus('Tutorial', 't-aurora-guide.mdx'), 'Draft');
  });
});

describe('buildGuesses', () => {
  test('fills content_type when missing from frontmatter', () => {
    const fm = { title: 'My Doc' };
    const guesses = buildGuesses(fm, 't-aurora-guide.mdx', 'Body text');
    assert.ok('content_type' in guesses);
    assert.equal(guesses.content_type, 'Tutorial');
  });

  test('does not overwrite existing frontmatter values', () => {
    const fm = { title: 'My Doc', content_type: 'Reference', status: 'Published' };
    const guesses = buildGuesses(fm, 't-aurora-guide.mdx', 'Body text');
    assert.ok(!('content_type' in guesses));
    assert.ok(!('status' in guesses));
  });
});

describe('scoreCompleteness', () => {
  test('returns 1.0 when all required fields present', () => {
    const fm = { title: 'T', description: 'D', status: 'Published', content_type: 'Tutorial' };
    // With default configFields that includes title,description,status,content_type as required
    const score = scoreCompleteness(fm, {});
    assert.ok(score >= 0 && score <= 1);
  });

  test('returns lower score when required fields missing', () => {
    const fmFull = { title: 'T', description: 'D', status: 'Published', content_type: 'Tutorial' };
    const fmPartial = { title: 'T' };
    const scoreFull = scoreCompleteness(fmFull, {});
    const scorePartial = scoreCompleteness(fmPartial, {});
    assert.ok(scoreFull >= scorePartial);
  });
});

describe('walk', () => {
  test('returns an array of file paths', () => {
    const files = walk(new URL('../docs', import.meta.url).pathname);
    assert.ok(Array.isArray(files));
    assert.ok(files.length > 0);
    assert.ok(files.every((f) => f.endsWith('.mdx') || f.endsWith('.md')));
  });
});
