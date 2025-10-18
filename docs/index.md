---
title: About Rspamd
---

# About Rspamd

:::danger URGENT: Service Disruption Notice

**Incident Disclosure: Rspamd Public Service Temporary Suspension Due to Hosting Provider Actions**

On Saturday, October 18th, 2025, the public Rspamd DNSBL RBL feed and what's more important **public fuzzy** service was disrupted due to an unexpected server block by our hosting provider, Hetzner. This interruption affected hundreds of thousands of users and likely led to increased volumes of spam for many legitimate email services worldwide.

**[Read the full incident disclosure](/blog/2025/10/18/incident-disclosure)**

**Summary:**
- Service was blocked due to false positive detection by hosting provider
- Despite multiple communications and clarifications, the block occurred
- Services are currently being reviewed and will be migrated to a more robust provider
- Public access to some Rspamd services will remain suspended until a proper solution is in place

We regret the inconvenience and are working to ensure this doesn't happen again.

:::

## Introduction

**Rspamd** is a high-performance email processing framework designed as an independent layer between your Mail Transfer Agent (MTA) and the internet. Operating outside MTA internal flows, Rspamd provides security isolation while delivering comprehensive message analysis, spam filtering, and policy enforcement.

### Core Capabilities

Built on an **event-driven architecture** with a complete **Lua scripting framework**, Rspamd offers:

- **Advanced spam filtering** - Combines Bayesian statistics, neural networks, fuzzy hashing, and 60+ analysis modules
- **Email authentication** - SPF, DKIM, DMARC, and ARC validation with cryptographic signing
- **Policy enforcement** - Rate limiting, greylisting, reputation tracking, and custom rules
- **Machine learning** - Neural networks and statistical classifiers that adapt to your mail patterns
- **External integrations** - Antivirus scanning, URL filtering, AI/ML services, and custom backends

### How It Works

Each message is evaluated through multiple stages:

1. **Pre-filters** - Whitelisting, basic policy checks (execute first, can skip further processing)
2. **Main filters** - Parallel execution of authentication checks (SPF/DKIM/DMARC), content analysis, RBL lookups, statistical classifiers
3. **Post-filters** - Composites, neural networks, final scoring adjustments
4. **Action decision** - Based on cumulative score: pass, add headers, greylist, or reject

Rspamd communicates results to your MTA via HTTP/JSON API or Milter protocol, recommending an action without directly handling mail delivery.

### Performance Profile

- **Event-driven I/O** - Single worker handles 100+ concurrent messages
- **Async operations** - Non-blocking DNS, Redis, HTTP requests
- **Typical scan time** - 50-200ms per message (including network operations)
- **Throughput** - 5-10 messages/sec per worker core (500K-1M messages/day single worker)
- **Memory footprint** - 50-100MB per worker process

See [Architecture documentation](/developers/architecture) for internal details and [Features](/about/features) for comprehensive capabilities list.

## Choose Your Path

This documentation is organized to help you succeed with Rspamd at any experience level:

### 🆕 New to Rspamd?

**Start here**: [Getting Started Guide](/getting-started/)

1. **[Understanding Rspamd](/getting-started/understanding-rspamd)** - Learn how Rspamd processes messages and makes decisions
2. **[Installation](/getting-started/installation)** - Choose the best installation method (package, Docker, Kubernetes)
3. **[First Setup](/getting-started/first-setup)** - Configure working spam filtering in 30 minutes

**Time investment**: 2-3 hours from zero to production-ready configuration

### 🎯 Configuring Rspamd?

**Go to**: [Configuration Guides](/guides/configuration/)

- **[Configuration Fundamentals](/guides/configuration/fundamentals)** - Understand the layered configuration system
- **[Tool Selection Guide](/guides/configuration/tool-selection)** - Choose between multimap, regexp, Lua, or selectors
- **Module-specific guides** - Detailed tutorials for common tasks

**Common tasks**:
- [Migrating from SpamAssassin](/tutorials/migrate_sa)
- [DKIM signing setup](/tutorials/dkim_signing_guide)
- [Multimap usage](/tutorials/multimap_guide)
- [Integration with your MTA](/tutorials/integration)

### 🔧 Technical Reference

**For developers and advanced users**:

- **[Module Documentation](/modules/)** - Complete parameter reference for all 60+ modules
- **[Lua API](/lua/)** - Programming interface for custom rules and plugins
- **[Developer Guides](/developers/)** - Architecture, protocol, writing rules, testing
- **[Protocol Documentation](/developers/protocol)** - HTTP API and Milter protocol specifications

## Quick Start Options

### Docker Test Environment (5 minutes)

Fastest way to explore Rspamd's web interface and test message scanning:

