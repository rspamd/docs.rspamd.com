---
title: Comparison
---

# Rspamd vs SpamAssassin

This comparison helps you understand the key differences between Rspamd and SpamAssassin, the two most popular open-source email filtering solutions. Both are mature, well-maintained projects with active communities, but they take fundamentally different approaches to spam filtering.

## Quick Summary

**Choose Rspamd if you need:**
- High-performance filtering (10-100x faster)
- Modern architecture with async I/O
- Built-in machine learning and neural networks
- Integrated web UI and management API
- Real-time configuration updates
- Native clustering and load balancing

**Choose SpamAssassin if you need:**
- Drop-in replacement for existing SA infrastructure
- Perl-based plugin ecosystem
- Simpler setup for small installations
- Compatibility with legacy Bayes databases

## Detailed Comparison

<div class="compare-table table-responsive">
  <table>
    <thead>
      <tr>
        <td class="col-4"></td>
        <td class="col-4"><img src="/img/rspamd_logo_small_black_simple.jpg" class="img-fluid"></td>
        <td class="col-4"><img src="/img/spamassassin_logo.jpg" class="img-fluid"></td>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th colspan="3">
          Architecture & Performance
        </th>
      </tr>
      <tr>
        <td>Written in</td>
        <td>C/C++ + Lua</td>
        <td>Perl</td>
      </tr>
      <tr>
        <td>Process model</td>
        <td>Event-driven async I/O (libevent)</td>
        <td>Pre-forked worker pool</td>
      </tr>
      <tr>
        <td>Performance (msg/sec/core)</td>
        <td><strong>5-10 messages/sec</strong><br/>(500K-1M msg/day per worker)</td>
        <td>0.5-2 messages/sec<br/>(50K-200K msg/day per worker)</td>
      </tr>
      <tr>
        <td>Typical scan time</td>
        <td><strong>50-200ms</strong> including network ops</td>
        <td>200ms-2s depending on rules</td>
      </tr>
      <tr>
        <td>Memory per process</td>
        <td>50-100MB per worker</td>
        <td>30-50MB per worker</td>
      </tr>
      <tr>
        <td>Concurrent processing</td>
        <td><strong>100+ messages simultaneously</strong> per worker</td>
        <td>1 message per worker process</td>
      </tr>
      <tr>
        <td>DNS queries</td>
        <td>Async, non-blocking, parallel</td>
        <td>Sequential or limited parallelism</td>
      </tr>
      <tr>
        <th colspan="3">
          Integration & Management
        </th>
      </tr>
      <tr>
        <td>MTA integration</td>
        <td>HTTP/JSON API, Milter, Exim protocol</td>
        <td>Spamc/Spamd protocol, Milter (via Amavis)</td>
      </tr>
      <tr>
        <td>Web interface</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Built-in modern SPA</strong><br/>Real-time stats, history, training, config</td>
        <td><span class="fa-regular fa-lg fa-circle-question"></span> 3rd party solutions only</td>
      </tr>
      <tr>
        <td>Management API</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>RESTful HTTP API</strong><br/>Full control, metrics, training</td>
        <td>Limited (spamc protocol)</td>
      </tr>
      <tr>
        <td>Configuration format</td>
        <td><strong>UCL</strong> (JSON-compatible, typed)<br/>Includes, macros, validation</td>
        <td>Custom text format<br/>Perl-style syntax</td>
      </tr>
      <tr>
        <td>Dynamic updates</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Zero-downtime reload</strong><br/>Maps update without restart</td>
        <td>Requires process restart</td>
      </tr>
      <tr>
        <td>Monitoring</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Prometheus metrics</strong><br/>Structured JSON logs</td>
        <td>Syslog, limited metrics</td>
      </tr>
      <tr>
        <td>Scripting/Plugins</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Lua API</strong> (LuaJIT)<br/>Fast, sandboxed, async support</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Perl plugins<br/>Full Perl ecosystem</td>
      </tr>
      <tr>
        <th colspan="3">
          Email Authentication
        </th>
      </tr>
      <tr>
        <td>SPF</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Full implementation</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Full implementation</td>
      </tr>
      <tr>
        <td>DKIM</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Verify + Sign<br/>Multiple signatures, key caching</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Verify only<br/>(sign via external tools)</td>
      </tr>
      <tr>
        <td>DMARC</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Full implementation</strong><br/>Policy enforcement + reporting</td>
        <td><span class="fa-regular fa-lg fa-circle-question"></span> 3rd party plugins</td>
      </tr>
      <tr>
        <td>ARC</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Verify + Sign</strong><br/>Essential for forwarding/lists</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span> Limited/no support</td>
      </tr>
      <tr>
        <td>BIMI</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Brand indicators support</strong><br/>VMC validation</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span></td>
      </tr>
      <tr>
        <th colspan="3">
          Content Analysis
        </th>
      </tr>
      <tr>
        <td>Regular expressions</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Hyperscan on x86_64</strong><br/>Multi-pattern matching, very fast</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Perl PCRE</td>
      </tr>
      <tr>
        <td>Language detection</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>60+ languages</strong><br/>UTF-8 normalization, CJK support</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> UTF-8 support (v4+)<br/>Limited language detection</td>
      </tr>
      <tr>
        <td>HTML parsing</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Custom C++ parser</strong><br/>Structure analysis, obfuscation detection</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Regex-based rules</td>
      </tr>
      <tr>
        <td>PDF filtering</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Custom parser<br/>Metadata & content extraction</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Basic support</td>
      </tr>
      <tr>
        <td>Phishing detection</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Advanced</strong><br/>Lookalike domains, URL redirector, external feeds</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Basic URL checks</td>
      </tr>
      <tr>
        <th colspan="3">
          Reputation & Blacklists
        </th>
      </tr>
      <tr>
        <td>DNS blacklists (RBL)</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> 50+ preconfigured<br/>Async parallel queries</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Standard RBL support</td>
      </tr>
      <tr>
        <td>URL blacklists (SURBL)</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Full support + URL extraction</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Full support</td>
      </tr>
      <tr>
        <td>Custom maps/lists</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Dynamic reload</strong><br/>HTTP/file maps, regex/glob matching</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Static files<br/>Requires restart</td>
      </tr>
      <tr>
        <td>IP reputation</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Built-in learning</strong><br/>Automatic scoring from history</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span> Manual configuration</td>
      </tr>
      <tr>
        <th colspan="3">
          Statistical Classification
        </th>
      </tr>
      <tr>
        <td>Bayes classifier</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>2-word window</strong><br/>Better context awareness</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> 1-word (unigram)</td>
      </tr>
      <tr>
        <td>Bayes autolearn</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Custom Lua rules</strong><br/>Token expiry, per-user/language</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Threshold-based</td>
      </tr>
      <tr>
        <td>Neural networks</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Multi-layer perceptron</strong><br/>Automatic weight optimization via kann<br/>Separate networks by message size</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span></td>
      </tr>
      <tr>
        <td>Fuzzy hashing</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Built-in distributed storage</strong><br/>Replication, encryption, clustering</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span> External (Pyzor, DCC, Razor)</td>
      </tr>
      <tr>
        <td>Razor support</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span></td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span></td>
      </tr>
      <tr>
        <td>DCC support</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span></td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span></td>
      </tr>
      <tr>
        <td>Pyzor support</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span></td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span></td>
      </tr>
      <tr>
        <th colspan="3">
          Data Storage Backends
        </th>
      </tr>
      <tr>
        <td>Redis</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Primary backend</strong><br/>Sentinel/Cluster support, connection pooling</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Optional (3rd party)</td>
      </tr>
      <tr>
        <td>SQLite</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span></td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span></td>
      </tr>
      <tr>
        <td>MySQL/PostgreSQL</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span> Use Redis instead</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span></td>
      </tr>
      <tr>
        <td>File-based</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> For small setups</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span></td>
      </tr>
      <tr>
        <th colspan="3">
          Policy & Anti-Abuse
        </th>
      </tr>
      <tr>
        <td>Greylisting</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Built-in</strong><br/>Redis-backed, configurable delays</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span> External (milter-greylist)</td>
      </tr>
      <tr>
        <td>Rate limiting</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Flexible rules</strong><br/>By IP, sender, rcpt, user, custom</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span> External tools</td>
      </tr>
      <tr>
        <td>Reply tracking</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Whitelist replied senders</strong><br/>Automatic reputation boost</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span></td>
      </tr>
      <tr>
        <td>Force actions</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Per-module control</strong><br/>Override scores with policies</td>
        <td>Limited policy control</td>
      </tr>
      <tr>
        <th colspan="3">
          Scalability & Clustering
        </th>
      </tr>
      <tr>
        <td>Native load balancing</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Proxy worker</strong><br/>Round-robin, hash-based, least-conn</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span> External LB required</td>
      </tr>
      <tr>
        <td>Horizontal scaling</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Designed for clustering</strong><br/>Shared Redis state</td>
        <td>Manual setup required</td>
      </tr>
      <tr>
        <td>Configuration sync</td>
        <td>Central config repo (Git/Ansible)</td>
        <td>Central config repo</td>
      </tr>
      <tr>
        <td>Inter-node encryption</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>HTTPCrypt protocol</strong><br/>X25519 + XChaCha20-Poly1305</td>
        <td><span class="fa-solid fa-lg fa-xmark icon-red"></span> TLS/VPN required</td>
      </tr>
      <tr>
        <th colspan="3">
          External Integrations
        </th>
      </tr>
      <tr>
        <td>Antivirus scanning</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Multiple engines<br/>ClamAV, Sophos, Kaspersky, etc.</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Via Amavis</td>
      </tr>
      <tr>
        <td>External services</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>HTTP callbacks</strong><br/>Custom classifiers, GPT integration</td>
        <td>Limited plugin support</td>
      </tr>
      <tr>
        <td>Analytics/Logging</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>ClickHouse, Elasticsearch</strong><br/>Structured exports</td>
        <td>Syslog, limited structured data</td>
      </tr>
      <tr>
        <th colspan="3">
          Development & Support
        </th>
      </tr>
      <tr>
        <td>Licence</td>
        <td>Apache 2.0</td>
        <td>Apache 2.0</td>
      </tr>
      <tr>
        <td>Development activity</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> <strong>Very active</strong><br/>Regular releases, new features</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Active<br/>Maintenance mode, stable</td>
      </tr>
      <tr>
        <td>Documentation</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Comprehensive<br/>Modern, searchable, examples</td>
        <td><span class="fa-solid fa-lg fa-check icon-green"></span> Extensive<br/>Mature, detailed</td>
      </tr>
      <tr>
        <td>Community</td>
        <td>Discord, Telegram, mailing lists</td>
        <td>Mailing lists, IRC, GitHub</td>
      </tr>
      <tr>
        <th colspan="3">&nbsp;
        </th>
      </tr>
    </tbody>
    <thead>
      <tr>
        <td></td>
        <td><img src="/img/rspamd_logo_small_black_simple.jpg" class="img-fluid"></td>
        <td><img src="/img/spamassassin_logo.jpg" class="img-fluid"></td>
      </tr>
    </thead>
  </table>
