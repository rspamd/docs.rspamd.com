#!/usr/bin/env node

const { DocusaurusIndexer } = require('./indexer');

// Configuration
const REINDEX_INTERVAL = parseInt(process.env.REINDEX_INTERVAL || '3600') * 1000; // Default 1 hour
const INITIAL_DELAY = parseInt(process.env.INITIAL_DELAY || '60') * 1000; // Wait 1 minute before first run

class AutoIndexer {
  constructor() {
    this.indexer = new DocusaurusIndexer();
    this.isRunning = false;
    this.intervalId = null;
  }

  async start() {
    console.log('🚀 Auto-indexer starting...');
    console.log(`📅 Initial delay: ${INITIAL_DELAY / 1000}s`);
    console.log(`⏰ Reindex interval: ${REINDEX_INTERVAL / 1000}s`);
    
    // Wait for initial delay
    await this.delay(INITIAL_DELAY);
    
    // Run initial indexing
    await this.runIndexing();
    
    // Set up periodic reindexing
    this.intervalId = setInterval(() => {
      this.runIndexing();
    }, REINDEX_INTERVAL);
    
    console.log('✅ Auto-indexer is running');
  }

  async runIndexing() {
    if (this.isRunning) {
      console.log('⏭️  Skipping indexing - already running');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('🔄 Starting scheduled indexing...');
      
      await this.indexer.init();
      await this.indexer.indexMarkdownFiles();
      await this.indexer.indexRenderedPages();
      await this.indexer.finalizeIndex();
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ Indexing completed in ${duration}s`);
      
    } catch (error) {
      console.error('❌ Indexing failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Auto-indexer stopped');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the auto-indexer
const autoIndexer = new AutoIndexer();
autoIndexer.start().catch(error => {
  console.error('❌ Failed to start auto-indexer:', error);
  process.exit(1);
}); 