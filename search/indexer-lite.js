#!/usr/bin/env node

// Lightweight indexer without puppeteer dependency
// Perfect for local development on Apple Silicon Macs

const { Client } = require('@elastic/elasticsearch');
const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');
const cheerio = require('cheerio');
const { glob } = require('glob');

const md = new MarkdownIt();

// Configuration
const config = {
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    index: process.env.INDEX_NAME || 'rspamd-docs'
  },
  site: {
    docsPath: process.env.DOCS_PATH || '../docs'
  }
};

class LiteIndexer {
  constructor() {
    this.client = new Client({ node: config.elasticsearch.url });
    this.indexName = config.elasticsearch.index;
    this.docsPath = config.site.docsPath;
  }

  async init() {
    try {
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

    let indexed = 0;
    for (const filePath of markdownFiles) {
      try {
        await this.indexMarkdownFile(filePath);
        indexed++;
      } catch (error) {
        console.error(`Error indexing ${filePath}:`, error);
      }
    }
    
    console.log(`✓ Indexed ${indexed} markdown files`);
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

  async finalizeIndex() {
    await this.client.indices.refresh({ index: this.indexName });
    const stats = await this.client.count({ index: this.indexName });
    console.log(`✓ Indexing complete! Total documents: ${stats.count}`);
  }
}

async function main() {
  console.log('🚀 Starting Lite Indexer (Markdown only)');
  console.log('📝 This indexer works without browser dependencies');
  
  const indexer = new LiteIndexer();
  
  try {
    await indexer.init();
    await indexer.indexMarkdownFiles();
    await indexer.finalizeIndex();
    
    console.log('🎉 Lite indexing completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Indexing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { LiteIndexer }; 