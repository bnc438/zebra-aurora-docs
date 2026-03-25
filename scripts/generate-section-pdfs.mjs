import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const buildDir = path.join(repoRoot, 'build');
const outputDir = path.join(repoRoot, 'static', 'pdf');
const tempDir = path.join(buildDir, '_pdf_tmp');
const pdfAssetDir = path.join(buildDir, '_pdf_assets');
const DEFAULT_PORT = Number(process.env.PDF_PORT || 4277);
const HOST = '127.0.0.1';

const require = createRequire(import.meta.url);
const sidebars = require(path.join(repoRoot, 'sidebars.js'));

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: {...process.env, ...env},
      stdio: 'inherit',
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

function flattenSidebarDocIds(items) {
  const ids = [];

  const visit = (item) => {
    if (!item) {
      return;
    }

    if (typeof item === 'string') {
      ids.push(item);
      return;
    }

    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    if (item.type === 'doc' && item.id) {
      ids.push(item.id);
      return;
    }

    if (item.type === 'category') {
      if (item.link?.type === 'doc' && item.link.id) {
        ids.push(item.link.id);
      }
      if (item.items) {
        item.items.forEach(visit);
      }
    }
  };

  visit(items);
  return ids;
}

function unique(list) {
  return [...new Set(list)];
}

function getCategoryFromSidebar(sidebarItems, label) {
  return sidebarItems.find((item) => item && typeof item === 'object' && item.type === 'category' && item.label === label);
}

function docIdToRoute(docId) {
  if (docId === 'index') {
    return '/docs/javascript-developers-guide';
  }
  if (docId.endsWith('/index')) {
    return `/docs/${docId.slice(0, -('/index'.length))}/`;
  }
  return `/docs/${docId}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildCoverConfig(sectionTitle, frontMatter = {}) {
  const title = frontMatter.pdf_cover_title || `Zebra ${sectionTitle}`;
  return {
    title,
    subtitle: frontMatter.pdf_cover_subtitle || 'Product Reference Guide',
    partNumber: frontMatter.pdf_cover_part_number || 'MN-000000-0EN Rev A',
    copyrightHeader: frontMatter.pdf_cover_copyright_header || 'Copyright',
    copyrightText:
      frontMatter.pdf_cover_copyright_text ||
      'This PDF is generated from Zebra product documentation and is intended for internal use. All specifications and information are subject to change without notice.',
  };
}

function buildDocMetaMapFromMetadata() {
  const docsMetaDir = path.join(
    repoRoot,
    '.docusaurus',
    'docusaurus-plugin-content-docs',
    'default'
  );
  const metaMap = new Map();

  if (!fs.existsSync(docsMetaDir)) {
    return metaMap;
  }

  for (const fileName of fs.readdirSync(docsMetaDir)) {
    if (!fileName.startsWith('site-docs-') || !fileName.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(docsMetaDir, fileName);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (typeof data.id === 'string' && typeof data.permalink === 'string') {
        metaMap.set(data.id, {
          permalink: data.permalink,
          title: data.title,
          frontMatter: data.frontMatter || {},
        });
      }
    } catch (error) {
      console.warn(`[PDF] Warning: Could not parse ${fileName}: ${error.message}`);
    }
  }

  return metaMap;
}

async function listenWithPortFallback(server, host, startPort, attempts = 20) {
  let port = startPort;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off('error', onError);
          reject(error);
        };
        server.once('error', onError);
        server.listen(port, host, () => {
          server.off('error', onError);
          resolve();
        });
      });
      return port;
    } catch (error) {
      if (error && error.code === 'EADDRINUSE') {
        port += 1;
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Unable to start PDF server from port ${startPort} after ${attempts} attempts`);
}

