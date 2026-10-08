---
title: About Rspamd
---

# About Rspamd

## Introduction

**Rspamd** is a high-performance spam filtering system and email processing framework. It runs as a separate daemon next to your Mail Transfer Agent (MTA): the MTA passes each message to Rspamd, which analyzes it and returns a score and a recommended action.

### Core Capabilities

Built on an **event-driven architecture** with a complete **Lua scripting framework**, Rspamd offers:

- **Advanced spam filtering** - Combines Bayesian statistics, neural networks, fuzzy hashing, DNS blocklists and rule-based content checks
- **Email authentication** - SPF, DKIM, DMARC, and ARC validation with cryptographic signing
- **Policy enforcement** - Rate limiting, greylisting, reputation tracking, and custom rules
- **Machine learning** - Neural networks and statistical classifiers that adapt to your mail patterns
- **External integrations** - Antivirus scanning, URL filtering, AI/ML services, and custom backends

### How It Works

Each message is evaluated through multiple stages:

1. **Pre-filters** - Settings, rDNS and ASN lookups, and with Redis the ratelimit and greylist checks (run first, can end processing early)
2. **Filters** - Authentication checks (SPF/DKIM/DMARC), content rules, RBL lookups, fuzzy checks; network lookups run concurrently
3. **Classifiers and composites** - The Bayes classifier, then composites that combine symbols
4. **Post-filters** - Neural networks, the greylisting decision, final action adjustments
5. **Action decision** - Based on the total score: no action, greylist, add header, rewrite subject or reject

