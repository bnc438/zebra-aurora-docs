/**
 * ingest-github-prs.mjs
 *
 * Fetches merged pull requests from GitHub for the last LOOKBACK_DAYS days.
 * Parses a version tag from each PR's labels or title text.
 * Writes results to static/data/github-prs.json.
 *
 * Required env vars:
 *   GITHUB_TOKEN   — Personal access token (repo:read scope)
 *   GITHUB_REPO    — Owner/repo slug, e.g. "ZebraTech/aurora-focus-docs"
 *
 * Optional env vars:
 *   GITHUB_LOOKBACK_DAYS — How many days back to fetch PRs (default: 90)
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(repoRoot, 'static', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'github-prs.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const LOOKBACK_DAYS = Number(process.env.GITHUB_LOOKBACK_DAYS || 90);
const PER_PAGE = 100;
const MAX_PAGES = 10;

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

function normalizeVersion(raw) {
  const m = String(raw || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3] || '0'}`;
}

function versionParseConfidence(raw) {
  if (/^\d+\.\d+\.\d+$/.test(String(raw || ''))) return 1.0;
  if (/^\d+\.\d+$/.test(String(raw || ''))) return 0.8;
  return 0.6;
}

/**
 * Tries to extract a version from a PR's labels first, then its title.
 * Returns {versionRaw, versionCanonical, versionParseConfidence, versionSource} or null.
 */
function extractVersionFromPr(pr) {
  // 1. Labels (highest confidence)
  for (const label of pr.labels || []) {
    const name = String(label.name || '');
    const canonical = normalizeVersion(name);
    if (canonical) {
      return {
        versionRaw: name,
        versionCanonical: canonical,
        versionParseConfidence: versionParseConfidence(name),
        versionSource: 'label',
      };
    }
  }

  // 2. Title — look for vX.Y.Z or X.Y.Z patterns
  const titleStr = String(pr.title || '');
  const titleMatches = titleStr.matchAll(/\bv?(\d+\.\d+(?:\.\d+)?)\b/gi);
  for (const m of titleMatches) {
    const raw = m[1];
    const canonical = normalizeVersion(raw);
    if (canonical) {
      return {
        versionRaw: m[0],
        versionCanonical: canonical,
        versionParseConfidence: versionParseConfidence(raw),
        versionSource: 'title',
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function httpsGet(url, token) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'aurora-docs-v2-dashboard/1.0',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = https.get(url, {headers}, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`GitHub API HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve({data: JSON.parse(body), headers: res.headers});
        } catch (e) {
          reject(new Error(`GitHub response parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Fetch PRs
// ---------------------------------------------------------------------------

async function fetchMergedPrs(repo, token) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const allPrs = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `https://api.github.com/repos/${repo}/pulls` +
      `?state=closed&per_page=${PER_PAGE}&page=${page}&sort=updated&direction=desc`;

    console.log(`[GH] Fetching PRs page ${page}…`);
    const {data} = await httpsGet(url, token);

    if (!Array.isArray(data) || data.length === 0) break;

    // Only include merged PRs within the lookback window
    const merged = data.filter((pr) => pr.merged_at && pr.merged_at >= since);
    allPrs.push(...merged);

    if (data.length < PER_PAGE) break;    // No more pages
    if (allPrs.length >= 500) break;       // Safety cap
  }

  return allPrs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(OUTPUT_DIR, {recursive: true});

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const generatedAt = new Date().toISOString();

  if (!GITHUB_REPO || !GITHUB_TOKEN) {
    console.warn(
      '[GH] GITHUB_REPO and GITHUB_TOKEN env vars are required. Writing empty result.'
    );
    const empty = {
      generatedAt,
      snapshotDate,
      repo: GITHUB_REPO || null,
      prCount: 0,
      skipped: true,
      records: [],
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(empty, null, 2));
    return;
  }

  const prs = await fetchMergedPrs(GITHUB_REPO, GITHUB_TOKEN);
  console.log(`[GH] Found ${prs.length} merged PRs in the last ${LOOKBACK_DAYS} days.`);

  const records = prs.map((pr) => {
    const vInfo = extractVersionFromPr(pr);
    return {
      snapshotDate,
      snapshotTimestamp: generatedAt,
      prNumber: pr.number,
      prTitle: pr.title || '',
      mergedAt: pr.merged_at || null,
      labels: (pr.labels || []).map((l) => l.name),
      versionRaw: vInfo?.versionRaw ?? null,
      versionCanonical: vInfo?.versionCanonical ?? null,
      versionParseConfidence: vInfo?.versionParseConfidence ?? 0,
      versionSource: vInfo?.versionSource ?? null,
    };
  });

  const output = {
    generatedAt,
    snapshotDate,
    repo: GITHUB_REPO,
    prCount: records.length,
    skipped: false,
    records,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(
    `[GH] Wrote ${records.length} PR records → ${path.relative(repoRoot, OUTPUT_FILE)}`
  );
}

main().catch((err) => {
  console.error('[GH] Fatal:', err.message);
  process.exitCode = 1;
});
