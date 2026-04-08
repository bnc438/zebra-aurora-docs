/**
 * generate-v2-snapshot.mjs
 *
 * Aggregates Phase 2 ingestion data into the V2 dashboard snapshot.
 * Reads:
 *   - static/build-report.json          (doc completeness + build stability)
 *   - static/data/github-prs.json       (PR ingestion output)
 *   - static/data/jira-epics.json       (Jira Epic ingestion output)
 *   - static/data/pdf-validation-results.json  (PDF generation results)
 *
 * Writes:
 *   - static/samples/dashboard-v2-nightly-snapshot.sample.json
 *
 * Optional env vars:
 *   DOCS_VERSION   — Explicit canonical version string (e.g. "9.4.0").
 *                    If omitted the script uses the most recent version found
 *                    in github-prs or jira data, falling back to "1.0.0".
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const BUILD_REPORT_PATH   = path.join(repoRoot, 'static', 'build-report.json');
const GITHUB_PRS_PATH     = path.join(repoRoot, 'static', 'data', 'github-prs.json');
const JIRA_EPICS_PATH     = path.join(repoRoot, 'static', 'data', 'jira-epics.json');
const PDF_RESULTS_PATH    = path.join(repoRoot, 'static', 'data', 'pdf-validation-results.json');
const OUTPUT_PATH         = path.join(repoRoot, 'static', 'samples', 'dashboard-v2-nightly-snapshot.sample.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeRead(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalizeVersion(raw) {
  const m = String(raw || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3] || '0'}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function statusFromScore(score, greenMin = 90, amberMin = 75) {
  if (score >= greenMin) return 'green';
  if (score >= amberMin) return 'amber';
  return 'red';
}

/**
 * Computes a 0-100 build stability score.
 * Penalises based on the fraction of docs that have build issues.
 */
function computeBuildStabilityScore(buildStabilityData, totalDocs) {
  if (!buildStabilityData || !totalDocs) return 100;
  const issueRate = (buildStabilityData.docsWithIssues || 0) / Math.max(1, totalDocs);
  return Math.max(0, Math.round((1 - issueRate) * 100));
}

/**
 * Computes a 0-100 PDF stability score from the validation results.
 * Returns null if no results are available.
 */
function computePdfStabilityScore(pdfResults) {
  if (!pdfResults || pdfResults.length === 0) return null;
  const passCount = pdfResults.filter((r) => r.renderSuccess && r.validationPassed).length;
  return Math.round((passCount / pdfResults.length) * 100);
}

function computeJiraStats(records, versionCanonical) {
  const relevant = versionCanonical
    ? records.filter((r) => r.versionCanonical === versionCanonical)
    : records;

  const epicCount       = relevant.length;
  const openCount       = relevant.filter((r) => r.statusMapped === 'open').length;
  const inProgressCount = relevant.filter((r) => r.statusMapped === 'in_progress').length;
  const closedCount     = relevant.filter((r) => r.statusMapped === 'closed').length;
  const closureRate     = epicCount > 0
    ? Number((closedCount / epicCount * 100).toFixed(1))
    : 0;

  return {epicCount, openCount, inProgressCount, closedCount, closureRate};
}

function computePrStats(records, versionCanonical) {
  const total  = records.length;
  const linked = versionCanonical
    ? records.filter((r) => r.versionCanonical === versionCanonical)
    : records;

  return {
    prCount: linked.length,
    prLinkCoveragePct: total > 0
      ? Number((linked.length / total * 100).toFixed(1))
      : 0,
  };
}

/**
 * Release Readiness Index.
 * Weighted formula (weights sum to 1.0):
 *   0.30 * docCompletenessPct
 *   0.25 * prLinkCoveragePct
 *   0.25 * jiraClosureRatePct
 *   0.20 * pdfStabilityScore
 */
function computeRRI(docCompletenessPct, prLinkCoveragePct, jiraClosureRatePct, pdfStabilityScore) {
  const pdfScore = pdfStabilityScore ?? 100;
  const rri =
    0.30 * docCompletenessPct +
    0.25 * prLinkCoveragePct +
    0.25 * jiraClosureRatePct +
    0.20 * pdfScore;
  return Number(clamp(rri, 0, 100).toFixed(2));
}

/**
 * Tries to determine the "current active version" from ingested data.
 * Preference order: DOCS_VERSION env var → most frequent canonical version in
 * GitHub PRs → most frequent in Jira Epics → fallback "1.0.0".
 */
