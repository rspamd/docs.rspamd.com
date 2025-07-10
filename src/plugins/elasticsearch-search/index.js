const path = require('path');

module.exports = function (context, options) {
  const { siteConfig } = context;
  const { searchBackend } = options;

  return {
    name: 'elasticsearch-search',
    
    getClientModules() {
      return [path.resolve(__dirname, './client')];
    },

    configureWebpack(config, isServer) {
      return {
        resolve: {
          alias: {
            '@elasticsearch-search': path.resolve(__dirname),
          },
        },
      };
    },

    injectHtmlTags() {
      return {
        headTags: [
          {
            tagName: 'script',
            innerHTML: `
              window.SEARCH_BACKEND_CONFIG = ${JSON.stringify(searchBackend)};
            `,
          },
        ],
      };
    },


  };
}; 