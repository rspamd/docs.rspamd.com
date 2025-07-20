# Rspamd Search Backend

A secure backend proxy service that sits between the Docusaurus frontend and Elasticsearch, providing security, rate limiting, and request validation.

## Features

- **Security**: Only allows read-only search operations, no write/delete operations
- **Rate Limiting**: Prevents abuse with per-IP rate limiting (30 requests/minute)
- **Request Validation**: Validates and sanitizes all search queries
- **CORS Protection**: Properly configured CORS headers for allowed origins
- **Request Logging**: Logs all search requests for monitoring
- **Error Handling**: Graceful error handling with appropriate HTTP status codes

## API Endpoints

### `POST /search`
Performs a search query against Elasticsearch.

**Request Body:**
```json
{
  "query": {
    "bool": {
      "should": [
        {
          "multi_match": {
            "query": "search term",
            "fields": ["title^3", "headings^2", "content"],
            "type": "best_fields",
            "fuzziness": "AUTO"
          }
        }
      ]
    }
  },
  "highlight": {
    "fields": {
      "title": {},
      "content": {
        "fragment_size": 150,
        "number_of_fragments": 3
      }
    }
  },
  "size": 20,
  "_source": ["title", "content", "url", "section", "hierarchy"]
}
```

**Response:**
```json
{
  "hits": {
    "total": { "value": 42 },
    "hits": [
      {
        "_id": "doc1",
        "_source": {
          "title": "Document Title",
          "content": "Document content...",
          "url": "/docs/example",
          "section": "docs",
          "hierarchy": ["Documentation", "Example"]
        },
        "_score": 1.5,
        "highlight": {
          "title": ["<mark>search</mark> term"],
          "content": ["Content with <mark>search</mark> term highlighted"]
        }
      }
    ]
  },
  "took": 15
}
```

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "rspamd-search-backend"
}
```

### `GET /status`
Returns index status information.

**Response:**
```json
{
  "index": "rspamd-docs",
  "documentCount": 150,
  "indexSize": 2048576,
  "status": "available"
}
```

## Security Features

### Rate Limiting
- **Search requests**: 30 requests per minute per IP
- **Status requests**: 10 requests per minute per IP
- **Speed limiting**: Progressive delays after 10 requests/minute

### Request Validation
- Strict JSON schema validation
- Maximum result size limits (50 documents max)
- Blocked dangerous operations (delete, update, create, script, etc.)
- Query string scanning for malicious content

### CORS Configuration
Allows requests from:
- `http://localhost:3000` (development)
- `https://docs.rspamd.com` (production)
- `https://*.rspamd.com` (subdomains)
- `https://rspamd.github.io` (GitHub Pages)

## Environment Variables

- `ELASTICSEARCH_URL`: Elasticsearch endpoint (default: `http://elasticsearch:9200`)
- `INDEX_NAME`: Index name (default: `rspamd-docs`)
- `PORT`: Server port (default: `3001`)

## Docker Integration

The backend runs as a Docker container and communicates with Elasticsearch through the internal Docker network. Only the backend's port 3001 is exposed to the host machine.

## Monitoring

The backend provides comprehensive logging:
- All search requests with IP, timestamp, and duration
- Error conditions with detailed error messages
- Service health status

## Security Best Practices

1. **No Direct Elasticsearch Access**: Frontend never talks directly to Elasticsearch
2. **Read-Only Operations**: Only search operations are allowed
3. **Input Validation**: All inputs are validated and sanitized
4. **Rate Limiting**: Prevents abuse and DoS attacks
5. **CORS Protection**: Restricts origins that can make requests
6. **Request Logging**: All requests are logged for monitoring

## Development

To run the backend locally:

```bash
cd search-backend
npm install
npm start
```

The backend will be available at `http://localhost:3001`. 