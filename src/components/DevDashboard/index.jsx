/**
 * src/components/DevDashboard/index.jsx
 * ============================================================================
 * Developer Dashboard — visually impressive 11-panel build intelligence suite.
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
 *  10.  JIRA Metrics (epic tracker · release readiness · SR SLA placeholder · PR↔ticket↔file table)
 *  11.  UX Metrics — Microsoft Clarity (sessions · rage/dead clicks · scroll depth)
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
// StatCard — big number highlight with icon and optional trend
// ---------------------------------------------------------------------------
function StatCard({ icon, value, label, accent }) {
  return (
    <div className={`${styles.statCard} ${accent ? styles.statCardAccent : ''}`}>
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
            Generated {new Date(report.generatedAt).toLocaleString()}
            {' · '}Node {report.nodeVersion || process?.version || '≥20'}
          </p>
          <div className={styles.heroStats}>
            <StatCard icon="📄" value={aggregate.totalDocs} label="Total Docs" accent />
            <StatCard icon="💬" value={aggregate.totalWords.toLocaleString()} label="Total Words" />
            <StatCard icon="📝" value={aggregate.avgWords} label="Avg Words/Doc" />
            <StatCard icon="✅" value={`${completePct}%`} label="Completeness" />
          </div>
          <div className={styles.statusRow} style={{ marginTop: '0.75rem' }}>
            {Object.entries(aggregate.sections || {}).map(([section, count]) => (
              <StatusBadge key={section} ok label={`${section}: ${count}`} />
            ))}
          </div>
        </div>
        <div className={styles.heroRight}>
          <HealthGauge score={seoScore} />
          <p className={styles.gaugeCaption}>Content Health Score</p>
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
        Taxonomy distribution from frontmatter ·{' '}
        {aggregate.totalDocs} docs · {totalUseCaseInstances} use-case tags · {totalRoleInstances} role tags
      </p>

      <div className={styles.schemaGrid}>
        {/* Device Type */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle}>📡 Topics by Device Type</h4>
          <DonutChart counts={deviceType} centerLabel="devices" />
        </div>

        {/* Role / User */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle}>👤 Topics by Role / User</h4>
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
          <h4 className={styles.schemaSectionTitle}>🎯 Topics by Use Case (ranked)</h4>
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
          <h4 className={styles.schemaSectionTitle}>🎓 Skill Level Distribution</h4>
          <DonutChart counts={skillLevel} />
        </div>

        {/* Product Name */}
        <div className={styles.schemaSection}>
          <h4 className={styles.schemaSectionTitle}>🏷 Topics by Product</h4>
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

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🧬</span>
        <h3 className={styles.panelTitle}>Schema Intelligence</h3>
      </div>
      <p className={styles.panelSubtitle}>
        Frontmatter field coverage ·{' '}
        <span className={styles.guessedChip}>{guessing.totalGuessedFields || 0} auto-guessed</span>{' '}
        across {guessing.docsWithGuesses || 0} docs
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
          <div className={styles.statValue}>
            {aggregate.totalDocs - (guessing.docsWithGuesses || 0)}
          </div>
          <div className={styles.statLabel}>Fully Authored</div>
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

  const buckets = [
    { label: 'Fresh',   key: 'fresh',  subtitle: '< 30 days', color: '#2ecc71' },
    { label: 'Recent',  key: 'recent', subtitle: '30–90 days', color: '#3498db' },
    { label: 'Aging',   key: 'aging',  subtitle: '90–180 days', color: '#f39c12' },
    { label: 'Stale',   key: 'stale',  subtitle: '> 180 days', color: '#e74c3c' },
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
        Content age based on file modification · <code>last_reviewed</code> frontmatter coverage:{' '}
        <strong>{reviewCoverage}%</strong>
      </p>

      {/* Freshness buckets */}
      <div className={styles.freshnessRow}>
        {buckets.map(({ label, key, subtitle, color }) => {
          const count = da[key] || 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className={styles.freshnessBucket} style={{ borderTopColor: color }}>
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
            <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>
              Monthly modification velocity
            </p>
            <BarChart counts={monthCounts} color="#003fbd" />
          </div>
        )}
        {/* Recently modified */}
        <div style={{ flex: '2 1 260px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>
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

  const items = [
    { label: 'Has Title',       value: (seo.hasTitle || 0) / total },
    { label: 'Has Description', value: (seo.hasDescription || 0) / total, warn: true },
    { label: 'Has Keywords',    value: (seo.hasKeywords || 0) / total, warn: true },
    { label: 'Has Slug',        value: (seo.hasSlug || 0) / total },
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
      <p className={styles.panelSubtitle}>Metadata completeness for search visibility</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue} style={{ color: scoreColor }}>{seoScore}%</div>
          <div className={styles.statLabel}>SEO Score</div>
        </div>
        <div className={styles.stat}>
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
      <p className={styles.panelSubtitle}>Publish status · GA Tier 1 presence</p>
      <div className={styles.statusRow}>
        <StatusBadge
          ok={gaStatus.startsWith('Active')}
          warn={!gaStatus.startsWith('Active') && !gaStatus.startsWith('Not')}
          label={`GA: ${gaStatus}`}
        />
      </div>
      <div className={styles.statRow} style={{ marginTop: '0.5rem' }}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{publishedCount}</div>
          <div className={styles.statLabel}>Published</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{draftCount}</div>
          <div className={styles.statLabel}>Draft</div>
        </div>
        <div className={styles.stat}>
          <div
            className={styles.statValue}
            style={{ color: publishRate >= 50 ? '#2ecc71' : '#e67e22' }}
          >
            {publishRate}%
          </div>
          <div className={styles.statLabel}>Publish Rate</div>
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
      <p className={styles.panelSubtitle}>Word count distribution · thin content detection</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{aggregate.avgWords}</div>
          <div className={styles.statLabel}>Avg Words</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{aggregate.totalWords.toLocaleString()}</div>
          <div className={styles.statLabel}>Total Words</div>
        </div>
        <div className={styles.stat}>
          <div
            className={styles.statValue}
            style={{ color: thinDocs > 0 ? '#e74c3c' : '#2ecc71' }}
          >
            {thinDocs}
          </div>
          <div className={styles.statLabel}>Thin Docs (&lt;100w)</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Word count distribution</p>
          <BarChart counts={buckets} color="#003fbd" />
        </div>
        <div style={{ flex: '2 1 240px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Top 5 docs by length</p>
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
      <p className={styles.panelSubtitle}>Search index statistics · coverage</p>
      <div className={styles.statusRow}>
        {indexErr
          ? <StatusBadge label="Index not found" />
          : index
            ? <StatusBadge ok label="Index loaded" />
            : <StatusBadge warn label="Loading index…" />}
      </div>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{index ? index.records.length : '–'}</div>
          <div className={styles.statLabel}>Records</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{report.aggregate.totalDocs}</div>
          <div className={styles.statLabel}>Source Docs</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{indexSizeKb != null ? `~${indexSizeKb} KB` : '–'}</div>
          <div className={styles.statLabel}>Index Size</div>
        </div>
        <div className={styles.stat}>
          <div
            className={styles.statValue}
            style={{ color: indexCoverage != null ? (indexCoverage >= 80 ? '#2ecc71' : '#f39c12') : undefined }}
          >
            {indexCoverage != null ? `${indexCoverage}%` : '–'}
          </div>
          <div className={styles.statLabel}>Doc Coverage</div>
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
        <span className={styles.panelIcon}>♿</span>
        <h3 className={styles.panelTitle}>Content Quality</h3>
      </div>
      <p className={styles.panelSubtitle}>Placeholder detection · missing metadata · completeness</p>
      <div className={styles.statusRow}>
        <StatusBadge
          ok={docsWithIssues === 0}
          warn={docsWithIssues > 0 && docsWithIssues < 10}
          label={`${docsWithIssues} docs have placeholders`}
        />
        <StatusBadge
          ok={missingTitle === 0}
          warn={missingTitle > 0}
          label={`${missingTitle} missing title`}
        />
        <StatusBadge
          ok={missingDesc === 0}
          warn={missingDesc > 0}
          label={`${missingDesc} missing description`}
        />
        <StatusBadge
          ok={missingKeywords === 0}
          warn={missingKeywords > 0}
          label={`${missingKeywords} missing keywords`}
        />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Placeholder by field */}
        <div style={{ flex: '1 1 200px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>Placeholders by field</p>
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
            Docs needing the most attention
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
// PANEL 10A: JIRA Epic Tracker
// ---------------------------------------------------------------------------
function JiraEpicPanel({ jira }) {
  if (!jira) return null;
  const { isMock, epic, tickets, velocity } = jira;

  const today   = new Date();
  const dueDate = epic?.dueDate ? new Date(epic.dueDate) : null;
  const startDate = epic?.startDate ? new Date(epic.startDate) : null;

  const totalDays   = startDate && dueDate ? Math.max(1, Math.round((dueDate - startDate) / 86_400_000)) : null;
  const elapsedDays = startDate ? Math.max(0, Math.round((today - startDate) / 86_400_000)) : null;
  const daysLeft    = dueDate ? Math.max(0, Math.round((dueDate - today) / 86_400_000)) : null;

  const total   = tickets?.total || 0;
  const done    = tickets?.done  || 0;
  const closedPct  = total > 0 ? done / total : 0;
  const elapsedPct = totalDays != null && elapsedDays != null ? Math.min(1, elapsedDays / totalDays) : 0;

  // readiness delta: positive = ahead of schedule, negative = behind
  const delta = closedPct - elapsedPct;
  const readinessLabel =
    delta >= 0.05 ? 'Ahead of Schedule' :
    delta >= -0.1 ? 'On Track' :
    delta >= -0.25 ? 'At Risk' : 'Critical';
  const readinessCls =
    delta >= -0.1 ? styles.readinessOnTrack :
    delta >= -0.25 ? styles.readinessBehind : styles.readinessCritical;
  const fillColor =
    delta >= -0.1  ? '#2ecc71' :
    delta >= -0.25 ? '#e67e22' : '#e74c3c';

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🎯</span>
        <h3 className={styles.panelTitle}>
          JIRA Epic Tracker
          {isMock && <span className={styles.mockBadge}>mock data</span>}
        </h3>
      </div>
      <p className={styles.panelSubtitle}>
        {epic?.key} — {epic?.summary}
        {daysLeft != null && (
          <span className={styles.countdownBadge} style={{ marginLeft: '0.5rem' }}>
            ⏱ {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
          </span>
        )}
      </p>

      {/* Ticket count chips */}
      <div className={styles.chipRow}>
        <div className={styles.chip}>
          <span className={styles.chipValue} style={{ color: '#e74c3c' }}>{tickets?.open ?? '–'}</span>
          <span className={styles.chipLabel}>Open</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipValue} style={{ color: '#f39c12' }}>{tickets?.inProgress ?? '–'}</span>
          <span className={styles.chipLabel}>In Progress</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipValue} style={{ color: '#2ecc71' }}>{tickets?.done ?? '–'}</span>
          <span className={styles.chipLabel}>Done</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipValue}>{total}</span>
          <span className={styles.chipLabel}>Total</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipValue}>{velocity ?? '–'}</span>
          <span className={styles.chipLabel}>Velocity/wk</span>
        </div>
      </div>

      {/* Release Readiness gauge */}
      <div className={styles.readinessGauge}>
        <div className={styles.readinessMeta}>
          <span className={styles.readinessLabel}>Release Readiness</span>
          <span className={readinessCls}>{readinessLabel}</span>
        </div>
        <div className={styles.readinessTrack}>
          <div
            className={styles.readinessFill}
            style={{ width: `${Math.round(closedPct * 100)}%`, background: fillColor }}
          />
          {elapsedPct > 0 && (
            <div
              className={styles.readinessTimeMarker}
              style={{ left: `calc(${Math.round(elapsedPct * 100)}% - 1px)` }}
            />
          )}
        </div>
        <div className={styles.readinessMeta}>
          <span style={{ color: 'var(--dd-muted)', fontSize: '0.67rem' }}>
            {Math.round(closedPct * 100)}% tickets closed
          </span>
          {elapsedPct > 0 && (
            <span style={{ color: 'var(--dd-muted)', fontSize: '0.67rem' }}>
              {Math.round(elapsedPct * 100)}% time elapsed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 10B: Service Request SLA (placeholder)
// ---------------------------------------------------------------------------
function ServiceRequestPanel({ jira }) {
  const sr = jira?.serviceRequest;
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🎫</span>
        <h3 className={styles.panelTitle}>Service Request SLA</h3>
      </div>
      <p className={styles.panelSubtitle}>Time to complete a service request update</p>

      <div className={styles.placeholderCard}>
        <span className={styles.placeholderBadge}>⏳ Placeholder</span>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <div className={styles.chip}>
            <span className={styles.chipValue} style={{ color: 'var(--dd-muted)' }}>
              {sr?.srAvgDays ?? '--'}
            </span>
            <span className={styles.chipLabel}>Avg Days</span>
          </div>
          <div className={styles.chip}>
            <span className={styles.chipValue} style={{ color: 'var(--dd-muted)' }}>
              {sr?.srCount ?? '--'}
            </span>
            <span className={styles.chipLabel}>SR Count</span>
          </div>
          <div className={styles.chip}>
            <span className={styles.chipValue} style={{ color: 'var(--dd-muted)' }}>
              {sr?.srP95Days ?? '--'}
            </span>
            <span className={styles.chipLabel}>P95 Days</span>
          </div>
        </div>
        <p className={styles.panelSubtitle} style={{ margin: '0.4rem 0 0', fontSize: '0.67rem' }}>
          {sr?.note ?? "Connect JIRA JQL filter `type = 'Service Request'` to populate"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 10C: JIRA ↔ PR ↔ Files linkage table
// ---------------------------------------------------------------------------
function JiraLinkagePanel({ jira }) {
  const [filter, setFilter] = React.useState('');
  const links = jira?.jiraLinks || [];

  const filtered = filter.trim()
    ? links.filter((row) => {
        const q = filter.toLowerCase();
        return (
          row.jiraKey?.toLowerCase().includes(q) ||
          row.summary?.toLowerCase().includes(q) ||
          String(row.prNumber).includes(q) ||
          row.files?.some((f) => f.toLowerCase().includes(q))
        );
      })
    : links;

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🔗</span>
        <h3 className={styles.panelTitle}>
          JIRA ↔ Pull Requests ↔ Files
          {jira?.isMock && <span className={styles.mockBadge}>mock data</span>}
        </h3>
      </div>
      <p className={styles.panelSubtitle}>
        Every JIRA ticket linked to its associated pull request and changed files.
        Populated from PR titles/bodies matching <code>[A-Z]+-\d+</code> and the GitHub Files API.
      </p>

      <div className={styles.filterBar}>
        <input
          className={styles.filterInput}
          type="text"
          placeholder="Filter by ticket, PR number, file path…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <span style={{ fontSize: '0.72rem', color: 'var(--dd-muted)' }}>
            {filtered.length} / {links.length} rows
          </span>
        )}
      </div>

      <div className={styles.scrollBox} style={{ maxHeight: '280px' }}>
        <table className={styles.linkageTable}>
          <thead>
            <tr>
              <th>JIRA Ticket</th>
              <th>Summary</th>
              <th>Status</th>
              <th>Pull Request</th>
              <th>Changed Files</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.empty}>No matching rows</td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={`${row.jiraKey}-${row.prNumber}`}>
                <td>
                  <span className={styles.linkageKey}>
                    {row.prUrl
                      ? <a href={row.prUrl} target="_blank" rel="noopener noreferrer">{row.jiraKey}</a>
                      : row.jiraKey}
                  </span>
                </td>
                <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={row.summary}>
                  {row.summary}
                </td>
                <td>
                  <StatusBadge
                    ok={row.status === 'Done'}
                    warn={row.status === 'In Progress'}
                    label={row.status}
                  />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {row.prNumber
                    ? <a href={row.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--dd-primary)', fontWeight: 600 }}>
                        #{row.prNumber}
                      </a>
                    : <span style={{ color: 'var(--dd-muted)' }}>—</span>}
                  {row.prTitle && (
                    <span style={{ color: 'var(--dd-muted)', fontSize: '0.65rem', marginLeft: '0.35rem' }}>
                      {row.prTitle}
                    </span>
                  )}
                </td>
                <td>
                  {row.files && row.files.length > 0
                    ? <div className={styles.linkageFiles}>
                        {row.files.map((f) => <span key={f}>{f}</span>)}
                      </div>
                    : <span style={{ color: 'var(--dd-muted)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL 11: UX Metrics (Microsoft Clarity)
// ---------------------------------------------------------------------------
function UXMetricsPanel({ clarity }) {
  if (!clarity) return null;
  const {
    isMock,
    sessions,
    avgSessionDurationSec,
    rageClickRate,
    deadClickRate,
    clickBackRate,
    jsErrorCount,
    scrollDepth,
    rageClickPages,
  } = clarity;

  const fmtPct  = (r) => `${(r * 100).toFixed(1)}%`;
  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const depthBuckets = [
    { label: '0–25%',   value: scrollDepth?.d25  ?? 0, color: '#003fbd' },
    { label: '25–50%',  value: scrollDepth?.d50  ?? 0, color: '#3498db' },
    { label: '50–75%',  value: scrollDepth?.d75  ?? 0, color: '#1abc9c' },
    { label: '75–100%', value: scrollDepth?.d100 ?? 0, color: '#2ecc71' },
  ];

  return (
    <div className={`${styles.panel} ${styles.panelWide}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelIcon}>🖱️</span>
        <h3 className={styles.panelTitle}>
          UX Metrics — Microsoft Clarity
          {isMock && <span className={styles.mockBadge}>mock data</span>}
        </h3>
      </div>
      <p className={styles.panelSubtitle}>
        Session quality · rage/dead clicks · scroll depth — 30-day rolling window.
        Set <code>CLARITY_API_KEY</code> + <code>CLARITY_PROJECT_ID</code> for live data.
      </p>

      {/* Top stat chips */}
      <div className={styles.chipRow}>
        <div className={styles.chip}>
          <span className={styles.chipValue}>{sessions?.toLocaleString() ?? '–'}</span>
          <span className={styles.chipLabel}>Sessions</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipValue}>{avgSessionDurationSec != null ? fmtTime(avgSessionDurationSec) : '–'}</span>
          <span className={styles.chipLabel}>Avg Duration</span>
        </div>
        <div className={styles.chip}>
          <span
            className={styles.chipValue}
            style={{ color: rageClickRate > 0.05 ? '#e74c3c' : rageClickRate > 0.02 ? '#f39c12' : '#2ecc71' }}
          >
            {rageClickRate != null ? fmtPct(rageClickRate) : '–'}
          </span>
          <span className={styles.chipLabel}>Rage Clicks</span>
        </div>
        <div className={styles.chip}>
          <span
            className={styles.chipValue}
            style={{ color: deadClickRate > 0.1 ? '#e74c3c' : deadClickRate > 0.05 ? '#f39c12' : '#2ecc71' }}
          >
            {deadClickRate != null ? fmtPct(deadClickRate) : '–'}
          </span>
          <span className={styles.chipLabel}>Dead Clicks</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipValue}
            style={{ color: clickBackRate > 0.15 ? '#e74c3c' : '#f39c12' }}
          >
            {clickBackRate != null ? fmtPct(clickBackRate) : '–'}
          </span>
          <span className={styles.chipLabel}>Click-Back</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipValue}
            style={{ color: jsErrorCount > 10 ? '#e74c3c' : jsErrorCount > 0 ? '#f39c12' : '#2ecc71' }}
          >
            {jsErrorCount ?? '–'}
          </span>
          <span className={styles.chipLabel}>JS Errors</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Scroll depth */}
        <div style={{ flex: '0 0 auto' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.6rem' }}>
            Scroll Depth (% sessions reaching depth)
          </p>
          <div className={styles.scrollDepthRow}>
            {depthBuckets.map(({ label, value, color }) => (
              <div key={label} className={styles.scrollDepthBar}>
                <span className={styles.scrollDepthPct}>{Math.round(value * 100)}%</span>
                <div
                  className={styles.scrollDepthFill}
                  style={{ height: `${Math.max(4, Math.round(value * 100))}%`, background: color }}
                />
                <span className={styles.scrollDepthLabel}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rage click hot pages */}
        <div style={{ flex: '1 1 220px' }}>
          <p className={styles.panelSubtitle} style={{ margin: '0 0 0.5rem' }}>
            🔥 Rage Click Hot Pages (top 5)
          </p>
          <table className={styles.clarityTable}>
            <thead>
              <tr><th>Page URL</th><th>Count</th></tr>
            </thead>
            <tbody>
              {(rageClickPages || []).map((p) => (
                <tr key={p.url}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>{p.url}</td>
                  <td style={{ fontWeight: 700, color: '#e74c3c', whiteSpace: 'nowrap' }}>{p.count}</td>
                </tr>
              ))}
              {(!rageClickPages || rageClickPages.length === 0) && (
                <tr><td colSpan={2} className={styles.empty}>No rage click data</td></tr>
              )}
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

  return (
    <div className={styles.dashboard}>
      <div className={styles.devNotice}>
        🛠 Developer Dashboard —{' '}
        <strong>dev only</strong>. This page is not visible in production.
        Data sourced from <code>static/build-report.json</code>.
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
        <ContentQualityPanel report={report} />

        {/* JIRA Metrics */}
        <div className={`${styles.panelWide}`} style={{ display: 'contents' }}>
          {/* Epic tracker + SR SLA side-by-side */}
          <div className={`${styles.tilesRow} ${styles.panelWide}`}>
            <JiraEpicPanel jira={report.jira} />
            <ServiceRequestPanel jira={report.jira} />
          </div>
          <JiraLinkagePanel jira={report.jira} />
        </div>

        {/* UX Metrics */}
        <UXMetricsPanel clarity={report.clarity} />
      </div>
    </div>
  );
}