function buildSectionsFromSidebar() {
  const tutorialSidebar = sidebars.tutorialSidebar || [];
  const userGuideCategory = getCategoryFromSidebar(tutorialSidebar, 'User Guide');
  const jsGuideCategory = getCategoryFromSidebar(tutorialSidebar, 'JavaScript Developers Guide');
  const licensingCategory = getCategoryFromSidebar(tutorialSidebar, 'Licensing');
  const releaseNotesCategory = getCategoryFromSidebar(tutorialSidebar, 'Release Notes');

  const userGuideIds = userGuideCategory ? flattenSidebarDocIds(userGuideCategory.items) : ['user-guide/index'];
  const licensingIds = licensingCategory ? flattenSidebarDocIds(licensingCategory.items) : ['licensing/index'];
  const releaseNotesIds = releaseNotesCategory ? flattenSidebarDocIds(releaseNotesCategory.items) : ['release-notes/index'];

  const jsGuideIds = jsGuideCategory ? unique(flattenSidebarDocIds(jsGuideCategory.items)) : ['index'];

  return [
    {
      key: 'licensing',
      title: 'Licensing',
      outputFile: 'licensing.pdf',
      docIds: unique(['licensing/index', ...licensingIds]),
    },
    {
      key: 'release-notes',
      title: 'Release Notes',
      outputFile: 'release-notes.pdf',
      docIds: unique(['release-notes/index', ...releaseNotesIds]),
    },
    {
      key: 'user-guide',
      title: 'User Guide',
      outputFile: 'user-guide.pdf',
      docIds: unique(['user-guide/index', ...userGuideIds]),
    },
    {
      key: 'javascript-programmers-guide',
      title: "JavaScript Programmer's Guide",
      outputFile: 'javascript-programmers-guide.pdf',
      docIds: unique(['index', ...jsGuideIds]),
    },
  ];
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, {recursive: true});
}

function hashString(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
  return {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/x-icon': '.ico',
  }[normalized] || '';
}

function extensionFromUrl(value) {
  try {
    const pathname = new URL(value).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'].includes(ext) ? ext : '';
  } catch {
    return '';
  }
}

function replaceAttributeValue(tag, attribute, newValue) {
  const pattern = new RegExp(`\\b${attribute}=(['"])(.*?)\\1`, 'i');
  if (pattern.test(tag)) {
    return tag.replace(pattern, `${attribute}="${escapeHtml(newValue)}"`);
  }

  const closeIndex = tag.endsWith('/>') ? tag.length - 2 : tag.length - 1;
  return `${tag.slice(0, closeIndex)} ${attribute}="${escapeHtml(newValue)}"${tag.slice(closeIndex)}`;
}

function removeAttribute(tag, attribute) {
  const pattern = new RegExp(`\\s+${attribute}=(['"])(.*?)\\1`, 'ig');
  return tag.replace(pattern, '');
}

function buildMissingImagePlaceholder(src, alt = '') {
  const label = alt.trim() || 'Image';
  return `<span class="pdf-image-placeholder"><strong>${escapeHtml(label)}</strong><span>Unable to embed remote asset during PDF export.</span><code>${escapeHtml(src)}</code></span>`;
}