</div>

## Use Case Recommendations

### When to Choose Rspamd

**High-volume mail systems** (100K+ messages/day):
- Event-driven architecture handles load efficiently
- Single server can replace multiple SpamAssassin servers
- Native clustering and load balancing

**Modern infrastructure** (containers, cloud, microservices):
- Stateless workers with Redis for state
- HTTP/JSON API for easy integration
- Prometheus metrics and structured logging
- Docker/Kubernetes friendly

**Advanced filtering needs**:
- Machine learning (neural networks, adaptive scoring)
- Complex policy enforcement (rate limiting, greylisting)
- Real-time updates without downtime
- Custom Lua plugins for specific requirements

**Operational excellence**:
- Built-in web UI for monitoring and management
- RESTful API for automation
- Zero-downtime configuration reloads

### When to Choose SpamAssassin

**Existing SpamAssassin deployments**:
- Already have tuned SA rules and configurations
- Large existing Perl plugin codebase
- Upgrade from older SA versions

**Low-volume mail systems** (< 10K messages/day):
- Simpler setup, fewer moving parts
- No Redis requirement
- File-based storage is sufficient

**Perl expertise**:
- Team has strong Perl skills
- Need to leverage Perl ecosystem
- Custom Perl plugins already developed

**Specific plugin requirements**:
- Need Pyzor support
- Require specific SA plugins not in Rspamd

