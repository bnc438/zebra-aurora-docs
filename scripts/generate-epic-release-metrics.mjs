#!/usr/bin/env node
/**
 * scripts/generate-epic-release-metrics.mjs
 * ---------------------------------------------------------------------------
 * Computes release-readiness metrics for a specific Epic and writes:
 *   static/data/epic-release-metrics.json
 *
 * Tracks:
 * - Jira tickets opened/closed for the epic
 * - Support tickets opened/closed during the epic window
 * - Ticket closure cycle time
 * - MDX churn during the epic window
 * - Release gate checks (critical + warning)
 *
 * Required env vars:
 *   EPIC_KEY             e.g. DOC-123
 *
 * Recommended env vars:
 *   RELEASE_FIX_VERSION  e.g. 9.4.0
 *   JIRA_SITES_JSON      JSON array of site configs (see example below)
 *
 * Optional fallback (single-site):
 *   JIRA_BASE_URL, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT
 *
 * JIRA_SITES_JSON example:
 * [
 *   {
 *     "siteId": "zebra-cloud",
 *     "baseUrl": "https://example.atlassian.net",
 *     "emailEnv": "JIRA_ZEBRA_EMAIL",
 *     "tokenEnv": "JIRA_ZEBRA_TOKEN",
 *     "projectKeys": ["DOC", "ENG"],
 *     "supportProjectKeys": ["SUP"],
 *     "epicKey": "DOC-123"
 *   }
 * ]
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'static', 'data');
const outputPath = path.join(outputDir, 'epic-release-metrics.json');

const EPIC_KEY = process.env.EPIC_KEY || '';
const RELEASE_FIX_VERSION = process.env.RELEASE_FIX_VERSION || '';
const DONE_STATUSES = (process.env.JIRA_DONE_STATUSES || 'Closed,Done,Resolved')
  .split(',')
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);
const SUPPORT_ISSUE_TYPES = (process.env.JIRA_SUPPORT_ISSUE_TYPES || 'Incident,Service Request,Support Ticket')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const JIRA_BOARD_FILTER_JQL = process.env.JIRA_BOARD_FILTER_JQL || '';
const JIRA_RAPID_VIEW_ID = process.env.JIRA_RAPID_VIEW_ID || '';

function parseSitesConfig() {
  const raw = process.env.JIRA_SITES_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((site, i) => ({
          siteId: site.siteId || `site-${i + 1}`,
          baseUrl: String(site.baseUrl || '').replace(/\/$/, ''),
          email: site.email || process.env[site.emailEnv || ''] || '',
          token: site.token || process.env[site.tokenEnv || ''] || '',
          projectKeys: Array.isArray(site.projectKeys) ? site.projectKeys : [],
          supportProjectKeys: Array.isArray(site.supportProjectKeys) ? site.supportProjectKeys : [],
          epicKey: site.epicKey || EPIC_KEY,
          boardFilterJql: String(site.boardFilterJql || JIRA_BOARD_FILTER_JQL || '').trim(),
          rapidView: String(site.rapidView || JIRA_RAPID_VIEW_ID || '').trim(),
        }));
      }
    } catch (err) {
      console.warn(`[epic-metrics] Could not parse JIRA_SITES_JSON: ${err.message}`);
    }
  }

  const singleBaseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
  const singleToken = process.env.JIRA_TOKEN || '';
  const singleEmail = process.env.JIRA_EMAIL || '';
  const singleProject = process.env.JIRA_PROJECT || '';

  if (singleBaseUrl && singleToken && singleProject) {
    return [{
      siteId: 'default-site',
      baseUrl: singleBaseUrl,
      email: singleEmail,
      token: singleToken,
      projectKeys: [singleProject],
      supportProjectKeys: [],
      epicKey: EPIC_KEY,
      boardFilterJql: String(JIRA_BOARD_FILTER_JQL || '').trim(),
      rapidView: String(JIRA_RAPID_VIEW_ID || '').trim(),
    }];
  }

  return [];
}

function authHeader(email, token) {
  if (!token) return '';
  if (email) {
    const encoded = Buffer.from(`${email}:${token}`).toString('base64');
    return `Basic ${encoded}`;
  }
  return `Bearer ${token}`;
}

function jiraPost(site, endpointPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${site.baseUrl}${endpointPath}`);
    const payload = JSON.stringify(body || {});
    const auth = authHeader(site.email, site.token);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (auth) headers.Authorization = auth;

    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers,
      },
      (res) => {
        let bodyText = '';
        res.on('data', (chunk) => {
          bodyText += chunk;
        });
        res.on('end', () => {
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${bodyText.slice(0, 400)}`));
            return;
          }
          try {
            resolve(JSON.parse(bodyText));
          } catch (err) {
            reject(new Error(`JSON parse error: ${err.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function jiraGet(site, endpointPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${site.baseUrl}${endpointPath}`);
    const auth = authHeader(site.email, site.token);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (auth) headers.Authorization = auth;

    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
      },
      (res) => {
        let bodyText = '';
        res.on('data', (chunk) => {
          bodyText += chunk;
        });
        res.on('end', () => {
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${bodyText.slice(0, 400)}`));
            return;
          }
          try {
            resolve(JSON.parse(bodyText));
          } catch (err) {
            reject(new Error(`JSON parse error: ${err.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function resolveBoardFilterJql(site) {
  if (site.boardFilterJql) return site.boardFilterJql;
  if (!site.rapidView) return '';

  try {
    const data = await jiraGet(site, `/rest/agile/1.0/board/${encodeURIComponent(site.rapidView)}/configuration`);
    const jql = data?.filter?.query || '';
    return String(jql || '').trim();
  } catch {
    return '';
  }
}

function joinJqlClauses(clauses) {
  return clauses.filter(Boolean).map((c) => `(${c})`).join(' AND ');
}

async function searchAllIssues(site, jql, fields) {
  const results = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const data = await jiraPost(site, '/rest/api/3/search', {
      jql,
      startAt,
      maxResults,
      fields,
    });

    const issues = Array.isArray(data.issues) ? data.issues : [];
    results.push(...issues);

    const total = Number(data.total || 0);
    startAt += issues.length;
    if (!issues.length || startAt >= total) break;
  }

  return results;
}

function statusIsClosed(statusName) {
  return DONE_STATUSES.includes(String(statusName || '').trim().toLowerCase());
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function hoursBetween(start, end) {
  if (!start || !end) return null;
  return Number(((end.getTime() - start.getTime()) / 3_600_000).toFixed(2));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  return Number(sorted[mid].toFixed(2));
}

function inWindow(d, start, end) {
  if (!d || !start || !end) return false;
  return d >= start && d <= end;
}

function quoteCsv(values) {
  return values.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(',');
}

function countMdxEdits(start, end) {
  if (!start || !end) {
    return {
      uniqueMdxFilesEdited: 0,
      totalMdxEditTouches: 0,
      totalMdxCommits: 0,
      files: [],
      skipped: true,
      reason: 'No epic date window available',
    };
  }

  try {
    const sinceIso = start.toISOString();
    const untilIso = end.toISOString();
    const cmd = `git log --since="${sinceIso}" --until="${untilIso}" --name-only --pretty=format:__COMMIT__%H`;
    const output = execSync(cmd, { cwd: repoRoot, encoding: 'utf8' });
    const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let commitCount = 0;
    const files = [];
    for (const line of lines) {
      if (line.startsWith('__COMMIT__')) {
        commitCount += 1;
        continue;
      }
      if (/\.mdx$/i.test(line)) {
        files.push(line.replace(/\\/g, '/'));
      }
    }

    const unique = [...new Set(files)].sort();
    return {
      uniqueMdxFilesEdited: unique.length,
      totalMdxEditTouches: files.length,
      totalMdxCommits: commitCount,
      files: unique,
      skipped: false,
    };
  } catch (err) {
    return {
      uniqueMdxFilesEdited: 0,
      totalMdxEditTouches: 0,
      totalMdxCommits: 0,
      files: [],
      skipped: true,
      reason: `git log failed: ${err.message}`,
    };
  }
}

function buildReleaseGate(metrics) {
  const checks = [
    {
      id: 'NO_OPEN_EPIC_TICKETS',
      severity: 'critical',
      passed: metrics.epicTickets.openNow === 0,
      value: metrics.epicTickets.openNow,
      expected: 0,
      message: 'No open Story/Task/Sub-task tickets tied to the epic.',
    },
    {
      id: 'NO_OPEN_SUPPORT_TICKETS',
      severity: 'critical',
      passed: metrics.supportTickets.openNow === 0,
      value: metrics.supportTickets.openNow,
      expected: 0,
      message: 'No open support tickets during epic window.',
    },
    {
      id: 'CYCLE_TIME_OBSERVED',
      severity: 'warning',
      passed: metrics.cycleTime.closedTicketCount > 0,
      value: metrics.cycleTime.closedTicketCount,
      expected: '>=1',
      message: 'Cycle time is measurable only when at least one ticket was closed.',
    },
  ];

  const criticalFailures = checks.filter((c) => c.severity === 'critical' && !c.passed);
  const warningFailures = checks.filter((c) => c.severity === 'warning' && !c.passed);

  return {
    status: criticalFailures.length > 0 ? 'fail' : warningFailures.length > 0 ? 'warn' : 'pass',
    checks,
    summary: {
      criticalFailures: criticalFailures.length,
      warningFailures: warningFailures.length,
      totalChecks: checks.length,
    },
  };
}

async function gatherSiteMetrics(site) {
  const result = {
    siteId: site.siteId,
    baseUrl: site.baseUrl,
    epicKey: site.epicKey,
    epicFound: false,
    boardFilterJqlApplied: '',
    rapidView: site.rapidView || null,
    errors: [],
    epicWindow: {
      start: null,
      end: null,
    },
    epicTickets: {
      total: 0,
      openedDuringWindow: 0,
      closedDuringWindow: 0,
      openNow: 0,
      closedNow: 0,
      keysOpenNow: [],
    },
    supportTickets: {
      total: 0,
      openedDuringWindow: 0,
      closedDuringWindow: 0,
      openNow: 0,
      closedNow: 0,
      keysOpenNow: [],
    },
    supportCycleTime: {
      avgHours: null,
      medianHours: null,
      p90Hours: null,
      closedTicketCount: 0,
    },
    cycleTime: {
      avgHours: null,
      medianHours: null,
      p90Hours: null,
      closedTicketCount: 0,
    },
  };

  if (!site.baseUrl || !site.token || !site.epicKey) {
    result.errors.push('Missing baseUrl/token/epicKey for site configuration.');
    return result;
  }

  try {
    const epicIssues = await searchAllIssues(
      site,
      `key = ${site.epicKey}`,
      ['summary', 'status', 'created', 'resolutiondate']
    );

    const epic = epicIssues[0];
    if (!epic) {
      result.errors.push(`Epic ${site.epicKey} was not found on this site.`);
      return result;
    }

    result.epicFound = true;
    const epicCreated = parseDate(epic.fields?.created);
    const epicClosed = parseDate(epic.fields?.resolutiondate) || new Date();
    result.epicWindow.start = epicCreated ? epicCreated.toISOString() : null;
    result.epicWindow.end = epicClosed ? epicClosed.toISOString() : null;

    const projectFilter = site.projectKeys.length
      ? `project in (${quoteCsv(site.projectKeys)})`
      : '';
    const issueTypeFilter = 'issuetype in ("Story","Task","Sub-task")';
    const fixVersionClause = RELEASE_FIX_VERSION ? ` AND fixVersion = "${RELEASE_FIX_VERSION}"` : '';
    const boardFilterJql = await resolveBoardFilterJql(site);
    result.boardFilterJqlApplied = boardFilterJql || '';

    const epicJql = joinJqlClauses([
      projectFilter,
      boardFilterJql,
      `"Epic Link" = ${site.epicKey}`,
      issueTypeFilter,
      fixVersionClause ? fixVersionClause.replace(/^\s*AND\s*/i, '') : '',
    ]);
    const epicTickets = await searchAllIssues(
      site,
      epicJql,
      ['status', 'created', 'resolutiondate']
    );

    const cycleHours = [];
    for (const issue of epicTickets) {
      const created = parseDate(issue.fields?.created);
      const resolved = parseDate(issue.fields?.resolutiondate);
      const statusName = issue.fields?.status?.name || '';
      const isClosed = statusIsClosed(statusName);

      if (inWindow(created, epicCreated, epicClosed)) result.epicTickets.openedDuringWindow += 1;
      if (inWindow(resolved, epicCreated, epicClosed)) result.epicTickets.closedDuringWindow += 1;

      if (isClosed) {
        result.epicTickets.closedNow += 1;
        const hours = hoursBetween(created, resolved);
        if (hours != null && hours >= 0) cycleHours.push(hours);
      } else {
        result.epicTickets.openNow += 1;
        result.epicTickets.keysOpenNow.push(issue.key);
      }
    }

    result.epicTickets.total = epicTickets.length;

    if (cycleHours.length) {
      const sorted = [...cycleHours].sort((a, b) => a - b);
      const p90Index = Math.max(0, Math.ceil(sorted.length * 0.9) - 1);
      result.cycleTime.avgHours = Number((cycleHours.reduce((s, v) => s + v, 0) / cycleHours.length).toFixed(2));
      result.cycleTime.medianHours = median(cycleHours);
      result.cycleTime.p90Hours = Number(sorted[p90Index].toFixed(2));
      result.cycleTime.closedTicketCount = cycleHours.length;
    }

    if (site.supportProjectKeys.length) {
      const supportProjects = `project in (${quoteCsv(site.supportProjectKeys)})`;
      const supportTypes = `issuetype in (${quoteCsv(SUPPORT_ISSUE_TYPES)})`;
      const supportFixVersionClause = RELEASE_FIX_VERSION ? ` AND fixVersion = "${RELEASE_FIX_VERSION}"` : '';
      const createdWindow = `created >= "${epicCreated.toISOString()}" AND created <= "${epicClosed.toISOString()}"`;
      const supportJql = joinJqlClauses([
        supportProjects,
        boardFilterJql,
        supportTypes,
        createdWindow,
        supportFixVersionClause ? supportFixVersionClause.replace(/^\s*AND\s*/i, '') : '',
      ]);

      const supportTickets = await searchAllIssues(
        site,
        supportJql,
        ['status', 'created', 'resolutiondate']
      );

      const supportCycleHours = [];

      for (const issue of supportTickets) {
        const created = parseDate(issue.fields?.created);
        const resolved = parseDate(issue.fields?.resolutiondate);
        const statusName = issue.fields?.status?.name || '';
        const isClosed = statusIsClosed(statusName);

        if (inWindow(created, epicCreated, epicClosed)) result.supportTickets.openedDuringWindow += 1;
        if (inWindow(resolved, epicCreated, epicClosed)) result.supportTickets.closedDuringWindow += 1;

        if (isClosed) {
          result.supportTickets.closedNow += 1;
          const hours = hoursBetween(created, resolved);
          if (hours != null && hours >= 0) supportCycleHours.push(hours);
        } else {
          result.supportTickets.openNow += 1;
          result.supportTickets.keysOpenNow.push(issue.key);
        }
      }

      result.supportTickets.total = supportTickets.length;

      if (supportCycleHours.length) {
        const sorted = [...supportCycleHours].sort((a, b) => a - b);
        const p90Index = Math.max(0, Math.ceil(sorted.length * 0.9) - 1);
        result.supportCycleTime.avgHours = Number((supportCycleHours.reduce((s, v) => s + v, 0) / supportCycleHours.length).toFixed(2));
        result.supportCycleTime.medianHours = median(supportCycleHours);
        result.supportCycleTime.p90Hours = Number(sorted[p90Index].toFixed(2));
        result.supportCycleTime.closedTicketCount = supportCycleHours.length;
      }
    }
  } catch (err) {
    result.errors.push(err.message);
  }

  return result;
}