```bash
# Run Rspamd container with web interface
docker run -d \
  --name rspamd-test \
  -p 11334:11334 \
  -p 11333:11333 \
  rspamd/rspamd:latest

# Access web interface at http://localhost:11334
# Default password: see container logs for generated password
docker logs rspamd-test 2>&1 | grep password
```

Test message scanning:
```bash
# Scan a test message
echo -e "Subject: Test\n\nTest message body" | \
  curl --data-binary @- http://localhost:11333/checkv2
```

**Note**: Docker setup is for testing only. For production, use package installation with proper Redis integration.

### Production Package Installation

#### Ubuntu/Debian

```bash
# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl gnupg

# Add Rspamd repository (modern keyring method)
curl -fsSL https://rspamd.com/apt-stable/gpg.key | \
  sudo gpg --dearmor -o /usr/share/keyrings/rspamd.gpg

echo "deb [signed-by=/usr/share/keyrings/rspamd.gpg] https://rspamd.com/apt-stable/ $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/rspamd.list

# Install Rspamd and Redis
sudo apt update
sudo apt install -y rspamd redis-server

# Start services
sudo systemctl enable --now rspamd redis-server
```

#### CentOS/RHEL/Rocky Linux

```bash
# Add Rspamd repository
curl -sSL https://rspamd.com/rpm-stable/centos-8/rspamd.repo | \
  sudo tee /etc/yum.repos.d/rspamd.repo

# Install Rspamd and Redis
sudo dnf install -y rspamd redis

# Start services
sudo systemctl enable --now rspamd redis
```

#### Next Steps After Installation

1. **Verify installation**:
   ```bash
   sudo systemctl status rspamd
   rspamd --version
   ```

2. **Set web interface password**:
   ```bash
   rspamadm pw  # Generate password hash
   echo 'password = "$2$your_hash_here";' | sudo tee /etc/rspamd/local.d/worker-controller.inc
   sudo systemctl restart rspamd
   ```

3. **Continue with**: [First Setup Guide](/getting-started/first-setup) for complete configuration

For detailed installation instructions including Kubernetes, Docker Compose, and other platforms, see the [Installation Guide](/getting-started/installation).

## Key Features at a Glance

| Feature | Description |
|---------|-------------|
| **Event-driven architecture** | Async I/O allows 100+ concurrent message scans per worker |
| **Email authentication** | SPF, DKIM (signing+validation), DMARC, ARC with caching |
| **Statistical learning** | Bayesian classifier + Neural networks + Fuzzy hashing |
| **Content analysis** | Regex rules (Hyperscan-optimized), MIME checks, language detection |
| **Real-time blacklists** | 50+ preconfigured RBLs, SURBL, URIBL with parallel DNS queries |
| **Anti-abuse** | Rate limiting, greylisting, spamtrap detection |
| **Web UI** | Real-time monitoring, history, training, configuration validation |
| **Protocols** | HTTP/JSON, Milter, native Rspamd protocol |
| **Security** | HTTPCrypt encryption, localhost-only binding, minimal attack surface |
| **Scalability** | Horizontal scaling, load balancing, Redis HA support |

See [Features page](/about/features) for comprehensive technical details.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Mail Transfer Agent                │
│          (Postfix/Exim/Sendmail/etc)           │
└────────────────┬────────────────────────────────┘
                 │ Milter/HTTP
                 ▼
         ┌───────────────┐
         │ Rspamd Proxy  │ ◄── Load balancing, protocol translation
         │    Worker     │
         └───────┬───────┘
                 │
         ┌───────▼────────┐
         │ Rspamd Normal  │ ◄── Message analysis, scoring
         │    Worker      │
         └───────┬────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌─────────────┐
│ Redis  │  │  DNS   │  │  External   │
│        │  │Resolver│  │  Services   │
│Statistics│ │ (RBLs)│  │(AV, URLs)  │
└────────┘  └────────┘  └─────────────┘
```

**Key components**:
- **Proxy worker** - Protocol translation (Milter ↔ HTTP), multiplexing, load balancing
- **Normal worker** - Actual message scanning and rule execution
- **Controller worker** - Web UI and management API
- **Redis** - Statistics, learning data, rate limiting, caching
- **DNS resolver** - Critical for RBL checks; use local recursive resolver

See [Architecture documentation](/developers/architecture) for detailed process model and event-driven implementation.

## Integration Examples

### Postfix (most common)

```nginx
# /etc/postfix/main.cf
smtpd_milters = inet:localhost:11332
non_smtpd_milters = inet:localhost:11332
milter_default_action = accept
milter_protocol = 6
```

### Exim

```perl
# ACL check
warn
  spam = nobody:true
  add_header = X-Spam-Score: $spam_score
  add_header = X-Spam-Report: $spam_report
```

### Direct HTTP API

```bash
# Scan message via HTTP
curl -X POST http://localhost:11333/checkv2 \
  -H "Content-Type: message/rfc822" \
  --data-binary @message.eml
