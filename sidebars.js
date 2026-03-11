const fs = require('fs');
const path = require('path');

const userGuideDir = path.join(__dirname, 'docs', 'user-guide');
const userGuideItems = fs
  .readdirSync(userGuideDir)
  .filter((fileName) => fileName.endsWith('.mdx'))
  .filter((fileName) => fileName !== 'index.mdx')
  .filter((fileName) => !fileName.startsWith('_'))
  .sort((a, b) => a.localeCompare(b))
  .map((fileName) => `user-guide/${fileName.replace(/\.mdx$/, '')}`);

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
      label: 'User Guide',
      items: ['user-guide/index', ...userGuideItems],
    },
    {
      type: 'category',
      label: 'JavaScript Developers Guide',
      collapsible: true,
      collapsed: true,
      items: [
        'index',
        {
          type: 'category',
          label: 'About this Guide',
          link: {type: 'doc', id: 't-aurora-js-about-this-guide'},
          collapsible: true,
          collapsed: true,
          items: ['r-notational-conventions', 'r-icon-conventions', 'c-service-information'],
        },
        {
          type: 'category',
          label: 'Using the JavaScript Environment',
          link: {type: 'doc', id: 'c-aurora-js-environment'},
          collapsible: true,
          collapsed: true,
          items: [
            't-aurora-js-using-the-javascript-editor',
            't-aurora-js-using-the-editor-for-a-deployed-job',
            't-aurora-js-limitations',
          ],
        },
        {
          type: 'category',
          label: 'Operation Mode',
          link: {type: 'doc', id: 't-aurora-js-operation-mode'},
          collapsible: true,
          collapsed: true,
          items: [
            'c-aurora-js-program-structure',
            't-aurora-js-input-data',
            't-aurora-js-constant-data',
            't-aurora-js-output-data',
            't-aurora-scripting-job-status',
            't-aurora-scripting-tcpip-rs323-and-usb-cdc-serial',
            't-aurora-js-hid-keyboard',
            't-aurora-js-ftp-control',
            't-aurora-focus-js-gpio-ports',
            't-aurora-focus-js-beeper',
            't-aurora-js-script-invocation',
            'c-aurora-js-example-script-lifecycle',
            't-aurora-js-managing-execution-time',
            'c-aurora-js-text-encoding',
          ],
        },
        {
          type: 'category',
          label: 'Debugging, Advanced Techniques, and Sample Scripts',
          link: {type: 'doc', id: 't-aurora-js-sample-scripts-advanced-techniques-and-debugging'},
          collapsible: true,
          collapsed: true,
          items: [
            'c-aurora-js-debugging',
            't-aurora-js-using-simulated-data',
            't-aurora-js-using-custom-templates',
            'g-aurora-js-obtaining-the-device-mac-address',
            't-aurora-js-sample-scripts',
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
