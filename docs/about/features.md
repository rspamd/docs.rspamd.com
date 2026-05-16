---
title: Features
---

# Rspamd Features

Rspamd is a high-performance spam filtering system that combines traditional spam detection techniques with modern machine learning approaches. Each message is analyzed by multiple independent checks (called symbols) that contribute to a cumulative spam score. Based on this score and configurable thresholds, Rspamd recommends an action (reject, greylist, add header, or accept) to your mail server.

## Core Architecture Features

### Event-Driven Non-Blocking Architecture

Rspamd uses [libevent](https://libevent.org/) for asynchronous I/O operations, allowing a single worker process to handle thousands of concurrent connections without blocking.

**Technical details:**
- Non-blocking DNS lookups (hundreds of RBL/DKIM/SPF queries per message)
- Asynchronous Redis operations for statistics and learning
- Parallel HTTP requests to external services (antivirus, URL checkers)
- Async session tracking ensures no message is finalized until all checks complete

**Performance impact:**
- Single worker can process 100+ messages simultaneously
- Typical message scanning: 50-200ms (including all network operations)
- Memory footprint: ~50-100MB per worker process

See [Architecture documentation](/developers/architecture#event-driven-model) for internal details.

### Multi-Worker Process Model

Rspamd uses a master-worker architecture inspired by nginx:
- **Main process**: Configuration management, worker lifecycle, no message processing
- **Normal workers**: Message analysis and scoring
- **Proxy workers**: Protocol translation (milter, HTTP) and load balancing
- **Controller worker**: Web UI and management API
- **Fuzzy storage worker**: Distributed fuzzy hash storage

**Benefits:**
- Isolated processes improve stability (one worker crash doesn't affect others)
- Easy horizontal scaling (add more workers or servers)
- Zero-downtime configuration reloads (graceful worker restart)
- Per-worker resource limits prevent runaway processes

### Modular Plugin System

Over 60 built-in modules can be enabled/disabled/configured independently:

```hcl
# Example: Configure SPF module
# /etc/rspamd/local.d/spf.conf
external_relay = ["192.168.1.0/24"];  # Skip SPF for internal relays
whitelist = ["example.com"];          # Whitelist trusted domains
```

**Module categories:**
- **Authentication**: SPF, DKIM, DMARC, ARC
- **Content analysis**: Regex rules, MIME checks, language detection
- **External services**: Antivirus, URL redirector, GPT integration
- **Statistics**: Bayes classifier, neural networks, fuzzy hashing
- **Policies**: Rate limiting, greylisting, whitelisting, force actions
- **Exporting**: ClickHouse, Elastic, metadata exporter

See [Modules documentation](/modules/) for complete list.

### Flexible Configuration System

Rspamd uses [UCL (Universal Configuration Language)](/configuration/ucl) - a JSON-compatible format with includes and macros:

```hcl
# Base configuration
reject = 15;

# Include external file
.include(try=true) "/etc/rspamd/custom-thresholds.conf"

# Macros
.define MY_NETWORK "192.168.1.0/24"
whitelist_ip = "$MY_NETWORK";
```

**Configuration layers:**
1. Default config: `/etc/rspamd/rspamd.conf`
2. Module defaults: `/etc/rspamd/modules.d/*.conf`
3. Local overrides: `/etc/rspamd/local.d/*.conf` (recommended)
4. Force overrides: `/etc/rspamd/override.d/*.conf` (complete replacement)

See [Configuration fundamentals](/guides/configuration/fundamentals) for best practices.

## Advanced Analysis Features

### Email Authentication Standards

**SPF (Sender Policy Framework):**
- Validates sender IP against DNS records
- Supports includes, redirects, and complex policies
- Symbols: `R_SPF_ALLOW`, `R_SPF_FAIL`, `R_SPF_SOFTFAIL`, `R_SPF_NEUTRAL`, `R_SPF_PERMFAIL`

**DKIM (DomainKeys Identified Mail):**
- Verifies cryptographic signatures in email headers
- Supports multiple signatures per message
- Caches public keys in Redis for performance
- Symbols: `R_DKIM_ALLOW`, `R_DKIM_REJECT`, `R_DKIM_TEMPFAIL`, `R_DKIM_PERMFAIL`

**DMARC (Domain-based Message Authentication):**
- Combines SPF and DKIM results with domain policy
- Supports aggregate and forensic reporting
- Policy enforcement: none, quarantine, reject
- Symbols: `DMARC_POLICY_ALLOW`, `DMARC_POLICY_REJECT`, `DMARC_POLICY_QUARANTINE`, `DMARC_POLICY_SOFTFAIL`

**ARC (Authenticated Received Chain):**
- Preserves authentication results across forwarding
- Validates authentication chain integrity
- Essential for mailing lists and forwarders
- Symbols: `ARC_ALLOW`, `ARC_REJECT`, `ARC_INVALID`

See [SPF module](/modules/spf), [DKIM module](/modules/dkim), [DMARC module](/modules/dmarc), [ARC module](/modules/arc).

### Statistical Learning

**Bayesian Classification:**
- Token-based statistical analysis (words, patterns, metadata)
- Redis backend with automatic token expiration
- Per-user and per-language training support
- Autolearn mode: automatically train on high-confidence spam/ham

```hcl
# /etc/rspamd/local.d/classifier-bayes.conf
backend = "redis";
new_schema = true;
expire = 8640000;  # 100 days

autolearn {
  spam_threshold = 12.0;
  ham_threshold = -2.0;
  check_balance = true;
}
```

**Neural Networks:**
- Multi-layer perceptron with rule outputs as inputs
- Automatically learns optimal symbol weight combinations
- Separate networks for short/medium/long messages
- Requires Redis for weight storage

```hcl
# /etc/rspamd/local.d/neural.conf
rules {
  "NEURAL_SPAM" {
    train {
      max_trains = 10000;  # Training cycles
      max_usages = 100;    # Retrains after this many classifications
      spam_score = 8.0;    # Learn as spam if score >= 8
      ham_score = -2.0;    # Learn as ham if score <= -2
    }
  }
}
```

**Fuzzy Hashing:**
- Perceptual hashing identifies similar messages
- Resistant to minor content modifications
- Distributed storage with replication
- Encrypted communication between nodes

Use cases:
- Newsletter detection (shared fuzzy hash across servers)
- Spam campaign identification (similar messages)
- Hash sharing with trusted partners

See [Statistic configuration](/configuration/statistic), [Neural module](/modules/neural), [Fuzzy check module](/modules/fuzzy_check).

### Content Analysis

**Regular Expression Rules:**
- LuaJIT-optimized regex engine (Hyperscan on x86_64)
- Multi-expression matching in single pass
- Header, body, URL, and raw content matching

Example custom rule:
```lua
-- /etc/rspamd/lua.local.d/custom_rule.lua
-- `custom_rule` basename is arbitrary
rspamd_config.SUSPICIOUS_ATTACHMENT = {
  callback = function(task)
    local parts = task:get_parts()
    for _, part in ipairs(parts) do
      local ext = part:get_extension()
      if ext and (ext == "exe" or ext == "scr" or ext == "bat") then
        return true, 1.0, ext  -- Return true, weight 1.0, attachment extension
      end
    end
    return false
  end,
  score = 5.0,
  group = "malware",
  description = "Suspicious executable attachment"
}
```

**MIME Structure Analysis:**
- Malformed MIME detection
- Charset validation and conversion
- Attachment type checking
- HTML/text ratio analysis
- Embedded image analysis

**Language and Charset Detection:**
- Automatic language identification (60+ languages)
- Mixed charset detection (common in spam)
- UTF-8 validation
- CJK (Chinese, Japanese, Korean) support

**URL Processing:**
- Extracts URLs from HTML, text, and headers
- SURBL/URIBL lookups (real-time URL blacklists)
- URL redirector resolution (follows shortened URLs)
- Phishing detection (lookalike domains)
- TLD validation

See [Regexp module](/modules/regexp), [SURBL module](/modules/surbl), [Phishing module](/modules/phishing).

### Reputation and Blacklists

**RBL (Real-time Blackhole Lists):**
- Parallel DNS queries to multiple RBLs (50+ preconfigured)
- IP reputation: sender IP, email server IPs from headers
- Automatic retry logic and caching
- Configurable weights per RBL

Commonly used RBLs:
- Spamhaus (ZEN, DBL, PBL)
- SORBS
- SpamCop
- Barracuda
- URIBL (URL-based)

**ASN and Country Detection:**
- GeoIP2/MaxMind database integration
- ASN-based reputation scoring
- Country-specific rules

**IP Score Module:**
- Tracks IP reputation based on historical behavior
- Learns from user actions (spam/ham classification)
- Exponential decay for old data
- Whitelist trusted IPs automatically

See [RBL module](/modules/rbl), [ASN module](/modules/asn), [IP Score module](/modules/ip_score).

### Anti-Abuse Mechanisms

**Greylisting:**
- Temporary rejection of unknown sender/recipient pairs
- Legitimate MTAs retry within minutes; spambots don't
- Redis-backed triplet storage (IP, sender, recipient)
- Configurable delay and expiration

```hcl
# /etc/rspamd/local.d/greylist.conf
expire = 86400;      # 24 hours
timeout = 300;       # 5 minutes delay
whitelist_ip = [];   # IPs to skip greylisting
whitelist_rcpt = []; # Recipients to skip greylisting
```

**Rate Limiting:**
- Limits messages per time period by IP, sender, recipient, or custom selector
- Bucket-based rate limiting (token bucket algorithm)
- Multiple limit tiers (soft limits, hard limits)
- Redis-backed counters

```hcl
# /etc/rspamd/local.d/ratelimit.conf
rates {
  # Limit to 100 messages per hour per sender IP
  to = {
    bucket = {
      burst = 120;
      rate = "100 / 1h";
    }
  }

  # Limit to 1000 recipients per hour per authenticated user
  to_ip_from = {
    bucket = {
      burst = 1100;
      rate = "1000 / 1h";
    }
  }
}
```

**Spamtrap Detection:**
- Mark certain addresses as spamtraps
- Auto-learn as spam any message to spamtraps
- Feed spamtraps to Bayesian classifier
- Block sender IPs sending to spamtraps

See [Greylisting module](/modules/greylisting), [Ratelimit module](/modules/ratelimit), [Spamtrap module](/modules/spamtrap).

## Integration and Management

### Protocol Support

**HTTP/JSON API:**
- Native protocol for message scanning
- RESTful endpoints for management
- WebSocket support for real-time updates
- [HTTPCrypt encryption](/developers/encryption) for inter-server communication

Example API request:
```bash
curl -X POST http://localhost:11333/checkv2 \
  -H "Content-Type: message/rfc822" \
  --data-binary @message.eml
```

Response:
```json
{
  "action": "add header",
  "score": 8.5,
  "required_score": 15.0,
  "symbols": {
    "R_SPF_FAIL": {"score": 1.0},
    "BAYES_SPAM": {"score": 3.5, "options": ["0.95"]},
    "SUSPICIOUS_URL": {"score": 2.0}
  },
  "messages": [],
  "message-id": "msg-12345"
}
```

**Milter Protocol:**
- Compatible with Postfix, Sendmail, and other milter-capable MTAs
- Protocol translation via Proxy worker
- Support for all milter actions (reject, tempfail, add/remove headers, modify body)
- Multiplexing multiple messages over single connection

**Exim Protocol:**
- Native integration via Exim's spam scanner interface
- Support for Exim ACLs
- Per-recipient scanning

See [Protocol documentation](/developers/protocol), [Integration guide](/tutorials/integration).

### Web Interface

Modern single-page application for monitoring and management:

**Features:**
- Real-time message history with detailed symbol breakdown
- Live statistics and graphs (messages/sec, actions distribution)
- Bayesian training (learn spam/ham from web UI)
- Fuzzy hash management (add/delete hashes)
- Configuration validation
- Symbol and rule management
- Server cluster monitoring (multiple Rspamd instances)

**Access control:**
- Password-protected (bcrypt hashing)
- Separate read-only and enable passwords
- IP-based access restrictions
- Optional HTTPS with client certificates

**API endpoints:**
- `/stat` - Server statistics
- `/graph` - Historical data (requires ClickHouse or Redis)
- `/history` - Recent messages
- `/errors` - Error log
- `/learn_spam`, `/learn_ham` - Training endpoints
- `/saveactions` - Modify action thresholds

See [Controller worker](/workers/controller) documentation.

### Monitoring and Observability

**Built-in Metrics:**
- Message processing statistics (total, per action, per symbol)
- Performance metrics (scan time, DNS time, cache hit rate)
- Bayesian learning statistics (spam/ham ratio, token count)
- Connection statistics (active connections, total processed)

**Prometheus Integration:**
- `/metrics` endpoint in Prometheus format
- Metric exporter module for custom metrics
- Pre-built Grafana dashboards available

**Logging:**
- Structured JSON logging
- Syslog support
- Per-module log levels
- Request ID tracking for debugging

**Health Checks:**
- `/ping` - Liveness check (is Rspamd responding?)
- `/stat` - Readiness check (is Rspamd ready to process?)
- Systemd watchdog support

Example Prometheus query:
```promql
# Message processing rate
rate(rspamd_scanned_total[5m])

# Spam detection rate
rate(rspamd_spam_total[5m]) / rate(rspamd_scanned_total[5m])
```

See [Metric exporter module](/modules/metric_exporter).

## Deployment and Scalability

### High Availability

**Load Balancing:**
- Proxy worker can forward to multiple Normal workers
- Round-robin, hash-based, or least-connection algorithms
- Automatic failover on worker failure
- Health checks for backend workers

**Redis High Availability:**
- Redis Sentinel support for automatic failover
- Redis Cluster support for sharding
- Consistent hashing for multi-Redis setups
- Connection pooling and retry logic

**Fuzzy Storage Replication:**
- Master-slave replication for fuzzy hashes
- Mirroring mode: write to multiple storage nodes
- Encrypted replication channels

**Configuration Synchronization:**
- Centralized configuration management (version control)
- Configuration templating (Ansible, Puppet, Chef)
- Dynamic configuration updates via controller API

### Horizontal Scaling

**Typical deployment patterns:**

1. **Single server** (< 100K messages/day):
   ```
   MTA → Rspamd (proxy + normal + controller) → Redis
   ```

2. **Load-balanced** (100K - 1M messages/day):
   ```
                 ┌→ Rspamd Worker 1 ┐
   MTA → Rspamd Proxy →→ Rspamd Worker 2 → Redis
                 └→ Rspamd Worker 3 ┘
   ```

3. **Distributed** (> 1M messages/day):
   ```
   MTA Cluster → Hardware LB → Rspamd Proxy Cluster → Rspamd Worker Cluster → Redis Cluster
   ```

**Performance expectations:**
- Single worker: 5-10 messages/sec (500K-1M messages/day)
- 4-worker server: 20-40 messages/sec (2-3M messages/day)
- DNS resolver speed is often the bottleneck (use local recursive resolver)

See [Architecture deployment patterns](/developers/architecture#deployment-patterns).

### Security

**HTTPCrypt Protocol:**
- Lightweight encryption for inter-server communication
- X25519 key exchange + XChaCha20-Poly1305 encryption
- Forward secrecy with ephemeral keys
- No certificate management (public key cryptography)

```hcl
# Enable encryption between proxy and workers
# /etc/rspamd/local.d/worker-proxy.inc
upstream "backend" {
  hosts = "backend1.example.com:11333";
  encryption = {
    type = "httpcrypt";
    pubkey = "your-public-key-here";
  };
}
```

**Secure Defaults:**
- Web interface bound to localhost by default
- No open ports on public interfaces
- Minimal attack surface (no direct MTA protocol handling)
- Regular security updates

See [Encryption documentation](/developers/encryption) for cryptographic details.

### Resource Efficiency

**Memory Management:**
- Custom memory pools for per-message allocations
- Bulk deallocation when message processing completes
- Typical memory usage: 50-100MB per worker
- No memory leaks in core (valgrind-tested)

**CPU Optimization:**
- Zero-copy message handling where possible
- Regex engine optimization (Hyperscan on x86_64)
- LuaJIT for fast rule execution
- SIMD operations for fuzzy hashing

**Disk I/O:**
- Minimal disk writes (only logs)
- All working data in Redis (in-memory)
- Optional persistent history (SQLite or ClickHouse)

**Network Optimization:**
- Connection pooling for Redis, HTTP, and DNS
- Parallel DNS queries (configurable socket count)
- Keep-alive connections where supported
- Request pipelining for batch operations

## Extending Rspamd

### Lua Plugin Development

Write custom plugins in Lua with full access to Rspamd internals:

```lua
-- /etc/rspamd/plugins.d/sender_reputation.lua
local lua_redis = require "lua_redis"
local rspamd_logger = require "rspamd_logger"

-- Callback for checking sender reputation
local function check_sender_reputation(task)
  local from = task:get_from('smtp')
  if not from or not from[1] then
    return false
  end

  local sender = from[1].addr:lower()

  -- Async Redis callback
  local function redis_cb(err, data)
    if err then
      rspamd_logger.warnx(task, 'Redis error: %s', err)
      return
    end

    if data then
      local score = tonumber(data)
      if score and score > 10 then
        -- Insert result symbol with score
        task:insert_result('SENDER_BAD_REPUTATION', 1.0, string.format('score=%s', score))
      end
    end
  end

  -- Make async Redis request
  local redis_params = lua_redis.parse_redis_server('reputation')
  if redis_params then
    local ret = lua_redis.redis_make_request(task,
      redis_params,
      sender,
      false, -- is write
      redis_cb,
      'GET',
      {'sender_rep:' .. sender}
    )
    if not ret then
      rspamd_logger.warnx(task, 'Cannot make redis request')
    end
  end

  return false  -- Do not insert symbol here; will be inserted in callback
end

-- Register callback symbol (virtual, no score)
rspamd_config:register_symbol({
  name = 'SENDER_REPUTATION_CHECK',
  type = 'normal',
  callback = check_sender_reputation,
  flags = 'nice', -- Execute even if message is already spam
  priority = 5
})

-- Register result symbol (this gets the score)
rspamd_config:register_symbol({
  name = 'SENDER_BAD_REPUTATION',
  type = 'virtual',
  parent = 'SENDER_REPUTATION_CHECK',
  score = 5.0,
  group = 'reputation',
  description = 'Sender has bad reputation in our database'
})
```

**Key concepts for async operations:**
- Main callback registers a check symbol (virtual, no score)
- Async operations (Redis, DNS, HTTP) use callbacks to insert results
- Result symbols use `parent` to link to check symbol
- Main callback returns `false` (result inserted asynchronously via `task:insert_result()`)

**Lua API features:**
- Full message access (headers, body, attachments, MIME structure)
- Async operations (Redis, HTTP, DNS)
- Task manipulation (insert symbols, add/modify headers)
- Configuration access
- Logging and debugging

See [Writing rules](/developers/writing_rules) and [Lua API documentation](/lua/).

### External Service Integration

**Antivirus Scanning:**
- ClamAV, Sophos, F-Prot, Kaspersky, ESET support
- Parallel scanning with multiple engines
- Result caching to avoid re-scanning
- Timeout and retry handling

**URL Filtering:**
- Google Safe Browsing API
- OPH (Open Phish)
- Custom URL checkers via HTTP

**AI/ML Services:**
- GPT integration for content analysis
- Custom HTTP-based classifiers
- Verdict aggregation with existing rules

**Data Export:**
- ClickHouse for long-term analytics
- Elasticsearch for log aggregation
- Custom webhooks for message events

See [External services module](/modules/external_services), [Antivirus module](/modules/antivirus), [ClickHouse module](/modules/clickhouse).

## Migration from Other Systems

### SpamAssassin Compatibility

**Migration approach:**
- Rspamd can work alongside SpamAssassin during transition
- Compatible scoring system and similar rule concepts
- SpamAssassin module can import scores from SA configuration

**Differences from SpamAssassin:**
- Much faster (10-100x depending on ruleset)
- Event-driven architecture vs process-per-message
- Better handling of modern spam techniques (DMARC, ARC, neural networks)
- Statistical learning requires retraining (Bayes databases are not compatible)
- Different plugin architecture (Lua vs Perl)

**Migration strategy:**
1. Install Rspamd alongside SpamAssassin
2. Configure both to add headers (not reject) for testing
3. Compare results over several days
4. Retrain Bayesian classifier with your mail corpus
5. Gradually transition to Rspamd once confident

See [SpamAssassin migration guide](/tutorials/migrate_sa) for detailed migration steps.

## Comparison with Other Solutions

| Feature | Rspamd | SpamAssassin | Amavis | Rspamd Advantage |
|---------|--------|--------------|--------|------------------|
| **Performance** | 20-40 msg/sec/core | 2-4 msg/sec/core | 5-10 msg/sec/core | 10-100x faster |
| **Architecture** | Event-driven, async | Process-per-message | Process pool | Non-blocking I/O |
| **Memory usage** | 50-100MB/worker | 30-50MB/process | 100-200MB/process | Efficient memory pools |
| **Learning** | Bayes, Neural, Fuzzy | Bayes only | Via SpamAssassin | Multiple ML methods |
| **Configuration** | UCL (structured) | Plain text rules | Perl code | Type-safe, validated |
| **Web UI** | Modern SPA | None (third-party) | None | Built-in monitoring |
| **Protocol** | HTTP, Milter, native | Spamc/spamd | SMTP proxy | Flexible integration |
| **Real-time updates** | Dynamic rules via maps | Restart required | Restart required | No downtime |
| **Clustering** | Native support | Limited | No | Built-in load balancing |

See [Comparison page](/about/comparison) for detailed analysis.

## Community and Support

- **Documentation**: Comprehensive guides, API reference, examples
- **Community support**: [Support channels](/support) (Matrix, mailing list, GitHub)
- **Professional support**: Available from Rspamd developers and partners
- **Active development**: Regular releases, security updates, new features
- **Open source**: Apache 2.0 license, source code on [GitHub](https://github.com/rspamd/rspamd)

---

**Ready to start?** See [Installation Guide](/getting-started/installation) → [First Setup](/getting-started/first-setup) → [Configuration Fundamentals](/guides/configuration/fundamentals)
