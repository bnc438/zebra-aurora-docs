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
    },
  },

  schemaAnalytics: {
    title: 'Schema Analytics',
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
        tooltip: 'Total number of frontmatter fields auto-populated by the build system. High values = incomplete manual authoring. Target: low/zero.',
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
        tooltip: 'Percentage of docs published (Published ÷ Total). Target: ≥95%. Low rates suggest incomplete workflows.',
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
    },
  },

  contentQuality: {
    title: 'Content Quality',
    description: 'Placeholder detection, missing metadata, and overall completeness scoring.',
    metrics: {
      placeholders: {
        label: 'Docs with Placeholders',
        tooltip: 'Count of docs containing placeholder text (e.g., [TODO], [YYYY-MM-DD], (Automated by build process)). Status: ✓ if 0, ⚠ if 1–10, ✗ if >10.',
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
};

export default dashboardTooltips;
