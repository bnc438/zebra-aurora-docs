// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const {themes} = require('prism-react-renderer');
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;
const enableInternalAnalytics =
  process.env.ASKAI_INTERNAL_ANALYTICS === 'true'
  || process.env.NODE_ENV !== 'production';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Zebra Machine Vision',
  tagline: 'Zebra Aurora Focus™ is a single, unified platform that makes it easy to set up, deploy and run all of Zebra’s Fixed Industrial Scanners and Machine Vision Smart Cameras – eliminating the need for different applications.',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: process.env.DOCUSAURUS_URL || 'https://bnc438.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: process.env.DOCUSAURUS_BASE_URL || '/',

  // GitHub pages deployment config.
  organizationName: 'bnc438',
  projectName: 'zebra-aurora-docs',

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  customFields: {
    /** True during `docusaurus start` (development), false in production builds. */
    isDev: process.env.NODE_ENV !== 'production',
    enableInternalAnalytics,
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl:
            'https://github.com/bnc438/zebra-aurora-docs/tree/main/',
        },
        pages: {
          exclude: enableInternalAnalytics ? [] : ['**/ask-ai-insights.{js,jsx,ts,tsx,md,mdx}'],
        },
        blog: false, // We disabled the blog.
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        docsRouteBasePath: ['/docs'],
        indexBlog: false,
        indexPages: true,
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      docs: {
        sidebar: {
          hideable: true,
        },
      },
      navbar: {
        title: 'Zebra Aurora Focus',
        logo: {
          alt: 'My Site Logo',
          src: 'img/z-logo-b.svg',
          srcDark: 'img/z-logo-bw.svg',
        },
        // THIS 'items' ARRAY IS THE MOST IMPORTANT PART
        items: [
          {
            to: '/docs/t-aurora-focus-getting-started-and-mdx-summary',
            position: 'left',
            label: 'Getting Started',
          },
          {
            to: '/docs/licensing/',
            position: 'left',
            label: 'Licensing',
          },
          {
            to: '/ask-ai',
            position: 'right',
            label: 'Ask AI',
          },
          ...(enableInternalAnalytics
            ? [
                {
                  to: '/ask-ai-insights',
                  position: 'right',
                  label: 'AskAI Insights',
                },
              ]
            : []),
        ],
      },
      footer: {
        style: 'dark',
        links: [],
        copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