function aggregateSites(siteMetrics) {
  const validSites = siteMetrics.filter((s) => s.epicFound);
  const windowStarts = validSites
    .map((s) => parseDate(s.epicWindow.start))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  const windowEnds = validSites
    .map((s) => parseDate(s.epicWindow.end))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  const globalStart = windowStarts[0] || null;
  const globalEnd = windowEnds.length ? windowEnds[windowEnds.length - 1] : null;

  const sum = (selector) => siteMetrics.reduce((acc, s) => acc + Number(selector(s) || 0), 0);

  const cycleRows = siteMetrics
    .filter((s) => Number(s.cycleTime.closedTicketCount || 0) > 0 && s.cycleTime.avgHours != null)
    .map((s) => ({
      avgHours: Number(s.cycleTime.avgHours),
      closed: Number(s.cycleTime.closedTicketCount || 0),
    }));

  const supportCycleRows = siteMetrics
    .filter((s) => Number(s.supportCycleTime.closedTicketCount || 0) > 0 && s.supportCycleTime.avgHours != null)
    .map((s) => ({
      avgHours: Number(s.supportCycleTime.avgHours),
      closed: Number(s.supportCycleTime.closedTicketCount || 0),
    }));

  let weightedAvgCycle = null;
  if (cycleRows.length) {
    const weightedSum = cycleRows.reduce((acc, row) => acc + row.avgHours * row.closed, 0);
    const weight = cycleRows.reduce((acc, row) => acc + row.closed, 0);
    weightedAvgCycle = Number((weightedSum / weight).toFixed(2));
  }

  let weightedAvgSupportCycle = null;
  if (supportCycleRows.length) {
    const weightedSum = supportCycleRows.reduce((acc, row) => acc + row.avgHours * row.closed, 0);
    const weight = supportCycleRows.reduce((acc, row) => acc + row.closed, 0);
    weightedAvgSupportCycle = Number((weightedSum / weight).toFixed(2));
  }

  const mdx = countMdxEdits(globalStart, globalEnd);

  const metrics = {
    epic: {
      key: EPIC_KEY || null,
      releaseFixVersion: RELEASE_FIX_VERSION || null,
      windowStart: globalStart ? globalStart.toISOString() : null,
      windowEnd: globalEnd ? globalEnd.toISOString() : null,
      sourceSites: siteMetrics.length,
      sourceSitesWithEpic: validSites.length,
      boardFiltersApplied: siteMetrics
        .map((s) => s.boardFilterJqlApplied || '')
        .filter(Boolean),
      rapidViews: siteMetrics
        .map((s) => s.rapidView || null)
        .filter(Boolean),
    },
    epicTickets: {
      total: sum((s) => s.epicTickets.total),
      openedDuringWindow: sum((s) => s.epicTickets.openedDuringWindow),
      closedDuringWindow: sum((s) => s.epicTickets.closedDuringWindow),
      openNow: sum((s) => s.epicTickets.openNow),
      closedNow: sum((s) => s.epicTickets.closedNow),
      openKeys: siteMetrics.flatMap((s) => s.epicTickets.keysOpenNow || []),
    },
    supportTickets: {
      total: sum((s) => s.supportTickets.total),
      openedDuringWindow: sum((s) => s.supportTickets.openedDuringWindow),
      closedDuringWindow: sum((s) => s.supportTickets.closedDuringWindow),
      openNow: sum((s) => s.supportTickets.openNow),
      closedNow: sum((s) => s.supportTickets.closedNow),
      openKeys: siteMetrics.flatMap((s) => s.supportTickets.keysOpenNow || []),
    },
    supportResolutionTime: {
      avgHoursWeighted: weightedAvgSupportCycle,
      avgDaysWeighted: weightedAvgSupportCycle == null ? null : Number((weightedAvgSupportCycle / 24).toFixed(2)),
      measuredClosedTickets: sum((s) => s.supportCycleTime.closedTicketCount),
    },
    cycleTime: {
      avgHoursWeighted: weightedAvgCycle,
      avgDaysWeighted: weightedAvgCycle == null ? null : Number((weightedAvgCycle / 24).toFixed(2)),
      measuredClosedTickets: sum((s) => s.cycleTime.closedTicketCount),
    },
    mdxChurn: {
      uniqueFilesEdited: mdx.uniqueMdxFilesEdited,
      totalEditTouches: mdx.totalMdxEditTouches,
      totalCommits: mdx.totalMdxCommits,
      files: mdx.files,
      skipped: mdx.skipped,
      reason: mdx.reason || null,
    },
  };

  const releaseGate = buildReleaseGate(metrics);
  return { metrics, releaseGate };
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const sites = parseSitesConfig();

  if (!EPIC_KEY) {
    const output = {
      generatedAt,
      skipped: true,
      reason: 'EPIC_KEY is required',
      placeholder: {
        EPIC_KEY: 'DOC-123',
        RELEASE_FIX_VERSION: '9.4.0',
        JIRA_SITES_JSON: '[{"siteId":"zebra-cloud","baseUrl":"https://example.atlassian.net","emailEnv":"JIRA_ZEBRA_EMAIL","tokenEnv":"JIRA_ZEBRA_TOKEN","projectKeys":["DOC"],"supportProjectKeys":["SUP"],"epicKey":"DOC-123","boardFilterJql":"project = DOC AND component = Core","rapidView":"1234"}]',
      },
      sites: [],
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`[epic-metrics] Skipped: ${output.reason}`);
    console.log(`[epic-metrics] Wrote placeholder output -> ${path.relative(repoRoot, outputPath)}`);
    return;
  }

  if (!sites.length) {
    const output = {
      generatedAt,
      skipped: true,
      epicKey: EPIC_KEY,
      releaseFixVersion: RELEASE_FIX_VERSION || null,
      reason: 'No Jira site config found. Set JIRA_SITES_JSON (recommended) or single-site fallback env vars.',
      placeholder: {
        EPIC_KEY,
        RELEASE_FIX_VERSION: RELEASE_FIX_VERSION || null,
        JIRA_SITES_JSON: '[{"siteId":"zebra-cloud","baseUrl":"https://example.atlassian.net","emailEnv":"JIRA_ZEBRA_EMAIL","tokenEnv":"JIRA_ZEBRA_TOKEN","projectKeys":["DOC"],"supportProjectKeys":["SUP"],"epicKey":"' + EPIC_KEY + '","boardFilterJql":"project = DOC AND component = Core","rapidView":"1234"}]',
        JIRA_BOARD_FILTER_JQL: 'project = DOC AND component = Core',
        JIRA_RAPID_VIEW_ID: '1234',
      },
      sites: [],
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`[epic-metrics] Skipped: ${output.reason}`);
    console.log(`[epic-metrics] Wrote placeholder output -> ${path.relative(repoRoot, outputPath)}`);
    return;
  }

  console.log(`[epic-metrics] Computing release metrics for epic ${EPIC_KEY} across ${sites.length} site(s)...`);

  const siteMetrics = [];
  for (const site of sites) {
    console.log(`[epic-metrics] Site ${site.siteId} ...`);
    const metrics = await gatherSiteMetrics(site);
    siteMetrics.push(metrics);
  }

  const { metrics, releaseGate } = aggregateSites(siteMetrics);

  const output = {
    generatedAt,
    skipped: false,
    epicKey: EPIC_KEY,
    releaseFixVersion: RELEASE_FIX_VERSION || null,
    doneStatuses: DONE_STATUSES,
    supportIssueTypes: SUPPORT_ISSUE_TYPES,
    sites: siteMetrics,
    metrics,
    releaseGate,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`[epic-metrics] Wrote output -> ${path.relative(repoRoot, outputPath)}`);
  console.log(`[epic-metrics] Epic open now: ${metrics.epicTickets.openNow}`);
  console.log(`[epic-metrics] Support open now: ${metrics.supportTickets.openNow}`);
  console.log(`[epic-metrics] MDX unique edited: ${metrics.mdxChurn.uniqueFilesEdited}`);
  console.log(`[epic-metrics] Release gate status: ${releaseGate.status}`);
}

main().catch((err) => {
  console.error('[epic-metrics] Fatal:', err.message);
  process.exitCode = 1;
});