async function cacheRemoteAsset(assetUrl, assetCache) {
  const cached = assetCache.get(assetUrl);
  if (cached) {
    return cached;
  }

  const response = await fetch(assetUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const ext = extensionFromContentType(contentType) || extensionFromUrl(assetUrl) || '.img';
  const fileName = `${hashString(assetUrl)}${ext}`;
  const diskPath = path.join(pdfAssetDir, fileName);
  const publicPath = `/_pdf_assets/${fileName}`;

  if (!fs.existsSync(diskPath)) {
    fs.writeFileSync(diskPath, bytes);
  }

  const result = {diskPath, publicPath};
  assetCache.set(assetUrl, result);
  return result;
}

async function localizeHtmlImages(html, siteUrl, assetCache) {
  const siteOrigin = new URL(siteUrl).origin;
  const imgPattern = /<img\b[^>]*>/gi;
  const matches = [...html.matchAll(imgPattern)];

  if (matches.length === 0) {
    return html;
  }

  let localizedHtml = '';
  let lastIndex = 0;

  for (const match of matches) {
    const [tag] = match;
    const index = match.index ?? 0;
    localizedHtml += html.slice(lastIndex, index);
    lastIndex = index + tag.length;

    const srcMatch = tag.match(/\bsrc=(['"])(.*?)\1/i);
    if (!srcMatch) {
      localizedHtml += tag;
      continue;
    }

    const altMatch = tag.match(/\balt=(['"])(.*?)\1/i);
    const absoluteSrc = new URL(srcMatch[2], siteUrl).toString();
    const isRemote = new URL(absoluteSrc).origin !== siteOrigin;

    if (!isRemote) {
      localizedHtml += replaceAttributeValue(tag, 'src', absoluteSrc);
      continue;
    }

    try {
      const cachedAsset = await cacheRemoteAsset(absoluteSrc, assetCache);
      let localizedTag = replaceAttributeValue(tag, 'src', cachedAsset.publicPath);
      localizedTag = removeAttribute(localizedTag, 'srcset');
      localizedHtml += localizedTag;
    } catch (error) {
      console.warn(`[PDF] Warning: Could not cache remote image ${absoluteSrc}: ${error.message}`);
      localizedHtml += buildMissingImagePlaceholder(absoluteSrc, altMatch?.[2] || '');
    }
  }

  localizedHtml += html.slice(lastIndex);
  return localizedHtml;
}

function createStaticServer(rootDir, host, portRef) {
  return http.createServer((req, res) => {
    try {
      const reqUrl = new URL(req.url, `http://${host}:${portRef.current}`);
      const urlPath = decodeURIComponent(reqUrl.pathname);
      const safePath = path.normalize(urlPath).replace(/^\/+/, '');
      let filePath = path.join(rootDir, safePath);

      const tryPaths = [];
      if (urlPath.endsWith('/')) {
        tryPaths.push(path.join(rootDir, safePath, 'index.html'));
      } else {
        tryPaths.push(filePath);
        tryPaths.push(path.join(rootDir, safePath + '.html'));
        tryPaths.push(path.join(rootDir, safePath, 'index.html'));
      }

      const existing = tryPaths.find((p) => p.startsWith(rootDir) && fs.existsSync(p) && fs.statSync(p).isFile());
      if (!existing) {
        res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end('Not found');
        return;
      }

      const ext = path.extname(existing).toLowerCase();
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
      }[ext] || 'application/octet-stream';

      res.writeHead(200, {'Content-Type': mime});
      fs.createReadStream(existing).pipe(res);
    } catch (error) {
      res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end(String(error));
    }
  });
}

function sectionHtml({cssHrefs, docs, coverConfig}) {
  const cssLinks = cssHrefs.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');
  const toc = docs
    .map(
      (doc, index) => `
        <li>
          <span class="pdf-toc-index">${index + 1}.</span>
          <span class="pdf-toc-title">${doc.title}</span>
        </li>
      `
    )
    .join('\n');
  const body = docs
    .map(
      (doc) => `
        <section class="pdf-doc-block">
          <article class="pdf-doc-content">${doc.html}</article>
        </section>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(coverConfig.title)}</title>
    ${cssLinks}
    <style>
      :root {
        --pdf-muted: #525f70;
        --pdf-border: #d2d8e2;
        --pdf-brand: #0b4fc2;
        --pdf-brand-dark: #0a214f;
        --pdf-title: #0e2f80;
      }
      body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #1b2330;
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.45;
      }
      .pdf-cover {
        min-height: 268mm;
        padding: 18mm 16mm 16mm;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
      }
      .pdf-cover h1 {
        margin: 0;
        color: var(--pdf-title);
        font-size: 56px;
        line-height: 1.05;
        font-weight: 700;
        letter-spacing: -0.6px;
      }
      .pdf-cover-subtitle {
        margin-top: 44mm;
        font-size: 54px;
        line-height: 1.08;
        color: #111;
        font-weight: 700;
      }
      .pdf-cover-meta {
        margin-top: auto;
        padding-top: 4mm;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 6mm;
        align-items: end;
      }
      .pdf-logo {
        width: 34mm;
        max-width: 100%;
        height: auto;
      }
      .pdf-cover-company {
        font-size: 10px;
        color: #303843;
        text-align: right;
      }
      .pdf-part-number {
        margin-top: 2mm;
        font-size: 9px;
        color: #4b5564;
        text-align: right;
      }
      .pdf-legal-panel {
        margin-bottom: 10mm;
      }
      .pdf-legal-title {
        background: var(--pdf-brand);
        color: #fff;
        text-align: center;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 10px;
      }
      .pdf-legal-body {
        padding: 10px 12px;
        font-size: 9px;
        color: #343f4f;
      }
      .pdf-toc-page {
        padding: 18mm 16mm;
      }
      .pdf-toc-page h2 {
        color: var(--pdf-title);
        font-size: 36px;
        margin: 0 0 10mm;
      }
      .pdf-toc-page ol {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .pdf-toc-page li {
        display: flex;
        gap: 8px;
        padding: 7px 0;
        font-size: 12px;
      }
      .pdf-toc-index {
        color: var(--pdf-muted);
        width: 28px;
        flex: 0 0 auto;
      }
      .pdf-toc-title {
        font-weight: 600;
      }
      .pdf-content {
        padding: 0 16mm 10mm;
      }
      .pdf-doc-block {
        margin: 0;
      }
      .pdf-doc-block + .pdf-doc-block {
        margin-top: 8mm;
        padding-top: 6mm;
      }
      .pdf-doc-content hr {
        display: none;
      }
      .pdf-page-break {
        page-break-before: always;
        break-before: page;
      }
      .pdf-doc-content img {
        max-width: 100%;
        height: auto;
      }
      .pdf-image-placeholder {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 10px 0;
        padding: 10px 12px;
        border: 1px dashed #c17500;
        background: #fff8ec;
        color: #613f00;
        font-size: 10px;
      }
      .pdf-image-placeholder strong {
        font-size: 11px;
      }
      .pdf-image-placeholder code {
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 9px;
      }
      .pdf-doc-content table {
        width: 100%;
        border-collapse: collapse;
        page-break-inside: auto;
      }
      .pdf-doc-content pre,
      .pdf-doc-content table,
      .pdf-doc-content blockquote,
      .pdf-doc-content figure {
        page-break-inside: avoid;
      }
      .pdf-doc-content h1,
      .pdf-doc-content h2,
      .pdf-doc-content h3,
      .pdf-doc-content h4 {
        break-after: avoid-page;
        page-break-after: avoid;
      }
      .pdf-doc-content h1,
      .pdf-doc-content h2,
      .pdf-doc-content h3 {
        color: var(--pdf-brand-dark);
      }
      .pdf-doc-content p,
      .pdf-doc-content li,
      .pdf-doc-content td,
      .pdf-doc-content th {
        font-size: 11px;
      }
      .pdf-doc-content table th {
        background: #f4f7fb;
      }
      @page {
        margin: 10mm;
      }
    </style>
  </head>
  <body>
    <section class="pdf-cover">
      <h1>${escapeHtml(coverConfig.title)}</h1>
      <p class="pdf-cover-subtitle">${escapeHtml(coverConfig.subtitle)}</p>
      <div class="pdf-cover-meta">
        <img class="pdf-logo" src="/img/z-logo-b.svg" alt="Zebra" />
        <div>
          <div class="pdf-cover-company">Zebra Technologies | 3 Overlook Point | Lincolnshire, IL 60069 USA<br/>zebra.com</div>
          <div class="pdf-part-number">${escapeHtml(coverConfig.partNumber)}</div>
        </div>
      </div>
    </section>
    <section class="pdf-toc-page pdf-page-break">
      <section class="pdf-legal-panel">
        <div class="pdf-legal-title">${escapeHtml(coverConfig.copyrightHeader)}</div>
        <div class="pdf-legal-body">${escapeHtml(coverConfig.copyrightText)}</div>
      </section>
      <h2>Contents</h2>
      <ol>
        ${toc}
      </ol>
    </section>
    <main class="pdf-content pdf-page-break">
      ${body}
    </main>
  </body>
</html>`;
}

async function collectDocHtml(browser, route, siteUrl) {
  const page = await browser.newPage();
  try {
    await page.goto(`${siteUrl}${route}`, {waitUntil: 'networkidle'});
    await page.waitForSelector('article', {timeout: 30000});

    const data = await page.evaluate(() => {
      const titleNode = document.querySelector('main h1');
      const contentNode = document.querySelector('.theme-doc-markdown') || document.querySelector('article');
      if (!contentNode) {
        throw new Error('Could not find document content node on page');
      }

      const clone = contentNode.cloneNode(true);

      clone.querySelectorAll('[data-no-pdf], [data-no-pdf="true"]').forEach((node) => {
        node.remove();
      });

      const cloneTitleNode = clone.querySelector('h1, h2, h3, h4');
      const hasContent = Boolean(clone.textContent && clone.textContent.trim().length > 0);

      clone.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src');
        if (src) {
          img.setAttribute('src', new URL(src, window.location.href).toString());
        }
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          const abs = srcset
            .split(',')
            .map((entry) => {
              const parts = entry.trim().split(/\s+/);
              if (parts.length === 0) {
                return entry;
              }
              const first = parts.shift();
              return `${new URL(first, window.location.href).toString()} ${parts.join(' ')}`.trim();
            })
            .join(', ');
          img.setAttribute('srcset', abs);
        }
      });

      const styles = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((node) => node.getAttribute('href'))
        .filter(Boolean)
        .map((href) => new URL(href, window.location.href).pathname);

      return {
        title: cloneTitleNode?.textContent?.trim() || titleNode?.textContent?.trim() || document.title,
        html: clone.innerHTML,
        hasContent,
        styles,
      };
    });

    return data;
  } finally {
    await page.close();
  }
}

async function waitForImagesToLoad(page, timeoutMs = 30000) {
  await page.waitForFunction(
    () => {
      const imgs = Array.from(document.images || []);
      if (imgs.length === 0) {
        return true;
      }
      return imgs.every((img) => img.complete);
    },
    null,
    {timeout: timeoutMs}
  );

  const brokenImages = await page.evaluate(() =>
    Array.from(document.images || [])
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src)
  );

  if (brokenImages.length > 0) {
    throw new Error(`Broken images detected in PDF page: ${brokenImages.slice(0, 5).join(', ')}`);
  }
}

async function generate() {
  ensureDir(outputDir);
  const portRef = {current: DEFAULT_PORT};
  const siteUrl = () => `http://${HOST}:${portRef.current}`;

  console.log('\n[PDF] Building site with PDF-friendly base URL...');
  await runCommand('npx', ['docusaurus', 'build'], {
    DOCUSAURUS_BASE_URL: '/',
    DOCUSAURUS_URL: siteUrl(),
  });

  const docMetaMap = buildDocMetaMapFromMetadata();
  console.log(`[PDF] Loaded ${docMetaMap.size} doc route mappings from metadata.`);

  ensureDir(tempDir);
  ensureDir(pdfAssetDir);

  const sections = buildSectionsFromSidebar();
  const server = createStaticServer(buildDir, HOST, portRef);
  portRef.current = await listenWithPortFallback(server, HOST, DEFAULT_PORT);
  console.log(`[PDF] Serving build output at ${siteUrl()}`);

  const browser = await chromium.launch({headless: true});
  const assetCache = new Map();

  try {
    for (const section of sections) {
      console.log(`\n[PDF] Generating ${section.outputFile}...`);
      const docs = [];
      const styleSet = new Set();

      const coverMeta =
        section.docIds
          .map((docId) => docMetaMap.get(docId))
          .find((docMeta) => Boolean(docMeta?.frontMatter?.pdf_cover_template)) ||
        docMetaMap.get(section.docIds[0]);

      const coverConfig = buildCoverConfig(section.title, coverMeta?.frontMatter || {});

      for (const docId of section.docIds) {
        const docMeta = docMetaMap.get(docId);
        if (docMeta?.frontMatter?.pdf_cover_template === true) {
          continue;
        }

        const route = docMeta?.permalink || docIdToRoute(docId);
        try {
          const docData = await collectDocHtml(browser, route, siteUrl());
          if (!docData.hasContent) {
            console.log(`[PDF] Skipping ${route} after web-only content stripping (no printable content).`);
            continue;
          }

          docs.push({
            route,
            title: docData.title,
            html: await localizeHtmlImages(docData.html, siteUrl(), assetCache),
          });
          docData.styles.forEach((styleHref) => styleSet.add(styleHref));
        } catch (error) {
          console.warn(
            `[PDF] Warning: Skipping doc \"${docId}\" at route \"${route}\": ${error.message}`
          );
        }
      }

      if (docs.length === 0) {
        console.warn(`[PDF] Warning: No docs collected for ${section.outputFile}; skipping PDF.`);
        continue;
      }

      const html = sectionHtml({
        cssHrefs: [...styleSet],
        docs,
        coverConfig,
      });

      const htmlPath = path.join(tempDir, `${section.key}.html`);
      fs.writeFileSync(htmlPath, html, 'utf8');

      const printPage = await browser.newPage();
      try {
        await printPage.goto(`${siteUrl()}/_pdf_tmp/${section.key}.html`, {waitUntil: 'networkidle'});
        await waitForImagesToLoad(printPage);
        await printPage.emulateMedia({media: 'print'});
        await printPage.pdf({
          path: path.join(outputDir, section.outputFile),
          format: 'A4',
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate:
            '<div style="font-size:9px;width:100%;padding:0 10mm;color:#444;display:flex;justify-content:flex-end;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
          margin: {
            top: '16mm',
            right: '12mm',
            bottom: '18mm',
            left: '12mm',
          },
        });
      } finally {
        await printPage.close();
      }

      console.log(`[PDF] Wrote static/pdf/${section.outputFile}`);
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n[PDF] Done. Generated section PDFs under static/pdf/.\n');
}

generate().catch((error) => {
  console.error('\n[PDF] Failed:', error);
  process.exitCode = 1;
});
