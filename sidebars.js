const fs = require('fs');
const path = require('path');

const userGuideDir = path.join(__dirname, 'docs', 'user-guide');

function getDocFileInfo(dirPath) {
  return fs
    .readdirSync(dirPath, {withFileTypes: true})
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => fileName.endsWith('.mdx'))
    .filter((fileName) => !fileName.startsWith('_'))
    .sort((a, b) => a.localeCompare(b));
}

const userGuideTopLevelItems = getDocFileInfo(userGuideDir)
  .filter((fileName) => fileName !== 'index.mdx')
  .map((fileName) => `user-guide/${fileName.replace(/\.mdx$/, '')}`);

const userGuideSectionOrder = [
  'about-this-guide',
  'aurora-focus-overview',
  'connectivity-gateway-solutions',
  'aurora-focus-web-hmi',
  'fixed-industrial-tools',
  'machine-vision-tools',
  'connectivity-guidelines',
  'troubleshooting',
  'regex',
  'zeti',
];

const userGuideSectionItems = fs
  .readdirSync(userGuideDir, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .filter((entry) => !entry.name.startsWith('_'))
  .sort((a, b) => {
    const indexA = userGuideSectionOrder.indexOf(a.name);
    const indexB = userGuideSectionOrder.indexOf(b.name);
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  })
  .map((entry) => {
    const sectionName = entry.name;
    const sectionDir = path.join(userGuideDir, sectionName);
    const files = getDocFileInfo(sectionDir);
    const sectionIndexExists = files.includes('index.mdx');
    const sectionDocItems = files
      .filter((fileName) => fileName !== 'index.mdx')
      .map((fileName) => `user-guide/${sectionName}/${fileName.replace(/\.mdx$/, '')}`);

    if (!sectionIndexExists && sectionDocItems.length === 0) {
      return null;
    }

    return {
      type: 'category',
      label: sectionName
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      ...(sectionIndexExists
        ? {link: {type: 'doc', id: `user-guide/${sectionName}/index`}}
        : {}),
      collapsible: true,
      collapsed: true,
      items: sectionDocItems,
    };
  })
  .filter(Boolean);

const userGuideItems = [...userGuideTopLevelItems, ...userGuideSectionItems];

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
