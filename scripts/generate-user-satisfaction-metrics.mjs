#!/usr/bin/env node
/**
 * User Satisfaction & Engagement Metrics Aggregation
 * 
 * Parses tracked user events from localStorage and generates:
 * - Content request tracking (CES feedback)
 * - Engagement metrics (code copies, Monaco opens, PDFs)
 * - Navigation patterns
 * - Performance metrics (scroll depth, time on page)
 * 
 * Usage: node scripts/generate-user-satisfaction-metrics.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const staticDir = path.join(projectRoot, 'static');
const dataDir = path.join(staticDir, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Get rolling window from env (default 30 days)
const ROLLING_WINDOW_DAYS = parseInt(process.env.METRICS_WINDOW_DAYS || '30', 10);
const WINDOW_START = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

function loadTrackedEvents() {
  /**
   * In production, events would be persisted to a backend.
   * For now, we load from demo data to show structure.
   * Actual implementation would read from your analytics backend.
   */
  const demoEventsPath = path.join(staticDir, 'demo-user-events.json');
  
  if (fs.existsSync(demoEventsPath)) {
    try {
      return JSON.parse(fs.readFileSync(demoEventsPath, 'utf-8'));
    } catch (error) {
      console.warn('[metrics] Could not load demo events:', error.message);
    }
  }

  return generateDemoEvents();
}

