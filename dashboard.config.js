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
   * Optional JIRA integration configuration.
   * When jiraBaseUrl + jiraToken + jiraEmail are set (or passed as env vars
   * JIRA_BASE_URL / JIRA_TOKEN / JIRA_EMAIL), generate-build-report.mjs will call
   * the JIRA REST API v3 to populate live epic data.
   * Leave blank to use the built-in mock seed data.
   *
   *   jiraBaseUrl  – e.g. "https://your-org.atlassian.net"
   *   projectKey   – e.g. "AURORA"
   *   epicKey      – e.g. "AURORA-42"  (current sprint epic)
   *   ghOwner      – GitHub owner for PR↔ticket linkage
   *   ghRepo       – GitHub repo  for PR↔ticket linkage
   */
  jira: {
    jiraBaseUrl: process.env.JIRA_BASE_URL || '',
    projectKey:  process.env.JIRA_PROJECT_KEY || 'AURORA',
    epicKey:     process.env.JIRA_EPIC_KEY    || '',
    ghOwner:     process.env.GH_OWNER         || '',
    ghRepo:      process.env.GH_REPO          || '',
  },

  /**
   * Optional Microsoft Clarity integration configuration.
   * When CLARITY_API_KEY env var is set, generate-build-report.mjs will call
   * the Clarity Data Export API to populate live UX metrics.
   * Leave blank to use the built-in mock seed data.
   *
   *   clarityProjectId – found in the Clarity project settings URL
   */
  clarity: {
    clarityProjectId: process.env.CLARITY_PROJECT_ID || '',
    clarityApiKey:    process.env.CLARITY_API_KEY     || '',
  },

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
};

module.exports = dashboardConfig;
