/**
 * src/components/DevDashboard/index.jsx
 * ============================================================================
 * Developer Dashboard — visually impressive 9-panel build intelligence suite.
 *
 * Panels:
 *   1.  Build Overview (hero header with health score gauge)
 *   2.  Schema Analytics (device type · role · use case · skill level)
 *   3.  Schema Intelligence (field coverage heatmap + guessing stats)
 *   4.  Date & Freshness Analytics (freshness buckets · monthly velocity)
 *   5.  SEO Health (metadata completeness)
 *   6.  Analytics (GA presence · publish status)
 *   7.  Content Performance (word count distribution)
 *   8.  Ask AI Engine (index statistics)
 *   9.  Content Quality (placeholders · missing metadata table)
 *   10. Dashboard Config In Use (tracked fields from dashboard.config.js)
 *   11. Accessibility — image alt text, heading skips, vague link text
 *   12. Build Stability — broken refs, duplicate slugs, required field checks
 *
 * All charts: pure CSS/SVG (conic-gradient donuts, CSS flex bars).
 * Zero external chart libraries.
 */

import React, { useEffect, useState } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

// ---------------------------------------------------------------------------
// Zebra Aurora palette – 10 distinguishable colours
// ---------------------------------------------------------------------------
const PALETTE = [
  '#003fbd', '#bdf75f', '#e67e22', '#9b59b6', '#1abc9c',
  '#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#e91e63',
];

const V2_GROUP_ORDER = [
  'releaseIntelligence',
  'contentIntelligence',
  'userBehavior',
  'searchInsights',
  'platformStability',
  'operationalHealth',
];

const V2_PRESETS = {
  all: V2_GROUP_ORDER,
  content_team: ['contentIntelligence', 'searchInsights', 'platformStability', 'operationalHealth'],
  product_owner: ['releaseIntelligence', 'userBehavior', 'searchInsights', 'platformStability'],
  leadership: ['releaseIntelligence', 'operationalHealth', 'platformStability'],
};

