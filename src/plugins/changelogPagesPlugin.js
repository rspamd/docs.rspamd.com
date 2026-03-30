const path = require('path');
const fs = require('fs');

module.exports = function changelogPagesPlugin(context) {
  return {
    name: 'changelog-pages-plugin',

    async loadContent() {
      const { parseChangelogFile } = require(
        path.join(context.siteDir, 'scripts', 'generate-changelog-data')
      );
      const changelogsDir = path.join(context.siteDir, 'changelogs');
      if (!fs.existsSync(changelogsDir)) return [];

      return fs
        .readdirSync(changelogsDir)
        .filter(f => f.endsWith('.md') && !f.toLowerCase().includes('readme'))
        .map(file =>
          parseChangelogFile(
            fs.readFileSync(path.join(changelogsDir, file), 'utf8'),
            file
          )
        );
    },

    async contentLoaded({ content, actions }) {
      const { createData, addRoute } = actions;
      for (const release of content) {
        const dataPath = await createData(
          `changelog-${release.version}.json`,
          JSON.stringify(release)
        );
        addRoute({
          path: `/changelog/${release.version}`,
          component: '@site/src/components/ChangelogReleasePage',
          modules: { release: dataPath },
          exact: true,
        });
      }
    },
  };
};
