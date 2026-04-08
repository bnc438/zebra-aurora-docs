/**
 * src/pages/dev-dashboard.js
 * ============================================================================
 * Developer Dashboard page — only renders in development builds.
 *
 * Guard: uses siteConfig.customFields.isDev (set in docusaurus.config.js).
 * In production the page returns a "not available" stub so no dashboard
 * code executes.
 *
 * Portability: this page works in any Docusaurus repo that has:
 *   1. customFields.isDev in docusaurus.config.js
 *   2. scripts/generate-build-report.mjs (produces static/build-report.json)
 *   3. src/components/DevDashboard/index.jsx
 */

import React from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

function NotAvailable() {
  return (
    <Layout title="Dev Dashboard" description="Developer dashboard (dev only)">
      <main style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <h1>Dev Dashboard</h1>
        <p style={{ color: 'var(--ifm-color-emphasis-600)' }}>
          This page is only available in development mode.
        </p>
        <p>
          Run <code>npm start</code> locally to access the developer dashboard.
        </p>
      </main>
    </Layout>
  );
}

export default function DevDashboardPage() {
  const { siteConfig } = useDocusaurusContext();
  const isDev = siteConfig.customFields?.isDev === true;

  if (!isDev) {
    return <NotAvailable />;
  }

  return (
    <Layout
      title="Dev Dashboard"
      description="Developer dashboard — build report, schema intelligence, SEO health, and more."
      noFooter={false}
    >
      {/* BrowserOnly ensures the dashboard (which fetches JSON) only runs in the browser */}
      <BrowserOnly fallback={<div style={{ padding: '2rem' }}>Loading dashboard…</div>}>
        {() => {
          // Dynamic import keeps the heavy DevDashboard component out of the SSR bundle
          const DevDashboard = require('@site/src/components/DevDashboard/index.jsx').default;
          return <DevDashboard />;
        }}
      </BrowserOnly>
    </Layout>
  );
}
