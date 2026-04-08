const fs = require('fs');
const path = require('path');

const userGuideDir = path.join(__dirname, 'docs', 'user-guide');

/**
 * Recursively build sidebar items for a directory.
 * - .mdx files become doc links
 * - Sub-directories become collapsible categories (with recursive children)
 * - index.mdx in a directory becomes the category link
 * @param {string} dirPath  Absolute path to scan
 * @param {string} docPrefix  Docusaurus doc-id prefix (e.g. 'user-guide/about-this-guide')
 * @param {string[]|null} orderHint  Optional ordered list of directory names for sorting
 */
function buildSidebarItems(dirPath, docPrefix, orderHint) {
  const entries = fs.readdirSync(dirPath, {withFileTypes: true});

  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.mdx') && !e.name.startsWith('_') && e.name !== 'index.mdx')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => `${docPrefix}/${e.name.replace(/\.mdx$/, '')}`);

  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .sort((a, b) => {
      if (!orderHint) return a.name.localeCompare(b.name);
      const iA = orderHint.indexOf(a.name);
      const iB = orderHint.indexOf(b.name);
      if (iA === -1 && iB === -1) return a.name.localeCompare(b.name);
      if (iA === -1) return 1;
      if (iB === -1) return -1;
      return iA - iB;
    })
    .map((e) => {
      const childDir = path.join(dirPath, e.name);
      const childPrefix = `${docPrefix}/${e.name}`;
      const hasIndex = fs.existsSync(path.join(childDir, 'index.mdx'));
      const childItems = buildSidebarItems(childDir, childPrefix, null);

      if (!hasIndex && childItems.length === 0) return null;

      return {
        type: 'category',
        label: e.name
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        ...(hasIndex ? {link: {type: 'doc', id: `${childPrefix}/index`}} : {}),
        collapsible: true,
        collapsed: true,
        items: childItems,
      };
    })
    .filter(Boolean);

  return [...files, ...dirs];
}

const userGuideSectionOrder = [
  'about-this-guide',
  'aurora-focus-overview',
  'getting-started',
  'ui-overview',
  'device-discovery',
  'device-mgmt-network-setup',
  'connectivity-gateway-solutions',
  'connect',
  'aurora-focus-web-hmi',
  'configuring-jobs',
  'build',
  'capture',
  'fixed-industrial-tools',
  'machine-vision-tools',
  'connectivity-guidelines',
  'troubleshooting',
  'regex',
  'zeti',
];

const userGuideItems = buildSidebarItems(userGuideDir, 'user-guide', userGuideSectionOrder);

const licensingDir = path.join(__dirname, 'docs', 'licensing');
const licensingItems = fs
  .readdirSync(licensingDir)
  .filter((fileName) => fileName.endsWith('.mdx'))
  .filter((fileName) => fileName !== 'index.mdx')
  .filter((fileName) => !fileName.startsWith('_'))
  .sort((a, b) => a.localeCompare(b))
  .map((fileName) => `licensing/${fileName.replace(/\.mdx$/, '')}`);

const releaseNotesDir = path.join(__dirname, 'docs', 'release-notes');
const releaseNotesItems = fs
  .readdirSync(releaseNotesDir)
  .filter((fileName) => /\.mdx?$/.test(fileName))
  .filter((fileName) => fileName !== 'index.mdx')
  .filter((fileName) => !fileName.startsWith('_'))
  .sort((a, b) => b.localeCompare(a))
  .map((fileName) => `release-notes/${fileName.replace(/\.mdx?$/, '')}`);

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  userGuideSidebar: [
    {
      type: 'category',
      label: 'User Guide',
      items: ['user-guide/index', ...userGuideItems],
    },
  ],
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      link: {type: 'doc', id: 'js-guide/t-aurora-focus-getting-started-and-mdx-summary'},
      items: ['js-guide/t-aurora-focus-getting-started-and-mdx-summary'],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: ['user-guide/index', ...userGuideItems],
    },
    {
      type: 'category',
      label: 'JavaScript Developers Guide',
      collapsible: true,
      collapsed: true,
      items: [
        'js-guide/index',
        {
          type: 'category',
          label: 'About this Guide',
          link: {type: 'doc', id: 'js-guide/t-aurora-js-about-this-guide'},
          collapsible: true,
          collapsed: true,
          items: ['js-guide/r-notational-conventions', 'js-guide/r-icon-conventions', 'js-guide/c-service-information'],
        },
        {
          type: 'category',
          label: 'Using the JavaScript Environment',
          link: {type: 'doc', id: 'js-guide/c-aurora-js-environment'},
          collapsible: true,
          collapsed: true,
          items: [
            'js-guide/t-aurora-js-using-the-javascript-editor',
            'js-guide/t-aurora-js-using-the-editor-for-a-deployed-job',
            'js-guide/t-aurora-js-limitations',
          ],
        },
        {
          type: 'category',
          label: 'Operation Mode',
          link: {type: 'doc', id: 'js-guide/t-aurora-js-operation-mode'},
          collapsible: true,
          collapsed: true,
          items: [
            'js-guide/c-aurora-js-program-structure',
            'js-guide/t-aurora-js-input-data',
            'js-guide/t-aurora-js-constant-data',
            'js-guide/t-aurora-js-output-data',
            'js-guide/t-aurora-scripting-job-status',
            'js-guide/t-aurora-scripting-tcpip-rs323-and-usb-cdc-serial',
            'js-guide/t-aurora-js-hid-keyboard',
            'js-guide/t-aurora-js-ftp-control',
            'js-guide/t-aurora-focus-js-gpio-ports',
            'js-guide/t-aurora-focus-js-beeper',
            'js-guide/t-aurora-js-script-invocation',
            'js-guide/c-aurora-js-example-script-lifecycle',
            'js-guide/t-aurora-js-managing-execution-time',
            'js-guide/c-aurora-js-text-encoding',
          ],
        },
        {
          type: 'category',
          label: 'Debugging, Advanced Techniques, and Sample Scripts',
          link: {type: 'doc', id: 'js-guide/t-aurora-js-sample-scripts-advanced-techniques-and-debugging'},
          collapsible: true,
          collapsed: true,
          items: [
            'js-guide/c-aurora-js-debugging',
            'js-guide/t-aurora-js-using-simulated-data',
            'js-guide/t-aurora-js-using-custom-templates',
            'js-guide/g-aurora-js-obtaining-the-device-mac-address',
            'js-guide/t-aurora-js-sample-scripts',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Licensing',
      items: ['licensing/index', ...licensingItems],
    },
    {
      type: 'category',
      label: 'Release Notes',
      items: ['release-notes/index', ...releaseNotesItems],
    },
  ],
};

module.exports = sidebars;
