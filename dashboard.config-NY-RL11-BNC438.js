/**
 * dashboard.config.js
 * ============================================================================
 * Defines the frontmatter fields to analyse for the dev dashboard build report.
 * Other Docusaurus repos can drop this file (plus scripts/generate-build-report.mjs
 * and src/pages/dev-dashboard.js) and get full analytics with zero code changes.
 *
 * Field schema:
 *   key        – exact YAML key in frontmatter
 *   label      – human-readable label for the dashboard
 *   required   – whether the field is required for a doc to be "complete"
 *   isArray    – whether the value is a YAML array (list of strings)
 *   chartType  – preferred chart type: 'donut' | 'bar' | 'progress'
 */

/** @type {{ fields: Array<{ key: string, label: string, required: boolean, isArray: boolean, chartType: string }>, placeholderPattern: RegExp }} */
const dashboardConfig = {
  /** Frontmatter fields tracked for coverage and taxonomy analysis. */
  fields: [
    { key: 'title',          label: 'Title',          required: true,  isArray: false, chartType: 'progress' },
    { key: 'description',    label: 'Description',    required: true,  isArray: false, chartType: 'progress' },
    { key: 'status',         label: 'Status',         required: true,  isArray: false, chartType: 'donut'    },
    { key: 'author',         label: 'Author',         required: false, isArray: false, chartType: 'bar'      },
    { key: 'content_type',   label: 'Content Type',   required: true,  isArray: false, chartType: 'donut'    },
    { key: 'device_type',    label: 'Device Type',    required: false, isArray: false, chartType: 'bar'      },
    { key: 'use_case',       label: 'Use Case',       required: false, isArray: true,  chartType: 'bar'      },
    { key: 'role',           label: 'Role',           required: false, isArray: true,  chartType: 'bar'      },
    { key: 'keywords',       label: 'Keywords',       required: false, isArray: true,  chartType: 'progress' },
    { key: 'product_name',   label: 'Product Name',   required: false, isArray: false, chartType: 'bar'      },
    { key: 'product_family', label: 'Product Family', required: false, isArray: false, chartType: 'donut'    },
    { key: 'last_reviewed',  label: 'Last Reviewed',  required: false, isArray: false, chartType: 'progress' },
    { key: 'version',        label: 'Version',        required: false, isArray: false, chartType: 'bar'      },
    { key: 'task',           label: 'Task',           required: false, isArray: false, chartType: 'bar'      },
    { key: 'skill_level',    label: 'Skill Level',    required: false, isArray: false, chartType: 'donut'    },
    { key: 'slug',           label: 'Slug',           required: false, isArray: false, chartType: 'progress' },
  ],

  /**
   * Regex that matches placeholder text in frontmatter values or body content.
   * Flags text like [Use Case 1], [YYYY-MM-DD], (Automated by build process), TODO, TBD.
   */
  placeholderPattern: /\[.*?\]|TODO|TBD|placeholder|\(Automated by build process\)/i,

  /**
   * Taxonomy fields whose unique values are enumerated in the aggregate report.
   * Must reference keys that exist in the `fields` array above.
   */
  taxonomyFields: [
    'status',
    'content_type',
    'device_type',
    'use_case',
    'role',
    'author',
    'product_family',
    'skill_level',
    'task',
    'product_name',
  ],

  /**
   * Dashboard tile metadata used by the Dev Dashboard UI.
   * Each metric tooltip explains what is measured and the target/optimal range.
   */
  dashboardTiles: {
    buildOverview: {
      description: 'High-level snapshot of documentation scale and metadata health.',
      metrics: {
        totalDocs: { label: 'Total Docs', tooltip: 'Measures the total number of documentation files included in the report. Optimal: steadily increasing with real product scope and no orphan/stub pages.' },
        totalWords: { label: 'Total Words', tooltip: 'Measures total written content volume across all docs. Optimal: sufficient depth for all topics, without unnecessary filler.' },
        avgWords: { label: 'Avg Words/Doc', tooltip: 'Measures average document length (total words divided by total docs). Optimal: typically 300+ words for substantive docs, with exceptions for quick references.' },
        completeness: { label: 'Completeness', tooltip: 'Measures percent of required frontmatter fields populated across docs. Optimal: 95-100%.' },
        healthScore: { label: 'Content Health Score', tooltip: 'Measures weighted health based on key metadata completeness signals. Optimal: 75%+ (green), ideally 90%+.' },
      },
    },

    schemaAnalytics: {
      description: 'Taxonomy distribution across devices, roles, use cases, skill levels, and products.',
      metrics: {
        deviceType: { label: 'Topics by Device Type', tooltip: 'Measures how docs are distributed by device_type taxonomy. Optimal: balanced coverage aligned to supported device portfolio.' },
        roleUser: { label: 'Topics by Role / User', tooltip: 'Measures distribution of docs by intended user role/persona. Optimal: strong representation for all priority personas.' },
        useCase: { label: 'Topics by Use Case', tooltip: 'Measures distribution of docs by tagged use_case values. Optimal: coverage across all critical customer workflows, not clustered in only a few tags.' },
        skillLevel: { label: 'Skill Level Distribution', tooltip: 'Measures beginner/intermediate/advanced balance. Optimal: mix aligned with audience needs, with clear on-ramp for beginners.' },
        productName: { label: 'Topics by Product', tooltip: 'Measures doc count by product_name. Optimal: documentation depth proportional to product priority and complexity.' },
      },
    },

    schemaIntelligence: {
      description: 'Field coverage and auto-generated metadata quality signals.',
      metrics: {
        guessedFields: { label: 'Guessed Fields', tooltip: 'Measures total frontmatter fields auto-populated by heuristics. Optimal: as low as possible, ideally 0.' },
        docsWithGuesses: { label: 'Docs w/ Guesses', tooltip: 'Measures number of docs containing at least one guessed field. Optimal: 0 or near 0.' },
        fullyAuthored: { label: 'Fully Authored', tooltip: 'Measures docs with no guessed fields. Optimal: as high as possible, ideally all docs.' },
        fieldCoverage: { label: 'Field Coverage', tooltip: 'Measures per-field completion percentages across the corpus. Optimal: all required fields in green (>=80%), ideally >=95%.' },
      },
    },

    dateFreshness: {
      description: 'Content recency and update cadence across the documentation set.',
      metrics: {
        fresh: { label: 'Fresh', tooltip: 'Measures docs updated in the last 30 days. Optimal: healthy share for actively changing areas.' },
        recent: { label: 'Recent', tooltip: 'Measures docs updated in 30-90 days. Optimal: substantial share indicating regular maintenance.' },
        aging: { label: 'Aging', tooltip: 'Measures docs updated in 90-180 days. Optimal: moderate and monitored.' },
        stale: { label: 'Stale', tooltip: 'Measures docs not updated for 180+ days. Optimal: as low as possible.' },
        lastReviewedCoverage: { label: 'Last Reviewed Coverage', tooltip: 'Measures percent of docs with last_reviewed populated. Optimal: 95-100%.' },
        velocityChart: { label: 'Monthly Velocity', tooltip: 'Measures monthly update activity. Optimal: consistent update cadence, avoiding long flat periods.' },
        recentlyModified: { label: 'Recently Modified', tooltip: 'Measures the latest updated docs list for quick triage. Optimal: reflects intentional, active maintenance.' },
      },
    },

    seoHealth: {
      description: 'Search discoverability readiness based on key metadata fields.',
      metrics: {
        seoScore: { label: 'SEO Score', tooltip: 'Measures aggregate metadata readiness (title, description, keywords, slug). Optimal: 75%+ minimum, ideally 90%+.' },
        hasDescription: { label: 'Have Description', tooltip: 'Measures docs with description frontmatter populated. Optimal: 100%.' },
        hasTitle: { label: 'Has Title', tooltip: 'Measures docs with title populated. Optimal: 100%.' },
        hasKeywords: { label: 'Has Keywords', tooltip: 'Measures docs with keywords populated. Optimal: near 100% for important pages.' },
        hasSlug: { label: 'Has Slug', tooltip: 'Measures docs with explicit slug metadata. Optimal: near 100% for stable, curated URLs.' },
      },
    },

    analytics: {
      description: 'Publication status and analytics instrumentation health.',
      metrics: {
        gaStatus: { label: 'GA Status', tooltip: 'Measures whether Google Analytics is detected and active. Optimal: Active in environments where analytics is expected.' },
        published: { label: 'Published', tooltip: 'Measures count of docs marked Published. Optimal: high count for mature documentation sets.' },
        draft: { label: 'Draft', tooltip: 'Measures count of docs still marked Draft. Optimal: low and actively decreasing.' },
        publishRate: { label: 'Publish Rate', tooltip: 'Measures Published divided by total docs. Optimal: >=95% for production-ready repositories.' },
      },
    },

    contentPerformance: {
      description: 'Content depth distribution and thin-page detection.',
      metrics: {
        avgWords: { label: 'Avg Words', tooltip: 'Measures average doc length. Optimal: generally 300+ words for deep topics, with concise exceptions.' },
        totalWords: { label: 'Total Words', tooltip: 'Measures total corpus size. Optimal: reflects complete coverage for all supported features.' },
        thinDocs: { label: 'Thin Docs (<100w)', tooltip: 'Measures docs with fewer than 100 words. Optimal: 0 or very low.' },
        distribution: { label: 'Word Distribution', tooltip: 'Measures how docs are spread across length buckets. Optimal: majority in mid/deep buckets, fewer ultra-short docs.' },
        topDocs: { label: 'Top 5 by Length', tooltip: 'Measures longest docs for visibility and possible split/refactor review. Optimal: long docs are intentional and well-structured.' },
      },
    },

    askai: {
      description: 'Ask AI index size, source coverage, and section distribution.',
      metrics: {
        records: { label: 'Records', tooltip: 'Measures total indexed search records/chunks. Optimal: complete indexing of all intended content.' },
        sourceDocs: { label: 'Source Docs', tooltip: 'Measures docs contributing to the Ask AI index. Optimal: near total documentation count.' },
        indexSize: { label: 'Index Size', tooltip: 'Measures serialized index size in KB. Optimal: as small as practical while retaining full answer quality.' },
        docCoverage: { label: 'Doc Coverage', tooltip: 'Measures percent of docs represented in the index. Optimal: 100% or near 100%.' },
        sectionBreakdown: { label: 'By Section', tooltip: 'Measures indexed records per section. Optimal: distribution aligned with section content volume and priority.' },
      },
    },

    contentQuality: {
      description: 'Placeholder hygiene and metadata completeness quality checks.',
      metrics: {
        placeholders: { label: 'Docs with Placeholders', tooltip: 'Measures docs containing placeholder-style text patterns. Optimal: 0.' },
        missingTitle: { label: 'Missing Title', tooltip: 'Measures docs missing title frontmatter. Optimal: 0.' },
        missingDescription: { label: 'Missing Description', tooltip: 'Measures docs missing description frontmatter. Optimal: 0.' },
        missingKeywords: { label: 'Missing Keywords', tooltip: 'Measures docs missing keywords frontmatter. Optimal: 0 or very low for non-reference pages.' },
        placeholdersByField: { label: 'Placeholders by Field', tooltip: 'Measures placeholder concentration by field for cleanup prioritization. Optimal: all fields at 0.' },
        needsAttention: { label: 'Needs Attention', tooltip: 'Measures lowest-quality docs by completeness/guessing. Optimal: list shrinks over time as docs are remediated.' },
      },
    },

    accessibility: {
      description: 'Static accessibility signal tracking for inclusive documentation quality.',
      metrics: {
        a11yScore: { label: 'A11y Score', tooltip: 'Measures aggregate accessibility quality based on common issue frequency. Optimal: 90%+.' },
        docsWithIssues: { label: 'Docs with Issues', tooltip: 'Measures docs with at least one accessibility issue. Optimal: 0.' },
        imagesNoAlt: { label: 'Images No Alt', tooltip: 'Measures image references missing alt text. Optimal: 0.' },
        vagueLinks: { label: 'Vague Links', tooltip: 'Measures non-descriptive link text instances. Optimal: 0.' },
        headingSkips: { label: 'Heading Skips', tooltip: 'Measures heading hierarchy skip occurrences. Optimal: 0.' },
        emptyHeadings: { label: 'Empty Headings', tooltip: 'Measures headings without text. Optimal: 0.' },
      },
    },

    buildStability: {
      description: 'Structural and metadata integrity checks that can impact build and UX reliability.',
      metrics: {
        stabilityScore: { label: 'Stability Score', tooltip: 'Measures overall stability after penalizing critical and warning-level issues. Optimal: 90%+.' },
        criticalIssues: { label: 'Critical Issues', tooltip: 'Measures critical problems like duplicate slugs and broken images. Optimal: 0.' },
        warnings: { label: 'Warnings', tooltip: 'Measures warning-level issues such as missing required metadata and invalid dates. Optimal: 0.' },
        duplicateSlugs: { label: 'Duplicate Slugs', tooltip: 'Measures conflicting URL slug occurrences. Optimal: 0.' },
        brokenImages: { label: 'Broken Images', tooltip: 'Measures broken/missing image references. Optimal: 0.' },
        missingRequired: { label: 'Missing Required', tooltip: 'Measures docs missing required frontmatter fields. Optimal: 0.' },
        duplicateTitles: { label: 'Duplicate Titles', tooltip: 'Measures repeated titles across docs. Optimal: 0 or intentionally rare.' },
      },
    },

    dashboardConfig: {
      description: 'Runtime view of the active dashboard configuration used to generate report data.',
      metrics: {
        trackedFields: { label: 'Tracked Fields', tooltip: 'Measures total configured frontmatter fields analyzed by the report pipeline. Optimal: includes all metadata fields you care about enforcing.' },
        requiredFields: { label: 'Required Fields', tooltip: 'Measures configured fields marked required for completeness scoring. Optimal: includes all mandatory publishing metadata and excludes optional taxonomy-only fields.' },
        taxonomyFields: { label: 'Taxonomy Fields', tooltip: 'Measures fields used for taxonomy breakdown charts and distributions. Optimal: includes stable categorization keys used for planning and content gaps.' },
      },
    },
  },
};

module.exports = dashboardConfig;
