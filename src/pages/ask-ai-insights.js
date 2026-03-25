import React, {useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

const FAILED_SEARCH_STORAGE_KEY = 'askai.failed-searches';
const WEBHOOK_STORAGE_KEY = 'askai.failed-search-webhook-url';

function normalizeQuery(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/\-#._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readFailedSearches() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(FAILED_SEARCH_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function toWeekStartIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function detectSignals(item) {
  const flags = [];
  const closest = item.closestReturnedPage || '';
  const query = item.normalizedQuery || normalizeQuery(item.query);

  if (!closest || closest === '(none)') {
    flags.push('Missing docs');
  }

  if ((item.confidenceAverage || 0) < 0.35 && closest && closest !== '(none)') {
    flags.push('Bad titles/headings');
  }

  const versionLike = /\b\d+(?:[._-]\d+)+\b/.test(query);
  const releaseHint = /\b(release|release-notes|known issues|fix|bug)\b/.test(query);
  if (versionLike && releaseHint && !String(closest).startsWith('/docs/releases/')) {
    flags.push('Versioned release-note discoverability');
  }

  if ((item.confidenceAverage || 0) < 0.45 && query !== normalizeQuery(item.query)) {
    flags.push('Synonym gaps');
  }

  return flags;
}

function aggregateWeekly(events) {
  const map = new Map();

  events.forEach((event) => {
    const weekStart = event.weekStart || toWeekStartIso(event.recordedAt);
    const query = String(event.query || '').trim();
    const normalized = String(event.normalizedQuery || normalizeQuery(query));
    const closest = String(event.closestReturnedPage || '(none)');
    if (!query) return;

    const key = `${weekStart}||${query}||${normalized}||${closest}`;
    const current = map.get(key) || {
      weekStart,
      query,
      normalizedQuery: normalized,
      closestReturnedPage: closest,
      failureCount: 0,
      confidenceSum: 0,
      confidenceAverage: 0,
      reasons: {},
      lastSeenAt: event.recordedAt || '',
    };

    current.failureCount += 1;
    current.confidenceSum += Number(event.confidence || 0);
    current.confidenceAverage = current.confidenceSum / current.failureCount;
    current.reasons[event.failureReason || 'unknown'] = (current.reasons[event.failureReason || 'unknown'] || 0) + 1;
    if ((event.recordedAt || '') > current.lastSeenAt) {
      current.lastSeenAt = event.recordedAt || current.lastSeenAt;
    }

    map.set(key, current);
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      confidenceAverage: Number(row.confidenceAverage.toFixed(3)),
      signals: detectSignals(row),
    }))
    .sort((left, right) => {
      if (left.weekStart !== right.weekStart) return left.weekStart < right.weekStart ? 1 : -1;
      if (left.failureCount !== right.failureCount) return right.failureCount - left.failureCount;
      return left.query.localeCompare(right.query);
    });
}

