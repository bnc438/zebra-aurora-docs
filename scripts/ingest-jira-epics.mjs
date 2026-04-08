/**
 * ingest-jira-epics.mjs
 *
 * Fetches Jira Epics for a project and maps each Epic's status + version info.
 * Writes results to static/data/jira-epics.json.
 *
 * Required env vars:
 *   JIRA_BASE_URL  — e.g. https://myorg.atlassian.net  (no trailing slash)
 *   JIRA_TOKEN     — API token (Atlassian Cloud) or Personal Access Token (Server/DC)
 *   JIRA_PROJECT   — Project key, e.g. "DOC"
 *
 * For Atlassian Cloud, also set:
 *   JIRA_EMAIL     — Your account email (used with JIRA_TOKEN for Basic auth)
 *
 * For Jira Server / Data Center, only JIRA_TOKEN is needed (Bearer auth).
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(repoRoot, 'static', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'jira-epics.json');

const JIRA_BASE_URL = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
const JIRA_TOKEN = process.env.JIRA_TOKEN || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_PROJECT = process.env.JIRA_PROJECT || '';
const MAX_RESULTS = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeVersion(raw) {
  const m = String(raw || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3] || '0'}`;
}

/**
 * Maps a Jira status name to one of the three canonical values used in the V2
 * dashboard: "open" | "in_progress" | "closed".
 */
function mapStatus(statusName) {
  const lower = String(statusName || '').toLowerCase();
  if (lower === 'done' || lower === 'closed' || lower === 'resolved') return 'closed';
  if (lower.includes('progress') || lower.includes('review') || lower.includes('testing')) {
    return 'in_progress';
  }
  return 'open';
}

function buildAuthHeader() {
  if (JIRA_EMAIL && JIRA_TOKEN) {
    // Atlassian Cloud: Basic auth with email:token
    const encoded = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
    return `Basic ${encoded}`;
  }
  if (JIRA_TOKEN) {
    // Jira Server/Data Center: Personal Access Token
    return `Bearer ${JIRA_TOKEN}`;
  }
  return '';
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const auth = buildAuthHeader();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (auth) headers['Authorization'] = auth;

    const req = https.get(url, {headers}, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Jira API HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Jira response parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Fetch Epics
// ---------------------------------------------------------------------------

async function fetchEpics() {
  const jql = encodeURIComponent(
    `project = ${JIRA_PROJECT} AND issuetype = Epic ORDER BY updated DESC`
  );
  const fields = 'summary,status,labels,fixVersions';
  const url = `${JIRA_BASE_URL}/rest/api/3/search?jql=${jql}&maxResults=${MAX_RESULTS}&fields=${fields}`;

  console.log(`[Jira] Fetching Epics for project ${JIRA_PROJECT}…`);
  const data = await httpsGet(url);
  return Array.isArray(data.issues) ? data.issues : [];
}

/**
 * Tries to resolve a version canonical from: fixVersions → labels → summary text.
 */
function extractVersionFromIssue(fields) {
  const fixVersionName = fields.fixVersions?.[0]?.name;
  if (fixVersionName) {
    const canonical = normalizeVersion(fixVersionName);
    if (canonical) return {versionRaw: fixVersionName, versionCanonical: canonical, versionSource: 'fixVersions'};
  }

  for (const label of (fields.labels || [])) {
    const canonical = normalizeVersion(label);
    if (canonical) return {versionRaw: label, versionCanonical: canonical, versionSource: 'label'};
  }

  const summaryMatch = String(fields.summary || '').match(/\b(\d+\.\d+(?:\.\d+)?)\b/);
  if (summaryMatch) {
    const canonical = normalizeVersion(summaryMatch[0]);
    if (canonical) return {versionRaw: summaryMatch[0], versionCanonical: canonical, versionSource: 'summary'};
  }

  return {versionRaw: null, versionCanonical: null, versionSource: null};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(OUTPUT_DIR, {recursive: true});

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const generatedAt = new Date().toISOString();

  if (!JIRA_BASE_URL || !JIRA_TOKEN || !JIRA_PROJECT) {
    console.warn(
      '[Jira] JIRA_BASE_URL, JIRA_TOKEN, and JIRA_PROJECT env vars are required. Writing empty result.'
    );
    const empty = {
      generatedAt,
      snapshotDate,
      project: JIRA_PROJECT || null,
      epicCount: 0,
      skipped: true,
      records: [],
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(empty, null, 2));
    return;
  }

  const issues = await fetchEpics();
  console.log(`[Jira] Found ${issues.length} Epics.`);

  const records = issues.map((issue) => {
    const fields = issue.fields || {};
    const statusRaw = fields.status?.name || 'Unknown';
    const {versionRaw, versionCanonical, versionSource} = extractVersionFromIssue(fields);

    return {
      snapshotDate,
      snapshotTimestamp: generatedAt,
      epicKey: issue.key,
      epicSummary: fields.summary || '',
      statusRaw,
      statusMapped: mapStatus(statusRaw),
      versionRaw,
      versionCanonical,
      versionSource,
      labels: fields.labels || [],
      fixVersions: (fields.fixVersions || []).map((v) => v.name),
    };
  });

  const output = {
    generatedAt,
    snapshotDate,
    project: JIRA_PROJECT,
    epicCount: records.length,
    skipped: false,
    records,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(
    `[Jira] Wrote ${records.length} Epic records → ${path.relative(repoRoot, OUTPUT_FILE)}`
  );
}

main().catch((err) => {
  console.error('[Jira] Fatal:', err.message);
  process.exitCode = 1;
});
