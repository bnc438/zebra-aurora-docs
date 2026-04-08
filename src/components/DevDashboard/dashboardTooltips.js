/**
 * src/components/DevDashboard/dashboardTooltips.js
 * ============================================================================
 * Centralized tooltips and descriptions for all dashboard metrics.
 * Organized by panel for easy maintenance and i18n support.
 */

export const dashboardTooltips = {
  buildOverview: {
    title: 'Build Overview',
    description: 'High-level snapshot of documentation health and size.',
    metrics: {
      totalDocs: {
        label: 'Total Docs',
        tooltip: 'Complete count of all documentation files in the repository. Indicates overall documentation scope and coverage.',
      },
      totalWords: {
        label: 'Total Words',
        tooltip: 'Aggregate word count across all documents. Larger numbers indicate more comprehensive documentation.',
      },
      avgWords: {
        label: 'Avg Words/Doc',
        tooltip: 'Average words per document (Total Words ÷ Total Docs). Helps identify content depth—lower values may indicate thin or stub documentation.',
      },
      completeness: {
        label: 'Completeness',
        tooltip: 'Percentage of required frontmatter fields filled across all docs. Higher = better-structured metadata. Directly impacts searchability and SEO.',
      },
      healthScore: {
        label: 'Content Health Score',
        tooltip: 'Weighted score (0–100%) combining SEO completeness, title/description presence, and frontmatter metadata. Green (≥75%), Yellow (50–74%), Red (<50%).',
      },
      globalStability: {
        label: 'Global Stability',
        tooltip: 'Percentage of docs free from stability issues (missing required fields, broken links, duplicate titles, broken images). Higher = more stable.',
      },
      criticalAlerts: {
        label: 'Critical Alerts',
        tooltip: 'Count of critical issue categories detected: broken internal links, SSR guard violations, missing CSP configuration, critical CVEs.',
      },
      warningAlerts: {
        label: 'Warning Alerts',
        tooltip: 'Count of warning-level issue categories: duplicate titles, missing required frontmatter, orphaned sidebar docs, broken image references.',
      },
    },
  },

  schemaAnalytics: {
    title: 'Metadata Schema Analytics',
    description: 'Taxonomy and audience distribution—tracks which topics, devices, roles, and use cases are covered.',
    metrics: {
      deviceType: {
        label: 'Topics by Device Type',
        tooltip: 'Donut chart showing how many docs target each device (e.g., mobile, desktop, terminal). Gaps may indicate missing device coverage.',
      },
      roleUser: {
        label: 'Topics by Role / User',
        tooltip: 'Bar chart of content by intended audience (e.g., developer, administrator, manager). Ensures all user personas are represented.',
      },
      useCase: {
        label: 'Topics by Use Case',
        tooltip: 'Ranked bar chart of feature/capability coverage (e.g., "authentication," "reporting"). Most tagged use cases are documentation strengths.',
      },
      skillLevel: {
        label: 'Skill Level Distribution',
        tooltip: 'Donut chart showing beginner vs. intermediate vs. advanced content balance. Ensures documentation serves users at all levels.',
      },
      productName: {
        label: 'Topics by Product',
        tooltip: 'Bar chart of docs per product or feature family. Identifies which products have the most/least documentation.',
      },
    },
  },

  schemaIntelligence: {
    title: 'Schema Intelligence',
    description: 'Frontmatter field coverage and auto-generation detection.',
    metrics: {
      guessedFields: {
        label: 'Guessed Fields',
        tooltip: 'Total number of frontmatter fields auto-populated by the build system. Target: low/zero. High values indicate docs need manual review.',
      },
      docsWithGuesses: {
        label: 'Docs w/ Guesses',
        tooltip: 'Number of documents with at least one auto-guessed field. These docs need author review to validate auto-filled metadata.',
      },
      fullyAuthored: {
        label: 'Fully Authored',
        tooltip: 'Documents with zero auto-guessed fields—manually verified by authors. This is the goal.',
      },
      fieldCoverage: {
        label: 'Field Coverage',
        tooltip: 'Color-coded heatmap (green = ≥80% complete, yellow = 40–79%, red = <40%) showing which frontmatter fields are most/least filled across the corpus.',
      },
    },
  },

  dateFreshness: {
    title: 'Date & Freshness Analytics',
    description: 'Content age tracking and modification velocity—identifies outdated or recently updated material.',
    metrics: {
      fresh: {
        label: 'Fresh',
        tooltip: 'Count of docs modified in the last month. Indicates actively maintained, up-to-date content (green is good).',
        subtext: '< 30 days',
      },
      recent: {
        label: 'Recent',
        tooltip: 'Moderately recent updates. Still generally current.',
        subtext: '30–90 days',
      },
      aging: {
        label: 'Aging',
        tooltip: 'Content approaching potential obsolescence; may need review. Highlighted in yellow.',
        subtext: '90–180 days',
      },
      stale: {
        label: 'Stale',
        tooltip: 'Docs not updated in 6+ months. High risk of outdated information; requires immediate review. Red flag.',
        subtext: '> 180 days',
      },
      lastReviewedCoverage: {
        label: 'Last Reviewed Coverage',
        tooltip: 'Percentage of docs with a "last_reviewed" frontmatter field filled. Helps track formal review cycles independent of file modification dates.',
      },
      velocityChart: {
        label: 'Monthly Velocity',
        tooltip: 'Bar chart showing doc edits per month. Spikes indicate active development; flat lines suggest documentation neglect.',
      },
      recentlyModified: {
        label: 'Recently Modified',
        tooltip: 'Table of the latest updated docs. Quick reference for what\'s currently being maintained.',
      },
    },
  },

  seoHealth: {
    title: 'SEO Health',
    description: 'Search engine optimization readiness—critical for discoverability.',
    metrics: {
      seoScore: {
        label: 'SEO Score',
        tooltip: 'Aggregate score (0–100%) based on presence of title, description, keywords, and slug. Green (≥75%), Yellow (50–74%), Red (<50%).',
      },
      hasDescription: {
        label: 'Have Description',
        tooltip: 'Count/percentage of docs with frontmatter "description" field. Search engines display this; missing = lost visibility.',
      },
      hasTitle: {
        label: 'Has Title',
        tooltip: 'Docs with a proper title (required frontmatter). Page title is SEO-critical.',
      },
      hasKeywords: {
        label: 'Has Keywords',
        tooltip: 'Docs with keywords field populated. Aids search indexing and relevance.',
      },
      hasSlug: {
        label: 'Has Slug',
        tooltip: 'Docs with a custom slug for clean URLs. Good for UX and SEO.',
      },
    },
  },

  analytics: {
    title: 'Analytics',
    description: 'Publication status and analytics integration detection.',
    metrics: {
      gaStatus: {
        label: 'GA Status',
        tooltip: 'Shows Google Analytics integration status (Active, Tag present, Blocked, Not configured). Active = traffic data is being collected.',
      },
      published: {
        label: 'Published',
        tooltip: 'Count of docs with status: Published. Represents live, reader-facing content.',
      },
      draft: {
        label: 'Draft',
        tooltip: 'Docs still in draft status (hidden from readers by default). Should be actively worked toward completion.',
      },
      publishRate: {
        label: 'Publish Rate',
        tooltip: 'Percentage of docs published (Published ÷ Total). Target: ≥95%. Low rates require workflow review.',
      },
    },
  },

  contentPerformance: {
    title: 'Content Performance',
    description: 'Word count distribution and thin content detection—ensures sufficient depth.',
    metrics: {
      avgWords: {
        label: 'Avg Words',
        tooltip: 'Average length—higher is generally better for SEO and user trust (>300 words recommended).',
      },
      totalWords: {
        label: 'Total Words',
        tooltip: 'Cumulative documentation size. Larger corpus = more comprehensive coverage.',
      },
      thinDocs: {
        label: 'Thin Docs (<100w)',
        tooltip: 'Count of docs under 100 words. These may lack sufficient detail and should be expanded or removed.',
      },
      distribution: {
        label: 'Word Distribution',
        tooltip: 'Bar chart showing how many docs fall into each length bucket (0–100, 101–300, 301–600, 601–1000, 1000+). Ideally spread toward larger buckets.',
      },
      topDocs: {
        label: 'Top 5 by Length',
        tooltip: 'Table of the longest documents. Helps identify comprehensive guides or potential candidates for splitting.',
      },
    },
  },

  askai: {
    title: 'Ask AI Engine',
    description: 'Search index statistics—powers the intelligent search feature.',
    metrics: {
      records: {
        label: 'Records',
        tooltip: 'Total searchable records in the Ask AI index. Each record = searchable text chunk. More = richer search results.',
      },
      sourceDocs: {
        label: 'Source Docs',
        tooltip: 'Number of documentation files contributing to the index. Should match or nearly match Total Docs.',
      },
      indexSize: {
        label: 'Index Size',
        tooltip: 'File size of the search index in KB. Larger index = slower search, but more comprehensive.',
      },
      docCoverage: {
        label: 'Doc Coverage',
        tooltip: 'Percentage of source docs indexed. Target: 100% or near-100%. Low coverage = some docs invisible to search.',
      },
      sectionBreakdown: {
        label: 'By Section',
        tooltip: 'Bar chart showing search index distribution across major documentation sections. Identifies which sections have the richest searchable content.',
      },
      failedSearchEvents: {
        label: 'Failed Searches',
        tooltip: 'Total failed AskAI search events captured in browser storage for the selected week scope. Higher values indicate discovery gaps.',
      },
      failedSearchRows: {
        label: 'Aggregate Rows',
        tooltip: 'Weekly grouped failed-search records (query + normalized query + closest page). Used for triage and trend tracking.',
      },
      failedSearchConfidence: {
        label: 'Failed Search Confidence',
        tooltip: 'Weighted average confidence for failed-search outcomes. Lower values generally indicate poorer query-to-content relevance.',
      },
      failedSearchSignals: {
        label: 'Signals',
        tooltip: 'Detected content-gap signals (for example missing docs, synonym gaps, release-note discoverability issues) across visible failed-search rows.',
      },
    },
  },

  contentQuality: {
    title: 'Content Quality',
    description: 'Placeholder detection, missing metadata, and overall completeness scoring.',
    metrics: {
      placeholders: {
        label: 'Docs with Placeholders',
        tooltip: 'Count of docs containing placeholder text (e.g., [TODO], [YYYY-MM-DD], (Automated by build process)). Status: ✓ if 0, ⚠ if 1–10, ✗ if >10. All placeholders must be resolved before release.',
      },
      missingTitle: {
        label: 'Missing Title',
        tooltip: 'Docs lacking a title frontmatter field (required for publication).',
      },
      missingDescription: {
        label: 'Missing Description',
        tooltip: 'Docs without a description (impacts SEO and metadata display).',
      },
      missingKeywords: {
        label: 'Missing Keywords',
        tooltip: 'Docs without keywords field populated. Reduces search indexing quality.',
      },
      placeholdersByField: {
        label: 'Placeholders by Field',
        tooltip: 'Table showing how many docs have placeholders in each field. Helps prioritize cleanup.',
      },
      needsAttention: {
        label: 'Needs Attention',
        tooltip: 'Ranked table of 8 docs with lowest completeness score and most auto-guessed fields. Focus author effort here first.',
      },
    },
  },

  dashboardConfig: {
    title: 'Dashboard Config In Use',
    description: 'Tracked fields, required fields, and taxonomy settings loaded from dashboard config.',
    metrics: {
      trackedFields: {
        label: 'Tracked Fields',
        tooltip: 'Total number of frontmatter fields monitored by the dashboard/report pipeline.',
      },
      requiredFields: {
        label: 'Required Fields',
        tooltip: 'Count of tracked fields marked required in the dashboard config. Missing values directly reduce completeness.',
      },
      taxonomyFields: {
        label: 'Taxonomy Fields',
        tooltip: 'Fields used for grouping and analytics dimensions such as audience, role, product, or use case.',
      },
    },
  },

  accessibility: {
    title: 'Accessibility',
    description: 'A11y compliance scanning—ensures documentation is usable by all browsers and assistive technologies.',
    metrics: {
      a11yScore: {
        label: 'A11y Score',
        tooltip: 'Overall accessibility rating (0–100%). Green (≥90%), Yellow (70–89%), Red (<70%). Based on absence of common a11y issues.',
      },
      docsWithIssues: {
        label: 'Docs with Issues',
        tooltip: 'Count of documents with at least one accessibility violation. Target: 0. Common issues: missing alt text, broken heading hierarchy, vague links.',
      },
      imagesNoAlt: {
        label: 'Images No Alt',
        tooltip: 'Count of images missing alt text. Screen readers cannot describe unlabeled images. Critical for blind/low-vision users.',
      },
      vagueLinks: {
        label: 'Vague Links',
        tooltip: 'Links with generic text like "click here" or "read more" (poor for screen reader users and context). Prefer descriptive link text.',
      },
      headingSkips: {
        label: 'Heading Skips',
        tooltip: 'Instances where heading hierarchy is broken (e.g., jumping from H1 to H3). Confuses screen reader navigation.',
      },
      emptyHeadings: {
        label: 'Empty Headings',
        tooltip: 'Headings with no text content—causes confusion for visual and assistive users alike.',
      },
      contrastIssues: {
        label: 'Low Contrast Text',
        tooltip: 'Count of inline-styled text elements where explicit foreground/background color contrast is below WCAG AA threshold (4.5:1).',
      },
    },
  },

  buildStability: {
    title: 'Build Stability',
    description: 'Data integrity and structural consistency checks—catches build-breaking issues early.',
    metrics: {
      stabilityScore: {
        label: 'Stability Score',
        tooltip: 'Computed score (0–100%) penalizing critical issues (–10 pts each) and warnings (–3 pts each). Green (≥90%), Yellow (70–89%), Red (<70%).',
      },
      criticalIssues: {
        label: 'Critical Issues',
        tooltip: 'Sum of duplicate slugs + broken image references. These can break routing or user experience. Red flag.',
      },
      warnings: {
        label: 'Warnings',
        tooltip: 'Sum of missing required fields + invalid date formats + duplicate titles. Reduce data quality. Yellow flag.',
      },
      duplicateSlugs: {
        label: 'Duplicate Slugs',
        tooltip: 'URL paths that appear more than once—causes routing ambiguity. Each duplicate is listed. Critical: must be fixed.',
      },
      brokenImages: {
        label: 'Broken Images',
        tooltip: 'Count of images referenced but missing or with broken paths. Critical: breaks visual presentation.',
      },
      missingRequired: {
        label: 'Missing Required',
        tooltip: 'Docs lacking one or more required frontmatter fields. Blocks publication in some workflows.',
      },
      duplicateTitles: {
        label: 'Duplicate Titles',
        tooltip: 'Same title appears in multiple docs. Confusing for users and SEO. Should be unique.',
      },
    },
  },

  epicReleaseGate: {
    title: 'Epic Release Gate',
    description: 'Release-blocking view for epic closure across Jira tickets, support load, cycle time, and MDX churn.',
    metrics: {
      gateStatus: {
        label: 'Gate Status',
        tooltip: 'Overall release gate result from critical + warning checks. fail = block release, warn = review needed, pass = release criteria met.',
      },
      epicOpenNow: {
        label: 'Epic Open Now',
        tooltip: 'Current count of Story/Task/Sub-task tickets still open for the tracked epic. Target: 0 before production release.',
      },
      supportOpenNow: {
        label: 'Support Open Now',
        tooltip: 'Current count of support tickets opened during the epic window that are still open. Target: 0 before production release.',
      },
      supportResolutionDays: {
        label: 'Service TTR (Days)',
        tooltip: 'Weighted average time-to-resolution in days for closed service-related tickets collected in the epic window.',
      },
      cycleAvgDays: {
        label: 'Cycle Avg (Days)',
        tooltip: 'Weighted average ticket closure time in days for closed tickets tied to the epic. Helps identify throughput and delivery risk.',
      },
      mdxUniqueFiles: {
        label: 'MDX Unique Files Edited',
        tooltip: 'Unique MDX files changed during the epic window, based on git history between epic created and epic closed dates.',
      },
    },
  },

  userBehavior: {
    title: 'User Behavior',
    description: 'Engagement analytics from aurora-tracking — scroll depth, session duration, navigation patterns, and Microsoft Clarity readiness.',
    metrics: {
      pageViews: {
        label: 'Page Views',
        tooltip: 'Total page_view events captured from documentation pages during the metrics window.',
      },
      totalSessions: {
        label: 'Sessions',
        tooltip: 'Unique session count recorded during the metrics window.',
      },
      uniqueDocuments: {
        label: 'Unique Docs Visited',
        tooltip: 'Distinct documentation pages viewed across all sessions.',
      },
      avgSessionDuration: {
        label: 'Avg Session Duration',
        tooltip: 'Average session length in seconds. Long sessions indicate deep engagement; very short may signal confusion.',
      },
      avgScrollDepth: {
        label: 'Avg Scroll Depth',
        tooltip: 'Average maximum scroll percentage reached across all tracked scroll_depth events. Higher = users reading more content.',
      },
      scrollDistribution: {
        label: 'Scroll Depth Distribution',
        tooltip: 'Distribution of scroll depth across 0–25%, 25–50%, 50–75%, 75–100% buckets. Ideally weighted toward deeper reads.',
      },
      codeCopies: {
        label: 'Code Copy Events',
        tooltip: 'Number of times users copied code blocks. High values indicate actionable, developer-focused content.',
      },
      monacoOpens: {
        label: 'Monaco Editor Opens',
        tooltip: 'Number of times users opened the live code editor. Indicates interactive engagement with examples.',
      },
      pdfRequests: {
        label: 'PDF Downloads',
        tooltip: 'Button click events for PDF generation. Indicates demand for offline/printable documentation.',
      },
      topDocuments: {
        label: 'Top Documents',
        tooltip: 'Most-viewed documentation pages during the metrics window. Helps prioritize content investment.',
      },
      contentRequests: {
        label: 'Content Requests',
        tooltip: 'User-submitted content requests or questions captured via AskAI prompts.',
      },
      cesScore: {
        label: 'CES Score',
        tooltip: 'Customer Effort Score derived from event patterns. Lower effort = better experience. Target: ≤5.',
      },
      clarityStatus: {
        label: 'Microsoft Clarity',
        tooltip: 'Integration status for Microsoft Clarity (rage clicks, dead clicks, session recordings). Planned data source for UX frustration signals.',
      },
    },
  },

  lighthouseCI: {
    title: 'Lighthouse CI (ENG-10)',
    description: 'Performance, accessibility, best practices, and SEO scores from Lighthouse CI audits.',
    metrics: {
      performance: {
        label: 'Performance',
        tooltip: 'Lighthouse performance score (0–100). Measures load speed, interactivity, and visual stability. Required threshold: ≥85.',
      },
      accessibility: {
        label: 'Accessibility',
        tooltip: 'Lighthouse accessibility score (0–100). Measures ARIA, color contrast, and semantic HTML. Required threshold: ≥95.',
      },
      bestPractices: {
        label: 'Best Practices',
        tooltip: 'Lighthouse best practices score (0–100). Covers HTTPS, console errors, deprecated APIs. Required threshold: ≥90.',
      },
      seo: {
        label: 'SEO',
        tooltip: 'Lighthouse SEO score (0–100). Checks meta tags, crawlability, and structured data.',
      },
      lastAuditDate: {
        label: 'Last Audit',
        tooltip: 'Date of the most recent Lighthouse CI run. Stale audits may not reflect current site performance.',
      },
      auditUrl: {
        label: 'Audited URL',
        tooltip: 'The URL that was audited. Typically the production or staging homepage.',
      },
    },
  },

  playwrightE2E: {
    title: 'Playwright E2E (ENG-08)',
    description: 'End-to-end test results across Chromium, Firefox, and WebKit browsers.',
    metrics: {
      totalTests: {
        label: 'Total Tests',
        tooltip: 'Number of E2E test cases defined in the Playwright suite.',
      },
      passed: {
        label: 'Passed',
        tooltip: 'Test cases that completed successfully.',
      },
      failed: {
        label: 'Failed',
        tooltip: 'Test cases that failed. Any non-zero value should block release.',
      },
      skipped: {
        label: 'Skipped',
        tooltip: 'Test cases that were skipped (e.g., platform-specific or flaky tests).',
      },
      passRate: {
        label: 'Pass Rate',
        tooltip: 'Percentage of tests passing. Target: 100%. Below 95% indicates critical regression.',
      },
      browsers: {
        label: 'Browsers Tested',
        tooltip: 'Browsers included in the E2E run. Expected: Chromium, Firefox, WebKit.',
      },
      duration: {
        label: 'Suite Duration',
        tooltip: 'Total wall-clock time to run the complete E2E suite. Rising durations may indicate test bloat.',
      },
      lastRunDate: {
        label: 'Last Run',
        tooltip: 'Date/time of the most recent Playwright E2E run.',
      },
    },
  },

  engineeringTests: {
    title: 'Engineering Tests',
    description: '14 engineering procedures across P0 critical (ENG-01–07) and P1 important (ENG-08–14) tiers.',
    metrics: {
      eng02: {
        label: 'ENG-02 Required Fields',
        tooltip: 'MDX Frontmatter Validation. Docs missing one or more required frontmatter fields. Cross-referenced from Build Stability. Target: 0.',
      },
      ssrGuardViolations: {
        label: 'ENG-07 SSR Violations',
        tooltip: 'SSR/Hydration Mismatch. Source files in src/ using window/document/localStorage without useEffect, useLayoutEffect, BrowserOnly, or typeof window guards. 0 = clean.',
      },
      brokenInternalLinks: {
        label: 'ENG-09 Broken Links (static)',
        tooltip: 'Internal Link Detection (static). Relative markdown links in docs/ checked against docs/ filesystem. Partial coverage only — full crawl via linkinator requires a built site.',
      },
      sidebarOrphanedDocs: {
        label: 'ENG-11 Orphaned Sidebar IDs',
        tooltip: 'Plugin & Sidebar Config. Explicit doc IDs in sidebars.js with no matching file in docs/. Dynamic filesystem-scanned sections pass by design. Target: 0.',
      },
      cspConfigured: {
        label: 'ENG-13 CSP Configured',
        tooltip: 'CSP Header Validation. Detects Content-Security-Policy in docusaurus.config.js. Does not validate directives or run violation tests — that requires a live server.',
      },
      criticalCves: {
        label: 'ENG-14 High/Critical CVEs',
        tooltip: 'Dependency Vulnerability Audit. Count of high + critical severity CVEs from npm audit --json. null = audit unavailable (check network). Target: 0.',
      },
      ghaWorkflowCoverage: {
        label: 'GitHub Actions Workflow Coverage',
        tooltip: 'Percentage of planned CI gate workflows present in .github/workflows. Low coverage means PRs can merge without objective release gates.',
      },
      ghaPullRequestTriggers: {
        label: 'GitHub Actions PR Triggers',
        tooltip: 'How many planned workflows currently run on pull_request. Missing triggers means checks are defined but not enforced before merge.',
      },
      ghaSchedules: {
        label: 'Scheduled Jobs (Nightly/Weekly)',
        tooltip: 'Verifies nightly link scanning and weekly security scans exist. Missing schedules allows external-link rot and CVEs to accumulate silently.',
      },
      eng12Placeholder: {
        label: 'ENG-12 Translation Placeholder',
        tooltip: 'Translation readiness guard. Placeholder remains pending until i18n.locales includes non-English locales, then ENG-12 workflow should be activated.',
      },
      ghaRunStatusApi: {
        label: 'GitHub Run Status API',
        tooltip: 'Connection status for fetching latest workflow run outcomes from GitHub Actions. Requires GITHUB_TOKEN and repository slug.',
      },
      ghaRunPassed: {
        label: 'Latest Runs Passed',
        tooltip: 'Count of tracked GitHub Action gates whose most recent workflow run finished successfully.',
      },
      ghaRunFailed: {
        label: 'Latest Runs Failed',
        tooltip: 'Count of tracked gates whose latest run failed. Any non-zero value is a release risk and should be investigated before merge.',
      },
    },
  },

  i18nCoverage: {
    title: 'i18n Coverage',
    description: 'Translation coverage across supported locales. Supports ENG-12 gate activation.',
    metrics: {
      locales: {
        label: 'Locales',
        tooltip: 'Number of non-English locales with at least one translated document.',
      },
      translatedDocs: {
        label: 'Translated Docs',
        tooltip: 'Total translated documents across all locales.',
      },
      avgCoverage: {
        label: 'Avg Coverage',
        tooltip: 'Average percentage of source docs translated per locale. Target: ≥80% for production readiness.',
      },
    },
  },

  ditaMigration: {
    title: 'DITA Migration Progress',
    description: 'Tracks semantic loss issues from DITA-to-MDX conversion and remediation progress.',
    metrics: {
      totalIssues: {
        label: 'Total Issues',
        tooltip: 'Count of semantic loss issues detected across all migrated files.',
      },
      highSeverity: {
        label: 'High Severity',
        tooltip: 'Critical issues requiring immediate attention (e.g., lost content, broken structure).',
      },
      remediationScore: {
        label: 'Remediation Score',
        tooltip: 'Percentage of files without high-severity issues. Higher = closer to migration completion.',
      },
    },
  },

  brokenLinkTrend: {
    title: 'Broken Link Health',
    description: 'Internal link integrity analysis from build output (ENG-09).',
    metrics: {
      brokenLinks: {
        label: 'Broken Links',
        tooltip: 'Total count of internal links that resolve to non-existent pages.',
      },
      affectedDocs: {
        label: 'Affected Docs',
        tooltip: 'Number of source documents containing at least one broken link.',
      },
    },
  },

  dependencyFreshness: {
    title: 'Dependency Freshness',
    description: 'Package health and security posture. Complements ENG-14 CVE gate.',
    metrics: {
      criticalCves: {
        label: 'Critical CVEs',
        tooltip: 'High + critical severity vulnerabilities from npm audit. Target: 0.',
      },
      outdated: {
        label: 'Outdated',
        tooltip: 'Packages with newer versions available. High counts increase security and compatibility risk.',
      },
      majorBehind: {
        label: 'Major Behind',
        tooltip: 'Packages that are one or more major versions behind. These may have breaking changes when updated.',
      },
    },
  },

  pdfCoverage: {
    title: 'PDF Section Coverage',
    description: 'Per-section PDF generation status and render success rates.',
    metrics: {
      expectedPdfs: {
        label: 'Expected PDFs',
        tooltip: 'Number of documentation sections configured for PDF generation.',
      },
      renderSuccess: {
        label: 'Render Success',
        tooltip: 'Percentage of PDF renders that completed without errors.',
      },
      outputValidity: {
        label: 'Output Validity',
        tooltip: 'Percentage of generated PDFs that pass structural validation checks.',
      },
    },
  },

  docFeedback: {
    title: 'Doc Feedback',
    description: 'Aggregated thumbs-up/down feedback from the DocFeedbackWidget.',
    metrics: {
      helpful: {
        label: 'Helpful',
        tooltip: 'Total thumbs-up votes across all documents.',
      },
      notHelpful: {
        label: 'Not Helpful',
        tooltip: 'Total thumbs-down votes. High counts indicate content quality issues on specific pages.',
      },
      satisfaction: {
        label: 'Satisfaction',
        tooltip: 'Percentage of positive votes (thumbs-up / total votes). Target: ≥70%.',
      },
    },
  },
};

export default dashboardTooltips;
