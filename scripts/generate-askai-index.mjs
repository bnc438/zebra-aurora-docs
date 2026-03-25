import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const docsRoot = path.join(workspaceRoot, 'docs');
const outputPath = path.join(workspaceRoot, 'static', 'askai-index.json');
const SKIPPED_HEADINGS = new Set(['monaco sandbox']);

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.mdx') || entry.name.endsWith('.md'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseFrontMatter(content) {
  if (!content.startsWith('---\n')) {
    return { frontMatter: {}, body: content };
  }
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontMatter: {}, body: content };
  }
  const raw = content.slice(4, end);
  const body = content.slice(end + 5);
  const frontMatter = {};
  for (const line of raw.split('\n')) {
    const splitIndex = line.indexOf(':');
    if (splitIndex === -1) continue;
    const key = line.slice(0, splitIndex).trim();
    let value = line.slice(splitIndex + 1).trim();
    if (!key) continue;
    value = value.replace(/^['"]|['"]$/g, '').trim();
    frontMatter[key] = value;
  }
  return { frontMatter, body };
}

function stripMarkdown(text) {
  return text
    .replace(/^import\s.+$/gm, ' ')
    .replace(/^export\s+default\s.+$/gm, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/```[a-z0-9-]*|```/gi, ' ')
    .replace(/<MonacoSandbox[\s\S]*?\/?>/g, ' ')
    .replace(/<ZoomableImage[\s\S]*?\/?>/g, ' ')
    .replace(/<DownloadSectionPdfButton[\s\S]*?\/?>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^:::[^\n]*$/gm, ' ')
    .replace(/^---$/gm, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[>*_~]/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferCategory(url) {
  if (url.startsWith('/docs/releases/') || url.startsWith('/docs/release-notes')) {
    return 'release-notes';
  }
  if (url.startsWith('/docs/licensing')) {
    return 'licensing';
  }
  if (
    url.startsWith('/docs/javascript-developers-guide')
    || url.includes('/aurora-js-')
    || url.includes('/scripting-')
  ) {
    return 'javascript';
  }
  return 'general';
}

function buildDocUrl(filePath, frontMatter) {
  if (frontMatter.slug) {
    if (frontMatter.slug.startsWith('/docs/')) return frontMatter.slug;
    if (frontMatter.slug.startsWith('/')) return `/docs${frontMatter.slug}`;
  }
  const rel = path.relative(docsRoot, filePath).replace(/\\/g, '/');
  const noExt = rel.replace(/\.(mdx|md)$/i, '');
  if (noExt.endsWith('/index')) {
    return `/docs/${noExt.slice(0, -6)}`;
  }
  return `/docs/${noExt}`;
}

function splitSections(body, fallbackTitle) {
  const lines = body.split('\n');
  const sections = [];
  let heading = fallbackTitle;
  let buffer = [];

  const flush = () => {
    const cleaned = stripMarkdown(buffer.join('\n'));
    if (!SKIPPED_HEADINGS.has(String(heading || '').trim().toLowerCase()) && cleaned.length > 60) {
      sections.push({ heading, text: cleaned.slice(0, 1400) });
    }
    buffer = [];
  };

  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)$/);
    if (match) {
      flush();
      heading = stripMarkdown(match[1]) || fallbackTitle;
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

const files = walk(docsRoot);
const records = [];

for (const filePath of files) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontMatter, body } = parseFrontMatter(raw);
  const title = frontMatter.title || path.basename(filePath, path.extname(filePath));
  const url = buildDocUrl(filePath, frontMatter);
  const sections = splitSections(body, title);
  for (const section of sections) {
    records.push({
      title,
      heading: section.heading,
      url,
      text: section.text,
      contentType: frontMatter.content_type || '',
      category: inferCategory(url),
    });
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2), 'utf8');
console.log(`askai index generated: ${records.length} sections`);
