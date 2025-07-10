#!/usr/bin/env node

const { Client } = require('@elastic/elasticsearch');
const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');
const cheerio = require('cheerio');
const { glob } = require('glob');
const axios = require('axios');

// Optional puppeteer dependency
let puppeteer = null;
try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.warn('⚠️  Puppeteer not available - rendered page indexing will be skipped');
}

const md = new MarkdownIt();

// Configuration
const config = {
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    index: process.env.INDEX_NAME || 'rspamd-docs'
  },
  site: {
    url: process.env.SITE_URL || 'http://localhost:3000',
    docsPath: process.env.DOCS_PATH || '../docs'
  }
};

class DocusaurusIndexer {
  constructor() {
    this.client = new Client({ node: config.elasticsearch.url });
    this.indexName = config.elasticsearch.index;
    this.siteUrl = config.site.url;
    this.docsPath = config.site.docsPath;
  }

  async init() {
    try {
      // Check if Elasticsearch is available
      await this.client.ping();
      console.log('✓ Connected to Elasticsearch');
      
      // Delete existing index if it exists
      try {
        await this.client.indices.delete({ index: this.indexName });
        console.log(`✓ Deleted existing index: ${this.indexName}`);
      } catch (error) {
        if (error.statusCode !== 404) {
          throw error;
        }
      }

      // Create new index with mapping
      await this.createIndex();
      console.log(`✓ Created index: ${this.indexName}`);
      
    } catch (error) {
      console.error('Failed to initialize:', error);
      process.exit(1);
    }
  }

  async createIndex() {
    const mapping = {
      mappings: {
        properties: {
          title: {
            type: 'text',
            analyzer: 'standard'
          },
          content: {
            type: 'text',
            analyzer: 'standard'
          },
          headings: {
            type: 'text',
            analyzer: 'standard'
          },
          url: {
            type: 'keyword'
          },
          path: {
            type: 'keyword'
          },
          section: {
            type: 'keyword'
          },
          tags: {
            type: 'keyword'
          },
          lastModified: {
            type: 'date'
          },
          hierarchy: {
            type: 'object',
            properties: {
              level: { type: 'integer' },
              title: { type: 'text' },
              url: { type: 'keyword' }
            }
          }
        }
      },
      settings: {
        analysis: {
          analyzer: {
            content_analyzer: {
              tokenizer: 'standard',
              filter: ['lowercase', 'stop', 'stemmer']
            }
          }
        }
      }
    };

    await this.client.indices.create({
      index: this.indexName,
      body: mapping
    });
  }

  async indexMarkdownFiles() {
    console.log('📁 Indexing markdown files...');
    
    const markdownFiles = await glob('**/*.{md,mdx}', {
      cwd: this.docsPath,
      absolute: true
    });

    for (const filePath of markdownFiles) {
      try {
        await this.indexMarkdownFile(filePath);
      } catch (error) {
        console.error(`Error indexing ${filePath}:`, error);
      }
    }
  }

  async indexMarkdownFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const { data: frontMatter, content: markdownContent } = matter(content);
    
    // Convert markdown to HTML
    const htmlContent = md.render(markdownContent);
    const $ = cheerio.load(htmlContent);
    
    // Extract text content
    const textContent = $.text();
    
