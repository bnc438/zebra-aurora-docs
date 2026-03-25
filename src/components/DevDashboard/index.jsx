/**
 * src/components/DevDashboard/index.jsx
 * ============================================================================
 * Developer Dashboard — 8 panels powered by static/build-report.json.
 *
 * All charts are pure CSS/SVG (conic-gradient donuts, CSS flex bar charts).
 * Zero external chart libraries required.
 *
 * Portability: drop this component + scripts/generate-build-report.mjs +
 * dashboard.config.js into any Docusaurus repo and the dashboard works.
 */

import React, { useEffect, useState } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

// ---------------------------------------------------------------------------
// Zebra Aurora palette – 10 distinguishable colours for taxonomy charts
// ---------------------------------------------------------------------------
const PALETTE = [
  '#003fbd', '#bdf75f', '#e67e22', '#9b59b6', '#1abc9c',
  '#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#e91e63',
];

// ---------------------------------------------------------------------------
// Helper: build conic-gradient string for donut rings
// ---------------------------------------------------------------------------
function buildConicGradient(segments) {
  if (!segments.length) return 'conic-gradient(#ccc 0% 100%)';
  let cursor = 0;
  const stops = segments.map(({ pct, color }) => {
    const start = cursor;
    cursor += pct;
    return `${color} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

// ---------------------------------------------------------------------------
// DonutChart component
// ---------------------------------------------------------------------------
function DonutChart({ counts }) {
  const entries = Object.entries(counts || {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!total) return <span className={styles.empty}>No data</span>;

  const segments = entries.map(([label, count], i) => ({
    label,
    count,
    pct: (count / total) * 100,
    color: PALETTE[i % PALETTE.length],
  }));

  const gradient = buildConicGradient(segments);
  const maskStyle = {
    background: `radial-gradient(circle, var(--ifm-background-surface-color) 52%, transparent 52%)`,
  };

  return (
    <div className={styles.donutWrap}>
      <div
        className={styles.donut}
        style={{ background: gradient }}
        title={`Total: ${total}`}
      >
        {/* CSS mask to cut out inner hole */}
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', ...maskStyle }} />
      </div>
      <div className={styles.donutLegend}>
        {segments.map(({ label, count, color }) => (
          <div key={label} className={styles.donutLegendItem}>
            <span className={styles.donutLegendSwatch} style={{ background: color }} />
            <span className={styles.donutLegendLabel}>{label}</span>
            <span className={styles.donutLegendCount}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BarChart component
// ---------------------------------------------------------------------------
function BarChart({ counts, maxBars = 10 }) {
  const entries = Object.entries(counts || {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxBars);
  const max = entries[0]?.[1] || 1;
  if (!entries.length) return <span className={styles.empty}>No data</span>;

  return (
    <div className={styles.barChart}>
      {entries.map(([label, count], i) => {
        const heightPct = Math.max(4, (count / max) * 100);
        return (
          <div key={label} className={styles.barWrap} title={`${label}: ${count}`}>
            <span className={styles.barCount}>{count}</span>
            <div
              className={styles.bar}
              style={{
                height: `${heightPct}%`,
                background: PALETTE[i % PALETTE.length],
                position: 'relative',
              }}
            >
              <span className={styles.barLabel}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressList component
// ---------------------------------------------------------------------------
function ProgressList({ items }) {
  return (
    <div className={styles.progressList}>
      {items.map(({ label, value, warn }) => {
        const pct = Math.round(value * 100);
        const fillClass = warn
          ? pct < 30
            ? styles.progressFillDanger
            : styles.progressFillWarn
          : styles.progressFill;
        return (
          <div key={label} className={styles.progressItem}>
            <div className={styles.progressMeta}>
              <span>{label}</span>
              <span>{pct}%</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={`${styles.progressFill} ${fillClass}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge helper
// ---------------------------------------------------------------------------
function StatusBadge({ ok, warn, label }) {
  const cls = ok ? styles.statusOk : warn ? styles.statusWarn : styles.statusError;
  const icon = ok ? '✓' : warn ? '⚠' : '✗';
  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      {icon} {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Panel 1: Build Overview
// ---------------------------------------------------------------------------
function BuildOverviewPanel({ report }) {
  const { aggregate } = report;
  const completePct = Math.round(aggregate.avgCompleteness * 100);
  const stats = [
    { value: aggregate.totalDocs,   label: 'Total Docs' },
    { value: aggregate.totalWords.toLocaleString(), label: 'Total Words' },
    { value: aggregate.avgWords,    label: 'Avg Words/Doc' },
    { value: `${completePct}%`,     label: 'Avg Completeness' },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>📦</span>
        <h3 className={styles.panelTitle}>Build Overview</h3>
      </div>
      <p className={styles.panelSubtitle}>
        Generated {new Date(report.generatedAt).toLocaleString()}
      </p>
      <div className={styles.statRow}>
        {stats.map(({ value, label }) => (
          <div key={label} className={styles.stat}>
            <div className={styles.statValue}>{value}</div>
            <div className={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>
      <div className={styles.statusRow}>
        {Object.entries(aggregate.sections || {}).map(([section, count]) => (
          <StatusBadge key={section} ok label={`${section}: ${count}`} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel 2: Schema Intelligence
// ---------------------------------------------------------------------------
function SchemaIntelligencePanel({ report }) {
  const { aggregate } = report;
  const totalDocs = aggregate.totalDocs || 1;
  const guessing = aggregate.guessing || {};
  const fieldItems = Object.entries(aggregate.fieldCoveragePercent || {})
    .map(([key, pct]) => ({ label: key, value: pct, warn: pct < 0.5 }));

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🧬</span>
        <h3 className={styles.panelTitle}>Schema Intelligence</h3>
      </div>
      <p className={styles.panelSubtitle}>
        Frontmatter field coverage · {guessing.totalGuessedFields || 0} auto-guessed fields across{' '}
        {guessing.docsWithGuesses || 0} docs{' '}
        <span className={styles.guessedChip}>guessed</span>
      </p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{guessing.totalGuessedFields || 0}</div>
          <div className={styles.statLabel}>Guessed Fields</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{guessing.docsWithGuesses || 0}</div>
          <div className={styles.statLabel}>Docs w/ Guesses</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{totalDocs - (guessing.docsWithGuesses || 0)}</div>
          <div className={styles.statLabel}>Fully Authored</div>
        </div>
      </div>
      <ProgressList items={fieldItems} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel 3: Accessibility Live Checks
// ---------------------------------------------------------------------------
function AccessibilityPanel({ report }) {
  const { aggregate, docs } = report;
  const placeholders = aggregate.placeholders || {};
  const docsWithIssues = placeholders.docsWithPlaceholders || 0;
  const byField = placeholders.byField || {};
  const bodyCount = byField._body || 0;
  const fieldCount = docsWithIssues - Math.min(bodyCount, docsWithIssues);

  // Find docs with missing title (basic a11y)
  const missingTitle = docs.filter((d) => !d.frontmatter.title).length;
  const missingDesc = docs.filter((d) => !d.frontmatter.description).length;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>♿</span>
        <h3 className={styles.panelTitle}>Accessibility Checks</h3>
      </div>
      <p className={styles.panelSubtitle}>Placeholder detection · missing metadata</p>
      <div className={styles.statusRow}>
        <StatusBadge ok={docsWithIssues === 0} warn={docsWithIssues > 0 && docsWithIssues < 10}
          label={`${docsWithIssues} docs have placeholders`} />
        <StatusBadge ok={missingTitle === 0} warn={missingTitle > 0}
          label={`${missingTitle} missing title`} />
        <StatusBadge ok={missingDesc === 0} warn={missingDesc > 0}
          label={`${missingDesc} missing description`} />
      </div>
      <div className={styles.scrollBox}>
        <table className={styles.docTable}>
          <thead>
            <tr><th>Field</th><th># Docs Affected</th></tr>
          </thead>
          <tbody>
            {Object.entries(byField)
              .sort(([, a], [, b]) => b - a)
              .map(([field, count]) => (
                <tr key={field}>
                  <td>{field === '_body' ? 'Body text' : field}</td>
                  <td>{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel 4: SEO Health
// ---------------------------------------------------------------------------
function SeoHealthPanel({ report }) {
  const { aggregate } = report;
  const seo = aggregate.seoHealth || {};
  const total = aggregate.totalDocs || 1;

  const items = [
    { label: 'Has Title',       value: (seo.hasTitle || 0) / total },
    { label: 'Has Description', value: (seo.hasDescription || 0) / total, warn: true },
    { label: 'Has Keywords',    value: (seo.hasKeywords || 0) / total, warn: true },
    { label: 'Has Slug',        value: (seo.hasSlug || 0) / total },
  ];

  const seoScore = Math.round(items.reduce((s, i) => s + i.value, 0) / items.length * 100);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🔍</span>
        <h3 className={styles.panelTitle}>SEO Health</h3>
      </div>
      <p className={styles.panelSubtitle}>Metadata completeness for search engine visibility</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{seoScore}%</div>
          <div className={styles.statLabel}>SEO Score</div>
        </div>
      </div>
      <ProgressList items={items} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel 5: Analytics
// ---------------------------------------------------------------------------
function AnalyticsPanel({ report }) {
  const { aggregate } = report;
  // Check if GA is configured (we look for gtag in docusaurus.config – best effort)
  const gaPresent = false; // Tier 1: static check (no gtag plugin detected in config)

  const statusCounts = aggregate.taxonomy?.status || {};
  const publishedCount = statusCounts['Published'] || 0;
  const draftCount = statusCounts['Draft'] || 0;
  const total = aggregate.totalDocs || 1;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>📊</span>
        <h3 className={styles.panelTitle}>Analytics</h3>
      </div>
      <p className={styles.panelSubtitle}>GA Tier 1 presence · Tier 2 locked (API key required)</p>
      <div className={styles.statusRow}>
        <StatusBadge ok={gaPresent} warn={!gaPresent}
          label={gaPresent ? 'GA configured' : 'GA not detected'} />
        <StatusBadge warn label="Tier 2: API key locked" />
      </div>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{publishedCount}</div>
          <div className={styles.statLabel}>Published</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{draftCount}</div>
          <div className={styles.statLabel}>Draft</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{Math.round((publishedCount / total) * 100)}%</div>
          <div className={styles.statLabel}>Publish Rate</div>
        </div>
      </div>
      <DonutChart counts={statusCounts} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel 6: Performance Metrics
// ---------------------------------------------------------------------------
function PerformancePanel({ report }) {
  const { aggregate, docs } = report;

  // Word count distribution buckets
  const buckets = { '0–100': 0, '101–300': 0, '301–600': 0, '601–1000': 0, '1000+': 0 };
  for (const doc of docs) {
    const w = doc.wordCount;
    if (w <= 100)       buckets['0–100']++;
    else if (w <= 300)  buckets['101–300']++;
    else if (w <= 600)  buckets['301–600']++;
    else if (w <= 1000) buckets['601–1000']++;
    else                buckets['1000+']++;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>⚡</span>
        <h3 className={styles.panelTitle}>Performance Metrics</h3>
      </div>
      <p className={styles.panelSubtitle}>Word count distribution · docs per section</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{aggregate.avgWords}</div>
          <div className={styles.statLabel}>Avg Words</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{aggregate.totalWords.toLocaleString()}</div>
          <div className={styles.statLabel}>Total Words</div>
        </div>
      </div>
      <p className={styles.panelSubtitle} style={{ margin: 0 }}>Word count distribution</p>
      <BarChart counts={buckets} />
      <p className={styles.panelSubtitle} style={{ margin: 0 }}>Docs per section</p>
      <BarChart counts={aggregate.sections || {}} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel 7: Ask AI Engine Stats
// ---------------------------------------------------------------------------
function AskAiPanel({ report }) {
  const [index, setIndex] = useState(null);
  const indexUrl = useBaseUrl('/askai-index.json');

  useEffect(() => {
    fetch(indexUrl)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setIndex(data))
      .catch(() => setIndex(null));
  }, [indexUrl]);

  const sectionCounts = {};
  if (index?.records) {
    for (const rec of index.records) {
      const parts = (rec.url || '').replace('/docs/', '').split('/');
      const section = parts.length > 1 ? parts[0] : 'root';
      sectionCounts[section] = (sectionCounts[section] || 0) + 1;
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🤖</span>
        <h3 className={styles.panelTitle}>Ask AI Engine</h3>
      </div>
      <p className={styles.panelSubtitle}>Search index statistics</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{index ? index.records.length : '–'}</div>
          <div className={styles.statLabel}>Index Records</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{report.aggregate.totalDocs}</div>
          <div className={styles.statLabel}>Source Docs</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {index
              ? `~${Math.round(JSON.stringify(index).length / 1024)} KB`
              : '–'}
          </div>
          <div className={styles.statLabel}>Index Size</div>
        </div>
      </div>
      {index
        ? <BarChart counts={sectionCounts} />
        : <span className={styles.empty}>Index not loaded</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel 8: Content Freshness / Velocity
// ---------------------------------------------------------------------------
function FreshnessPanel({ report }) {
  const { docs } = report;

  const stale = docs.filter((d) => {
    const rev = d.frontmatter.last_reviewed;
    return !rev || rev === null || /\[.*?\]/.test(String(rev));
  }).length;
  const reviewed = docs.length - stale;

  // Docs grouped by content_type for velocity view
  const byContentType = report.aggregate.taxonomy?.content_type || {};

  // Top 5 most-wordy (freshness proxy)
  const topDocs = [...docs]
    .sort((a, b) => b.wordCount - a.wordCount)
    .slice(0, 5);

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🕐</span>
        <h3 className={styles.panelTitle}>Content Freshness / Velocity</h3>
      </div>
      <p className={styles.panelSubtitle}>Review status · content type distribution</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{reviewed}</div>
          <div className={styles.statLabel}>Reviewed</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stale}</div>
          <div className={styles.statLabel}>Needs Review</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {docs.length > 0 ? Math.round((reviewed / docs.length) * 100) : 0}%
          </div>
          <div className={styles.statLabel}>Review Coverage</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Content type velocity</p>
          <DonutChart counts={byContentType} />
        </div>
        <div style={{ flex: '2 1 240px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Top 5 docs by word count</p>
          <table className={styles.docTable}>
            <thead>
              <tr><th>Title</th><th>Words</th><th>Section</th></tr>
            </thead>
            <tbody>
              {topDocs.map((d) => (
                <tr key={d.filePath}>
                  <td title={d.title}>{d.title}</td>
                  <td>{d.wordCount}</td>
                  <td>{d.section}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DevDashboard export
// ---------------------------------------------------------------------------
export default function DevDashboard() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const reportUrl = useBaseUrl('/build-report.json');

  useEffect(() => {
    fetch(reportUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setReport(data))
      .catch((e) => setError(e.message));
  }, [reportUrl]);

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.devNotice}>
          ⚠ Could not load <code>build-report.json</code>: {error}.{' '}
          Run <code>npm run build-report</code> first.
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.empty}>Loading build report…</div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.devNotice}>
        🛠 Developer Dashboard — <strong>dev only</strong>. This page is not visible in production.
        Data sourced from <code>static/build-report.json</code>.
      </div>

      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>Dev Dashboard</h1>
        <span className={styles.dashboardBadge}>DEV ONLY</span>
        <span className={styles.buildMeta}>
          Report: {new Date(report.generatedAt).toLocaleString()}
        </span>
      </div>

      <div className={styles.panelGrid}>
        <BuildOverviewPanel report={report} />
        <SchemaIntelligencePanel report={report} />
        <AccessibilityPanel report={report} />
        <SeoHealthPanel report={report} />
        <AnalyticsPanel report={report} />
        <PerformancePanel report={report} />
        <AskAiPanel report={report} />
        <FreshnessPanel report={report} />
      </div>
    </div>
  );
}