function rowsToCsv(rows) {
  const headers = [
    'week_start',
    'exact_query',
    'normalized_query',
    'count_failures',
    'closest_returned_page',
    'confidence_average',
    'signals',
    'last_seen_at',
  ];

  const csvRows = [headers.join(',')];
  rows.forEach((row) => {
    const values = [
      row.weekStart,
      row.query,
      row.normalizedQuery,
      row.failureCount,
      row.closestReturnedPage,
      row.confidenceAverage,
      row.signals.join('; '),
      row.lastSeenAt,
    ].map((value) => `"${String(value || '').replaceAll('"', '""')}"`);
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

function downloadCsv(rows) {
  if (typeof window === 'undefined') return;
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `askai-failed-searches-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function sendAggregateToWebhook(rows, webhookUrl) {
  const payload = {
    eventType: 'askai_failed_search_weekly_aggregate',
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    rows: rows.map((row) => ({
      weekStart: row.weekStart,
      exactQuery: row.query,
      normalizedQuery: row.normalizedQuery,
      countFailures: row.failureCount,
      closestReturnedPage: row.closestReturnedPage,
      confidenceAverage: row.confidenceAverage,
      signals: row.signals,
      reasons: row.reasons,
      lastSeenAt: row.lastSeenAt,
    })),
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook request failed with HTTP ${response.status}`);
  }
}

export default function AskAIInsightsPage() {
  const [webhookUrl, setWebhookUrl] = useState(
    typeof window !== 'undefined' ? window.localStorage.getItem(WEBHOOK_STORAGE_KEY) || '' : ''
  );
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [refreshSeed, setRefreshSeed] = useState(0);

  const failedSearches = useMemo(() => readFailedSearches(), [refreshSeed]);
  const weeklyRows = useMemo(() => aggregateWeekly(failedSearches), [failedSearches]);

  const weeks = useMemo(() => {
    return Array.from(new Set(weeklyRows.map((row) => row.weekStart))).sort((a, b) => (a < b ? 1 : -1));
  }, [weeklyRows]);

  const [selectedWeek, setSelectedWeek] = useState('all');

  const visibleRows = useMemo(() => {
    if (selectedWeek === 'all') return weeklyRows;
    return weeklyRows.filter((row) => row.weekStart === selectedWeek);
  }, [selectedWeek, weeklyRows]);

  const totals = useMemo(() => {
    const totalEvents = visibleRows.reduce((sum, row) => sum + row.failureCount, 0);
    const weightedConfidence = visibleRows.reduce(
      (sum, row) => sum + (row.confidenceAverage * row.failureCount),
      0
    );
    return {
      totalEvents,
      uniqueRows: visibleRows.length,
      confidenceAverage: totalEvents > 0 ? Number((weightedConfidence / totalEvents).toFixed(3)) : 0,
    };
  }, [visibleRows]);

  function handleSaveWebhookUrl(event) {
    event.preventDefault();
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WEBHOOK_STORAGE_KEY, webhookUrl.trim());
    setStatusMessage('Saved webhook URL in local browser storage.');
  }

  async function handleSendToGoogleSheets() {
    const trimmed = webhookUrl.trim();
    if (!trimmed) {
      setStatusMessage('Please provide your Google Apps Script Web App URL first.');
      return;
    }

    try {
      setIsSending(true);
      setStatusMessage('Sending aggregate rows to Google Sheets webhook...');
      await sendAggregateToWebhook(visibleRows, trimmed);
      setStatusMessage(`Sent ${visibleRows.length} aggregate rows to Google Sheets.`);
    } catch (error) {
      setStatusMessage(`Failed to send aggregate rows: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  }

  function handleRefresh() {
    setRefreshSeed((value) => value + 1);
    setStatusMessage('Refreshed data from local failed-search storage.');
  }

  return (
    <Layout title="AskAI Insights" description="Weekly content-gap analytics for AskAI failed searches">
      <main className="container margin-vert--lg">
        <h1>AskAI Insights Dashboard</h1>
        <p>
          Weekly aggregate of failed AskAI searches for content-gap tracking. This dashboard groups by exact query,
          normalized query, closest returned page, and week.
        </p>

        <div className="margin-bottom--md" style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
          <button type="button" className="button button--secondary" onClick={handleRefresh}>
            Refresh Data
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => downloadCsv(visibleRows)}
            disabled={!visibleRows.length}
          >
            Download CSV
          </button>
          <Link className="button button--secondary" to="/ask-ai">
            Back to Ask AI
          </Link>
        </div>

        <div className="margin-bottom--md" style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
          <div style={{padding: '0.75rem 1rem', border: '1px solid var(--ifm-color-emphasis-300)', borderRadius: 8}}>
            <strong>Total failures:</strong> {totals.totalEvents}
          </div>
          <div style={{padding: '0.75rem 1rem', border: '1px solid var(--ifm-color-emphasis-300)', borderRadius: 8}}>
            <strong>Aggregate rows:</strong> {totals.uniqueRows}
          </div>
          <div style={{padding: '0.75rem 1rem', border: '1px solid var(--ifm-color-emphasis-300)', borderRadius: 8}}>
            <strong>Confidence average:</strong> {Math.round(totals.confidenceAverage * 100)}%
          </div>
          <label style={{padding: '0.75rem 1rem', border: '1px solid var(--ifm-color-emphasis-300)', borderRadius: 8}}>
            <strong>Week:</strong>{' '}
            <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)}>
              <option value="all">All weeks</option>
              {weeks.map((week) => (
                <option key={week} value={week}>{week}</option>
              ))}
            </select>
          </label>
        </div>

        <form onSubmit={handleSaveWebhookUrl} className="margin-bottom--md">
          <label htmlFor="askai-webhook-url" style={{display: 'block', fontWeight: 600, marginBottom: '0.5rem'}}>
            Google Sheets Webhook URL (Google Apps Script Web App)
          </label>
          <div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
            <input
              id="askai-webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              style={{flex: '1 1 520px', padding: '0.6rem 0.75rem', borderRadius: 8}}
            />
            <button type="submit" className="button button--secondary">Save URL</button>
            <button
              type="button"
              className="button button--primary"
              onClick={handleSendToGoogleSheets}
              disabled={isSending || !visibleRows.length}
            >
              {isSending ? 'Sending...' : 'Send Weekly Aggregate to Google Sheets'}
            </button>
          </div>
        </form>

        <p style={{fontSize: '0.95rem', color: 'var(--ifm-color-emphasis-700)'}}>
          Payload columns: week start, exact query, normalized query, count failures, closest returned page,
          confidence average, signals, reasons, last seen.
        </p>

        {statusMessage ? (
          <p style={{fontWeight: 600, color: 'var(--ifm-color-emphasis-800)'}}>{statusMessage}</p>
        ) : null}

        <div style={{overflowX: 'auto'}}>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Week</th>
                <th>Exact query</th>
                <th>Normalized query</th>
                <th>Count failures</th>
                <th>Closest returned page</th>
                <th>Confidence avg</th>
                <th>Signals</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? visibleRows.map((row) => (
                <tr key={`${row.weekStart}-${row.query}-${row.closestReturnedPage}`}>
                  <td>{row.weekStart}</td>
                  <td>{row.query}</td>
                  <td>{row.normalizedQuery}</td>
                  <td>{row.failureCount}</td>
                  <td>{row.closestReturnedPage}</td>
                  <td>{Math.round(row.confidenceAverage * 100)}%</td>
                  <td>{row.signals.join(', ') || '-'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>No failed-search records found yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </Layout>
  );
}