function resolveCurrentVersion(ghRecords, jiraRecords) {
  const envVersion = process.env.DOCS_VERSION;
  if (envVersion) {
    const canonical = normalizeVersion(envVersion);
    return {versionRaw: envVersion, versionCanonical: canonical || envVersion, confidence: 1.0};
  }

  // Count version occurrences from PR records
  const freq = {};
  for (const r of [...(ghRecords || []), ...(jiraRecords || [])]) {
    if (r.versionCanonical) {
      freq[r.versionCanonical] = (freq[r.versionCanonical] || 0) + 1;
    }
  }

  const ranked = Object.entries(freq).sort(([, a], [, b]) => b - a);
  if (ranked.length > 0) {
    const [canonical] = ranked[0];
    const total = Object.values(freq).reduce((s, v) => s + v, 0);
    return {
      versionRaw: canonical,
      versionCanonical: canonical,
      confidence: Number((ranked[0][1] / total).toFixed(2)),
    };
  }

  return {versionRaw: '1.0.0', versionCanonical: '1.0.0', confidence: 0.5};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const now = new Date();
  const snapshotDate = now.toISOString().slice(0, 10);
  const generatedAt  = now.toISOString();

  // ---- Read source data ----------------------------------------------------
  const report = safeRead(BUILD_REPORT_PATH, null);
  if (!report) {
    throw new Error(
      `Cannot read ${BUILD_REPORT_PATH}.\n` +
      'Run "npm run build-report" before generating the V2 snapshot.'
    );
  }

  const ghData   = safeRead(GITHUB_PRS_PATH,  {prCount: 0, skipped: true, records: []});
  const jiraData = safeRead(JIRA_EPICS_PATH,  {epicCount: 0, skipped: true, records: []});
  const pdfData  = safeRead(PDF_RESULTS_PATH, {snapshotDate, records: []});

  const aggregate         = report.aggregate || {};
  const totalDocs         = aggregate.totalDocs || 0;
  const avgCompleteness   = aggregate.avgCompleteness || 0;
  const buildStabilityData = aggregate.buildStability || {};
  const a11yStats          = aggregate.a11yStats || {};
  const ghRecords          = Array.isArray(ghData.records)   ? ghData.records   : [];
  const jiraRecords        = Array.isArray(jiraData.records) ? jiraData.records : [];
  const pdfResults         = Array.isArray(pdfData.records)  ? pdfData.records  : [];

  // ---- Resolve current version --------------------------------------------
  const {versionRaw, versionCanonical, confidence: versionParseConfidence} =
    resolveCurrentVersion(ghRecords, jiraRecords);

  // ---- Core metric computations -------------------------------------------
  const docCompletenessPct   = Number((avgCompleteness * 100).toFixed(1));
  const buildStabilityScore  = computeBuildStabilityScore(buildStabilityData, totalDocs);
  const pdfStabilityScore    = computePdfStabilityScore(pdfResults) ?? buildStabilityScore;
  const jiraStats            = computeJiraStats(jiraRecords, versionCanonical);
  const prStats              = computePrStats(ghRecords, versionCanonical);
  const rri                  = computeRRI(
    docCompletenessPct,
    prStats.prLinkCoveragePct,
    jiraStats.closureRate,
    pdfStabilityScore
  );

  // Content intelligence
  const requiredFieldDebt    = buildStabilityData.docsWithMissingRequired || 0;
  const metadataQualityScore = Math.round(docCompletenessPct);

  // Platform stability
  const pdfRenderSuccessRatePct = pdfResults.length > 0
    ? Number((pdfResults.filter((r) => r.renderSuccess).length / pdfResults.length * 100).toFixed(1))
    : 100;
  const pdfOutputValidityRatePct = pdfResults.length > 0
    ? Number((pdfResults.filter((r) => r.validationPassed).length / pdfResults.length * 100).toFixed(1))
    : 100;

  // Global stability (weighted average of primary measurable scores)
  const globalScore = Math.round(
    0.35 * buildStabilityScore +
    0.35 * metadataQualityScore +
    0.30 * pdfStabilityScore
  );
  const criticalAlertCount = buildStabilityData.duplicateSlugsCount || 0;
  const warningAlertCount  =
    (buildStabilityData.docsWithIssues || 0) + (a11yStats.docsWithIssues || 0);

  // ---- Assemble releaseFact ------------------------------------------------
  const releaseFact = {
    snapshotDate,
    snapshotTimestamp: generatedAt,
    versionRaw,
    versionCanonical,
    versionParseConfidence,
    docCount: totalDocs,
    docCompletenessPct,
    prCount: prStats.prCount,
    prLinkCoveragePct: prStats.prLinkCoveragePct,
    jiraEpicCount: jiraStats.epicCount,
    jiraOpenCount: jiraStats.openCount,
    jiraInProgressCount: jiraStats.inProgressCount,
    jiraClosedCount: jiraStats.closedCount,
    jiraClosureRatePct: jiraStats.closureRate,
    releaseCoverageCompletenessPct: docCompletenessPct,
    buildStabilityScore,
    pdfStabilityScore,
    releaseReadinessIndex: rri,
  };

  // ---- Assemble dashboardAggregateV2 --------------------------------------
  const dashboardAggregateV2 = {
    schemaVersion: '2.0.0',
    generatedAt,
    snapshotDate,
    presetOptions: ['all', 'content_team', 'product_owner', 'leadership'],
    globalStability: {
      score: globalScore,
      status: statusFromScore(globalScore),
      criticalAlertCount,
      warningAlertCount,
      thresholds: {greenMin: 90, amberMin: 75},
    },
    tiles: {
      releaseIntelligence: {
        metrics: {
          releaseReadinessIndex: rri,
          jiraClosureRatePct: jiraStats.closureRate,
        },
      },
      contentIntelligence: {
        metrics: {
          requiredFieldDebt,
          metadataQualityScore,
        },
      },
      // userBehavior and searchInsights require runtime analytics — populated
      // live in the DevDashboard from localStorage / future analytics pipeline.
      userBehavior: {
        metrics: {
          pageviews: 0,
          uniqueUsers: 0,
          engagedSessions: 0,
          avgEngagementTimeSec: 0,
          topicPopularityScore: 0,
        },
        weights: {
          pageviews: 0.35,
          uniqueUsers: 0.25,
          engagedSessions: 0.25,
          avgEngagementTimeSec: 0.15,
        },
      },
      searchInsights: {
        metrics: {
          localQueryVolume: 0,
          localZeroResultRatePct: 0,
          askAiQueryVolume: 0,
          unifiedContentGapScore: 0,
        },
      },
      platformStability: {
        metrics: {
          monacoStabilityScore: 0,   // Populated live from localStorage
          pdfRenderSuccessRatePct,
          pdfOutputValidityRatePct,
        },
      },
      operationalHealth: {
        metrics: {
          nightlySnapshotSuccessRatePct: 100,
          dataFreshnessLagHours: 0,
        },
      },
    },
    thresholds: {
      global: {greenMin: 90, amberMin: 75},
      metricSpecific: {
        localZeroResultRatePct: {greenMax: 10, amberMax: 20},
        requiredFieldDebt: {greenMax: 0, amberMax: 5},
      },
    },
    tooltips: {
      releaseReadinessIndex: {
        definition: 'Weighted readiness score combining doc completeness, PR coverage, Jira closure rate, and PDF stability.',
        formula: '0.30 * docCompletenessPct + 0.25 * prLinkCoveragePct + 0.25 * jiraClosureRatePct + 0.20 * pdfStabilityScore',
        thresholds: {greenMin: 85, amberMin: 65},
        owner: 'Content + Product',
        updatedAt: generatedAt,
      },
      metadataQualityScore: {
        definition: 'Average frontmatter completeness across all docs as a percentage.',
        formula: 'avg(completenessScore per doc) × 100',
        thresholds: {greenMin: 85, amberMin: 65},
        owner: 'Content Team',
        updatedAt: generatedAt,
      },
      buildStabilityScore: {
        definition: 'Percentage of docs with no build issues (missing required fields, broken image refs, invalid dates).',
        formula: '(1 − docsWithIssues / totalDocs) × 100',
        thresholds: {greenMin: 90, amberMin: 75},
        owner: 'Content Team',
        updatedAt: generatedAt,
      },
      pdfStabilityScore: {
        definition: 'Percentage of PDF sections that rendered successfully and passed validation.',
        formula: 'passedSections / totalSections × 100',
        thresholds: {greenMin: 95, amberMin: 80},
        owner: 'Engineering',
        updatedAt: generatedAt,
      },
    },
  };

  // ---- Write output --------------------------------------------------------
  const snapshot = {
    snapshotDate,
    generatedAt,
    releaseFact: [releaseFact],
    searchQueryEvent: [],        // Populated live from localStorage in DevDashboard
    monacoTelemetryEvent: [],    // Populated live from localStorage in DevDashboard
    pdfValidationResult: pdfResults,
    dashboardAggregateV2,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), {recursive: true});
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2));

  console.log(`[v2-snapshot] Snapshot written → ${path.relative(repoRoot, OUTPUT_PATH)}`);
  console.log(`[v2-snapshot] Version:           ${versionCanonical} (confidence ${versionParseConfidence})`);
  console.log(`[v2-snapshot] Global Stability:  ${globalScore} (${statusFromScore(globalScore)})`);
  console.log(`[v2-snapshot] Release Readiness: ${rri}`);
  console.log(`[v2-snapshot] Doc Completeness:  ${docCompletenessPct}%`);
  console.log(`[v2-snapshot] PDF sections:      ${pdfResults.length} (${pdfRenderSuccessRatePct}% success)`);
  console.log(`[v2-snapshot] PRs linked:        ${prStats.prCount} / Jira Epics: ${jiraStats.epicCount}`);
}

main().catch((err) => {
  console.error('[v2-snapshot] Fatal:', err.message);
  process.exitCode = 1;
});