```

See [Integration guide](/tutorials/integration) for complete MTA setup instructions.

## Performance Comparison

| Solution | Messages/sec/core | Architecture | Memory/process |
|----------|------------------|--------------|----------------|
| **Rspamd** | 5-10 | Event-driven, async | 50-100MB |
| SpamAssassin | 0.5-1 | Process-per-message | 30-50MB |
| Amavis | 1-2 | Process pool | 100-200MB |

**Why Rspamd is faster**:
- Non-blocking I/O (single process handles many messages)
- Optimized regex engine (Hyperscan on x86_64)
- Efficient memory pools
- Connection pooling for Redis/DNS/HTTP
- Zero-copy message handling where possible

See [Performance comparison](/about/comparison) for detailed benchmarks.

## Common Use Cases

- **ISP/hosting providers** - High-volume mail filtering (millions of messages/day)
- **Enterprise mail servers** - Policy enforcement, DLP, advanced authentication
- **Small business** - Simple spam filtering with minimal resources
- **Mailing list operators** - ARC handling, reputation management
- **Security teams** - Threat intelligence integration, custom detection rules

## Migration from SpamAssassin

If you're currently using SpamAssassin:

1. **Install Rspamd alongside SpamAssassin** (don't remove SA yet)
2. **Configure both to add headers** (test mode, no rejection)
3. **Compare results** for several days
4. **Retrain Bayesian classifier** with your mail corpus (SA Bayes data not compatible)
5. **Switch to Rspamd** once confident

**Key differences**:
- 10-100x faster processing
- Different statistical model (must retrain)
- Better modern spam handling (DMARC, ARC, neural nets)
- Event-driven vs process-per-message

See [SpamAssassin migration guide](/tutorials/migrate_sa) for step-by-step instructions.

## Community and Support

### Community Channels

- **[GitHub Discussions](https://github.com/rspamd/rspamd/discussions)** - Questions, ideas, and general discussion
- **[Discord](https://discord.gg/RsBM5KXtgX)** - Real-time chat for quick questions and community support
- **[Telegram](https://t.me/rspamd)** - Alternative real-time chat
- **[Mailing Lists](https://lists.rspamd.com)** - Long-form technical discussions and announcements

### Development and Issues

- **[GitHub Repository](https://github.com/rspamd/rspamd)** - Source code, issue tracking, pull requests
- **[Issue Tracker](https://github.com/rspamd/rspamd/issues)** - Bug reports and feature requests
- **[Contributing Guide](https://github.com/rspamd/rspamd/blob/master/CONTRIBUTING.md)** - How to contribute code or documentation

### Commercial Support

Professional support, consulting, and custom development available from Rspamd developers and certified partners. See [Support page](/support) for details.

### Security Vulnerabilities

Report security issues privately to: security@rspamd.com

Do not open public GitHub issues for security vulnerabilities.

## Documentation Structure

This documentation is organized into several sections:

- **[Getting Started](/getting-started/)** - Installation, configuration basics, first setup
- **[About](/about/)** - Features, comparison, performance
- **[Configuration](/configuration/)** - System-wide settings, UCL syntax, configuration layers
- **[Modules](/modules/)** - Complete reference for all 60+ modules
- **[Workers](/workers/)** - Worker types and their configuration
- **[Tutorials](/tutorials/)** - Step-by-step guides for common tasks
- **[Developers](/developers/)** - Architecture, protocol, writing rules, Lua API
- **[Lua API](/lua/)** - Complete programming interface documentation
- **[FAQ](/faq)** - Frequently asked questions

## License and Legal

Rspamd is open source software licensed under the **[Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)**.

Key points:
- Free to use, modify, and distribute
- Commercial use permitted
- Patent grant included
- No warranty provided

See [LICENSE](https://github.com/rspamd/rspamd/blob/master/LICENSE) file for complete terms.

## Project Status

- **Active development** - Regular releases with new features and improvements
- **Production ready** - Used by ISPs, hosting providers, and enterprises worldwide
- **Stable API** - Backwards compatibility maintained
- **Security updates** - Prompt response to vulnerabilities
- **Long-term support** - Project maintained since 2012

**Current stable version**: Check [GitHub releases](https://github.com/rspamd/rspamd/releases) for latest version

---

**Ready to start?**

→ New users: [Understanding Rspamd](/getting-started/understanding-rspamd) → [Installation](/getting-started/installation) → [First Setup](/getting-started/first-setup)

→ Experienced users: [Configuration Fundamentals](/guides/configuration/fundamentals) → [Module Reference](/modules/)

→ Developers: [Architecture](/developers/architecture) → [Writing Rules](/developers/writing_rules) → [Lua API](/lua/)