function generateDemoEvents() {
  /**
   * Generates realistic demo event data for the metrics report.
   * In production, these would come from actual user tracking.
   */
  const docs = [
    '/docs/js-guide/',
    '/docs/js-guide/t-aurora-js-getting-started/',
    '/docs/js-guide/t-aurora-js-using-the-javascript-editor/',
    '/docs/user-guide/',
    '/docs/release-notes/',
    '/docs/licensing/',
  ];

  const events = [];
  const now = Date.now();

  // Generate 200+ realistic events over the rolling window
  for (let i = 0; i < 250; i++) {
    const randomTime = now - Math.random() * ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const doc = docs[Math.floor(Math.random() * docs.length)];
    const sessionId = `session_${Math.floor(i / 10)}`; // Group events by session

    const eventTypes = ['page_view', 'code_copy', 'monaco_editor_open', 'pdf_button_click', 'scroll_depth', 'session_end', 'content_request'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    const event = {
      type: eventType,
      sessionId,
      docPath: doc,
      timestamp: new Date(randomTime).toISOString(),
      url: `http://localhost:3000${doc}`,
    };

    // Add type-specific metadata
    if (eventType === 'code_copy') {
      event.codeLanguage = ['javascript', 'json', 'xml', 'python'][Math.floor(Math.random() * 4)];
    } else if (eventType === 'monaco_editor_open') {
      event.codeLanguage = ['javascript', 'json'][Math.floor(Math.random() * 2)];
    } else if (eventType === 'scroll_depth') {
      event.percentScroll = [25, 50, 75, 100][Math.floor(Math.random() * 4)];
    } else if (eventType === 'session_end') {
      event.timeSpentSeconds = Math.floor(Math.random() * 600) + 10; // 10s to 10m
    } else if (eventType === 'content_request') {
      event.text = [
        'How do I debug JavaScript in the editor?',
        'Example for FTP file transfer',
        'More info on GPIO port control',
        'Troubleshooting Monaco editor issues',
      ][Math.floor(Math.random() * 4)];
      event.email = Math.random() > 0.3 ? `user${i % 20}@example.com` : 'anonymous';
    }

    events.push(event);
  }

  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function aggregateMetrics(events) {
  /**
   * Aggregates raw events into meaningful metrics
   */
  const metrics = {
    window: {
      startDate: WINDOW_START.toISOString(),
      endDate: new Date().toISOString(),
      days: ROLLING_WINDOW_DAYS,
    },
    summary: {
      totalEvents: 0,
      totalSessions: 0,
      uniqueDocuments: 0,
      eventsByType: {},
    },
    engagement: {
      codeExecution: {
        monacoOpens: 0,
        codeCopies: 0,
        topLanguages: {},
      },
      pdfGeneration: {
        requests: 0,
        topDocuments: {},
      },
      contentRequests: {
        total: 0,
        topRequests: [],
        byDocument: {},
      },
    },
    navigation: {
      pageViews: 0,
      topDocuments: {},
      sessionDuration: {
        average: 0,
        total: 0,
        samples: [],
      },
    },
    performance: {
      scrollDepth: {
        average: 0,
        distribution: {
          '0-25%': 0,
          '25-50%': 0,
          '50-75%': 0,
          '75-100%': 0,
        },
      },
      timeOnPage: {
        average: 0,
        median: 0,
      },
    },
  };

  const sessions = new Map();
  const contentRequests = new Map();
  const docPageViews = new Map();
  const scrollDepths = [];
  const sessionTimes = [];

  for (const event of events) {
    // Filter by window
    const eventTime = new Date(event.timestamp);
    if (eventTime < WINDOW_START) continue;

    metrics.summary.totalEvents++;
    metrics.summary.eventsByType[event.type] = (metrics.summary.eventsByType[event.type] || 0) + 1;

    // Track sessions
    if (event.sessionId && !sessions.has(event.sessionId)) {
      sessions.set(event.sessionId, []);
    }
    if (event.sessionId) {
      sessions.get(event.sessionId).push(event);
    }

    // Track unique docs
    if (!docPageViews.has(event.docPath)) {
      docPageViews.set(event.docPath, 0);
    }

    switch (event.type) {
      case 'page_view':
        metrics.navigation.pageViews++;
        docPageViews.set(event.docPath, (docPageViews.get(event.docPath) || 0) + 1);
        break;

      case 'monaco_editor_open':
        metrics.engagement.codeExecution.monacoOpens++;
        metrics.engagement.codeExecution.topLanguages[event.codeLanguage] =
          (metrics.engagement.codeExecution.topLanguages[event.codeLanguage] || 0) + 1;
        break;

      case 'code_copy':
        metrics.engagement.codeExecution.codeCopies++;
        metrics.engagement.codeExecution.topLanguages[event.codeLanguage] =
          (metrics.engagement.codeExecution.topLanguages[event.codeLanguage] || 0) + 1;
        break;

      case 'pdf_button_click':
        metrics.engagement.pdfGeneration.requests++;
        metrics.engagement.pdfGeneration.topDocuments[event.docPath] =
          (metrics.engagement.pdfGeneration.topDocuments[event.docPath] || 0) + 1;
        break;

      case 'content_request':
        metrics.engagement.contentRequests.total++;
        contentRequests.set(event.text, (contentRequests.get(event.text) || 0) + 1);
        metrics.engagement.contentRequests.byDocument[event.docPath] =
          (metrics.engagement.contentRequests.byDocument[event.docPath] || 0) + 1;
        break;

      case 'scroll_depth':
        scrollDepths.push(event.percentScroll);
        if (event.percentScroll <= 25) metrics.performance.scrollDepth.distribution['0-25%']++;
        else if (event.percentScroll <= 50)
          metrics.performance.scrollDepth.distribution['25-50%']++;
        else if (event.percentScroll <= 75)
          metrics.performance.scrollDepth.distribution['50-75%']++;
        else metrics.performance.scrollDepth.distribution['75-100%']++;
        break;

      case 'session_end':
        sessionTimes.push(event.timeSpentSeconds);
        break;
    }
  }

  // Calculate aggregates
  metrics.summary.totalSessions = sessions.size;
  metrics.summary.uniqueDocuments = docPageViews.size;

  // Top documents
  metrics.navigation.topDocuments = Array.from(docPageViews.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([doc, views]) => ({ document: doc, views }));

  // Top content requests
  metrics.engagement.contentRequests.topRequests = Array.from(contentRequests.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([request, count]) => ({ request, count }));

  // Scroll depth average
  if (scrollDepths.length > 0) {
    metrics.performance.scrollDepth.average = Math.round(
      scrollDepths.reduce((a, b) => a + b, 0) / scrollDepths.length
    );
  }

  // Session duration stats
  if (sessionTimes.length > 0) {
    metrics.navigation.sessionDuration.average = Math.round(
      sessionTimes.reduce((a, b) => a + b, 0) / sessionTimes.length
    );
    metrics.navigation.sessionDuration.total = sessionTimes.length;
    metrics.navigation.sessionDuration.median = Math.round(
      sessionTimes.sort((a, b) => a - b)[Math.floor(sessionTimes.length / 2)]
    );
    metrics.performance.timeOnPage.average = metrics.navigation.sessionDuration.average;
    metrics.performance.timeOnPage.median = metrics.navigation.sessionDuration.median;
  }

  // Code execution rate
  const totalEngagementEvents = metrics.engagement.codeExecution.monacoOpens +
    metrics.engagement.codeExecution.codeCopies +
    metrics.engagement.pdfGeneration.requests;
  metrics.engagement.executionRate = metrics.navigation.pageViews > 0
    ? Math.round((totalEngagementEvents / metrics.navigation.pageViews) * 100)
    : 0;

  // CES (Customer Effort Score) - satisfaction based on content requests
  metrics.ces = {
    score: Math.max(0, 100 - metrics.engagement.contentRequests.total * 2), // Lower satisfaction = more requests
    totalRequests: metrics.engagement.contentRequests.total,
    interpretation: metrics.engagement.contentRequests.total <= 5
      ? 'Excellent'
      : metrics.engagement.contentRequests.total <= 15
      ? 'Good'
      : 'Needs attention',
  };

  return metrics;
}

function generateReport() {
  console.log('[metrics] Generating user satisfaction metrics...\n');

  const events = loadTrackedEvents();
  console.log(`[metrics] Loaded ${events.length} events`);

  const metrics = aggregateMetrics(events);

  const report = {
    timestamp: new Date().toISOString(),
    metrics,
    notes: 'User satisfaction metrics based on event tracking from doc pages.',
  };

  // Save as separate file
  const outputPath = path.join(dataDir, 'user-satisfaction-metrics.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`[metrics] Report saved: ${outputPath}`);

  displaySummary(report);

  return report;
}

function displaySummary(report) {
  const { metrics } = report;

  console.log('\n═══════════════════════════════════════════════════');
  console.log('        USER SATISFACTION & ENGAGEMENT METRICS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`📊 Window: ${metrics.window.days} days (${metrics.window.startDate.split('T')[0]})`);
  console.log(`📈 Total Events: ${metrics.summary.totalEvents}`);
  console.log(`👥 Sessions: ${metrics.summary.totalSessions}`);
  console.log(`📄 Unique Docs: ${metrics.summary.uniqueDocuments}\n`);

  console.log('Code Execution & Engagement:');
  console.log(`  📝 Monaco Editor Opens: ${metrics.engagement.codeExecution.monacoOpens}`);
  console.log(`  📋 Code Copies: ${metrics.engagement.codeExecution.codeCopies}`);
  console.log(`  📄 PDF Requests: ${metrics.engagement.pdfGeneration.requests}`);
  console.log(`  ⚡ Execution Rate: ${metrics.engagement.executionRate}%\n`);

  console.log('Content Requests (CES):');
  console.log(`  🗨️  Total Requests: ${metrics.engagement.contentRequests.total}`);
  console.log(`  😊 CES Score: ${metrics.ces.score}/100 (${metrics.ces.interpretation})\n`);

  console.log('Navigation:');
  console.log(`  👁️  Page Views: ${metrics.navigation.pageViews}`);
  console.log(`  ⏱️  Avg Session: ${metrics.navigation.sessionDuration.average}s`);
  console.log(`  📍 Median Session: ${metrics.navigation.sessionDuration.median}s\n`);

  console.log('Performance:');
  console.log(`  📊 Avg Scroll Depth: ${metrics.performance.scrollDepth.average}%`);
  console.log(`  Distribution: ${JSON.stringify(metrics.performance.scrollDepth.distribution)}\n`);

  if (metrics.navigation.topDocuments.length > 0) {
    console.log('Top 5 Documents:');
    metrics.navigation.topDocuments.slice(0, 5).forEach((doc, i) => {
      console.log(`  ${i + 1}. ${doc.document} (${doc.views} views)`);
    });
    console.log('');
  }

  if (metrics.engagement.contentRequests.topRequests.length > 0) {
    console.log('Top Content Requests:');
    metrics.engagement.contentRequests.topRequests.slice(0, 5).forEach((req, i) => {
      console.log(`  ${i + 1}. "${req.request}" (${req.count}x)`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════\n');
}

try {
  generateReport();
} catch (error) {
  console.error('[metrics] Generation failed:', error);
  process.exit(1);
}
