const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const axios = require('axios');
const Joi = require('joi');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
const INDEX_NAME = process.env.INDEX_NAME || 'rspamd-docs';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow for API usage
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://docs.rspamd.com',
    /^https:\/\/.*\.rspamd\.com$/,
    /^https:\/\/rspamd\.github\.io$/
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Forwarded-For', 'X-Real-IP'],
  credentials: false
}));

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Rate limiting - more restrictive for search
const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 requests per minute per IP
  message: {
    error: 'Too many search requests, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 1 * 60 * 1000, // 1 minute
  delayAfter: 10, // Allow 10 requests per minute at full speed
  delayMs: (hits) => hits * 100, // Add 100ms delay per request after delayAfter
  maxDelayMs: 2000, // Maximum delay of 2 seconds
});

// Search query validation schema
const searchQuerySchema = Joi.object({
  query: Joi.object({
    bool: Joi.object({
      should: Joi.array().items(Joi.object()).max(10)
    }).unknown(true)
  }).unknown(true),
  highlight: Joi.object().unknown(true),
  size: Joi.number().min(1).max(50).default(20),
  from: Joi.number().min(0).max(1000).default(0),
  _source: Joi.array().items(Joi.string()).max(20)
}).unknown(false); // Strict: only allow known fields

// Middleware to validate search requests
const validateSearchQuery = (req, res, next) => {
  const { error, value } = searchQuerySchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Invalid search query',
      details: error.details.map(d => d.message)
    });
  }
  
  // Additional security checks
  const queryString = JSON.stringify(value);
  
  // Block dangerous operations
  const blockedTerms = [
    'delete', 'update', 'create', 'index',
    '_delete_by_query', '_update_by_query',
    'script', 'eval', 'function_score'
  ];
  
  for (const term of blockedTerms) {
    if (queryString.toLowerCase().includes(term)) {
      return res.status(403).json({
        error: 'Forbidden query operation detected'
      });
    }
  }
  
  req.validatedQuery = value;
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'rspamd-search-backend'
  });
});

// Search endpoint
app.post('/search', searchRateLimit, speedLimiter, validateSearchQuery, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Log search request (without sensitive data)
    console.log(`🔍 Search request from ${req.ip} at ${new Date().toISOString()}`);
    
    const response = await axios.post(
      `${ELASTICSEARCH_URL}/${INDEX_NAME}/_search`,
      req.validatedQuery,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      }
    );
    
    const duration = Date.now() - startTime;
    console.log(`✅ Search completed in ${duration}ms, returned ${response.data.hits?.hits?.length || 0} results`);
    
    // Return only the hits and aggregations, strip internal ES metadata
    const sanitizedResponse = {
      hits: {
        total: response.data.hits.total,
        hits: response.data.hits.hits.map(hit => ({
          _id: hit._id,
          _source: hit._source,
          _score: hit._score,
          highlight: hit.highlight
        }))
      },
      took: response.data.took
    };
    
    res.json(sanitizedResponse);
    
  } catch (error) {
    console.error('❌ Search error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Search service temporarily unavailable'
      });
    }
    
    if (error.response) {
      // Elasticsearch returned an error
      const status = error.response.status;
      if (status === 400) {
        return res.status(400).json({
          error: 'Invalid search query'
        });
      } else if (status === 404) {
        return res.status(404).json({
          error: 'Search index not found'
        });
      }
    }
    
    res.status(500).json({
      error: 'Internal search error'
    });
  }
});

// Index status endpoint (read-only)
app.get('/status', rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10 // More restrictive for status endpoint
}), async (req, res) => {
  try {
    const response = await axios.get(`${ELASTICSEARCH_URL}/${INDEX_NAME}/_stats`, {
      timeout: 3000
    });
    
    res.json({
      index: INDEX_NAME,
      documentCount: response.data.indices[INDEX_NAME]?.total?.docs?.count || 0,
      indexSize: response.data.indices[INDEX_NAME]?.total?.store?.size_in_bytes || 0,
      status: 'available'
    });
    
  } catch (error) {
    console.error('❌ Status check error:', error.message);
    res.status(503).json({
      error: 'Search service status unavailable',
      index: INDEX_NAME,
      status: 'unavailable'
    });
  }
});

// Catch-all for unsupported methods/endpoints
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    supportedEndpoints: [
      'GET /health',
      'GET /status', 
      'POST /search'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Rspamd Search Backend running on port ${PORT}`);
  console.log(`📡 Elasticsearch URL: ${ELASTICSEARCH_URL}`);
  console.log(`📚 Index: ${INDEX_NAME}`);
  console.log(`🔒 Security features enabled: Rate limiting, CORS, Validation`);
}); 