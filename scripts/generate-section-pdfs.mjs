import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
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

function buildDocRouteMapFromMetadata() {
  const docsMetaDir = path.join(
    repoRoot,
    '.docusaurus',
    'docusaurus-plugin-content-docs',
    'default'
  );
  const routeMap = new Map();

  if (!fs.existsSync(docsMetaDir)) {
    return routeMap;
  }

  for (const fileName of fs.readdirSync(docsMetaDir)) {
    if (!fileName.startsWith('site-docs-') || !fileName.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(docsMetaDir, fileName);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (typeof data.id === 'string' && typeof data.permalink === 'string') {
        routeMap.set(data.id, data.permalink);
      }
    } catch (error) {
      console.warn(`[PDF] Warning: Could not parse ${fileName}: ${error.message}`);
    }
  }

  return routeMap;
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
  const licensingCategory = getCategoryFromSidebar(tutorialSidebar, 'Licensing');
  const releaseNotesCategory = getCategoryFromSidebar(tutorialSidebar, 'Release Notes');

  const userGuideIds = userGuideCategory ? flattenSidebarDocIds(userGuideCategory.items) : ['user-guide/index'];
  const licensingIds = licensingCategory ? flattenSidebarDocIds(licensingCategory.items) : ['licensing/index'];
  const releaseNotesIds = releaseNotesCategory ? flattenSidebarDocIds(releaseNotesCategory.items) : ['release-notes/index'];

  const jsAll = flattenSidebarDocIds(tutorialSidebar);
  const jsGuideIds = unique(
    jsAll.filter(
      (id) =>
        !id.startsWith('user-guide/') &&
        !id.startsWith('licensing/') &&
        !id.startsWith('release-notes/')
    )
  );

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

function sectionHtml({sectionTitle, cssHrefs, docs}) {
  const cssLinks = cssHrefs.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');
  const body = docs
    .map(
      (doc, index) => `
        <section class="pdf-doc-block ${index > 0 ? 'pdf-page-break' : ''}">
          <header class="pdf-doc-header">
            <h1>${doc.title}</h1>
            <p class="pdf-doc-url">${doc.route}</p>
          </header>
          <article class="pdf-doc-content">${doc.html}</article>
        </section>
      `
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${sectionTitle}</title>
    ${cssLinks}
    <style>
      :root {
        --pdf-muted: #5f6b7a;
        --pdf-border: #d7dde5;
      }
      body {
        margin: 0;
        padding: 20px 24px;
        background: #fff;
      }
      .pdf-doc-block {
        margin: 0;
      }
      .pdf-page-break {
        page-break-before: always;
        break-before: page;
      }
      .pdf-doc-header {
        border-bottom: 1px solid var(--pdf-border);
        margin-bottom: 18px;
        padding-bottom: 10px;
      }
      .pdf-doc-header h1 {
        margin: 0 0 6px;
      }
      .pdf-doc-url {
        margin: 0;
        color: var(--pdf-muted);
        font-size: 12px;
      }
      .pdf-doc-content img {
        max-width: 100%;
        height: auto;
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
      @page {
        margin: 16mm;
      }
    </style>
  </head>
  <body>
    ${body}
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
        title: titleNode?.textContent?.trim() || document.title,
        html: clone.innerHTML,
        styles,
      };
    });

    return data;
  } finally {
    await page.close();
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

  const docRouteMap = buildDocRouteMapFromMetadata();
  console.log(`[PDF] Loaded ${docRouteMap.size} doc route mappings from metadata.`);

  ensureDir(tempDir);

  const sections = buildSectionsFromSidebar();
  const server = createStaticServer(buildDir, HOST, portRef);
  portRef.current = await listenWithPortFallback(server, HOST, DEFAULT_PORT);
  console.log(`[PDF] Serving build output at ${siteUrl()}`);

  const browser = await chromium.launch({headless: true});

  try {
    for (const section of sections) {
      console.log(`\n[PDF] Generating ${section.outputFile}...`);
      const docs = [];
      const styleSet = new Set();

      for (const docId of section.docIds) {
        const route = docRouteMap.get(docId) || docIdToRoute(docId);
        try {
          const docData = await collectDocHtml(browser, route, siteUrl());
          docs.push({
            route,
            title: docData.title,
            html: docData.html,
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
        sectionTitle: section.title,
        cssHrefs: [...styleSet],
        docs,
      });

      const htmlPath = path.join(tempDir, `${section.key}.html`);
      fs.writeFileSync(htmlPath, html, 'utf8');

      const printPage = await browser.newPage();
      try {
        await printPage.goto(`${siteUrl()}/_pdf_tmp/${section.key}.html`, {waitUntil: 'networkidle'});
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