## Migration Path

If you're migrating from SpamAssassin to Rspamd:

1. **Parallel deployment**: Run both systems in header-only mode to compare results
2. **Retrain statistical classifiers**: Bayes databases are not compatible; retrain with your mail corpus
3. **Rule conversion**: Most SA rules have Rspamd equivalents; some custom rules may need Lua conversion
4. **Performance tuning**: Start with default config, tune based on your mail patterns
5. **Gradual transition**: Move users/domains incrementally once confident

See the [SpamAssassin migration guide](/tutorials/migrate_sa) for detailed instructions.

## Performance Comparison

Real-world performance metrics from production deployments:

| Metric | Rspamd | SpamAssassin | Improvement |
|--------|--------|--------------|-------------|
| Messages/sec/core | 5-10 | 0.5-2 | **10-20x faster** |
| Scan time (typical) | 50-200ms | 200ms-2s | **4-10x faster** |
| Concurrent connections | 100+ per worker | 1 per worker | **100x better** |
| Memory efficiency | 50-100MB/worker | 30-50MB/worker | Similar |
| Setup complexity | Moderate | Simple to Moderate | Depends on scale |

## Conclusion

Both Rspamd and SpamAssassin are excellent spam filtering solutions, but they target different use cases:

- **Rspamd** is the modern choice for high-performance, scalable deployments with advanced features and machine learning
- **SpamAssassin** remains a solid choice for smaller deployments and organizations with existing SA infrastructure

For new deployments or high-volume systems, Rspamd offers significant advantages in performance, features, and operational capabilities. For existing SpamAssassin users with low-volume requirements, staying with SA may be the path of least resistance.

---

**Note**: DSPAM, previously included in this comparison, is no longer actively maintained and is not recommended for new deployments.