const V2_TILE_META = {
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
      {items.map(({ label, value, warn, tooltip }) => {
        const pct = Math.round(value * 100);
        const fillClass = warn
          ? pct < 30
            ? styles.progressFillDanger
            : styles.progressFillWarn
          : styles.progressFill;
        return (
          <div key={label} className={styles.progressItem} title={tooltip}>
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
// StatCard — big number highlight with icon and optional trend
// ---------------------------------------------------------------------------
function StatCard({ icon, value, label, accent, tooltip }) {
  return (
    <div className={`${styles.statCard} ${accent ? styles.statCardAccent : ''}`} title={tooltip}>
      {icon && <span className={styles.statCardIcon}>{icon}</span>}
      <div className={styles.statCardValue}>{value}</div>
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
  // The gauge is a half-donut: 180° arc
  // We use a conic gradient clipped to the top half
  const filledDeg = (pct / 100) * 180;
  const gradient = `conic-gradient(from 180deg, ${color} 0deg ${filledDeg}deg, var(--ifm-color-emphasis-200) ${filledDeg}deg 180deg)`;
  const label =
    pct >= 75 ? 'Healthy' :
    pct >= 50 ? 'Fair' :
    'Needs Work';

  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gauge} style={{ background: gradient }}>
        <div className={styles.gaugeHole}>
          <span className={styles.gaugeValue} style={{ color }}>{pct}%</span>
          <span className={styles.gaugeLabel}>{label}</span>
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
  const tileDescription = getTileDescription(report, 'buildOverview', 'High-level snapshot of documentation health and size.');
  const totalDocsMeta = getMetricMeta(report, 'buildOverview', 'totalDocs', 'Total Docs');
  const totalWordsMeta = getMetricMeta(report, 'buildOverview', 'totalWords', 'Total Words');
  const avgWordsMeta = getMetricMeta(report, 'buildOverview', 'avgWords', 'Avg Words/Doc');
  const completenessMeta = getMetricMeta(report, 'buildOverview', 'completeness', 'Completeness');
  const healthScoreMeta = getMetricMeta(report, 'buildOverview', 'healthScore', 'Content Health Score');

  // Health score: weighted average of key signals
  const seo = aggregate.seoHealth || {};
  const total = aggregate.totalDocs || 1;
  const seoScore = Math.round(
    ((seo.hasTitle || 0) / total * 25) +
    ((seo.hasDescription || 0) / total * 25) +
    ((seo.hasKeywords || 0) / total * 25) +
    (completePct / 4)
  );

  return (
    <div className={`${styles.panel} ${styles.panelHero}`}>
      <div className={styles.heroGradient} aria-hidden="true" />
      <div className={styles.heroContent}>
        <div className={styles.heroLeft}>
          <div className={styles.panelHead}>
            <span className={styles.panelIcon}>📦</span>
            <h3 className={styles.panelTitle}>Build Overview</h3>
          </div>
          <p className={styles.panelSubtitle}>
            {tileDescription}
            {' · '}Generated {new Date(report.generatedAt).toLocaleString()}
            {' · '}Node {report.nodeVersion || process?.version || '≥20'}
          </p>
          <div className={styles.heroStats}>
            <StatCard icon="📄" value={aggregate.totalDocs} label={totalDocsMeta.label} accent tooltip={totalDocsMeta.tooltip} />
            <StatCard icon="💬" value={aggregate.totalWords.toLocaleString()} label={totalWordsMeta.label} tooltip={totalWordsMeta.tooltip} />
            <StatCard icon="📝" value={aggregate.avgWords} label={avgWordsMeta.label} tooltip={avgWordsMeta.tooltip} />
            <StatCard icon="✅" value={`${completePct}%`} label={completenessMeta.label} tooltip={completenessMeta.tooltip} />
          </div>
          <div className={styles.statusRow} style={{ marginTop: '0.75rem' }}>
            {Object.entries(aggregate.sections || {}).map(([section, count]) => (
              <StatusBadge key={section} ok label={`${section}: ${count}`} />
            ))}
          </div>
        </div>
        <div className={styles.heroRight}>
          <HealthGauge score={seoScore} />
          <p className={styles.gaugeCaption} title={healthScoreMeta.tooltip}>{healthScoreMeta.label}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 2: Schema Analytics (NEW — device · role · use case · skill level)
// ---------------------------------------------------------------------------
function SchemaAnalyticsPanel({ report }) {
  const { aggregate } = report;
  const tax = aggregate.taxonomy || {};
  const tileDescription = getTileDescription(report, 'schemaAnalytics', 'Taxonomy and audience distribution.');
  const deviceTypeMeta = getMetricMeta(report, 'schemaAnalytics', 'deviceType', 'Topics by Device Type');
  const roleUserMeta = getMetricMeta(report, 'schemaAnalytics', 'roleUser', 'Topics by Role / User');
  const useCaseMeta = getMetricMeta(report, 'schemaAnalytics', 'useCase', 'Topics by Use Case');
  const skillLevelMeta = getMetricMeta(report, 'schemaAnalytics', 'skillLevel', 'Skill Level Distribution');
  const productMeta = getMetricMeta(report, 'schemaAnalytics', 'productName', 'Topics by Product');

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
        <h3 className={styles.panelTitle}>Schema Analytics</h3>
      </div>
      <p className={styles.panelSubtitle}>
        {tileDescription} {' · '}
        {aggregate.totalDocs} docs · {totalUseCaseInstances} use-case tags · {totalRoleInstances} role tags
      </p>

      <div className={styles.schemaGrid}>
        {/* Device Type */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle} title={deviceTypeMeta.tooltip}>📡 {deviceTypeMeta.label}</h4>
          <DonutChart counts={deviceType} centerLabel="devices" />
        </div>

        {/* Role / User */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle} title={roleUserMeta.tooltip}>👤 {roleUserMeta.label}</h4>
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
          <h4 className={styles.schemaSectionTitle} title={useCaseMeta.tooltip}>🎯 {useCaseMeta.label} (ranked)</h4>
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
          <h4 className={styles.schemaSectionTitle} title={skillLevelMeta.tooltip}>🎓 {skillLevelMeta.label}</h4>
          <DonutChart counts={skillLevel} />
        </div>

        {/* Product Name */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle} title={productMeta.tooltip}>🏷 {productMeta.label}</h4>
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
  const tileDescription = getTileDescription(report, 'schemaIntelligence', 'Frontmatter field coverage and auto-generation detection.');
  const guessedFieldsMeta = getMetricMeta(report, 'schemaIntelligence', 'guessedFields', 'Guessed Fields');
  const docsWithGuessesMeta = getMetricMeta(report, 'schemaIntelligence', 'docsWithGuesses', 'Docs w/ Guesses');
  const fullyAuthoredMeta = getMetricMeta(report, 'schemaIntelligence', 'fullyAuthored', 'Fully Authored');
  const fieldCoverageMeta = getMetricMeta(report, 'schemaIntelligence', 'fieldCoverage', 'Field Coverage');

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🧬</span>
        <h3 className={styles.panelTitle}>Schema Intelligence</h3>
      </div>
      <p className={styles.panelSubtitle}>
        {tileDescription} {' · '}
        <span className={styles.guessedChip}>{guessing.totalGuessedFields || 0} auto-guessed</span>{' '}
        across {guessing.docsWithGuesses || 0} docs
      </p>
      <div className={styles.statRow}>
        <div className={styles.stat} title={guessedFieldsMeta.tooltip}>
          <div className={styles.statValue}>{guessing.totalGuessedFields || 0}</div>
          <div className={styles.statLabel}>{guessedFieldsMeta.label}</div>
        </div>
        <div className={styles.stat} title={docsWithGuessesMeta.tooltip}>
          <div className={styles.statValue}>{guessing.docsWithGuesses || 0}</div>
          <div className={styles.statLabel}>{docsWithGuessesMeta.label}</div>
        </div>
        <div className={styles.stat} title={fullyAuthoredMeta.tooltip}>
          <div className={styles.statValue}>
            {aggregate.totalDocs - (guessing.docsWithGuesses || 0)}
          </div>
          <div className={styles.statLabel}>{fullyAuthoredMeta.label}</div>
        </div>
      </div>
      <div title={fieldCoverageMeta.tooltip}>
        <FieldCoverageGrid fieldCoveragePercent={aggregate.fieldCoveragePercent} />
      </div>
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
  const tileDescription = getTileDescription(report, 'dateFreshness', 'Content age tracking and modification velocity.');
  const freshMeta = getMetricMeta(report, 'dateFreshness', 'fresh', 'Fresh');
  const recentMeta = getMetricMeta(report, 'dateFreshness', 'recent', 'Recent');
  const agingMeta = getMetricMeta(report, 'dateFreshness', 'aging', 'Aging');
  const staleMeta = getMetricMeta(report, 'dateFreshness', 'stale', 'Stale');
  const reviewedMeta = getMetricMeta(report, 'dateFreshness', 'lastReviewedCoverage', 'Last Reviewed Coverage');
  const velocityMeta = getMetricMeta(report, 'dateFreshness', 'velocityChart', 'Monthly Velocity');
  const recentlyModifiedMeta = getMetricMeta(report, 'dateFreshness', 'recentlyModified', 'Recently Modified');

  const buckets = [
    { label: freshMeta.label, key: 'fresh', subtitle: '< 30 days', color: '#2ecc71', tooltip: freshMeta.tooltip },
    { label: recentMeta.label, key: 'recent', subtitle: '30–90 days', color: '#3498db', tooltip: recentMeta.tooltip },
    { label: agingMeta.label, key: 'aging', subtitle: '90–180 days', color: '#f39c12', tooltip: agingMeta.tooltip },
    { label: staleMeta.label, key: 'stale', subtitle: '> 180 days', color: '#e74c3c', tooltip: staleMeta.tooltip },
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
        <h3 className={styles.panelTitle}>Date &amp; Freshness Analytics</h3>
      </div>
      <p className={styles.panelSubtitle}>
        {tileDescription} {' · '}<span title={reviewedMeta.tooltip}>Content age based on file modification</span>{' '}
        · <code>last_reviewed</code> frontmatter coverage:{' '}
        <strong>{reviewCoverage}%</strong>
      </p>

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
            <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }} title={velocityMeta.tooltip}>
              {velocityMeta.label}
            </p>
            <BarChart counts={monthCounts} color="#003fbd" />
          </div>
        )}
        {/* Recently modified */}
        <div style={{ flex: '2 1 260px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }} title={recentlyModifiedMeta.tooltip}>
            5 most recently modified
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
  const tileDescription = getTileDescription(report, 'seoHealth', 'Search engine optimization readiness.');
  const seoScoreMeta = getMetricMeta(report, 'seoHealth', 'seoScore', 'SEO Score');
  const hasTitleMeta = getMetricMeta(report, 'seoHealth', 'hasTitle', 'Has Title');
  const hasDescriptionMeta = getMetricMeta(report, 'seoHealth', 'hasDescription', 'Has Description');
  const hasKeywordsMeta = getMetricMeta(report, 'seoHealth', 'hasKeywords', 'Has Keywords');
  const hasSlugMeta = getMetricMeta(report, 'seoHealth', 'hasSlug', 'Has Slug');

  const items = [
    { label: hasTitleMeta.label, value: (seo.hasTitle || 0) / total, tooltip: hasTitleMeta.tooltip },
    { label: hasDescriptionMeta.label, value: (seo.hasDescription || 0) / total, warn: true, tooltip: hasDescriptionMeta.tooltip },
    { label: hasKeywordsMeta.label, value: (seo.hasKeywords || 0) / total, warn: true, tooltip: hasKeywordsMeta.tooltip },
    { label: hasSlugMeta.label, value: (seo.hasSlug || 0) / total, tooltip: hasSlugMeta.tooltip },
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
        <h3 className={styles.panelTitle}>SEO Health</h3>
      </div>
      <p className={styles.panelSubtitle}>{tileDescription}</p>
      <div className={styles.statRow}>
        <div className={styles.stat} title={seoScoreMeta.tooltip}>
          <div className={styles.statValue} style={{ color: scoreColor }}>{seoScore}%</div>
          <div className={styles.statLabel}>{seoScoreMeta.label}</div>
        </div>
        <div className={styles.stat} title={hasDescriptionMeta.tooltip}>
          <div className={styles.statValue}>{seo.hasDescription || 0}/{total}</div>
          <div className={styles.statLabel}>Have Description</div>
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
  const tileDescription = getTileDescription(report, 'analytics', 'Publication status and analytics integration detection.');
  const gaMeta = getMetricMeta(report, 'analytics', 'gaStatus', 'GA Status');
  const publishedMeta = getMetricMeta(report, 'analytics', 'published', 'Published');
  const draftMeta = getMetricMeta(report, 'analytics', 'draft', 'Draft');
  const publishRateMeta = getMetricMeta(report, 'analytics', 'publishRate', 'Publish Rate');
  const publishedCount = statusCounts['Published'] || 0;
  const draftCount = statusCounts['Draft'] || 0;
  const total = aggregate.totalDocs || 1;
  const publishRate = Math.round((publishedCount / total) * 100);

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
        <h3 className={styles.panelTitle}>Analytics</h3>
      </div>
      <p className={styles.panelSubtitle}>{tileDescription}</p>
      <div className={styles.statusRow}>
        <StatusBadge
          ok={gaStatus.startsWith('Active')}
          warn={!gaStatus.startsWith('Active') && !gaStatus.startsWith('Not')}
          label={`${gaMeta.label}: ${gaStatus}`}
          tooltip={gaMeta.tooltip}
        />
      </div>
      <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
        <div className={styles.stat} title={publishedMeta.tooltip}>
          <div className={styles.statValue}>{publishedCount}</div>
          <div className={styles.statLabel}>{publishedMeta.label}</div>
        </div>
        <div className={styles.stat} title={draftMeta.tooltip}>
          <div className={styles.statValue}>{draftCount}</div>
          <div className={styles.statLabel}>{draftMeta.label}</div>
        </div>
        <div className={styles.stat} title={publishRateMeta.tooltip}>
          <div
            className={styles.statValue}
            style={{ color: publishRate >= 50 ? '#2ecc71' : '#e67e22' }}
          >
            {publishRate}%
          </div>
          <div className={styles.statLabel}>{publishRateMeta.label}</div>
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
  const tileDescription = getTileDescription(report, 'contentPerformance', 'Word count distribution and thin content detection.');
  const avgWordsMeta = getMetricMeta(report, 'contentPerformance', 'avgWords', 'Avg Words');
  const totalWordsMeta = getMetricMeta(report, 'contentPerformance', 'totalWords', 'Total Words');
  const thinDocsMeta = getMetricMeta(report, 'contentPerformance', 'thinDocs', 'Thin Docs (<100w)');
  const distributionMeta = getMetricMeta(report, 'contentPerformance', 'distribution', 'Word Distribution');
  const topDocsMeta = getMetricMeta(report, 'contentPerformance', 'topDocs', 'Top 5 by Length');

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
        <h3 className={styles.panelTitle}>Content Performance</h3>
      </div>
      <p className={styles.panelSubtitle}>{tileDescription}</p>
      <div className={styles.statRow}>
        <div className={styles.stat} title={avgWordsMeta.tooltip}>
          <div className={styles.statValue}>{aggregate.avgWords}</div>
          <div className={styles.statLabel}>{avgWordsMeta.label}</div>
        </div>
        <div className={styles.stat} title={totalWordsMeta.tooltip}>
          <div className={styles.statValue}>{aggregate.totalWords.toLocaleString()}</div>
          <div className={styles.statLabel}>{totalWordsMeta.label}</div>
        </div>
        <div className={styles.stat} title={thinDocsMeta.tooltip}>
          <div
            className={styles.statValue}
            style={{ color: thinDocs > 0 ? '#e74c3c' : '#2ecc71' }}
          >
            {thinDocs}
          </div>
          <div className={styles.statLabel}>{thinDocsMeta.label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }} title={distributionMeta.tooltip}>{distributionMeta.label}</p>
          <BarChart counts={buckets} color="#003fbd" />
        </div>
        <div style={{ flex: '2 1 240px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }} title={topDocsMeta.tooltip}>Top 5 docs by length</p>
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
function AskAiPanel({ report }) {
  const [index, setIndex] = useState(null);
  const [indexErr, setIndexErr] = useState(false);
  const indexUrl = useBaseUrl('/askai-index.json');
  const tileDescription = getTileDescription(report, 'askai', 'Search index statistics.');
  const recordsMeta = getMetricMeta(report, 'askai', 'records', 'Records');
  const sourceDocsMeta = getMetricMeta(report, 'askai', 'sourceDocs', 'Source Docs');
  const indexSizeMeta = getMetricMeta(report, 'askai', 'indexSize', 'Index Size');
  const docCoverageMeta = getMetricMeta(report, 'askai', 'docCoverage', 'Doc Coverage');
  const sectionBreakdownMeta = getMetricMeta(report, 'askai', 'sectionBreakdown', 'By Section');

  useEffect(() => {
    fetch(indexUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data ? setIndex(data) : setIndexErr(true)))
      .catch(() => setIndexErr(true));
  }, [indexUrl]);

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

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🤖</span>
        <h3 className={styles.panelTitle}>Ask AI Engine</h3>
      </div>
      <p className={styles.panelSubtitle}>{tileDescription}</p>
      <div className={styles.statusRow}>
        {indexErr
          ? <StatusBadge label="Index not found" />
          : index
            ? <StatusBadge ok label="Index loaded" />
            : <StatusBadge warn label="Loading index…" />}
      </div>
      <div className={styles.statRow}>
        <div className={styles.stat} title={recordsMeta.tooltip}>
          <div className={styles.statValue}>{index ? index.records.length : '–'}</div>
          <div className={styles.statLabel}>{recordsMeta.label}</div>
        </div>
        <div className={styles.stat} title={sourceDocsMeta.tooltip}>
          <div className={styles.statValue}>{report.aggregate.totalDocs}</div>
          <div className={styles.statLabel}>{sourceDocsMeta.label}</div>
        </div>
        <div className={styles.stat} title={indexSizeMeta.tooltip}>
          <div className={styles.statValue}>{indexSizeKb != null ? `~${indexSizeKb} KB` : '–'}</div>
          <div className={styles.statLabel}>{indexSizeMeta.label}</div>
        </div>
        <div className={styles.stat} title={docCoverageMeta.tooltip}>
          <div
            className={styles.statValue}
            style={{ color: indexCoverage != null ? (indexCoverage >= 80 ? '#2ecc71' : '#f39c12') : undefined }}
          >
            {indexCoverage != null ? `${indexCoverage}%` : '–'}
          </div>
          <div className={styles.statLabel}>{docCoverageMeta.label}</div>
        </div>
      </div>
      {index
        ? <div title={sectionBreakdownMeta.tooltip}><BarChart counts={sectionCounts} /></div>
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
      <div className={styles.statusRow}>
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
// PANEL 10: Dashboard Config (what drives report generation)
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
// PANEL 11: Accessibility (a11y)
// ---------------------------------------------------------------------------
function AccessibilityPanel({ report }) {
  const { aggregate, docs } = report;
  const a11y = aggregate.a11yStats || {};
  const tileDescription = getTileDescription(report, 'accessibility', 'A11y compliance scanning for assistive technology and browser usability.');
  const a11yScoreMeta = getMetricMeta(report, 'accessibility', 'a11yScore', 'A11y Score');
  const docsWithIssuesMeta = getMetricMeta(report, 'accessibility', 'docsWithIssues', 'Docs with Issues');
  const imagesNoAltMeta = getMetricMeta(report, 'accessibility', 'imagesNoAlt', 'Images No Alt');
  const vagueLinksMeta = getMetricMeta(report, 'accessibility', 'vagueLinks', 'Vague Links');
  const headingSkipsMeta = getMetricMeta(report, 'accessibility', 'headingSkips', 'Heading Skips');
  const emptyHeadingsMeta = getMetricMeta(report, 'accessibility', 'emptyHeadings', 'Empty Headings');

  if (!aggregate.a11yStats) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelIcon}>♿</span>
          <h3 className={styles.panelTitle}>Accessibility</h3>
        </div>
        <p className={styles.panelSubtitle}>Re-run <code>npm run build-report</code> to populate a11y data.</p>
      </div>
    );
  }

  const total = aggregate.totalDocs || 1;
  const docsWithIssues = a11y.docsWithIssues || 0;
  const a11yScore = Math.max(0, Math.round(100 - (docsWithIssues / total) * 100));
  const scoreColor =
    a11yScore >= 90 ? '#2ecc71' :
    a11yScore >= 70 ? '#f39c12' :
    '#e74c3c';

  const worstDocs = [...docs]
    .filter((d) => d.hasA11yIssues)
    .sort((a, b) => b.a11yIssues.length - a.a11yIssues.length)
    .slice(0, 8);

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>♿</span>
        <h3 className={styles.panelTitle}>Accessibility</h3>
      </div>
      <p className={styles.panelSubtitle}>
        {tileDescription}
      </p>
      <div className={styles.statusRow}>
        <StatusBadge
          ok={docsWithIssues === 0}
          warn={docsWithIssues > 0 && docsWithIssues <= 5}
          label={docsWithIssues === 0 ? 'No a11y issues found' : `${docsWithIssuesMeta.label}: ${docsWithIssues}`}
          tooltip={docsWithIssuesMeta.tooltip}
        />
      </div>
      <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
        <div className={styles.stat} title={a11yScoreMeta.tooltip}>
          <div className={styles.statValue} style={{ color: scoreColor }}>{a11yScore}%</div>
          <div className={styles.statLabel}>{a11yScoreMeta.label}</div>
        </div>
        <div className={styles.stat} title={imagesNoAltMeta.tooltip}>
          <div className={styles.statValue} style={{ color: (a11y.imgNoAlt || 0) > 0 ? '#e74c3c' : '#2ecc71' }}>
            {a11y.imgNoAlt || 0}
          </div>
          <div className={styles.statLabel}>{imagesNoAltMeta.label}</div>
        </div>
        <div className={styles.stat} title={vagueLinksMeta.tooltip}>
          <div className={styles.statValue} style={{ color: (a11y.nonDescriptiveLinks || 0) > 0 ? '#f39c12' : '#2ecc71' }}>
            {a11y.nonDescriptiveLinks || 0}
          </div>
          <div className={styles.statLabel}>{vagueLinksMeta.label}</div>
        </div>
        <div className={styles.stat} title={headingSkipsMeta.tooltip}>
          <div className={styles.statValue} style={{ color: (a11y.headingSkips || 0) > 0 ? '#f39c12' : '#2ecc71' }}>
            {a11y.headingSkips || 0}
          </div>
          <div className={styles.statLabel}>{headingSkipsMeta.label}</div>
        </div>
        <div className={styles.stat} title={emptyHeadingsMeta.tooltip}>
          <div className={styles.statValue} style={{ color: (a11y.emptyHeadings || 0) > 0 ? '#e74c3c' : '#2ecc71' }}>
            {a11y.emptyHeadings || 0}
          </div>
          <div className={styles.statLabel}>{emptyHeadingsMeta.label}</div>
        </div>
      </div>
      {worstDocs.length > 0 && (
        <div className={styles.scrollBox}>
          <table className={styles.docTable}>
            <thead>
              <tr><th>Document</th><th>Issues</th></tr>
            </thead>
            <tbody>
              {worstDocs.map((d) => (
                <tr key={d.filePath}>
                  <td title={d.title}>{d.title}</td>
                  <td>
                    {d.a11yIssues.map((issue) => (
                      <span key={issue.type} className={styles.guessedChip} style={{ marginRight: '4px' }}>
                        {issue.type.replace(/_/g, ' ')}{issue.count ? ` ×${issue.count}` : ''}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {docsWithIssues === 0 && (
        <p className={styles.empty}>✓ No static accessibility issues detected</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 12: Build Stability
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
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🏗</span>
        <h3 className={styles.panelTitle}>Build Stability</h3>
      </div>
      <p className={styles.panelSubtitle}>
        {tileDescription}
      </p>
      <div className={styles.statusRow}>
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
  const visibleGroups = V2_PRESETS[preset] || V2_GROUP_ORDER;
  const globalStability = aggregateV2?.globalStability;

  return (
    <div className={styles.dashboard}>
      <div className={styles.devNotice}>
        🛠 Developer Dashboard —{' '}
        <strong>dev only</strong>. This page is not visible in production.
        Data sourced from <code>static/build-report.json</code> and <code>static/samples/dashboard-v2-nightly-snapshot.sample.json</code>.
      </div>

      <div className={styles.v2Section}>
        <div className={styles.v2Header}>
          <div>
            <h2 className={styles.v2Title}>Dashboard V2 Preview</h2>
            <p className={styles.panelSubtitle}>
              Phase 1 preview using contract-backed sample snapshot data.
            </p>
          </div>
          <div className={styles.v2Controls}>
            <label htmlFor="v2-preset" className={styles.v2ControlLabel}>Audience Preset</label>
            <select
              id="v2-preset"
              className={styles.v2Select}
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="all">All Metrics</option>
              <option value="content_team">Content Team</option>
              <option value="product_owner">Product Owner</option>
              <option value="leadership">Leadership</option>
            </select>
          </div>
        </div>

        {!aggregateV2 && (
          <div className={styles.panel}>
            <p className={styles.panelSubtitle}>
              {v2Error
                ? `Could not load V2 snapshot: ${v2Error}`
                : 'Loading V2 snapshot...'}
            </p>
          </div>
        )}

        {aggregateV2 && (
          <>
            <div className={styles.v2GlobalStrip}>
              <div className={styles.v2GlobalCard}>
                <div className={styles.v2GlobalTitle}>Global Stability</div>
                <div className={styles.v2GlobalValue}>{Math.round(globalStability?.score || 0)}%</div>
                <V2StatusChip status={globalStability?.status} score={globalStability?.score} />
              </div>
              <div className={styles.v2GlobalCard}>
                <div className={styles.v2GlobalTitle}>Critical Alerts</div>
                <div className={styles.v2GlobalValue}>{globalStability?.criticalAlertCount ?? 0}</div>
              </div>
              <div className={styles.v2GlobalCard}>
                <div className={styles.v2GlobalTitle}>Warning Alerts</div>
                <div className={styles.v2GlobalValue}>{globalStability?.warningAlertCount ?? 0}</div>
              </div>
              <div className={styles.v2GlobalCard}>
                <div className={styles.v2GlobalTitle}>Snapshot Date</div>
                <div className={styles.v2GlobalValue}>{aggregateV2.snapshotDate || v2Snapshot?.snapshotDate || '—'}</div>
              </div>
            </div>

            <div className={styles.panelGrid}>
              {visibleGroups.map((tileKey) => (
                <V2MetricTile
                  key={tileKey}
                  tileKey={tileKey}
                  tileData={aggregateV2.tiles?.[tileKey]}
                  tooltips={aggregateV2.tooltips}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <BuildOverviewPanel report={report} />

      <div className={styles.panelGrid}>
        <SchemaAnalyticsPanel report={report} />
        <SchemaIntelligencePanel report={report} />
        <DateFreshnessPanel report={report} />
        <SeoHealthPanel report={report} />
        <AnalyticsPanel report={report} />
        <ContentPerformancePanel report={report} />
        <AskAiPanel report={report} />
        <DashboardConfigPanel report={report} />
        <ContentQualityPanel report={report} />
        <AccessibilityPanel report={report} />
        <BuildStabilityPanel report={report} />
      </div>
    </div>
  );
}
