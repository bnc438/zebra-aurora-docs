#!/usr/bin/env node
/**
 * scripts/validate-dashboard-v2-contracts.mjs
 * ---------------------------------------------------------------------------
 * Lightweight, dependency-free contract validation for dashboard v2 payloads.
 * Fails fast so invalid snapshot structures are caught in CI/build pipelines.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const snapshotPath = path.join(workspaceRoot, 'static', 'samples', 'dashboard-v2-nightly-snapshot.sample.json');
const schemaDir = path.join(workspaceRoot, 'schemas', 'dashboard-v2');
const schemaFiles = [
  'release-fact.schema.json',
  'search-query-event.schema.json',
  'monaco-telemetry-event.schema.json',
  'pdf-validation-result.schema.json',
  'dashboard-aggregate-v2.schema.json',
];

function die(message) {
  console.error(`[dashboard-v2-validate] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[dashboard-v2-validate] ${message}`);
}

function assert(condition, message) {
  if (!condition) die(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertKeys(obj, keys, name) {
  for (const key of keys) {
    assert(Object.prototype.hasOwnProperty.call(obj, key), `${name} missing required key: ${key}`);
  }
}

function assertPercent(value, name) {
  assert(isNumber(value), `${name} must be a number`);
  assert(value >= 0 && value <= 100, `${name} must be between 0 and 100`);
}

function validateReleaseFact(row, index) {
  const name = `releaseFact[${index}]`;
  assert(isObject(row), `${name} must be an object`);
  assertKeys(row, [
    'snapshotDate', 'snapshotTimestamp', 'versionRaw', 'versionCanonical', 'versionParseConfidence',
    'docCount', 'docCompletenessPct', 'prCount', 'prLinkCoveragePct', 'jiraEpicCount',
    'jiraOpenCount', 'jiraInProgressCount', 'jiraClosedCount', 'jiraClosureRatePct',
    'releaseCoverageCompletenessPct', 'buildStabilityScore', 'pdfStabilityScore', 'releaseReadinessIndex',
  ], name);
  assert(/^\d+\.\d+\.\d+$/.test(row.versionCanonical), `${name}.versionCanonical must match x.y.z`);
  assert(row.versionParseConfidence >= 0 && row.versionParseConfidence <= 1, `${name}.versionParseConfidence must be 0..1`);
  assertPercent(row.docCompletenessPct, `${name}.docCompletenessPct`);
  assertPercent(row.prLinkCoveragePct, `${name}.prLinkCoveragePct`);
  assertPercent(row.jiraClosureRatePct, `${name}.jiraClosureRatePct`);
  assertPercent(row.releaseCoverageCompletenessPct, `${name}.releaseCoverageCompletenessPct`);
  assertPercent(row.buildStabilityScore, `${name}.buildStabilityScore`);
  assertPercent(row.pdfStabilityScore, `${name}.pdfStabilityScore`);
  assertPercent(row.releaseReadinessIndex, `${name}.releaseReadinessIndex`);
}

function validateSearchQueryEvent(row, index) {
  const name = `searchQueryEvent[${index}]`;
  assert(isObject(row), `${name} must be an object`);
  assertKeys(row, [
    'eventId', 'eventTimestamp', 'snapshotDate', 'source', 'queryText', 'queryNormalized', 'zeroResultFlag', 'environment',
  ], name);
  assert(['local_search', 'ask_ai'].includes(row.source), `${name}.source must be local_search or ask_ai`);
  assert(typeof row.queryText === 'string' && row.queryText.length > 0, `${name}.queryText must be non-empty string`);
  assert(typeof row.zeroResultFlag === 'boolean', `${name}.zeroResultFlag must be boolean`);
}

function validateMonacoTelemetryEvent(row, index) {
  const name = `monacoTelemetryEvent[${index}]`;
  assert(isObject(row), `${name} must be an object`);
  assertKeys(row, ['eventId', 'eventTimestamp', 'snapshotDate', 'environment', 'eventType', 'sessionId'], name);
  assert(row.environment === 'dev', `${name}.environment must be dev`);
  assert(['load_success', 'load_failure', 'runtime_exception', 'freeze_detected'].includes(row.eventType), `${name}.eventType invalid`);
}

function validatePdfValidationResult(row, index) {
  const name = `pdfValidationResult[${index}]`;
  assert(isObject(row), `${name} must be an object`);
  assertKeys(row, [
    'snapshotDate', 'runId', 'pdfId', 'sectionKey', 'outputPath', 'renderAttempted', 'renderSuccess',
    'renderDurationMs', 'timeoutFlag', 'fileExists', 'pageCount', 'brokenLinkCount', 'imageFailureCount',
    'internalLinkCheckPassed', 'externalLinkCheckPassed', 'validationPassed',
  ], name);
  assert(typeof row.validationPassed === 'boolean', `${name}.validationPassed must be boolean`);
  assert(row.pageCount >= 0, `${name}.pageCount must be >= 0`);
}

function validateDashboardAggregateV2(obj) {
  const name = 'dashboardAggregateV2';
  assert(isObject(obj), `${name} must be an object`);
  assertKeys(obj, ['schemaVersion', 'generatedAt', 'snapshotDate', 'presetOptions', 'globalStability', 'tiles', 'thresholds', 'tooltips'], name);

  assert(Array.isArray(obj.presetOptions), `${name}.presetOptions must be an array`);
  for (const preset of ['all', 'content_team', 'product_owner', 'leadership']) {
    assert(obj.presetOptions.includes(preset), `${name}.presetOptions missing ${preset}`);
  }

  assert(isObject(obj.globalStability), `${name}.globalStability must be object`);
  assertPercent(obj.globalStability.score, `${name}.globalStability.score`);
  assert(['green', 'amber', 'red'].includes(obj.globalStability.status), `${name}.globalStability.status invalid`);

  const hasWeights = isObject(obj.tiles?.userBehavior?.weights);
  assert(hasWeights, `${name}.tiles.userBehavior.weights must exist`);
}

function main() {
  for (const schemaFile of schemaFiles) {
    const fullPath = path.join(schemaDir, schemaFile);
    assert(fs.existsSync(fullPath), `Missing schema file: schemas/dashboard-v2/${schemaFile}`);
    JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  }
  ok(`Schema files found and parseable (${schemaFiles.length})`);

  assert(fs.existsSync(snapshotPath), 'Missing sample snapshot: static/samples/dashboard-v2-nightly-snapshot.sample.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  assertKeys(snapshot, [
    'snapshotDate',
    'generatedAt',
    'releaseFact',
    'searchQueryEvent',
    'monacoTelemetryEvent',
    'pdfValidationResult',
    'dashboardAggregateV2',
  ], 'snapshot');

  assert(Array.isArray(snapshot.releaseFact), 'snapshot.releaseFact must be array');
  snapshot.releaseFact.forEach(validateReleaseFact);

  assert(Array.isArray(snapshot.searchQueryEvent), 'snapshot.searchQueryEvent must be array');
  snapshot.searchQueryEvent.forEach(validateSearchQueryEvent);

  assert(Array.isArray(snapshot.monacoTelemetryEvent), 'snapshot.monacoTelemetryEvent must be array');
  snapshot.monacoTelemetryEvent.forEach(validateMonacoTelemetryEvent);

  assert(Array.isArray(snapshot.pdfValidationResult), 'snapshot.pdfValidationResult must be array');
  snapshot.pdfValidationResult.forEach(validatePdfValidationResult);

  validateDashboardAggregateV2(snapshot.dashboardAggregateV2);

  ok('All dashboard v2 contract checks passed');
}

main();