[Understanding Rspamd](/getting-started/understanding-rspamd#how-rspamd-processes-a-message) describes each stage.

Rspamd communicates results to your MTA via HTTP/JSON API or Milter protocol, recommending an action without directly handling mail delivery.

### Performance Profile

- **Event-driven I/O** - Each worker process scans many messages at once
- **Async operations** - Non-blocking DNS, Redis, HTTP requests
- **Throughput** - The project reports roughly ten times SpamAssassin's throughput with the same rules. Actual throughput depends on your hardware, the enabled modules and message size. Scan time also depends on the latency of DNS, Redis and other network lookups

See [Architecture documentation](/developers/architecture) for internal details, [Performance](/about/performance) for the optimizations Rspamd uses and [Features](/about/features) for the full list of capabilities.

## Choose Your Path

This documentation is organized to help you succeed with Rspamd at any experience level:

### 🆕 New to Rspamd?

**Start here**: [Getting Started Guide](/getting-started/)

1. **[Understanding Rspamd](/getting-started/understanding-rspamd)** - Learn how Rspamd processes messages and makes decisions
2. **[Installation](/getting-started/installation)** - Choose the best installation method (package, Docker, Kubernetes)
3. **[First Setup](/getting-started/first-setup)** - Check Redis and the web interface password, connect Postfix and train Bayes

### 🎯 Configuring Rspamd?

**Go to**: [Configuration](/configuration/)

- **[Configuration Fundamentals](/guides/configuration/fundamentals)** - Understand the layered configuration system
- **[Tool Selection Guide](/guides/configuration/tool-selection)** - Choose between multimap, regexp, Lua, or selectors

**Common tasks**:
- [Migrating from SpamAssassin](/tutorials/migrate_sa)
- [DKIM signing setup](/tutorials/dkim_signing_guide)
- [Multimap usage](/tutorials/multimap_guide)
- [Integration with your MTA](/tutorials/integration)

### 🔧 Technical Reference

**For developers and advanced users**:

- **[Module Documentation](/modules/)** - Configuration reference for the built-in modules
- **[Lua API](/lua/)** - Programming interface for custom rules and plugins
- **[Developer Guides](/developers/architecture)** - Architecture, protocol, [writing rules](/developers/writing_rules), [testing](/developers/writing_tests)
- **[Protocol Documentation](/developers/protocol)** - HTTP scanning protocol and reply format; [controller endpoints](/developers/controller_endpoints) cover the management API

## Quick Start Options

### Docker Test Environment

Fastest way to explore Rspamd's web interface and test message scanning. The image does not generate a password, and the controller refuses the default password `q1` for connections through a published port, so set your own first:

```bash
# Generate a password hash (enter the password when asked)
docker run --rm -it rspamd/rspamd:latest rspamadm pw

# Put the hash into a local.d directory for the container
mkdir -p local.d
echo 'password = "$2$your_generated_hash";' > local.d/worker-controller.inc

# Run Rspamd with the ports published on 127.0.0.1 only
docker run -d \
  --name rspamd-test \
  -v "$PWD/local.d:/etc/rspamd/local.d:ro" \
  -p 127.0.0.1:11334:11334 \
  -p 127.0.0.1:11333:11333 \
  rspamd/rspamd:latest

# Access web interface at http://localhost:11334 and log in with your password
```

Test message scanning:
```bash
# Scan a test message (without From, To, Date and Message-ID headers it scores high on its own)
echo -e "Subject: Test\n\nTest message body" | \
  curl --data-binary @- http://localhost:11333/checkv2
```

**Note**: This single container has no Redis and no local recursive DNS resolver, so Bayes, greylisting and rate limiting do not work and DNS blocklists may refuse its queries. For production, use the packages below or the [Docker Compose setup](/getting-started/installation#docker-compose) with Redis and Unbound.

### Production Package Installation

#### Ubuntu/Debian

```bash
# Install prerequisites
sudo apt-get update
sudo apt-get install -y lsb-release wget gpg

# Add GPG key
sudo mkdir -p /etc/apt/keyrings
wget -O- https://rspamd.com/apt-stable/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/rspamd.gpg > /dev/null

# Add repository
CODENAME=$(lsb_release -c -s)
echo "deb [signed-by=/etc/apt/keyrings/rspamd.gpg] http://rspamd.com/apt-stable/ $CODENAME main" | sudo tee /etc/apt/sources.list.d/rspamd.list

# Install Rspamd and Redis
sudo apt-get update
sudo apt-get --no-install-recommends install rspamd
sudo apt-get install redis-server

# Start services
sudo systemctl enable --now rspamd redis-server
```

#### RHEL, AlmaLinux, Rocky Linux and other EL distributions

```bash
# The packages need EPEL (on RHEL itself, see the installation guide)
sudo dnf install epel-release

# Add Rspamd repository for your EL version
source /etc/os-release
EL_VERSION=$(echo -n $PLATFORM_ID | sed "s/.*el//")
sudo curl -o /etc/yum.repos.d/rspamd.repo https://rspamd.com/rpm-stable/centos-${EL_VERSION}/rspamd.repo

# Install Rspamd and Redis (on EL 10, install and enable valkey instead of redis)
sudo dnf install rspamd redis

# Start services
sudo systemctl enable --now rspamd redis
```

#### Next Steps After Installation

1. **Verify installation**:
   ```bash
   sudo systemctl status rspamd
   rspamd --version
   ```

2. **Connect Rspamd to Redis**. The shipped configuration has no Redis server set, so Bayes, greylisting and rate limiting stay disabled until you add one:
   ```hcl
   # /etc/rspamd/local.d/redis.conf
   servers = "127.0.0.1";
   ```

3. **Set web interface password** (connections from localhost do not need it, but clients outside `secure_ip` do):
   ```bash
   rspamadm pw  # Generate password hash
   echo 'password = "$2$your_hash_here";' | sudo tee /etc/rspamd/local.d/worker-controller.inc
   sudo systemctl restart rspamd
   ```

4. **Continue with**: [First Setup Guide](/getting-started/first-setup) for complete configuration

For detailed installation instructions including Kubernetes, Docker Compose, and other platforms, see the [Installation Guide](/getting-started/installation).

## Key Features at a Glance

| Feature | Description |
|---------|-------------|
| **Event-driven architecture** | Async I/O lets each worker scan many messages concurrently |
| **Email authentication** | SPF, DKIM (signing+validation), DMARC, ARC with caching |
| **Statistical learning** | Bayesian classifier + Neural networks + Fuzzy hashing |
| **Content analysis** | Regex rules (Hyperscan-optimized), MIME checks, language detection |
| **Real-time blacklists** | Preconfigured IP, domain, URL and email blocklists (Spamhaus, SURBL, URIBL and others) with parallel DNS queries |
| **Anti-abuse** | Rate limiting, greylisting, spamtrap detection |
| **Web UI** | Statistics and throughput graphs, history, scanning and training, editing scores, action thresholds and maps, selector testing |
| **Protocols** | HTTP/JSON, Milter (proxy worker), legacy RSPAMC and spamc protocols |
| **Security** | HTTPCrypt encryption, localhost-only binding, minimal attack surface |
| **Scalability** | Horizontal scaling, load balancing, Redis HA support |

See the [Features page](/about/features) for technical details.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Mail Transfer Agent                │
│          (Postfix/Exim/Sendmail/etc)            │
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
│ (Bayes,│  │Resolver│  │  Services   │
│ limits)│  │ (RBLs) │  │ (AV, URLs)  │
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

```ini
# /etc/postfix/main.cf
smtpd_milters = inet:localhost:11332
non_smtpd_milters = inet:localhost:11332
milter_default_action = accept
milter_protocol = 6
```

### Exim

Exim talks to the normal worker on port 11333 with the legacy RSPAMC protocol:

```text
# Main section of the Exim configuration
spamd_address = 127.0.0.1 11333 variant=rspamd

# In the ACL used for acl_smtp_data
warn
  spam = nobody:true
  add_header = X-Spam-Score: $spam_score
  add_header = X-Spam-Report: $spam_report
```

This only adds headers. The [Exim section](/tutorials/integration#integration-with-exim-mta) of the integration guide shows a complete ACL that rejects or defers mail based on `$spam_action`.

### Direct HTTP API

```bash
# Scan message via HTTP
curl -X POST http://localhost:11333/checkv2 \
  -H "Content-Type: message/rfc822" \
  --data-binary @message.eml
```

See [Integration guide](/tutorials/integration) for complete MTA setup instructions.

## Performance Comparison

The project reports that Rspamd processes about ten times as many messages as SpamAssassin with the same rules, loaded through the [SpamAssassin module](/modules/spamassassin). In a [2019 measurement](/blog/rspamd-performance), one server handled about 1500 messages per second with about 80% of its CPU idle. Throughput on your system depends on your hardware, the enabled modules and message size. Slow DNS, Redis and other network lookups add to the scan time of each message, but they do not hold up other scans.

**Why Rspamd is faster**:
- Non-blocking I/O (single process handles many messages)
- Optimized regex engine (Hyperscan or its fork Vectorscan in the official packages)
- Efficient memory pools
- Connection pools for Redis and HTTP keep-alive connections
- Zero-copy message handling where possible

See [Performance](/about/performance) for the optimizations and the [comparison with SpamAssassin](/about/comparison) for a feature-by-feature table.

## Common Use Cases

- **ISP/hosting providers** - High-volume mail filtering (millions of messages/day)
- **Enterprise mail servers** - Policy enforcement, outbound scanning, advanced authentication
- **Small business** - Simple spam filtering with minimal resources
- **Mailing list operators** - ARC handling, reputation management
- **Security teams** - Threat intelligence integration, custom detection rules

## Migration from SpamAssassin

If you're currently using SpamAssassin:

1. **Install Rspamd alongside SpamAssassin** (don't remove SA yet)
2. **Configure both to add headers** (test mode, no rejection; see [Testing alongside SpamAssassin](/getting-started/installation#testing-alongside-spamassassin))
3. **Compare results** for several days
4. **Retrain Bayesian classifier** with your mail corpus (SA Bayes data not compatible)
5. **Switch to Rspamd** once confident

**Key differences**:
- Roughly ten times SpamAssassin's throughput with the same rules
- Different statistical model (must retrain)
- DKIM and ARC signing and DMARC aggregate reports built in (SpamAssassin only checks DMARC and ARC)
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
- **[Contributing Guide](https://github.com/rspamd/rspamd/blob/master/CONTRIBUTING.md)** - How to contribute code; [contributing to the documentation](/tutorials/site_contributing) covers this site

### Commercial Support

For large or custom deployments that may require NDA signing, consulting, or dedicated access to fuzzy storage or DNS lists, commercial support is available. Contact support@rspamd.com; see the [Support page](/support#commercial-support).

### Security Vulnerabilities

Report security issues privately through [GitHub private vulnerability reporting](https://github.com/rspamd/rspamd/security/advisories/new) (preferred), or email vsevolod@rspamd.com with `[SECURITY]` in the subject.

Do not open public GitHub issues for security vulnerabilities. [SECURITY.md](https://github.com/rspamd/rspamd/blob/master/SECURITY.md) explains what the project treats as a vulnerability.

## Documentation Structure

This documentation is organized into several sections:

- **[Getting Started](/getting-started/)** - Installation, configuration basics, first setup
- **[About](/about/)** - Features, comparison, performance
- **[Configuration](/configuration/)** - System-wide settings, UCL syntax, configuration layers
- **[Modules](/modules/)** - Reference for the built-in modules
- **[Workers](/workers/)** - Worker types and their configuration
- **[Tutorials](/tutorials/)** - Step-by-step guides for common tasks
- **[Developers](/developers/architecture)** - Architecture, [protocol](/developers/protocol), [writing rules](/developers/writing_rules), [writing tests](/developers/writing_tests)
- **[Lua API](/lua/)** - Complete programming interface documentation
- **[FAQ](/faq)** - Frequently asked questions

## License and Legal

Rspamd is open source software licensed under the **[Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)**.

Key points:
- Free to use, modify, and distribute
- Commercial use permitted
- Patent grant included
- No warranty provided

See [LICENSE.md](https://github.com/rspamd/rspamd/blob/master/LICENSE.md) file for complete terms.

## Project Status

- **Active development** - Regular releases with new features and improvements
- **Production ready** - Used by ISPs, hosting providers, and enterprises worldwide
- **Upgrade notes** - Incompatible changes between versions are listed in [Updating Rspamd](/tutorials/migration)
- **Security updates** - Released for the latest stable series only (currently 4.x); older series get no backports
- **Project history** - Developed since 2008

**Current stable version**: Check [GitHub releases](https://github.com/rspamd/rspamd/releases) for latest version

---

**Ready to start?**

→ New users: [Understanding Rspamd](/getting-started/understanding-rspamd) → [Installation](/getting-started/installation) → [First Setup](/getting-started/first-setup)

→ Experienced users: [Configuration Fundamentals](/guides/configuration/fundamentals) → [Module Reference](/modules/)

→ Developers: [Architecture](/developers/architecture) → [Writing Rules](/developers/writing_rules) → [Lua API](/lua/)