    // Extract headings
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      headings.push($(el).text());
    });

    // Get relative path and URL
    const relativePath = path.relative(this.docsPath, filePath);
    const urlPath = relativePath
      .replace(/\.mdx?$/, '')
      .replace(/\/index$/, '')
      .replace(/\\/g, '/');
    
    const url = urlPath === 'index' ? '/' : `/${urlPath}`;
    
    // Determine section
    const section = this.getSection(relativePath);
    
    // Get file stats
    const stats = await fs.stat(filePath);
    
    const document = {
      title: frontMatter.title || this.extractTitle(markdownContent) || path.basename(filePath, path.extname(filePath)),
      content: textContent,
      headings: headings.join(' '),
      url: url,
      path: relativePath,
      section: section,
      tags: frontMatter.tags || [],
      lastModified: stats.mtime,
      hierarchy: this.buildHierarchy(relativePath)
    };

    await this.client.index({
      index: this.indexName,
      body: document
    });

    console.log(`✓ Indexed: ${relativePath} -> ${url}`);
  }

  extractTitle(content) {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : null;
  }

  getSection(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.length > 1) {
      return parts[0];
    }
    return 'root';
  }

  buildHierarchy(filePath) {
    const parts = filePath.split(path.sep);
    const hierarchy = [];
    
    for (let i = 0; i < parts.length - 1; i++) {
      hierarchy.push({
        level: i,
        title: parts[i],
        url: `/${parts.slice(0, i + 1).join('/')}`
      });
    }
    
    return hierarchy;
  }

  async indexRenderedPages() {
    console.log('🌐 Indexing rendered pages...');
    
    if (!puppeteer) {
      console.log('⏭️  Skipping rendered page indexing - puppeteer not available');
      return;
    }
    
    try {
      // Use puppeteer to get the sitemap or crawl the site
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote'
          ]
        });
      } catch (launchError) {
        console.log('⚠️  Failed to launch browser (this is normal on Apple Silicon Macs)');
        console.log('📝 Rendered page indexing will be skipped - markdown indexing will continue');
        return;
      }
      
      const page = await browser.newPage();
      
      // Try to get sitemap first
      const sitemapUrl = `${this.siteUrl}/sitemap.xml`;
      
      try {
        const response = await axios.get(sitemapUrl);
        const $ = cheerio.load(response.data, { xmlMode: true });
        
        const urls = [];
        $('url > loc').each((i, el) => {
          urls.push($(el).text());
        });
        
        for (const url of urls) {
          if (url.includes('/blog/') || url.includes('/changelog/')) {
            await this.indexRenderedPage(page, url);
          }
        }
      } catch (error) {
        console.log('No sitemap found, skipping rendered page indexing');
      }
      
      await browser.close();
    } catch (error) {
      console.log('⚠️  Error with rendered page indexing - continuing with markdown files only');
      console.log(`   Error: ${error.message}`);
    }
  }

  async indexRenderedPage(page, url) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      const content = await page.evaluate(() => {
        const article = document.querySelector('article, main, .markdown');
        if (article) {
          return {
            title: document.title,
            content: article.innerText,
            headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.innerText).join(' ')
          };
        }
        return null;
      });

      if (content) {
        const urlPath = new URL(url).pathname;
        
        const document = {
          title: content.title,
          content: content.content,
          headings: content.headings,
          url: urlPath,
          path: urlPath,
          section: this.getSectionFromUrl(urlPath),
          tags: [],
          lastModified: new Date(),
          hierarchy: this.buildHierarchyFromUrl(urlPath)
        };

        await this.client.index({
          index: this.indexName,
          body: document
        });

        console.log(`✓ Indexed rendered page: ${urlPath}`);
      }
    } catch (error) {
      console.error(`Error indexing rendered page ${url}:`, error);
    }
  }

  getSectionFromUrl(urlPath) {
    const parts = urlPath.split('/').filter(p => p);
    return parts[0] || 'root';
  }

  buildHierarchyFromUrl(urlPath) {
    const parts = urlPath.split('/').filter(p => p);
    const hierarchy = [];
    
    for (let i = 0; i < parts.length; i++) {
      hierarchy.push({
        level: i,
        title: parts[i],
        url: `/${parts.slice(0, i + 1).join('/')}`
      });
    }
    
    return hierarchy;
  }

  async finalizeIndex() {
    // Refresh the index to make documents searchable
    await this.client.indices.refresh({ index: this.indexName });
    
    // Get index stats
    const stats = await this.client.count({ index: this.indexName });
    console.log(`✓ Indexing complete! Total documents: ${stats.count}`);
  }
}

async function main() {
  const indexer = new DocusaurusIndexer();
  
  try {
    await indexer.init();
    await indexer.indexMarkdownFiles();
    await indexer.indexRenderedPages();
    await indexer.finalizeIndex();
    
    console.log('🎉 Indexing completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Indexing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DocusaurusIndexer }; 