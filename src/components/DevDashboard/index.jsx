// ---------------------------------------------------------------------------
// PANEL 10: Accessibility (WCAG compliance)
// ---------------------------------------------------------------------------
function AccessibilityPanel({ report }) {
  const tooltips = dashboardTooltips.accessibility.metrics;
  const a11y = report.aggregate?.a11yStats || {};
  const wcag = a11y.wcagCompliance || {};
  const docs = report.docs || [];
  const scoreColor =
    wcag.wcagLevel === 'AAA' ? '#2ecc71' :
    wcag.wcagLevel === 'AA' ? '#f39c12' :
    wcag.wcagLevel === 'A' ? '#e74c3c' : '#888';

  // Collect docs with a11y issues
  const docsWithIssues = docs
    .filter((d) => d.hasA11yIssues)
    .map((d) => ({
      file: d.filePath,
      title: d.title || d.filePath.replace(/^docs\//, ''),
      section: d.section,
      issues: (d.a11yIssues || []).map((i) => `${i.type.replace(/_/g, ' ')} (${i.count})`).join(', ') || '–',
      issueCount: (d.a11yIssues || []).reduce((s, i) => s + (i.count || 1), 0),
    }))
    .sort((a, b) => b.issueCount - a.issueCount);

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>♿</span>
        <h3 className={styles.panelTitle}>Accessibility (WCAG Compliance)</h3>
      </div>
      <p className={styles.panelSubtitle}>
        WCAG compliance analysis across {wcag.pagesAnalyzed || '–'} pages.
        {wcag.lastAnalyzed && ` Last analyzed: ${new Date(wcag.lastAnalyzed).toLocaleDateString()}`}
      </p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: scoreColor }}>{wcag.wcagLevel || 'N/A'}</div>
          <div className={styles.statLabel} title={tooltips.a11yScore.tooltip}>WCAG Level</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{wcag.totalViolations ?? '–'}</div>
          <div className={styles.statLabel}>Violations</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: (wcag.criticalErrors || 0) > 0 ? '#e74c3c' : '#2ecc71' }}>{wcag.criticalErrors ?? '–'}</div>
          <div className={styles.statLabel}>Critical Errors</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: (wcag.warnings || 0) > 0 ? '#f39c12' : '#2ecc71' }}>{wcag.warnings ?? '–'}</div>
          <div className={styles.statLabel} title={tooltips.headingSkips.tooltip}>Warnings</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{a11y.imgNoAlt ?? '–'}</div>
          <div className={styles.statLabel} title={tooltips.imagesNoAlt.tooltip}>{tooltips.imagesNoAlt.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{a11y.docsWithIssues ?? '–'}</div>
          <div className={styles.statLabel} title={tooltips.docsWithIssues.tooltip}>{tooltips.docsWithIssues.label}</div>
        </div>
      </div>
      <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
        <StatusBadge ok={wcag.wcagLevel === 'AAA'} warn={wcag.wcagLevel === 'AA'} label={`WCAG Level: ${wcag.wcagLevel || 'N/A'}`} tooltip={tooltips.a11yScore.tooltip} />
        <StatusBadge ok={wcag.criticalErrors === 0} warn={wcag.criticalErrors > 0} label={`Critical Errors: ${wcag.criticalErrors ?? '–'}`} tooltip={tooltips.docsWithIssues.tooltip} />
        <StatusBadge ok={wcag.warnings === 0} warn={wcag.warnings > 0} label={`Warnings: ${wcag.warnings ?? '–'}`} tooltip={tooltips.headingSkips.tooltip} />
        <StatusBadge ok={(a11y.imgNoAlt || 0) === 0} warn={(a11y.imgNoAlt || 0) > 0} label={`Missing Alt: ${a11y.imgNoAlt ?? 0}`} tooltip={tooltips.imagesNoAlt.tooltip} />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        {/* Top Issues + Recommendations */}
        <div style={{ flex: '1 1 260px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Top Issues</p>
          {wcag.topIssues && wcag.topIssues.length > 0 ? (
            <ul>
              {wcag.topIssues.map((issue, i) => (
                <li key={i}>{issue.description} ({issue.count})</li>
              ))}
            </ul>
          ) : (
            <span className={styles.empty}>No issues reported</span>
          )}
          <p className={styles.panelSubtitle} style={{ margin: '1rem 0 0.5rem' }}>Recommendations</p>
          {wcag.recommendations && wcag.recommendations.length > 0 ? (
            <ul>
              {wcag.recommendations.map((rec, i) => (
                <li key={i}><strong>[{rec.priority}]</strong> {rec.description} — <em>{rec.action}</em></li>
              ))}
            </ul>
          ) : (
            <span className={styles.empty}>No recommendations</span>
          )}
        </div>

        {/* Files needing updates */}
        <div style={{ flex: '2 1 400px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Files Needing Accessibility Updates</p>
          {docsWithIssues.length > 0 ? (
            <div className={styles.scrollBox}>
              <table className={styles.docTable}>
                <thead>
                  <tr><th>File</th><th>Section</th><th>Issues</th><th>Count</th></tr>
                </thead>
                <tbody>
                  {docsWithIssues.map((d) => (
                    <tr key={d.file}>
                      <td title={d.file}>{d.file.replace(/^docs\//, '')}</td>
                      <td>{d.section}</td>
                      <td>{d.issues}</td>
                      <td style={{ color: d.issueCount > 2 ? '#e74c3c' : d.issueCount > 0 ? '#f39c12' : '#2ecc71', fontWeight: 600 }}>{d.issueCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <span className={styles.empty}>✓ No files with accessibility issues</span>
          )}
        </div>
      </div>
    </div>
  );
}
/**
 * src/components/DevDashboard/index.jsx
 * ============================================================================
 * Developer Dashboard — visually impressive 9-panel build intelligence suite.
 *
 * Panels:
 *   1. Build Overview (hero header with health score gauge)
 *   2. Metadata Schema Analytics (device type · role · use case · skill level)
 *   3. Schema Intelligence (field coverage heatmap + guessing stats)
 *   4. Date & Freshness Analytics (freshness buckets · monthly velocity)
 *   5. SEO Health (metadata completeness)
 *   6. Analytics (GA presence · publish status)
 *   7. Content Performance (word count distribution)
 *   8. Ask AI Engine (index statistics)
 *   9. Content Quality (placeholders · missing metadata table)
 *
 * All charts: pure CSS/SVG (conic-gradient donuts, CSS flex bars).
 * Zero external chart libraries.
 */

import React, { useEffect, useState } from 'react';
import { dashboardTooltips } from './dashboardTooltips';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

// ---------------------------------------------------------------------------
// Zebra Aurora palette – 10 distinguishable colours
// ---------------------------------------------------------------------------
const PALETTE = [
  '#003fbd', '#bdf75f', '#e67e22', '#9b59b6', '#1abc9c',
  '#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#e91e63',
];

// ---------------------------------------------------------------------------
// Section header — groups related panels with a labeled divider
// ---------------------------------------------------------------------------
function SectionHeader({ icon, title }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionIcon}>{icon}</span>
      <h2 className={styles.sectionTitle}>{title}</h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2 Dashboard constants
// ---------------------------------------------------------------------------

// Panel keys for V1 persona filtering
const ALL_V1_PANELS = [
  'buildOverview',
  // Quality Gates
  'engineeringTests', 'buildStability', 'brokenLinkTrend', 'lighthouseCI', 'playwrightE2E',
  'dependencyFreshness', 'pdfCoverage', 'platformStability', 'operationalHealth',
  // Content Health
  'contentQuality', 'seoHealth', 'dateFreshness', 'contentPerformance',
  'i18nCoverage', 'ditaMigration',
  // Schema & Taxonomy
  'schemaAnalytics', 'schemaIntelligence',
  // Platform Intelligence
  'analytics', 'searchInsights', 'accessibility',
  // UX Metrics
  'userBehavior', 'docFeedback',
  // Release & Operations
  'epicReleaseGate', 'releaseIntelligence', 'jiraIntelligence', 'dashboardConfig',
];

const V1_PRESETS = {
  all: ALL_V1_PANELS,
  developer: [
    'buildOverview', 'engineeringTests', 'buildStability', 'brokenLinkTrend',
    'lighthouseCI', 'playwrightE2E', 'dependencyFreshness', 'pdfCoverage',
    'platformStability', 'operationalHealth',
    'searchInsights', 'schemaIntelligence', 'dashboardConfig',
  ],
  content_team: [
    'buildOverview', 'contentQuality', 'seoHealth', 'dateFreshness',
    'contentPerformance', 'i18nCoverage', 'ditaMigration',
    'schemaAnalytics', 'searchInsights', 'accessibility', 'docFeedback',
  ],
  product_owner: [
    'buildOverview', 'epicReleaseGate', 'releaseIntelligence', 'analytics',
    'userBehavior', 'docFeedback', 'seoHealth', 'dateFreshness',
    'contentPerformance', 'i18nCoverage', 'ditaMigration',
    'platformStability',
  ],
  qa_engineer: [
    'buildOverview', 'engineeringTests', 'lighthouseCI', 'playwrightE2E',
    'buildStability', 'brokenLinkTrend', 'dependencyFreshness', 'pdfCoverage',
    'platformStability', 'operationalHealth',
    'accessibility', 'contentQuality',
  ],
  leadership: [
    'buildOverview', 'epicReleaseGate', 'releaseIntelligence',
    'analytics', 'userBehavior', 'docFeedback', 'seoHealth',
    'operationalHealth', 'platformStability', 'ditaMigration', 'i18nCoverage',
  ],
};

const V2_TILE_META = {
  jiraIntelligence: {
    title: 'JIRA Intelligence',
    icon: '📋',
    description: 'JIRA ticket coverage, traceability, and workflow status analytics.',
  },
  releaseIntelligence: {
    title: 'Release Intelligence',
    icon: '🚀',
    description: 'Version, PR, and Jira traceability signals per release.',
  },
  contentIntelligence: {
    title: 'Content Intelligence',
    icon: '🧠',
    description: 'Metadata quality, completeness, and taxonomy coverage risks.',
  },
  userBehavior: {
    title: 'User Behavior',
    icon: '👥',
    description: 'Topic demand and engagement score details.',
  },
  searchInsights: {
    title: 'Search Insights',
    icon: '🔎',
    description: 'Local search and Ask AI query patterns plus content-gap scoring.',
  },
  platformStability: {
    title: 'Platform Stability',
    icon: '🧱',
    description: 'Monaco and PDF pipeline reliability indicators.',
  },
  operationalHealth: {
    title: 'Operational Health',
    icon: '⚙️',
    description: 'Snapshot freshness, ingestion reliability, and drift checks.',
  },
};

// ---------------------------------------------------------------------------
// Helpers for config-driven tile descriptions and metric metadata
// ---------------------------------------------------------------------------
function getTileConfig(report, tileKey) {
  return report?.dashboardConfig?.dashboardTiles?.[tileKey] || null;
}

function getTileDescription(report, tileKey, fallback = '') {
  return getTileConfig(report, tileKey)?.description || fallback;
}

function getMetricMeta(report, tileKey, metricKey, fallbackLabel) {
  const metric = getTileConfig(report, tileKey)?.metrics?.[metricKey] || {};
  return {
    label: metric.label || fallbackLabel,
    tooltip: metric.tooltip || '',
  };
}

// ---------------------------------------------------------------------------
// V2 helpers
// ---------------------------------------------------------------------------
function formatMetricLabel(key = '') {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/Pct/g, ' %')
    .replace(/Id/g, ' ID')
    .replace(/^./, (c) => c.toUpperCase());
}

function formatMetricValue(value) {
  if (typeof value === 'number') {
    const isInt = Number.isInteger(value);
    return isInt ? value.toLocaleString() : value.toFixed(2);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return `${value.length} items`;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '—');
}

function V2StatusChip({ status, score }) {
  const cls = status === 'green'
    ? styles.v2StatusGreen
    : status === 'amber'
      ? styles.v2StatusAmber
      : styles.v2StatusRed;
  return <span className={`${styles.v2StatusChip} ${cls}`}>{String(status || 'unknown').toUpperCase()} · {Math.round(score || 0)}%</span>;
}

function V2MetricTile({ tileKey, tileData, tooltips }) {
  const meta = V2_TILE_META[tileKey] || { title: tileKey, icon: '📦', description: '' };
  const metrics = tileData?.metrics || {};
  const entries = Object.entries(metrics);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>{meta.icon}</span>
        <h3 className={styles.panelTitle}>{meta.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{meta.description}</p>
      <div className={styles.v2MetricList}>
        {entries.length === 0 && <span className={styles.empty}>No metrics available</span>}
        {entries.map(([key, value]) => {
          const tooltip = tooltips?.[key];
          const tooltipText = tooltip
            ? `${tooltip.definition || ''}${tooltip.formula ? ` | Formula: ${tooltip.formula}` : ''}`
            : '';
          return (
            <div key={key} className={styles.v2MetricRow} title={tooltipText}>
              <span className={styles.v2MetricLabel}>{formatMetricLabel(key)}</span>
              <span className={styles.v2MetricValue}>{formatMetricValue(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DonutChart — pure CSS conic-gradient with center label
// ---------------------------------------------------------------------------
function DonutChart({ counts, centerLabel }) {
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

  let cursor = 0;
  const stops = segments.map(({ pct, color }) => {
    const start = cursor;
    cursor += pct;
    return `${color} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
  });
  const gradient = `conic-gradient(${stops.join(', ')})`;

  return (
    <div className={styles.donutWrap}>
      <div className={styles.donutContainer}>
        <div className={styles.donut} style={{ background: gradient }} title={`Total: ${total}`}>
          <div className={styles.donutHole}>
            <span className={styles.donutCenter}>{centerLabel ?? total}</span>
          </div>
        </div>
      </div>
      <div className={styles.donutLegend}>
        {segments.map(({ label, count, color, pct }) => (
          <div key={label} className={styles.donutLegendItem}>
            <span className={styles.donutLegendSwatch} style={{ background: color }} />
            <span className={styles.donutLegendLabel}>{label}</span>
            <span className={styles.donutLegendPct}>{pct.toFixed(0)}%</span>
            <span className={styles.donutLegendCount}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BarChart — CSS flex vertical bars
// ---------------------------------------------------------------------------
function BarChart({ counts, maxBars = 10, color }) {
  const entries = Object.entries(counts || {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxBars);
  const max = entries[0]?.[1] || 1;
  if (!entries.length) return <span className={styles.empty}>No data</span>;

  return (
    <div className={styles.barChart}>
      {[75, 50, 25].map((pct) => (
        <div
          key={pct}
          className={styles.barChartGridline}
          style={{ bottom: `calc(${pct}% + 1.4rem)` }}
        />
      ))}
      {entries.map(([label, count], i) => {
        const heightPct = Math.max(4, (count / max) * 100);
        const barColor = color || PALETTE[i % PALETTE.length];
        return (
          <div key={label} className={styles.barWrap} title={`${label}: ${count}`}>
            <span className={styles.barCount}>{count}</span>
            <div
              className={styles.bar}
              style={{ height: `${heightPct}%`, background: barColor }}
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
// HorizontalBar — single labelled fill bar for comparisons
// ---------------------------------------------------------------------------
function HorizontalBar({ label, value, max, color, subtitle }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={styles.hBarItem}>
      <div className={styles.hBarMeta}>
        <span className={styles.hBarLabel}>{label}</span>
        <span className={styles.hBarValue}>{value} <span className={styles.hBarPct}>({pct}%)</span></span>
      </div>
      <div className={styles.hBarTrack}>
        <div className={styles.hBarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      {subtitle && <span className={styles.hBarSubtitle}>{subtitle}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressList — vertical list of metric progress bars
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
              <span className={pct < 50 ? styles.warnText : styles.okText}>{pct}%</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={fillClass} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
function StatusBadge({ ok, warn, label, tooltip }) {
  const cls = ok ? styles.statusOk : warn ? styles.statusWarn : styles.statusError;
  const icon = ok ? '✓' : warn ? '⚠' : '✗';
  return (
    <span className={`${styles.statusBadge} ${cls}`} title={tooltip}>
      {icon} {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatCard — big number highlight with icon, label, and tooltip
// ---------------------------------------------------------------------------
function StatCard({ icon, value, label, accent, tooltip, valueColor }) {
  return (
    <div className={`${styles.statCard} ${accent ? styles.statCardAccent : ''}`}
      title={tooltip}>
      {icon && <span className={styles.statCardIcon}>{icon}</span>}
      <div className={styles.statCardValue} style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      <div className={styles.statCardLabel}>{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HealthGauge — semicircle gauge showing overall build health %
// ---------------------------------------------------------------------------
function HealthGauge({ score }) {
  // Score 0–100
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const color =
    pct >= 75 ? '#2ecc71' :
    pct >= 50 ? '#f39c12' :
    '#e74c3c';
  const filledDeg = (pct / 100) * 180;
  const gradient = `conic-gradient(from 180deg, ${color} 0deg ${filledDeg}deg, var(--ifm-color-emphasis-200) ${filledDeg}deg 180deg)`;
  const label =
    pct >= 75 ? 'Healthy' :
    pct >= 50 ? 'Fair' :
    'Needs Work';

  return (
    <div className={styles.gaugeWrap} title={`${label} — ${pct}% health score`}>
      <div className={styles.gauge} style={{ background: gradient }}>
        <div className={styles.gaugeHole}>
          <span className={styles.gaugeValue} style={{ color }}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldCoverageGrid — colour-coded grid of field coverage
// ---------------------------------------------------------------------------
function FieldCoverageGrid({ fieldCoveragePercent }) {
  const entries = Object.entries(fieldCoveragePercent || {});
  if (!entries.length) return null;
  return (
    <div className={styles.coverageGrid}>
      {entries.map(([field, pct]) => {
        const pctRound = Math.round(pct * 100);
        const intensity =
          pctRound >= 80 ? 'high' :
          pctRound >= 40 ? 'mid' :
          'low';
        return (
          <div
            key={field}
            className={`${styles.coverageCell} ${styles[`coverageCell_${intensity}`]}`}
            title={`${field}: ${pctRound}%`}
          >
            <span className={styles.coverageCellField}>{field.replace(/_/g, ' ')}</span>
            <span className={styles.coverageCellPct}>{pctRound}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 1: Build Overview (hero)
// ---------------------------------------------------------------------------
function BuildOverviewPanel({ report }) {
  const { aggregate } = report;
  const completePct = Math.round(aggregate.avgCompleteness * 100);
  const tooltips = dashboardTooltips.buildOverview.metrics;

  // Health score: weighted average of key signals
  const seo = aggregate.seoHealth || {};
  const total = aggregate.totalDocs || 1;
  const seoScore = Math.round(
    ((seo.hasTitle || 0) / total * 25) +
    ((seo.hasDescription || 0) / total * 25) +
    ((seo.hasKeywords || 0) / total * 25) +
    (completePct / 4)
  );

  // V1-sourced stability metrics (consistent, real data — never sample files)
  // Global Stability: percentage of docs with NO stability issues
  // Issues counted: broken links (per doc), missing required fields, duplicate titles, broken images
  const bs = aggregate.buildStability || {};
  const eng = aggregate.engineeringTests || {};
  const docsWithIssues = (bs.docsWithMissingRequired || 0) +
    (eng.docsWithBrokenLinks || 0) +
    (bs.duplicateTitlesCount || 0) +
    (bs.brokenImageRefs || 0);
  // Cap at total so score never goes negative
  const stabilityScore = Math.round(Math.max(0, (1 - docsWithIssues / (total * 2)) * 100));
  const stabilityColor = stabilityScore >= 90 ? '#2ecc71' : stabilityScore >= 70 ? '#f39c12' : '#e74c3c';

  // Critical Alerts: count of distinct critical issue categories that are non-zero
  const criticalAlerts =
    (eng.brokenInternalLinks > 0 ? 1 : 0) +
    (eng.ssrGuardViolations > 0 ? 1 : 0) +
    (!eng.cspConfigured ? 1 : 0);
  // Warning Alerts: count of distinct warning-level issue categories that are non-zero
  const warningAlerts =
    (bs.duplicateTitlesCount > 0 ? 1 : 0) +
    (bs.docsWithMissingRequired > 0 ? 1 : 0) +
    ((eng.sidebarOrphanedDocs || 0) > 0 ? 1 : 0) +
    (bs.brokenImageRefs > 0 ? 1 : 0);

  // Snapshot date (from report generation)
  const snapshotDate = new Date(report.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className={`${styles.panel} ${styles.panelHero}`}>
      <div className={styles.heroGradient} aria-hidden="true" />
      <div className={styles.heroContent}>
        {/* Top bar: Build Overview title left, snapshot date right */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            {/* Content Health Status with gauge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <HealthGauge score={seoScore} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--dd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Content Health Status</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--dd-muted)', lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ifm-heading-color)' }}>📅 {snapshotDate}</div>
            <div>Generated {new Date(report.generatedAt).toLocaleTimeString()}</div>
            <div>Node {report.nodeVersion || process?.version || '≥20'}</div>
          </div>
        </div>

        {/* All metrics in a single row */}
        <div className={styles.heroStats} style={{ marginTop: '0.75rem' }}>
          <StatCard icon="📄" value={aggregate.totalDocs} label={tooltips.totalDocs.label} tooltip={tooltips.totalDocs.tooltip} accent />
          <StatCard icon="💬" value={aggregate.totalWords.toLocaleString()} label={tooltips.totalWords.label} tooltip={tooltips.totalWords.tooltip} />
          <StatCard icon="📝" value={aggregate.avgWords} label={tooltips.avgWords.label} tooltip={tooltips.avgWords.tooltip} />
          <StatCard icon="✅" value={`${completePct}%`} label={tooltips.completeness.label} tooltip={tooltips.completeness.tooltip} />
          <StatCard icon="🛡️" value={`${stabilityScore}%`} label={tooltips.globalStability.label} tooltip={tooltips.globalStability.tooltip} valueColor={stabilityColor} />
          <StatCard icon="🚨" value={criticalAlerts} label={tooltips.criticalAlerts.label} tooltip={tooltips.criticalAlerts.tooltip} valueColor={criticalAlerts > 0 ? '#e74c3c' : '#2ecc71'} />
          <StatCard icon="⚠️" value={warningAlerts} label={tooltips.warningAlerts.label} tooltip={tooltips.warningAlerts.tooltip} valueColor={warningAlerts > 0 ? '#f39c12' : '#2ecc71'} />
        </div>

        {/* Section chips at bottom */}
        <div className={styles.statusRow} style={{ marginTop: '0.75rem', gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
          {Object.entries(aggregate.sections || {}).map(([section, count]) => (
            <StatusBadge key={section} ok label={`${section}: ${count}`} tooltip={`Docs in ${section} section`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 2: Metadata Schema Analytics (NEW — device · role · use case · skill level)
// ---------------------------------------------------------------------------
function SchemaAnalyticsPanel({ report }) {
  const { aggregate } = report;
  const tax = aggregate.taxonomy || {};
  const tooltips = dashboardTooltips.schemaAnalytics.metrics;

  const deviceType   = tax.device_type || {};
  const roleData     = tax.role || {};
  const useCaseData  = tax.use_case || {};
  const skillLevel   = tax.skill_level || {};
  const productName  = tax.product_name || {};

  // Total topics (across all use_case occurrences — each doc can have multiple)
  const totalUseCaseInstances = Object.values(useCaseData).reduce((s, v) => s + v, 0);
  const totalRoleInstances    = Object.values(roleData).reduce((s, v) => s + v, 0);

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🔬</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.schemaAnalytics.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.schemaAnalytics.description}</p>

      <div className={styles.schemaGrid}>
        {/* Device Type */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle} title={tooltips.deviceType.tooltip}>📡 {tooltips.deviceType.label}</h4>
          <DonutChart counts={deviceType} centerLabel="devices" />
        </div>

        {/* Role / User */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle} title={tooltips.roleUser.tooltip}>👤 {tooltips.roleUser.label}</h4>
          <div className={styles.hBarList}>
            {Object.entries(roleData)
              .sort(([, a], [, b]) => b - a)
              .map(([role, count], i) => (
                <HorizontalBar
                  key={role}
                  label={role}
                  value={count}
                  max={totalRoleInstances}
                  color={PALETTE[i % PALETTE.length]}
                />
              ))}
          </div>
        </div>

        {/* Use Case (most popular) */}
        <div className={`${styles.schemaSection} ${styles.schemaSectionWide}`}>
          <h4 className={styles.schemaSectionTitle} title={tooltips.useCase.tooltip}>🎯 {tooltips.useCase.label}</h4>
          <div className={styles.hBarList}>
            {Object.entries(useCaseData)
              .sort(([, a], [, b]) => b - a)
              .map(([uc, count], i) => (
                <HorizontalBar
                  key={uc}
                  label={uc}
                  value={count}
                  max={totalUseCaseInstances}
                  color={PALETTE[i % PALETTE.length]}
                />
              ))}
          </div>
        </div>

        {/* Skill Level */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle} title={tooltips.skillLevel.tooltip}>🎓 {tooltips.skillLevel.label}</h4>
          <DonutChart counts={skillLevel} />
        </div>

        {/* Product Name */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle} title={tooltips.productName.tooltip}>🏷 {tooltips.productName.label}</h4>
          <BarChart counts={productName} maxBars={6} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 3: Schema Intelligence (field coverage heatmap)
// ---------------------------------------------------------------------------
function SchemaIntelligencePanel({ report }) {
  const { aggregate } = report;
  const guessing = aggregate.guessing || {};
  const tooltips = dashboardTooltips.schemaIntelligence.metrics;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🧬</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.schemaIntelligence.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.schemaIntelligence.description}</p>
      <div className={styles.statRow}>
        <div className={styles.stat} title={tooltips.guessedFields.tooltip}>
          <div className={styles.statValue}>{guessing.totalGuessedFields || 0}</div>
          <div className={styles.statLabel}>{tooltips.guessedFields.label}</div>
        </div>
        <div className={styles.stat} title={tooltips.docsWithGuesses.tooltip}>
          <div className={styles.statValue}>{guessing.docsWithGuesses || 0}</div>
          <div className={styles.statLabel}>{tooltips.docsWithGuesses.label}</div>
        </div>
        <div className={styles.stat} title={tooltips.fullyAuthored.tooltip}>
          <div className={styles.statValue}>
            {aggregate.totalDocs - (guessing.docsWithGuesses || 0)}
          </div>
          <div className={styles.statLabel}>{tooltips.fullyAuthored.label}</div>
        </div>
      </div>
      <FieldCoverageGrid fieldCoveragePercent={aggregate.fieldCoveragePercent} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 4: Date & Freshness Analytics
// ---------------------------------------------------------------------------
function DateFreshnessPanel({ report }) {
  const { aggregate, docs } = report;
  const da = aggregate.dateAnalytics || {};
  const total = aggregate.totalDocs || 1;
  const tooltips = dashboardTooltips.dateFreshness.metrics;

  const buckets = [
    { label: tooltips.fresh.label, key: 'fresh',  subtitle: tooltips.fresh.subtext, color: '#2ecc71', tooltip: tooltips.fresh.tooltip },
    { label: tooltips.recent.label, key: 'recent', subtitle: tooltips.recent.subtext, color: '#3498db', tooltip: tooltips.recent.tooltip },
    { label: tooltips.aging.label, key: 'aging',  subtitle: tooltips.aging.subtext, color: '#f39c12', tooltip: tooltips.aging.tooltip },
    { label: tooltips.stale.label, key: 'stale',  subtitle: tooltips.stale.subtext, color: '#e74c3c', tooltip: tooltips.stale.tooltip },
  ];

  // Monthly velocity chart
  const sortedMonths = Object.entries(da.modifiedByMonth || {}).sort(([a], [b]) => a.localeCompare(b));
  const monthCounts = Object.fromEntries(sortedMonths.map(([k, v]) => [k.slice(5), v])); // show MM

  // Top 5 most recently modified docs
  const recentDocs = [...docs]
    .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
    .slice(0, 5);

  const reviewCoverage = Math.round((da.lastReviewedCount || 0) / total * 100);

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>📅</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.dateFreshness.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.dateFreshness.description} <code>last_reviewed</code> frontmatter coverage: <strong>{reviewCoverage}%</strong></p>

      {/* Freshness buckets */}
      <div className={styles.freshnessRow}>
        {buckets.map(({ label, key, subtitle, color, tooltip }) => {
          const count = da[key] || 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className={styles.freshnessBucket} style={{ borderTopColor: color }} title={tooltip}>
              <div className={styles.freshnessBucketValue} style={{ color }}>{count}</div>
              <div className={styles.freshnessBucketLabel}>{label}</div>
              <div className={styles.freshnessBucketSub}>{subtitle} · {pct}%</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        {/* Monthly velocity */}
        {Object.keys(monthCounts).length > 0 && (
          <div style={{ flex: '1 1 200px' }}>
            <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }} title={tooltips.velocityChart.tooltip}>
              {tooltips.velocityChart.label}
            </p>
            <BarChart counts={monthCounts} color="#003fbd" />
          </div>
        )}
        {/* Recently modified */}
        <div style={{ flex: '2 1 260px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }} title={tooltips.recentlyModified.tooltip}>
            {tooltips.recentlyModified.label}
          </p>
          <table className={styles.docTable}>
            <thead>
              <tr><th>Title</th><th>Modified</th><th>Section</th></tr>
            </thead>
            <tbody>
              {recentDocs.map((d) => (
                <tr key={d.filePath}>
                  <td title={d.title}>{d.title}</td>
                  <td>{new Date(d.lastModified).toLocaleDateString()}</td>
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
// PANEL 5: SEO Health
// ---------------------------------------------------------------------------
function SeoHealthPanel({ report }) {
  const { aggregate } = report;
  const seo = aggregate.seoHealth || {};
  const total = aggregate.totalDocs || 1;
  const tooltips = dashboardTooltips.seoHealth.metrics;

  const items = [
    { label: tooltips.hasTitle.label, value: (seo.hasTitle || 0) / total, warn: false, tooltip: tooltips.hasTitle.tooltip },
    { label: tooltips.hasDescription.label, value: (seo.hasDescription || 0) / total, warn: true, tooltip: tooltips.hasDescription.tooltip },
    { label: tooltips.hasKeywords.label, value: (seo.hasKeywords || 0) / total, warn: true, tooltip: tooltips.hasKeywords.tooltip },
    { label: tooltips.hasSlug.label, value: (seo.hasSlug || 0) / total, warn: false, tooltip: tooltips.hasSlug.tooltip },
  ];

  const seoScore = Math.round(
    items.reduce((s, i) => s + i.value, 0) / items.length * 100
  );

  const scoreColor =
    seoScore >= 75 ? '#2ecc71' :
    seoScore >= 50 ? '#f39c12' :
    '#e74c3c';

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🔍</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.seoHealth.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.seoHealth.description}</p>
      <div className={styles.statRow}>
        <div className={styles.stat} title={tooltips.seoScore.tooltip}>
          <div className={styles.statValue} style={{ color: scoreColor }}>{seoScore}%</div>
          <div className={styles.statLabel}>{tooltips.seoScore.label}</div>
        </div>
        <div className={styles.stat} title={tooltips.hasDescription.tooltip}>
          <div className={styles.statValue}>{seo.hasDescription || 0}/{total}</div>
          <div className={styles.statLabel}>{tooltips.hasDescription.label}</div>
        </div>
      </div>
      <ProgressList items={items} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 6: Analytics (GA + publish status)
// ---------------------------------------------------------------------------
function AnalyticsPanel({ report }) {
  const { aggregate } = report;
  const statusCounts = aggregate.taxonomy?.status || {};
  const publishedCount = statusCounts['Published'] || 0;
  const draftCount = statusCounts['Draft'] || 0;
  const total = aggregate.totalDocs || 1;
  const publishRate = Math.round((publishedCount / total) * 100);
  const tooltips = dashboardTooltips.analytics.metrics;

  // Attempt to detect GA presence in the window (browser-only)
  const [gaStatus, setGaStatus] = useState('checking…');
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const tag = document.querySelector('script[src*="googletagmanager"]');
        const dataLayerLen = window.dataLayer?.length ?? 0;
        if (tag && window.gtag && typeof window.gtag === 'function') {
          setGaStatus(`Active · ${dataLayerLen} dataLayer events`);
        } else if (tag) {
          setGaStatus('Tag present but blocked (adblocker?)');
        } else {
          setGaStatus('Not configured');
        }
      }
    } catch {
      setGaStatus('Unknown');
    }
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>📊</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.analytics.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.analytics.description}</p>
      <div className={styles.statusRow}>
        <StatusBadge
          ok={gaStatus.startsWith('Active')}
          warn={!gaStatus.startsWith('Active') && !gaStatus.startsWith('Not')}
          label={`GA: ${gaStatus}`}
        />
      </div>
      <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
        <div className={styles.stat} title={tooltips.published.tooltip}>
          <div className={styles.statValue}>{publishedCount}</div>
          <div className={styles.statLabel}>{tooltips.published.label}</div>
        </div>
        <div className={styles.stat} title={tooltips.draft.tooltip}>
          <div className={styles.statValue}>{draftCount}</div>
          <div className={styles.statLabel}>{tooltips.draft.label}</div>
        </div>
        <div className={styles.stat} title={tooltips.publishRate.tooltip}>
          <div
            className={styles.statValue}
            style={{ color: publishRate >= 50 ? '#2ecc71' : '#e67e22' }}
          >
            {publishRate}%
          </div>
          <div className={styles.statLabel}>{tooltips.publishRate.label}</div>
        </div>
      </div>
      <DonutChart counts={statusCounts} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 7: Content Performance (word count distribution)
// ---------------------------------------------------------------------------
function ContentPerformancePanel({ report }) {
  const { aggregate, docs } = report;
  const tooltips = dashboardTooltips.contentPerformance.metrics;

  const buckets = { '0–100': 0, '101–300': 0, '301–600': 0, '601–1000': 0, '1000+': 0 };
  for (const doc of docs) {
    const w = doc.wordCount;
    if (w <= 100)       buckets['0–100']++;
    else if (w <= 300)  buckets['101–300']++;
    else if (w <= 600)  buckets['301–600']++;
    else if (w <= 1000) buckets['601–1000']++;
    else                buckets['1000+']++;
  }

  const topDocs = [...docs].sort((a, b) => b.wordCount - a.wordCount).slice(0, 5);
  const thinDocs = docs.filter((d) => d.wordCount < 100).length;

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>⚡</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.contentPerformance.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.contentPerformance.description}</p>
      <div className={styles.statRow}>
        <StatCard label={tooltips.avgWords.label} value={aggregate.avgWords} tooltip={tooltips.avgWords.tooltip} />
        <StatCard label={tooltips.totalWords.label} value={aggregate.totalWords.toLocaleString()} tooltip={tooltips.totalWords.tooltip} />
        <StatCard label={tooltips.thinDocs.label} value={thinDocs} tooltip={tooltips.thinDocs.tooltip} accent={thinDocs > 0} />
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>{tooltips.distribution.label}</p>
          <BarChart counts={buckets} color="#003fbd" />
        </div>
        <div style={{ flex: '2 1 240px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>{tooltips.topDocs.label}</p>
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
// PANEL 8: Ask AI Engine
// ---------------------------------------------------------------------------
// Merged AskAI + Search Metrics Panel
function SearchInsightsPanel({ report }) {
  const [index, setIndex] = useState(null);
  const [indexErr, setIndexErr] = useState(false);
  const [failedSearches, setFailedSearches] = useState([]);
  const indexUrl = useBaseUrl('/askai-index.json');
  const tooltips = dashboardTooltips.askai.metrics;

  useEffect(() => {
    fetch(indexUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data ? setIndex(data) : setIndexErr(true)))
      .catch(() => setIndexErr(true));

    // Load failed searches from localStorage (browser only)
    if (typeof window !== 'undefined') {
      try {
        const failed = JSON.parse(window.localStorage.getItem('askai.failed-searches') || '[]');
        setFailedSearches(failed);
      } catch {
        setFailedSearches([]);
      }
    }
  }, [indexUrl]);

  // Section breakdown for indexed records
  const sectionCounts = {};
  if (index?.records) {
    for (const rec of index.records) {
      const url = (rec.url || '').replace(/^\/docs\//, '');
      const parts = url.split('/');
      const section = parts.length > 1 ? parts[0] : 'root';
      sectionCounts[section] = (sectionCounts[section] || 0) + 1;
    }
  }

  const indexSizeKb = index
    ? Math.round(JSON.stringify(index).length / 1024)
    : null;

  const indexCoverage = index && report.aggregate.totalDocs > 0
    ? Math.round((new Set(index.records.map((r) => r.url)).size / report.aggregate.totalDocs) * 100)
    : null;

  // Analyze failed searches (missed queries)
  const failedByQuery = {};
  failedSearches.forEach((f) => {
    const q = (f.query || '').trim().toLowerCase();
    if (!q) return;
    failedByQuery[q] = (failedByQuery[q] || 0) + 1;
  });
  const missedSearches = Object.entries(failedByQuery)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Analyze most popular successful searches (from index records)
  const popularByQuery = {};
  if (index?.records) {
    for (const rec of index.records) {
      const q = (rec.query || '').trim().toLowerCase();
      if (!q) continue;
      popularByQuery[q] = (popularByQuery[q] || 0) + 1;
    }
  }
  const popularSearches = Object.entries(popularByQuery)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🔎</span>
        <h3 className={styles.panelTitle}>Search & AskAI Insights</h3>
      </div>
      <p className={styles.panelSubtitle}>Combined analytics for AskAI and documentation search. Shows missed queries and most popular searches.</p>
      <div className={styles.statusRow}>
        {indexErr
          ? <StatusBadge label="Index not found" />
          : index
            ? <StatusBadge ok label="Index loaded" />
            : <StatusBadge warn label="Loading index…" />}
      </div>
      <div className={styles.statRow}>
        <StatCard label={tooltips.records.label} value={index ? index.records.length : '–'} tooltip={tooltips.records.tooltip} />
        <StatCard label={tooltips.sourceDocs.label} value={report.aggregate.totalDocs} tooltip={tooltips.sourceDocs.tooltip} />
        <StatCard label={tooltips.indexSize.label} value={indexSizeKb != null ? `~${indexSizeKb} KB` : '–'} tooltip={tooltips.indexSize.tooltip} />
        <StatCard label={tooltips.docCoverage.label} value={indexCoverage != null ? `${indexCoverage}%` : '–'} tooltip={tooltips.docCoverage.tooltip} accent={indexCoverage != null && indexCoverage < 80} />
      </div>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <div style={{ flex: '1 1 200px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Missed Searches (Top 5)</p>
          {missedSearches.length > 0 ? (
            <ul>
              {missedSearches.map(([q, count]) => (
                <li key={q}><strong>{q}</strong> <span style={{ color: '#e74c3c' }}>({count})</span></li>
              ))}
            </ul>
          ) : <span className={styles.empty}>No missed searches</span>}
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Popular Searches (Top 5)</p>
          {popularSearches.length > 0 ? (
            <ul>
              {popularSearches.map(([q, count]) => (
                <li key={q}><strong>{q}</strong> <span style={{ color: '#2ecc71' }}>({count})</span></li>
              ))}
            </ul>
          ) : <span className={styles.empty}>No popular searches</span>}
        </div>
      </div>
      {index
        ? <BarChart counts={sectionCounts} />
        : <span className={styles.empty}>{indexErr ? 'Run npm run prestart to generate index.' : 'Loading…'}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 9: Content Quality (placeholders + missing metadata)
// ---------------------------------------------------------------------------
function ContentQualityPanel({ report }) {
  const { aggregate, docs } = report;
  const placeholders = aggregate.placeholders || {};
  const tileDescription = getTileDescription(report, 'contentQuality', 'Placeholder detection, missing metadata, and overall completeness scoring.');
  const placeholdersMeta = getMetricMeta(report, 'contentQuality', 'placeholders', 'Docs with Placeholders');
  const missingTitleMeta = getMetricMeta(report, 'contentQuality', 'missingTitle', 'Missing Title');
  const missingDescriptionMeta = getMetricMeta(report, 'contentQuality', 'missingDescription', 'Missing Description');
  const missingKeywordsMeta = getMetricMeta(report, 'contentQuality', 'missingKeywords', 'Missing Keywords');
  const placeholdersByFieldMeta = getMetricMeta(report, 'contentQuality', 'placeholdersByField', 'Placeholders by Field');
  const needsAttentionMeta = getMetricMeta(report, 'contentQuality', 'needsAttention', 'Needs Attention');
  const docsWithIssues = placeholders.docsWithPlaceholders || 0;
  const byField = placeholders.byField || {};

  const missingTitle = docs.filter((d) => !d.frontmatter.title).length;
  const missingDesc = docs.filter((d) => !d.frontmatter.description).length;
  const missingKeywords = docs.filter((d) => {
    const kw = d.frontmatter.keywords;
    return !kw || (Array.isArray(kw) && kw.length === 0);
  }).length;

  // Top 10 least complete docs
  const leastComplete = [...docs]
    .sort((a, b) => a.completenessScore - b.completenessScore)
    .slice(0, 8);

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>📋</span>
        <h3 className={styles.panelTitle}>Content Quality</h3>
      </div>
      <p className={styles.panelSubtitle}>{tileDescription}</p>
      <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
        <StatusBadge
          ok={docsWithIssues === 0}
          warn={docsWithIssues > 0 && docsWithIssues < 10}
          label={`${placeholdersMeta.label}: ${docsWithIssues}`}
          tooltip={placeholdersMeta.tooltip}
        />
        <StatusBadge
          ok={missingTitle === 0}
          warn={missingTitle > 0}
          label={`${missingTitleMeta.label}: ${missingTitle}`}
          tooltip={missingTitleMeta.tooltip}
        />
        <StatusBadge
          ok={missingDesc === 0}
          warn={missingDesc > 0}
          label={`${missingDescriptionMeta.label}: ${missingDesc}`}
          tooltip={missingDescriptionMeta.tooltip}
        />
        <StatusBadge
          ok={missingKeywords === 0}
          warn={missingKeywords > 0}
          label={`${missingKeywordsMeta.label}: ${missingKeywords}`}
          tooltip={missingKeywordsMeta.tooltip}
        />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Placeholder by field */}
        <div style={{ flex: '1 1 200px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }} title={placeholdersByFieldMeta.tooltip}>{placeholdersByFieldMeta.label}</p>
          <div className={styles.scrollBox}>
            <table className={styles.docTable}>
              <thead>
                <tr><th>Field</th><th># Affected</th></tr>
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

        {/* Least complete docs */}
        <div style={{ flex: '2 1 260px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>
            <span title={needsAttentionMeta.tooltip}>Docs needing the most attention</span>
          </p>
          <div className={styles.scrollBox}>
            <table className={styles.docTable}>
              <thead>
                <tr><th>Title</th><th>Completeness</th><th>Guesses</th></tr>
              </thead>
              <tbody>
                {leastComplete.map((d) => {
                  const pct = Math.round(d.completenessScore * 100);
                  const color =
                    pct >= 75 ? '#2ecc71' :
                    pct >= 50 ? '#f39c12' :
                    '#e74c3c';
                  return (
                    <tr key={d.filePath}>
                      <td title={d.title}>{d.title}</td>
                      <td style={{ color, fontWeight: 600 }}>{pct}%</td>
                      <td>{d.guessedFields.length > 0
                        ? <span className={styles.guessedChip}>{d.guessedFields.length} guessed</span>
                        : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: Dashboard Config (what drives report generation)
// ---------------------------------------------------------------------------
function DashboardConfigPanel({ report }) {
  const cfg = report.dashboardConfig;
  const tileDescription = getTileDescription(report, 'dashboardConfig', 'Tracked fields and taxonomy settings loaded from dashboard config.');
  const trackedFieldsMeta = getMetricMeta(report, 'dashboardConfig', 'trackedFields', 'Tracked Fields');
  const requiredFieldsMeta = getMetricMeta(report, 'dashboardConfig', 'requiredFields', 'Required Fields');
  const taxonomyFieldsMeta = getMetricMeta(report, 'dashboardConfig', 'taxonomyFields', 'Taxonomy Fields');
  if (!cfg) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelIcon}>⚙️</span>
          <h3 className={styles.panelTitle}>Dashboard Config In Use</h3>
        </div>
        <p className={styles.panelSubtitle}>Config metadata is unavailable in this report version.</p>
      </div>
    );
  }

  const requiredCount = (cfg.trackedFields || []).filter((f) => f.required).length;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>⚙️</span>
        <h3 className={styles.panelTitle}>Dashboard Config In Use</h3>
      </div>
      <p className={styles.panelSubtitle}>{tileDescription} · Loaded from <code>{cfg.sourceFile}</code></p>
      <div className={styles.statRow}>
        <div className={styles.stat} title={trackedFieldsMeta.tooltip}>
          <div className={styles.statValue}>{(cfg.trackedFields || []).length}</div>
          <div className={styles.statLabel}>{trackedFieldsMeta.label}</div>
        </div>
        <div className={styles.stat} title={requiredFieldsMeta.tooltip}>
          <div className={styles.statValue}>{requiredCount}</div>
          <div className={styles.statLabel}>{requiredFieldsMeta.label}</div>
        </div>
        <div className={styles.stat} title={taxonomyFieldsMeta.tooltip}>
          <div className={styles.statValue}>{(cfg.taxonomyFields || []).length}</div>
          <div className={styles.statLabel}>{taxonomyFieldsMeta.label}</div>
        </div>
      </div>
      <div className={styles.scrollBox}>
        <table className={styles.docTable}>
          <thead>
            <tr><th>Key</th><th>Required</th><th>Type</th></tr>
          </thead>
          <tbody>
            {(cfg.trackedFields || []).map((f) => (
              <tr key={f.key}>
                <td>{f.key}</td>
                <td>{f.required ? 'Yes' : 'No'}</td>
                <td>{f.isArray ? 'Array' : 'Scalar'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: Build Stability
// ---------------------------------------------------------------------------
function BuildStabilityPanel({ report }) {
  const { aggregate } = report;
  const bs = aggregate.buildStability || {};
  const tileDescription = getTileDescription(report, 'buildStability', 'Data integrity and structural consistency checks.');
  const stabilityScoreMeta = getMetricMeta(report, 'buildStability', 'stabilityScore', 'Stability Score');
  const criticalIssuesMeta = getMetricMeta(report, 'buildStability', 'criticalIssues', 'Critical Issues');
  const warningsMeta = getMetricMeta(report, 'buildStability', 'warnings', 'Warnings');
  const duplicateSlugsMeta = getMetricMeta(report, 'buildStability', 'duplicateSlugs', 'Duplicate Slugs');
  const brokenImagesMeta = getMetricMeta(report, 'buildStability', 'brokenImages', 'Broken Images');
  const missingRequiredMeta = getMetricMeta(report, 'buildStability', 'missingRequired', 'Missing Required');
  const duplicateTitlesMeta = getMetricMeta(report, 'buildStability', 'duplicateTitles', 'Duplicate Titles');

  if (!aggregate.buildStability) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelIcon}>🏗</span>
          <h3 className={styles.panelTitle}>Build Stability</h3>
        </div>
        <p className={styles.panelSubtitle}>Re-run <code>npm run build-report</code> to populate stability data.</p>
      </div>
    );
  }

  const criticalIssues = (bs.duplicateSlugsCount || 0) + (bs.brokenImageRefs || 0);
  const warnIssues =
    (bs.docsWithMissingRequired || 0) +
    (bs.invalidDateFormats || 0) +
    (bs.duplicateTitlesCount || 0);
  const stabilityScore = Math.max(0, Math.round(100 - criticalIssues * 10 - warnIssues * 3));
  const scoreColor =
    stabilityScore >= 90 ? '#2ecc71' :
    stabilityScore >= 70 ? '#f39c12' :
    '#e74c3c';

  return (
    <div className={`${styles.panel}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🏗</span>
        <h3 className={styles.panelTitle}>Build Stability</h3>
      </div>
      <p className={styles.panelSubtitle}>{tileDescription}</p>
      <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
        <StatusBadge
          ok={criticalIssues === 0}
          warn={criticalIssues > 0}
          label={`${criticalIssuesMeta.label}: ${criticalIssues}`}
          tooltip={criticalIssuesMeta.tooltip}
        />
        <StatusBadge
          ok={warnIssues === 0}
          warn={warnIssues > 0}
          label={`${warningsMeta.label}: ${warnIssues}`}
          tooltip={warningsMeta.tooltip}
        />
      </div>
      <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
        <div className={styles.stat} title={stabilityScoreMeta.tooltip}>
          <div className={styles.statValue} style={{ color: scoreColor }}>{stabilityScore}%</div>
          <div className={styles.statLabel}>{stabilityScoreMeta.label}</div>
        </div>
        <div className={styles.stat} title={duplicateSlugsMeta.tooltip}>
          <div className={styles.statValue} style={{ color: (bs.duplicateSlugsCount || 0) > 0 ? '#e74c3c' : '#2ecc71' }}>
            {bs.duplicateSlugsCount || 0}
          </div>
          <div className={styles.statLabel}>{duplicateSlugsMeta.label}</div>
        </div>
        <div className={styles.stat} title={brokenImagesMeta.tooltip}>
          <div className={styles.statValue} style={{ color: (bs.brokenImageRefs || 0) > 0 ? '#e74c3c' : '#2ecc71' }}>
            {bs.brokenImageRefs || 0}
          </div>
          <div className={styles.statLabel}>{brokenImagesMeta.label}</div>
        </div>
        <div className={styles.stat} title={missingRequiredMeta.tooltip}>
          <div className={styles.statValue} style={{ color: (bs.docsWithMissingRequired || 0) > 0 ? '#f39c12' : '#2ecc71' }}>
            {bs.docsWithMissingRequired || 0}
          </div>
          <div className={styles.statLabel}>{missingRequiredMeta.label}</div>
        </div>
        <div className={styles.stat} title={duplicateTitlesMeta.tooltip}>
          <div className={styles.statValue} style={{ color: (bs.duplicateTitlesCount || 0) > 0 ? '#f39c12' : '#2ecc71' }}>
            {bs.duplicateTitlesCount || 0}
          </div>
          <div className={styles.statLabel}>{duplicateTitlesMeta.label}</div>
        </div>
      </div>
      {(bs.duplicateSlugs || []).length > 0 && (
        <div>
          <p className={styles.panelSubtitle} style={{ margin: '0.75rem 0 0.25rem' }}>
            Duplicate slugs (routing conflict):
          </p>
          <div className={styles.scrollBox}>
            <table className={styles.docTable}>
              <thead><tr><th>URL</th></tr></thead>
              <tbody>
                {bs.duplicateSlugs.map((slug) => (
                  <tr key={slug}><td style={{ color: '#e74c3c' }}>{slug}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {(bs.duplicateTitles || []).length > 0 && (
        <div>
          <p className={styles.panelSubtitle} style={{ margin: '0.75rem 0 0.25rem' }}>
            Duplicate titles:
          </p>
          <div className={styles.scrollBox}>
            <table className={styles.docTable}>
              <thead><tr><th>Title</th></tr></thead>
              <tbody>
                {bs.duplicateTitles.map((title) => (
                  <tr key={title}><td style={{ color: '#f39c12' }}>{title}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {criticalIssues === 0 && warnIssues === 0 && (
        <p className={styles.empty}>✓ No build stability issues detected</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: Epic Release Gate (Jira integration placeholder)
// ---------------------------------------------------------------------------
function EpicReleaseGatePanel({ report }) {
  const [epicData, setEpicData] = useState(null);
  const [epicErr, setEpicErr] = useState(false);
  const epicUrl = useBaseUrl('/data/epic-release-metrics.json');
  const tooltips = dashboardTooltips.epicReleaseGate.metrics;

  useEffect(() => {
    fetch(epicUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data ? setEpicData(data) : setEpicErr(true)))
      .catch(() => setEpicErr(true));
  }, [epicUrl]);

  const gate = epicData?.releaseGate || {};
  const metrics = epicData?.metrics || {};
  const epicTickets = metrics.epicTickets || {};
  const support = metrics.supportTickets || {};
  const mdx = metrics.mdxChurn || {};

  const gateColor =
    gate.status === 'pass' ? '#2ecc71' :
    gate.status === 'warn' ? '#f39c12' :
    gate.status === 'fail' ? '#e74c3c' : '#888';

  return (
    <div className={`${styles.panel}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🚀</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.epicReleaseGate.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.epicReleaseGate.description}</p>
      {epicErr || epicData?.skipped ? (
        <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
          <StatusBadge warn label={epicData?.skipped ? `Skipped: ${epicData.reason || 'No epic configured'}` : 'Epic metrics not available — run npm run epic-metrics'} />
        </div>
      ) : !epicData ? (
        <StatusBadge warn label="Loading epic metrics…" />
      ) : (
        <>
          <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
            <StatusBadge
              ok={gate.status === 'pass'}
              warn={gate.status === 'warn'}
              label={`Gate: ${(gate.status || 'unknown').toUpperCase()}`}
              tooltip={tooltips.gateStatus.tooltip}
            />
          </div>
          <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
            <div className={styles.stat} title={tooltips.epicOpenNow.tooltip}>
              <div className={styles.statValue} style={{ color: (epicTickets.openNow || 0) > 0 ? '#e74c3c' : '#2ecc71' }}>
                {epicTickets.openNow ?? '–'}
              </div>
              <div className={styles.statLabel}>{tooltips.epicOpenNow.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.supportOpenNow.tooltip}>
              <div className={styles.statValue} style={{ color: (support.openNow || 0) > 0 ? '#f39c12' : '#2ecc71' }}>
                {support.openNow ?? '–'}
              </div>
              <div className={styles.statLabel}>{tooltips.supportOpenNow.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.supportResolutionDays.tooltip}>
              <div className={styles.statValue}>{support.avgResolutionDays != null ? `${support.avgResolutionDays}d` : '–'}</div>
              <div className={styles.statLabel}>{tooltips.supportResolutionDays.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.cycleAvgDays.tooltip}>
              <div className={styles.statValue}>{epicTickets.cycleAvgDays != null ? `${epicTickets.cycleAvgDays}d` : '–'}</div>
              <div className={styles.statLabel}>{tooltips.cycleAvgDays.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.mdxUniqueFiles.tooltip}>
              <div className={styles.statValue}>{mdx.uniqueFilesEdited ?? '–'}</div>
              <div className={styles.statLabel}>{tooltips.mdxUniqueFiles.label}</div>
            </div>
          </div>
          {gate.checks && gate.checks.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Gate Checks</p>
              <div className={styles.scrollBox}>
                <table className={styles.docTable}>
                  <thead><tr><th>Check</th><th>Status</th><th>Value</th></tr></thead>
                  <tbody>
                    {gate.checks.map((c) => (
                      <tr key={c.id}>
                        <td>{c.message || c.id}</td>
                        <td style={{ color: c.passed ? '#2ecc71' : '#e74c3c', fontWeight: 600 }}>{c.passed ? 'PASS' : 'FAIL'}</td>
                        <td>{c.value ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: Engineering Tests (14 ENG procedures)
// ---------------------------------------------------------------------------
function EngineeringTestsPanel({ report }) {
  const eng = report.aggregate?.engineeringTests || {};
  const tooltips = dashboardTooltips.engineeringTests.metrics;

  const tests = [
    { id: 'ENG-02', label: tooltips.eng02.label, value: eng.missingRequiredFields ?? null, pass: (eng.missingRequiredFields || 0) === 0, tooltip: tooltips.eng02.tooltip },
    { id: 'ENG-07', label: tooltips.ssrGuardViolations.label, value: eng.ssrGuardViolations ?? null, pass: (eng.ssrGuardViolations || 0) === 0, tooltip: tooltips.ssrGuardViolations.tooltip },
    { id: 'ENG-09', label: tooltips.brokenInternalLinks.label, value: eng.brokenInternalLinks ?? null, pass: (eng.brokenInternalLinks || 0) === 0, tooltip: tooltips.brokenInternalLinks.tooltip },
    { id: 'ENG-11', label: tooltips.sidebarOrphanedDocs.label, value: eng.sidebarOrphanedDocs ?? null, pass: (eng.sidebarOrphanedDocs || 0) === 0, tooltip: tooltips.sidebarOrphanedDocs.tooltip },
    { id: 'ENG-13', label: tooltips.cspConfigured.label, value: eng.cspConfigured ?? null, pass: eng.cspConfigured === true, tooltip: tooltips.cspConfigured.tooltip },
    { id: 'ENG-14', label: tooltips.criticalCves.label, value: eng.criticalCves ?? null, pass: (eng.criticalCves || 0) === 0, tooltip: tooltips.criticalCves.tooltip },
  ];

  const passCount = tests.filter((t) => t.pass).length;
  const totalCount = tests.length;

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🧪</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.engineeringTests.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.engineeringTests.description}</p>
      <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
        <StatusBadge
          ok={passCount === totalCount}
          warn={passCount > 0 && passCount < totalCount}
          label={`${passCount}/${totalCount} checks passing`}
          tooltip="Number of engineering checks currently passing out of total tracked checks."
        />
      </div>
      <div className={styles.scrollBox} style={{ marginTop: '0.75rem' }}>
        <table className={styles.docTable}>
          <thead><tr><th>ID</th><th>Check</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.id} title={t.tooltip}>
                <td><strong>{t.id}</strong></td>
                <td>{t.label}</td>
                <td>{t.value != null ? String(t.value) : '–'}</td>
                <td style={{ color: t.pass ? '#2ecc71' : '#e74c3c', fontWeight: 600 }}>{t.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {eng.ghaWorkflowCoverage != null && (
        <div className={styles.statRow} style={{ marginTop: '0.75rem' }}>
          <div className={styles.stat} title={tooltips.ghaWorkflowCoverage.tooltip}>
            <div className={styles.statValue}>{eng.ghaWorkflowCoverage ?? '–'}%</div>
            <div className={styles.statLabel}>{tooltips.ghaWorkflowCoverage.label}</div>
          </div>
          <div className={styles.stat} title={tooltips.ghaPullRequestTriggers.tooltip}>
            <div className={styles.statValue}>{eng.ghaPullRequestTriggers ?? '–'}</div>
            <div className={styles.statLabel}>{tooltips.ghaPullRequestTriggers.label}</div>
          </div>
          <div className={styles.stat} title={tooltips.ghaSchedules.tooltip}>
            <div className={styles.statValue}>{eng.ghaSchedules ?? '–'}</div>
            <div className={styles.statLabel}>{tooltips.ghaSchedules.label}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: User Behavior (engagement from aurora-tracking + satisfaction metrics)
// ---------------------------------------------------------------------------
function UserBehaviorPanel() {
  const [metrics, setMetrics] = useState(null);
  const [metricsErr, setMetricsErr] = useState(false);
  const metricsUrl = useBaseUrl('/data/user-satisfaction-metrics.json');
  const tooltips = dashboardTooltips.userBehavior.metrics;

  useEffect(() => {
    fetch(metricsUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data ? setMetrics(data.metrics || data) : setMetricsErr(true)))
      .catch(() => setMetricsErr(true));
  }, [metricsUrl]);

  const summary = metrics?.summary || {};
  const engagement = metrics?.engagement || {};
  const navigation = metrics?.navigation || {};
  const performance = metrics?.performance || {};
  const ces = metrics?.ces || {};
  const scrollDepth = performance.scrollDepth || {};
  const scrollDist = scrollDepth.distribution || {};
  const topDocs = Array.isArray(navigation.topDocuments) ? navigation.topDocuments : [];
  const topRequests = engagement.contentRequests?.topRequests || [];

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>👥</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.userBehavior.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.userBehavior.description}</p>
      {metricsErr || !metrics ? (
        <div className={styles.statusRow}>
          <StatusBadge warn label={metricsErr ? 'Run npm run user-satisfaction-metrics to generate data' : 'Loading…'} />
        </div>
      ) : (
        <>
          <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
            <StatusBadge ok={ces.score != null && ces.score <= 5} warn={ces.score > 5} label={`CES: ${ces.score ?? '–'} — ${ces.interpretation || 'N/A'}`} tooltip={tooltips.cesScore.tooltip} />
            <StatusBadge warn label="Microsoft Clarity: Not integrated" tooltip={tooltips.clarityStatus.tooltip} />
          </div>
          <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
            <div className={styles.stat} title={tooltips.pageViews.tooltip}>
              <div className={styles.statValue}>{navigation.pageViews ?? '–'}</div>
              <div className={styles.statLabel}>{tooltips.pageViews.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.totalSessions.tooltip}>
              <div className={styles.statValue}>{summary.totalSessions ?? '–'}</div>
              <div className={styles.statLabel}>{tooltips.totalSessions.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.uniqueDocuments.tooltip}>
              <div className={styles.statValue}>{summary.uniqueDocuments ?? '–'}</div>
              <div className={styles.statLabel}>{tooltips.uniqueDocuments.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.avgSessionDuration.tooltip}>
              <div className={styles.statValue}>{navigation.sessionDuration?.average != null ? `${navigation.sessionDuration.average}s` : '–'}</div>
              <div className={styles.statLabel}>{tooltips.avgSessionDuration.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.avgScrollDepth.tooltip}>
              <div className={styles.statValue} style={{ color: (scrollDepth.average || 0) >= 50 ? '#2ecc71' : '#f39c12' }}>
                {scrollDepth.average != null ? `${scrollDepth.average}%` : '–'}
              </div>
              <div className={styles.statLabel}>{tooltips.avgScrollDepth.label}</div>
            </div>
          </div>
          <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
            <div className={styles.stat} title={tooltips.codeCopies.tooltip}>
              <div className={styles.statValue}>{engagement.codeExecution?.codeCopies ?? '–'}</div>
              <div className={styles.statLabel}>{tooltips.codeCopies.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.monacoOpens.tooltip}>
              <div className={styles.statValue}>{engagement.codeExecution?.monacoOpens ?? '–'}</div>
              <div className={styles.statLabel}>{tooltips.monacoOpens.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.pdfRequests.tooltip}>
              <div className={styles.statValue}>{engagement.pdfGeneration?.requests ?? '–'}</div>
              <div className={styles.statLabel}>{tooltips.pdfRequests.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.contentRequests.tooltip}>
              <div className={styles.statValue}>{engagement.contentRequests?.total ?? '–'}</div>
              <div className={styles.statLabel}>{tooltips.contentRequests.label}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            {/* Scroll depth distribution */}
            <div style={{ flex: '1 1 200px' }}>
              <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }} title={tooltips.scrollDistribution.tooltip}>{tooltips.scrollDistribution.label}</p>
              <BarChart counts={scrollDist} color="#003fbd" />
            </div>

            {/* Top documents */}
            <div style={{ flex: '1 1 240px' }}>
              <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }} title={tooltips.topDocuments.tooltip}>{tooltips.topDocuments.label}</p>
              <div className={styles.scrollBox}>
                <table className={styles.docTable}>
                  <thead><tr><th>Document</th><th>Views</th></tr></thead>
                  <tbody>
                    {topDocs.slice(0, 8).map((d) => (
                      <tr key={d.document || d}>
                        <td title={d.document}>{(d.document || '').replace(/^\/docs\//, '')}</td>
                        <td>{d.views ?? '–'}</td>
                      </tr>
                    ))}
                    {topDocs.length === 0 && <tr><td colSpan={2}><span className={styles.empty}>No page view data</span></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top content requests */}
            <div style={{ flex: '1 1 240px' }}>
              <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Top Content Requests</p>
              <div className={styles.scrollBox}>
                <table className={styles.docTable}>
                  <thead><tr><th>Request</th><th>Count</th></tr></thead>
                  <tbody>
                    {topRequests.slice(0, 5).map((r) => (
                      <tr key={r.request}>
                        <td title={r.request}>{r.request}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                    {topRequests.length === 0 && <tr><td colSpan={2}><span className={styles.empty}>No requests</span></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: Lighthouse CI (ENG-10)
// ---------------------------------------------------------------------------
function LighthouseCIPanel({ report }) {
  const eng = report.aggregate?.engineeringTests || {};
  const tooltips = dashboardTooltips.lighthouseCI.metrics;

  // Lighthouse scores from build report (if GitHub Actions results are ingested)
  const lhData = report.aggregate?.lighthouseCI || {};
  const perf = lhData.performance ?? null;
  const a11y = lhData.accessibility ?? null;
  const bp = lhData.bestPractices ?? null;
  const seo = lhData.seo ?? null;
  const lastAudit = lhData.lastAuditDate || null;

  const thresholds = { performance: 85, accessibility: 95, bestPractices: 90 };

  function scoreColor(score, threshold) {
    if (score == null) return '#888';
    return score >= threshold ? '#2ecc71' : score >= threshold * 0.8 ? '#f39c12' : '#e74c3c';
  }

  function ScoreGauge({ score, threshold, label }) {
    const pct = score != null ? score : 0;
    const color = scoreColor(score, threshold);
    return (
      <div style={{ textAlign: 'center', flex: '1 1 80px' }} title={`${label}: ${score ?? 'N/A'} (threshold: ${threshold})`}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 0.25rem',
          background: `conic-gradient(${color} ${pct * 3.6}deg, #e0e0e0 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--ifm-background-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '1.1rem', color,
          }}>
            {score ?? '–'}
          </div>
        </div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    );
  }

  const hasData = perf != null || a11y != null || bp != null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🔦</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.lighthouseCI.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.lighthouseCI.description}</p>
      {!hasData ? (
        <div className={styles.statusRow}>
          <StatusBadge warn label="No Lighthouse data — CI artifact not yet ingested" tooltip="Run ENG-10 Lighthouse CI workflow and ingest results into build-report.json to populate this tile." />
        </div>
      ) : (
        <>
          <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
            <StatusBadge ok={(perf ?? 0) >= thresholds.performance} warn={(perf ?? 0) < thresholds.performance} label={`Perf: ${perf ?? '–'} (≥${thresholds.performance})`} tooltip={tooltips.performance.tooltip} />
            <StatusBadge ok={(a11y ?? 0) >= thresholds.accessibility} warn={(a11y ?? 0) < thresholds.accessibility} label={`A11y: ${a11y ?? '–'} (≥${thresholds.accessibility})`} tooltip={tooltips.accessibility.tooltip} />
            <StatusBadge ok={(bp ?? 0) >= thresholds.bestPractices} warn={(bp ?? 0) < thresholds.bestPractices} label={`BP: ${bp ?? '–'} (≥${thresholds.bestPractices})`} tooltip={tooltips.bestPractices.tooltip} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
            <ScoreGauge score={perf} threshold={thresholds.performance} label={tooltips.performance.label} />
            <ScoreGauge score={a11y} threshold={thresholds.accessibility} label={tooltips.accessibility.label} />
            <ScoreGauge score={bp} threshold={thresholds.bestPractices} label={tooltips.bestPractices.label} />
            <ScoreGauge score={seo} threshold={80} label={tooltips.seo.label} />
          </div>
          {lastAudit && (
            <p className={styles.panelSubtitle} style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              Last audit: {new Date(lastAudit).toLocaleString()}
            </p>
          )}
        </>
      )}
      <div style={{ marginTop: '0.75rem' }}>
        <p className={styles.panelSubtitle} style={{ margin: '0 0 0.25rem' }}>Required Thresholds (ENG-10)</p>
        <div className={styles.scrollBox}>
          <table className={styles.docTable}>
            <thead><tr><th>Metric</th><th>Threshold</th><th>Current</th><th>Status</th></tr></thead>
            <tbody>
              {[
                { label: 'Performance', threshold: 85, value: perf },
                { label: 'Accessibility', threshold: 95, value: a11y },
                { label: 'Best Practices', threshold: 90, value: bp },
              ].map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>≥{row.threshold}</td>
                  <td>{row.value ?? '–'}</td>
                  <td style={{ color: row.value == null ? '#888' : row.value >= row.threshold ? '#2ecc71' : '#e74c3c', fontWeight: 600 }}>
                    {row.value == null ? 'NO DATA' : row.value >= row.threshold ? 'PASS' : 'FAIL'}
                  </td>
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
// PANEL: Playwright E2E (ENG-08)
// ---------------------------------------------------------------------------
function PlaywrightE2EPanel({ report }) {
  const tooltips = dashboardTooltips.playwrightE2E.metrics;
  const e2e = report.aggregate?.playwrightE2E || {};
  const totalTests = e2e.totalTests ?? null;
  const passed = e2e.passed ?? null;
  const failed = e2e.failed ?? null;
  const skipped = e2e.skipped ?? null;
  const browsers = e2e.browsers || [];
  const duration = e2e.duration ?? null;
  const lastRun = e2e.lastRunDate || null;
  const passRate = totalTests ? Math.round((passed / totalTests) * 100) : null;

  const hasData = totalTests != null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🎭</span>
        <h3 className={styles.panelTitle}>{dashboardTooltips.playwrightE2E.title}</h3>
      </div>
      <p className={styles.panelSubtitle}>{dashboardTooltips.playwrightE2E.description}</p>
      {!hasData ? (
        <div className={styles.statusRow}>
          <StatusBadge warn label="No E2E data — CI artifact not yet ingested" tooltip="Run ENG-08 Playwright E2E workflow and ingest results into build-report.json to populate this tile." />
        </div>
      ) : (
        <>
          <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
            <StatusBadge ok={failed === 0} warn={failed > 0} label={`${passRate ?? '–'}% pass rate (${passed}/${totalTests})`} tooltip={tooltips.passRate.tooltip} />
            {browsers.length > 0 && <StatusBadge ok label={`Browsers: ${browsers.join(', ')}`} tooltip={tooltips.browsers.tooltip} />}
          </div>
          <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
            <div className={styles.stat} title={tooltips.totalTests.tooltip}>
              <div className={styles.statValue}>{totalTests}</div>
              <div className={styles.statLabel}>{tooltips.totalTests.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.passed.tooltip}>
              <div className={styles.statValue} style={{ color: '#2ecc71' }}>{passed}</div>
              <div className={styles.statLabel}>{tooltips.passed.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.failed.tooltip}>
              <div className={styles.statValue} style={{ color: failed > 0 ? '#e74c3c' : '#2ecc71' }}>{failed}</div>
              <div className={styles.statLabel}>{tooltips.failed.label}</div>
            </div>
            <div className={styles.stat} title={tooltips.skipped.tooltip}>
              <div className={styles.statValue}>{skipped ?? '–'}</div>
              <div className={styles.statLabel}>{tooltips.skipped.label}</div>
            </div>
            {duration != null && (
              <div className={styles.stat} title={tooltips.duration.tooltip}>
                <div className={styles.statValue}>{duration}s</div>
                <div className={styles.statLabel}>{tooltips.duration.label}</div>
              </div>
            )}
          </div>
          {lastRun && (
            <p className={styles.panelSubtitle} style={{ marginTop: '0.5rem' }}>
              Last run: {new Date(lastRun).toLocaleString()}
            </p>
          )}
        </>
      )}
      <div style={{ marginTop: '0.75rem' }}>
        <p className={styles.panelSubtitle} style={{ margin: '0 0 0.25rem' }}>Expected Browsers (ENG-08)</p>
        <div className={styles.scrollBox}>
          <table className={styles.docTable}>
            <thead><tr><th>Browser</th><th>Status</th></tr></thead>
            <tbody>
              {['Chromium', 'Firefox', 'WebKit'].map((b) => {
                const tested = browsers.map((x) => x.toLowerCase()).includes(b.toLowerCase());
                return (
                  <tr key={b}>
                    <td>{b}</td>
                    <td style={{ color: tested ? '#2ecc71' : hasData ? '#e74c3c' : '#888', fontWeight: 600 }}>
                      {hasData ? (tested ? 'TESTED' : 'MISSING') : 'NO DATA'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: i18n Coverage
// ---------------------------------------------------------------------------
function I18nCoveragePanel({ report }) {
  const tooltips = dashboardTooltips.i18nCoverage.metrics;
  const sections = report.aggregate?.sections || {};
  const locales = ['de', 'fr', 'ja'];
  const mainDocCount = Object.entries(sections)
    .filter(([key]) => !locales.includes(key))
    .reduce((sum, [, count]) => sum + count, 0);

  const localeCoverage = locales.map((locale) => {
    const count = sections[locale] || 0;
    const pct = mainDocCount > 0 ? Math.round((count / mainDocCount) * 100) : 0;
    return { locale, count, pct };
  });

  const totalTranslated = localeCoverage.reduce((s, l) => s + l.count, 0);
  const avgCoverage = localeCoverage.length > 0
    ? Math.round(localeCoverage.reduce((s, l) => s + l.pct, 0) / localeCoverage.length)
    : 0;

  const scoreColor = avgCoverage >= 50 ? '#2ecc71' : avgCoverage >= 20 ? '#f39c12' : '#e74c3c';

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🌐</span>
        <h3 className={styles.panelTitle}>i18n Coverage</h3>
      </div>
      <p className={styles.panelSubtitle}>Translation coverage across supported locales vs. {mainDocCount} source docs. Supports ENG-12 gate.</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{locales.length}</div>
          <div className={styles.statLabel} title={tooltips.locales.tooltip}>{tooltips.locales.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{totalTranslated}</div>
          <div className={styles.statLabel} title={tooltips.translatedDocs.tooltip}>{tooltips.translatedDocs.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: scoreColor }}>{avgCoverage}%</div>
          <div className={styles.statLabel} title={tooltips.avgCoverage.tooltip}>{tooltips.avgCoverage.label}</div>
        </div>
      </div>
      <div className={styles.scrollBox} style={{ marginTop: '0.75rem' }}>
        <table className={styles.docTable}>
          <thead><tr><th>Locale</th><th>Translated</th><th>Coverage</th><th>Status</th></tr></thead>
          <tbody>
            {localeCoverage.map((l) => (
              <tr key={l.locale}>
                <td><strong>{l.locale.toUpperCase()}</strong></td>
                <td>{l.count} / {mainDocCount}</td>
                <td style={{ color: l.pct >= 50 ? '#2ecc71' : l.pct >= 20 ? '#f39c12' : '#e74c3c', fontWeight: 600 }}>{l.pct}%</td>
                <td>{l.count === 0 ? '⚠ Not started' : l.pct >= 80 ? '✓ Good' : '⏳ In progress'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: DITA Migration Progress
// ---------------------------------------------------------------------------
function DitaMigrationPanel() {
  const tooltips = dashboardTooltips.ditaMigration.metrics;
  const [ditaData, setDitaData] = useState(null);
  const [ditaErr, setDitaErr] = useState(false);
  const ditaUrl = useBaseUrl('/dita-semantic-loss-report.json');

  useEffect(() => {
    fetch(ditaUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data ? setDitaData(data) : setDitaErr(true)))
      .catch(() => setDitaErr(true));
  }, [ditaUrl]);

  if (ditaErr || !ditaData) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelIcon}>🔄</span>
          <h3 className={styles.panelTitle}>DITA Migration Progress</h3>
        </div>
        <div className={styles.statusRow}>
          <StatusBadge warn label={ditaErr ? 'Report not found — check static/dita-semantic-loss-report.json' : 'Loading…'} />
        </div>
      </div>
    );
  }

  const summary = ditaData.summary || {};
  const total = summary.totalIssues || 0;
  const byType = summary.byType || {};
  const bySeverity = summary.bySeverity || {};
  const high = bySeverity.HIGH || 0;
  const medium = bySeverity.MEDIUM || 0;
  const low = bySeverity.LOW || 0;
  const totalFiles = ditaData.totalFiles || 0;

  const remediationPct = total > 0 ? Math.max(0, Math.round(100 - (high / Math.max(1, totalFiles)) * 100)) : 100;
  const scoreColor = remediationPct >= 80 ? '#2ecc71' : remediationPct >= 50 ? '#f39c12' : '#e74c3c';

  // Top issue types sorted by count
  const topIssues = Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🔄</span>
        <h3 className={styles.panelTitle}>DITA Migration Progress</h3>
      </div>
      <p className={styles.panelSubtitle}>Semantic loss tracking from DITA-to-MDX conversion. {totalFiles} files analyzed.</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{total}</div>
          <div className={styles.statLabel} title={tooltips.totalIssues.tooltip}>{tooltips.totalIssues.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: '#e74c3c' }}>{high}</div>
          <div className={styles.statLabel} title={tooltips.highSeverity.tooltip}>{tooltips.highSeverity.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: '#f39c12' }}>{medium}</div>
          <div className={styles.statLabel}>Medium Severity</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: '#2ecc71' }}>{low}</div>
          <div className={styles.statLabel}>Low Severity</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: scoreColor }}>{remediationPct}%</div>
          <div className={styles.statLabel} title={tooltips.remediationScore.tooltip}>{tooltips.remediationScore.label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
        <div style={{ flex: '1 1 200px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Severity Breakdown</p>
          <DonutChart counts={bySeverity} />
        </div>
        <div style={{ flex: '2 1 260px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Top Issue Types</p>
          <div className={styles.scrollBox}>
            <table className={styles.docTable}>
              <thead><tr><th>Issue Type</th><th>Count</th></tr></thead>
              <tbody>
                {topIssues.map(([type, count]) => (
                  <tr key={type}>
                    <td>{type.replace(/_/g, ' ')}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: Broken Link Trend
// ---------------------------------------------------------------------------
function BrokenLinkTrendPanel({ report }) {
  const tooltips = dashboardTooltips.brokenLinkTrend.metrics;
  const eng = report.aggregate?.engineeringTests || {};
  const brokenLinks = eng.brokenInternalLinks ?? 0;
  const docsWithBroken = eng.docsWithBrokenLinks ?? 0;
  const brokenDetail = eng.brokenLinkDetail || [];

  const scoreColor = brokenLinks === 0 ? '#2ecc71' : brokenLinks <= 10 ? '#f39c12' : '#e74c3c';

  // Group broken links by source page
  const byPage = {};
  brokenDetail.forEach((d) => {
    byPage[d.path] = (d.links || []).length;
  });

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🔗</span>
        <h3 className={styles.panelTitle}>Broken Link Health</h3>
      </div>
      <p className={styles.panelSubtitle}>Internal link integrity from build analysis (ENG-09).</p>
      <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
        <StatusBadge ok={brokenLinks === 0} warn={brokenLinks > 0} label={`${brokenLinks} broken links across ${docsWithBroken} docs`} />
      </div>
      <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: scoreColor }}>{brokenLinks}</div>
          <div className={styles.statLabel} title={tooltips.brokenLinks.tooltip}>{tooltips.brokenLinks.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{docsWithBroken}</div>
          <div className={styles.statLabel} title={tooltips.affectedDocs.tooltip}>{tooltips.affectedDocs.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{report.aggregate?.totalDocs || 0}</div>
          <div className={styles.statLabel}>Total Docs</div>
        </div>
      </div>
      {brokenDetail.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Broken Links by Source</p>
          <div className={styles.scrollBox}>
            <table className={styles.docTable}>
              <thead><tr><th>Source File</th><th>Broken Count</th></tr></thead>
              <tbody>
                {Object.entries(byPage)
                  .sort(([, a], [, b]) => b - a)
                  .map(([file, count]) => (
                    <tr key={file}>
                      <td title={file}>{file.replace(/^docs\//, '')}</td>
                      <td style={{ color: '#e74c3c', fontWeight: 600 }}>{count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {brokenLinks === 0 && <p className={styles.empty}>✓ No broken internal links detected</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: Dependency Freshness
// ---------------------------------------------------------------------------
function DependencyFreshnessPanel({ report }) {
  const tooltips = dashboardTooltips.dependencyFreshness.metrics;
  const eng = report.aggregate?.engineeringTests || {};
  const criticalCves = eng.criticalCves ?? null;
  const deps = report.aggregate?.dependencyFreshness || {};
  const outdatedCount = deps.outdatedCount ?? null;
  const majorBehind = deps.majorBehind ?? null;
  const lastAudit = deps.lastAuditDate || eng.lastAuditDate || null;
  const totalDeps = deps.totalDependencies ?? null;

  const hasData = outdatedCount != null || criticalCves != null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>📦</span>
        <h3 className={styles.panelTitle}>Dependency Freshness</h3>
      </div>
      <p className={styles.panelSubtitle}>Package health and security posture. Complements ENG-14 CVE gate.</p>
      <div className={styles.statusRow} style={{ gap: '0.75rem', display: 'flex', flexWrap: 'wrap' }}>
        <StatusBadge
          ok={(criticalCves || 0) === 0}
          warn={(criticalCves || 0) > 0}
          label={`Critical CVEs: ${criticalCves ?? 'N/A'}`}
          tooltip={tooltips.criticalCves.tooltip}
        />
        {outdatedCount != null && (
          <StatusBadge
            ok={outdatedCount === 0}
            warn={outdatedCount > 0}
            label={`${outdatedCount} outdated packages`}
            tooltip={tooltips.outdated.tooltip}
          />
        )}
      </div>
      <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: (criticalCves || 0) === 0 ? '#2ecc71' : '#e74c3c' }}>
            {criticalCves ?? '–'}
          </div>
          <div className={styles.statLabel} title={tooltips.criticalCves.tooltip}>{tooltips.criticalCves.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{outdatedCount ?? '–'}</div>
          <div className={styles.statLabel} title={tooltips.outdated.tooltip}>{tooltips.outdated.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: (majorBehind || 0) > 0 ? '#f39c12' : '#2ecc71' }}>
            {majorBehind ?? '–'}
          </div>
          <div className={styles.statLabel} title={tooltips.majorBehind.tooltip}>{tooltips.majorBehind.label}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{totalDeps ?? '–'}</div>
          <div className={styles.statLabel}>Total Deps</div>
        </div>
      </div>
      {lastAudit && (
        <p className={styles.panelSubtitle} style={{ marginTop: '0.5rem' }}>
          Last audit: {new Date(lastAudit).toLocaleString()}
        </p>
      )}
      {!hasData && (
        <div className={styles.statusRow} style={{ marginTop: '0.5rem' }}>
          <StatusBadge warn label="Run npm run build-report to populate dependency data" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: PDF Section Coverage
// ---------------------------------------------------------------------------
function PdfCoveragePanel({ report }) {
  const tooltips = dashboardTooltips.pdfCoverage.metrics;
  const sections = report.aggregate?.sections || {};
  const expectedPdfs = ['user-guide', 'js-guide', 'licensing', 'release-notes'];
  const pdfStatus = expectedPdfs.map((section) => {
    const label = section.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    return { section, label, docCount: sections[section] || 0 };
  });

  const platformStability = report.aggregate?.platformStability || {};
  const pdfRenderRate = platformStability.pdfRenderSuccessRatePct ?? null;
  const pdfValidRate = platformStability.pdfOutputValidityRatePct ?? null;
  const totalPdfs = pdfStatus.length;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>📄</span>
        <h3 className={styles.panelTitle}>PDF Section Coverage</h3>
      </div>
      <p className={styles.panelSubtitle}>Per-section PDF generation status across {totalPdfs} expected outputs.</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{totalPdfs}</div>
          <div className={styles.statLabel} title={tooltips.expectedPdfs.tooltip}>{tooltips.expectedPdfs.label}</div>
        </div>
        {pdfRenderRate != null && (
          <div className={styles.stat}>
            <div className={styles.statValue} style={{ color: pdfRenderRate >= 90 ? '#2ecc71' : '#f39c12' }}>{pdfRenderRate}%</div>
            <div className={styles.statLabel} title={tooltips.renderSuccess.tooltip}>{tooltips.renderSuccess.label}</div>
          </div>
        )}
        {pdfValidRate != null && (
          <div className={styles.stat}>
            <div className={styles.statValue} style={{ color: pdfValidRate >= 90 ? '#2ecc71' : '#f39c12' }}>{pdfValidRate}%</div>
            <div className={styles.statLabel} title={tooltips.outputValidity.tooltip}>{tooltips.outputValidity.label}</div>
          </div>
        )}
      </div>
      <div className={styles.scrollBox} style={{ marginTop: '0.75rem' }}>
        <table className={styles.docTable}>
          <thead><tr><th>Section</th><th>Source Docs</th><th>PDF Expected</th></tr></thead>
          <tbody>
            {pdfStatus.map((p) => (
              <tr key={p.section}>
                <td>{p.label}</td>
                <td>{p.docCount}</td>
                <td style={{ color: '#2ecc71', fontWeight: 600 }}>✓ Yes</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL: Doc Feedback Widget Metrics
// ---------------------------------------------------------------------------
function DocFeedbackPanel() {
  const tooltips = dashboardTooltips.docFeedback.metrics;
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = JSON.parse(localStorage.getItem('doc-feedback-data') || '{}');
      if (Object.keys(stored).length > 0) {
        setFeedback(stored);
      }
    } catch { /* ignore */ }
  }, []);

  const entries = feedback ? Object.entries(feedback) : [];
  let thumbsUp = 0;
  let thumbsDown = 0;
  const byDoc = [];

  entries.forEach(([doc, data]) => {
    const up = data?.up || 0;
    const down = data?.down || 0;
    thumbsUp += up;
    thumbsDown += down;
    if (up + down > 0) byDoc.push({ doc, up, down, total: up + down });
  });

  byDoc.sort((a, b) => b.total - a.total);
  const totalVotes = thumbsUp + thumbsDown;
  const satisfactionPct = totalVotes > 0 ? Math.round((thumbsUp / totalVotes) * 100) : null;
  const scoreColor = satisfactionPct == null ? '#888' : satisfactionPct >= 70 ? '#2ecc71' : satisfactionPct >= 40 ? '#f39c12' : '#e74c3c';

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>💬</span>
        <h3 className={styles.panelTitle}>Doc Feedback</h3>
      </div>
      <p className={styles.panelSubtitle}>Aggregated thumbs-up/down feedback from the DocFeedbackWidget.</p>
      {totalVotes === 0 ? (
        <div className={styles.statusRow}>
          <StatusBadge warn label="No feedback data collected yet" tooltip="Feedback is stored in localStorage when users interact with the widget." />
        </div>
      ) : (
        <>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <div className={styles.statValue} style={{ color: '#2ecc71' }}>{thumbsUp}</div>
              <div className={styles.statLabel} title={tooltips.helpful.tooltip}>👍 {tooltips.helpful.label}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue} style={{ color: '#e74c3c' }}>{thumbsDown}</div>
              <div className={styles.statLabel} title={tooltips.notHelpful.tooltip}>👎 {tooltips.notHelpful.label}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{totalVotes}</div>
              <div className={styles.statLabel}>Total Votes</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue} style={{ color: scoreColor }}>{satisfactionPct}%</div>
              <div className={styles.statLabel} title={tooltips.satisfaction.tooltip}>{tooltips.satisfaction.label}</div>
            </div>
          </div>
          {byDoc.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Top Feedback by Page</p>
              <div className={styles.scrollBox}>
                <table className={styles.docTable}>
                  <thead><tr><th>Document</th><th>👍</th><th>👎</th></tr></thead>
                  <tbody>
                    {byDoc.slice(0, 8).map((d) => (
                      <tr key={d.doc}>
                        <td title={d.doc}>{d.doc.replace(/^\/docs\//, '')}</td>
                        <td style={{ color: '#2ecc71' }}>{d.up}</td>
                        <td style={{ color: '#e74c3c' }}>{d.down}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DevDashboard export
// ---------------------------------------------------------------------------
export default function DevDashboard() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [v2Snapshot, setV2Snapshot] = useState(null);
  const [v2Error, setV2Error] = useState(null);
  const [preset, setPreset] = useState('all');
  const reportUrl = useBaseUrl('/build-report.json');
  const v2SnapshotUrl = useBaseUrl('/samples/dashboard-v2-nightly-snapshot.sample.json');

  useEffect(() => {
    fetch(reportUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setReport(data))
      .catch((e) => setError(e.message));
  }, [reportUrl]);

  useEffect(() => {
    fetch(v2SnapshotUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setV2Snapshot(data))
      .catch((e) => setV2Error(e.message));
  }, [v2SnapshotUrl]);

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.devNotice}>
          ⚠ Could not load <code>build-report.json</code>: {error}.{' '}
          Run <code>npm run build-report</code> first, then restart the dev server.
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingShimmer}>
          <div className={styles.shimmerCard} />
          <div className={styles.shimmerCard} />
          <div className={styles.shimmerCard} />
        </div>
      </div>
    );
  }

  const aggregateV2 = v2Snapshot?.dashboardAggregateV2 || null;

  const v1Visible = V1_PRESETS[preset] || ALL_V1_PANELS;
  const showPanel = (key) => v1Visible.includes(key);

  return (
    <div className={styles.dashboard}>
      <div className={styles.devNotice} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <span>
          🛠 Developer Dashboard —{' '}
          <strong>dev only</strong>. This page is not visible in production.
          Data sourced from <code>static/build-report.json</code>.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="persona-preset" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Audience</label>
          <select
            id="persona-preset"
            className={styles.v2Select}
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="all">All Panels</option>
            <option value="developer">Developer</option>
            <option value="content_team">Content Team</option>
            <option value="product_owner">Product Owner</option>
            <option value="qa_engineer">QA Engineer</option>
            <option value="leadership">Leadership</option>
          </select>
        </div>
      </div>

      {/* ── Status Color Legend ──────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
        padding: '0.5rem 1rem', borderRadius: 8,
        background: 'var(--ifm-background-surface-color)',
        border: '1px solid var(--ifm-color-emphasis-200)',
        fontSize: '0.8rem', color: 'var(--ifm-font-color-secondary)',
        marginBottom: '1.5rem',
      }}>
        <span style={{ fontWeight: 600 }}>Status Legend:</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#2ecc71', display: 'inline-block' }} />
          <strong style={{ color: '#2ecc71' }}>Green</strong> — Healthy / passing / on target
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffe600', display: 'inline-block' }} />
          <strong style={{ color: '#ccb800' }}>Yellow</strong> — Warning / approaching threshold
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e67e22', display: 'inline-block' }} />
          <strong style={{ color: '#e67e22' }}>Orange</strong> — Needs attention / below target
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e74c3c', display: 'inline-block' }} />
          <strong style={{ color: '#e74c3c' }}>Red</strong> — Critical / failing / action required
        </span>
      </div>

      {/* ── Build Overview ────────────────────────────── */}
      {showPanel('buildOverview') && (
        <div className={styles.sectionGroup}>
          <SectionHeader icon="📦" title="Build Overview" />
          <BuildOverviewPanel report={report} />
        </div>
      )}

      {/* ── Quality Gates ────────────────────────────────── */}
      {(showPanel('engineeringTests') || showPanel('buildStability') || showPanel('lighthouseCI') || showPanel('playwrightE2E') || showPanel('platformStability') || showPanel('operationalHealth') || showPanel('brokenLinkTrend') || showPanel('dependencyFreshness') || showPanel('pdfCoverage')) && (
        <div className={styles.sectionGroup}>
          <SectionHeader icon="🧪" title="Quality Gates" />
          <div className={styles.panelGrid}>
            {showPanel('engineeringTests') && <EngineeringTestsPanel report={report} />}
            {showPanel('buildStability') && <BuildStabilityPanel report={report} />}
            {showPanel('brokenLinkTrend') && <BrokenLinkTrendPanel report={report} />}
            {showPanel('lighthouseCI') && <LighthouseCIPanel report={report} />}
            {showPanel('playwrightE2E') && <PlaywrightE2EPanel report={report} />}
            {showPanel('dependencyFreshness') && <DependencyFreshnessPanel report={report} />}
            {showPanel('pdfCoverage') && <PdfCoveragePanel report={report} />}
            {showPanel('platformStability') && aggregateV2?.tiles?.platformStability && (
              <V2MetricTile tileKey="platformStability" tileData={aggregateV2.tiles.platformStability} tooltips={aggregateV2.tooltips} />
            )}
            {showPanel('operationalHealth') && aggregateV2?.tiles?.operationalHealth && (
              <V2MetricTile tileKey="operationalHealth" tileData={aggregateV2.tiles.operationalHealth} tooltips={aggregateV2.tooltips} />
            )}
          </div>
        </div>
      )}

      {/* ── Content Health ───────────────────────────────── */}
      {(showPanel('contentQuality') || showPanel('seoHealth') || showPanel('dateFreshness') || showPanel('contentPerformance') || showPanel('i18nCoverage') || showPanel('ditaMigration')) && (
        <div className={styles.sectionGroup}>
          <SectionHeader icon="📋" title="Content Health" />
          <div className={styles.panelGrid}>
            {showPanel('contentQuality') && <ContentQualityPanel report={report} />}
            {showPanel('seoHealth') && <SeoHealthPanel report={report} />}
            {showPanel('dateFreshness') && <DateFreshnessPanel report={report} />}
            {showPanel('contentPerformance') && <ContentPerformancePanel report={report} />}
            {showPanel('i18nCoverage') && <I18nCoveragePanel report={report} />}
            {showPanel('ditaMigration') && <DitaMigrationPanel />}
            {aggregateV2?.tiles?.contentIntelligence && (
              <V2MetricTile tileKey="contentIntelligence" tileData={aggregateV2.tiles.contentIntelligence} tooltips={aggregateV2.tooltips} />
            )}
          </div>
        </div>
      )}

      {/* ── Schema & Taxonomy ────────────────────────────── */}
      {(showPanel('schemaAnalytics') || showPanel('schemaIntelligence')) && (
        <div className={styles.sectionGroup}>
          <SectionHeader icon="🔬" title="Schema & Taxonomy" />
          <div className={styles.panelGrid}>
            {showPanel('schemaAnalytics') && <SchemaAnalyticsPanel report={report} />}
            {showPanel('schemaIntelligence') && <SchemaIntelligencePanel report={report} />}
          </div>
        </div>
      )}

      {/* ── Platform Intelligence ────────────────────────── */}
      {(showPanel('analytics') || showPanel('searchInsights') || showPanel('accessibility')) && (
        <div className={styles.sectionGroup}>
          <SectionHeader icon="📊" title="Platform Intelligence" />
          <div className={styles.panelGrid}>
            {showPanel('analytics') && <AnalyticsPanel report={report} />}
            {showPanel('searchInsights') && <SearchInsightsPanel report={report} />}
            {showPanel('searchInsights') && aggregateV2?.tiles?.searchInsights && (
              <V2MetricTile tileKey="searchInsights" tileData={aggregateV2.tiles.searchInsights} tooltips={aggregateV2.tooltips} />
            )}
            {showPanel('accessibility') && <AccessibilityPanel report={report} />}
          </div>
        </div>
      )}

      {/* ── UX Metrics ───────────────────────────────────── */}
      {(showPanel('userBehavior') || showPanel('docFeedback')) && (
        <div className={styles.sectionGroup}>
          <SectionHeader icon="👥" title="User Experience Metrics" />
          <div className={styles.panelGrid}>
            {showPanel('userBehavior') && <UserBehaviorPanel />}
            {showPanel('docFeedback') && <DocFeedbackPanel />}
            {aggregateV2?.tiles?.userBehavior && (
              <V2MetricTile tileKey="userBehavior" tileData={aggregateV2.tiles.userBehavior} tooltips={aggregateV2.tooltips} />
            )}
          </div>
        </div>
      )}

      {/* ── Release & Operations ─────────────────────────── */}
      {(showPanel('epicReleaseGate') || showPanel('dashboardConfig') || showPanel('releaseIntelligence') || showPanel('jiraIntelligence')) && (
        <div className={styles.sectionGroup}>
          <SectionHeader icon="🚀" title="Release & Operations" />
          <div className={styles.panelGrid}>
            {showPanel('epicReleaseGate') && <EpicReleaseGatePanel report={report} />}
            {showPanel('releaseIntelligence') && aggregateV2?.tiles?.releaseIntelligence && (
              <V2MetricTile tileKey="releaseIntelligence" tileData={aggregateV2.tiles.releaseIntelligence} tooltips={aggregateV2.tooltips} />
            )}
            {showPanel('jiraIntelligence') && aggregateV2?.tiles?.jiraIntelligence && (
              <V2MetricTile tileKey="jiraIntelligence" tileData={aggregateV2.tiles.jiraIntelligence} tooltips={aggregateV2.tooltips} />
            )}
            {showPanel('dashboardConfig') && <DashboardConfigPanel report={report} />}
          </div>
        </div>
      )}
    </div>
  );
}
