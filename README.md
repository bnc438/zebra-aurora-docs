# Zebra Aurora Docs

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
npm install
```

## Local Development

```bash
npm start
```

This command starts a local development server and opens a browser window. Most changes are reflected live without having to restart the server.

For a static build preview (no hot reload):

```bash
npm run serve:static
```

## Build

```bash
npm run build
```

This command generates static content into the `build` directory.

## Deployment

```bash
GIT_USER=<Your GitHub username> npm run deploy
```

---

## Developer Dashboard

The developer dashboard is a **dev-only** panel available at [`/dev-dashboard`](http://localhost:3000/dev-dashboard) when running `npm start`. It ships zero meaningful code to production — the page renders a "not available" stub in production builds.

### Dashboard panels

| Panel | Description |
|---|---|
| Build Overview | Total docs, word counts, average completeness |
| Schema Intelligence | Per-field frontmatter coverage + auto-guessed values |
| Accessibility Checks | Placeholder detection, missing titles/descriptions |
| SEO Health | Title, description, keywords, slug coverage |
| Analytics | GA presence (Tier 1) · Tier 2 locked pending API key |
| Performance Metrics | Word count distribution, docs per section |
| Ask AI Engine | Index record count, index size, section distribution |
| Content Freshness | Review coverage, content type velocity, top docs |

### Setup

The dashboard is powered by `static/build-report.json`, which is auto-generated before every `start`, `build`, and `deploy` by `scripts/generate-build-report.mjs`.

To regenerate it manually:

```bash
npm run build-report
```

### Schema guessing and flagging

For docs with missing taxonomy frontmatter fields, `generate-build-report.mjs` makes educated guesses based on:

| Signal | Guessed field |
|---|---|
| Filename prefix (`t-`, `c-`, `r-`, `g-`, `rn-`) | `content_type` |
| Device model mentions in content (VS/xS/NS42, FS/NS) | `device_type` |
| Title/content keywords (OCR, GPIO, scripting, etc.) | `use_case` |
| Inferred `content_type` | `role`, `skill_level` |
| Filename prefix | `status` |

All guessed values are flagged with `_guessed: true` in `build-report.json` so authors can review and promote them into actual frontmatter. In the dashboard, guessed values are highlighted with an italic **guessed** chip.

### Running tests

```bash
npm test
```

This runs the unit tests for `generate-build-report.mjs` using Node's built-in test runner (Node ≥ 20 required, no extra dependencies).

---

## Porting to another Docusaurus repo

To add the dev dashboard to any other Docusaurus repo:

1. Copy these files:
   - `scripts/generate-build-report.mjs`
   - `dashboard.config.js`
   - `src/pages/dev-dashboard.js`
   - `src/components/DevDashboard/`

2. In `docusaurus.config.js`, add to the root config object:
   ```js
   customFields: {
     isDev: process.env.NODE_ENV !== 'production',
   },
   ```

3. In `package.json`, update your `prestart`/`prebuild`/`predeploy` scripts to include:
   ```
   node scripts/generate-build-report.mjs
   ```

4. Optionally customise `dashboard.config.js` to match your frontmatter schema.

5. Run `npm start` and navigate to `/dev-dashboard`.

