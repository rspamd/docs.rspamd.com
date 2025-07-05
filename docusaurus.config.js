// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const isPr = process.env.GITHUB_EVENT_NAME === 'pull_request';
// Extract PR number from GITHUB_REF, which looks like "refs/pull/123/merge"
const prNumber = isPr ? process.env.GITHUB_REF.match(/^refs\/pull\/(\d+)\/merge$/)?.[1] : null;
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const branch = process.env.GITHUB_REF_NAME?.replace('refs/heads/', '');
// true for any branch‐build in GHA, false locally (no env var)
const isPreview = Boolean(branch);

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Rspamd Documentation',
  tagline: 'Fast, free and open-source spam filtering system',
  url: 'https://rspamd.com',

  baseUrl: isPr && prNumber
    ? `/${repoName}/pr/${prNumber}/`
    : isPreview && repoName
      ? `/${repoName}/branches/${branch}/`
      : '/',
  onBrokenLinks: 'ignore',
  onBrokenMarkdownLinks: 'ignore',
  favicon: 'img/favicon.png',
  markdown: {
    format: 'detect',
    mermaid: true,
    mdx1Compat: {
      comments: true,
      admonitions: true,
      headingIds: true,
    },
  },

  // GitHub pages deployment config
  organizationName: 'rspamd',
  projectName: 'docs.rspamd.com',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: '/',
          editUrl: 'https://github.com/rspamd/docs.rspamd.com/edit/master/',
          remarkPlugins: [
            [require('@docusaurus/remark-plugin-npm2yarn'), {sync: true}],
          ],
          rehypePlugins: [],
          beforeDefaultRemarkPlugins: [],
          beforeDefaultRehypePlugins: [],
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/rspamd/docs.rspamd.com/edit/master/',
          blogTitle: 'Rspamd Blog',
          blogDescription: 'News and updates from the Rspamd project',
          postsPerPage: 5,
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      algolia: {
        // The application ID provided by Algolia
        appId: 'CT62O5YTD2',
        // Public API key: it is safe to commit it
        apiKey: '6bbd22f8f2bfbbf74c9da23d2f4acdb0',
        indexName: 'rspamd',
        // Optional: see doc section below
        contextualSearch: true,
        // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
        externalUrlRegex: 'external\\.com|domain\\.com',
        // Optional: Algolia search parameters
        searchParameters: {},
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true,
        },
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: '',
        logo: {
          alt: 'Rspamd Logo',
          src: 'img/rspamd_logo_black.png',
          srcDark: 'img/rspamd_logo_navbar.png',
          href: 'https://www.rspamd.com',
          target: '_self',
        },
        items: [
          {
            type: 'doc',
            docId: 'index',
            position: 'left',
            label: 'Documentation',
          },
          {
            type: 'doc',
            docId: 'about/index',
            position: 'left',
            label: 'About',
          },
          {
            type: 'doc',
            docId: 'tutorials/index',
            position: 'left',
            label: 'Tutorials',
          },
          {
            type: 'doc',
            docId: 'modules/index',
            position: 'left',
            label: 'Modules',
          },
          {
            type: 'doc',
            docId: 'other/usage_policy',
            position: 'left',
            label: 'Usage Policy',
          },
          {
            type: 'doc',
            docId: 'faq',
            position: 'left',
            label: 'FAQ',
          },
          {
            type: 'doc',
            docId: 'support',
            position: 'left',
            label: 'Support',
          },
          {
            type: 'doc',
            docId: 'downloads',
            position: 'left',
            label: 'Downloads',
          },
          {
            to: '/blog',
            label: 'Blog',
            position: 'left',
          },
          {
            to: '/changelog',
            label: 'Changelog',
            position: 'left',
          },
          {
            type: 'html',
            position: 'right',
            value: '<div id="font-size-control-mount"></div>',
          },
          {
            href: 'https://github.com/rspamd/rspamd',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                to: '/tutorials/quickstart',
              },
              {
                label: 'Configuration',
                to: '/configuration',
              },
              {
                label: 'Modules',
                to: '/modules',
              },
              {
                label: 'Tutorials',
                to: '/tutorials',
              },
            ],
          },
          {
            title: 'Resources',
            items: [
              {
                label: 'Downloads',
                to: '/downloads',
              },
              {
                label: 'FAQ',
                to: '/faq',
              },
              {
                label: 'Support',
                to: '/support',
              },
              {
                label: 'Changelog',
                to: '/changelog',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/rspamd/rspamd',
              },
              {
                label: 'Contributing',
                to: '/tutorials/site_contributing',
              },
              {
                label: 'Blog',
                to: '/blog',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Rspamd Project. Built with Docusaurus.`,
      },
      prism: {
        theme: {
          plain: { color: "#393A34", backgroundColor: "#f6f8fa" },
          styles: [
            { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#999988", fontStyle: "italic" } },
            { types: ["namespace"], style: { opacity: 0.7 } },
            { types: ["string", "attr-value"], style: { color: "#e3116c" } },
            { types: ["punctuation", "operator"], style: { color: "#393A34" } },
            { types: ["entity", "url", "symbol", "number", "boolean", "variable", "constant", "property", "regex", "inserted"], style: { color: "#36acaa" } },
            { types: ["atrule", "keyword", "attr-name", "selector"], style: { color: "rgb(222, 71, 0)" } },
            { types: ["function", "deleted", "tag"], style: { color: "#d73a49" } },
            { types: ["function-variable"], style: { color: "#6f42c1" } },
            { types: ["tag", "selector", "keyword"], style: { color: "rgb(222, 71, 0)" } }
          ]
        },
        darkTheme: {
          plain: { color: "#F8F8F2", backgroundColor: "#282A36" },
          styles: [
            { types: ["prolog", "constant", "builtin"], style: { color: "rgb(189, 147, 249)" } },
            { types: ["inserted", "function"], style: { color: "rgb(80, 250, 123)" } },
            { types: ["deleted"], style: { color: "rgb(255, 85, 85)" } },
            { types: ["changed"], style: { color: "rgb(255, 184, 108)" } },
            { types: ["punctuation", "symbol"], style: { color: "rgb(248, 248, 242)" } },
            { types: ["string", "char", "tag", "selector"], style: { color: "rgb(255, 121, 198)" } },
            { types: ["keyword", "variable"], style: { color: "rgb(189, 147, 249)", fontStyle: "italic" } },
            { types: ["comment"], style: { color: "rgb(98, 114, 164)" } },
            { types: ["attr-name"], style: { color: "rgb(241, 250, 140)" } }
          ]
        },
        additionalLanguages: ['lua', 'nginx'],
      },
      mermaid: {
        theme: {
          light: 'default',
          dark: 'dark',
        },
        options: {
          securityLevel: 'loose',
          maxTextSize: 90000,
          maxEdges: 300,
          maxHeight: 5000,
          wrap: true,
        },
      },
    }),
};

module.exports = config;
