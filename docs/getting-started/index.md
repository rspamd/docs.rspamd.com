---
title: Getting Started with Rspamd
sidebar_position: 1
---

# Getting Started with Rspamd

Welcome to Rspamd! This guide will take you from complete beginner to running a production spam filtering system. Whether you're setting up a small business mail server or migrating from SpamAssassin, you'll find a clear path forward.

## The Quick Path (2-3 Hours)

If you're starting fresh, follow these three steps in order:

### 1. [Understanding Rspamd](understanding-rspamd)

**Time: 30 minutes reading**

Build the right mental model before installing anything:
- How Rspamd processes messages (processing pipeline)
- What symbols, scores, and actions mean
- Why statistical learning matters
- How modules work together

**Why start here?** Understanding Rspamd's design prevents common configuration mistakes. You'll know *why* to configure things a certain way, not just *what* to configure.

### 2. [Installation Guide](installation)

**Time: 30-60 minutes**

Choose your installation method and get Rspamd running:
- **Package installation** (recommended for production) - Ubuntu/Debian, CentOS/RHEL, FreeBSD
- **Docker** (testing and development) - Quick setup with web interface
- **Kubernetes** (cloud-native deployments) - Scalable production deployment

**Includes**: Repository setup, Redis installation, service verification, security checklist

### 3. [First Setup](first-setup)

**Time: 30-45 minutes**

Configure working spam filtering:
- Set action thresholds (reject, add header, greylist)
- Connect to Redis for statistics
- Configure web interface password
- Integrate with your MTA (Postfix, Exim, Sendmail)
- Test with real messages
- Optional: Enable Bayesian learning

**Result**: A functioning spam filter that you can monitor via web interface

After completing these three guides, continue with [Configuration Fundamentals](/guides/configuration/fundamentals) to learn what else you can customize.

## Alternative Starting Points

### 🔄 Migrating from SpamAssassin

If you're currently using SpamAssassin, follow this migration path:

**1. Understand the differences** (Read [Understanding Rspamd](understanding-rspamd) first)
- Event-driven vs process-per-message architecture
- Different Bayes implementation (databases not compatible)
- DMARC/ARC support not in SA
- 10-100x faster processing
- Different scoring system

**2. Parallel deployment** (Follow [Installation](installation) + [First Setup](first-setup))
- Install Rspamd alongside SpamAssassin
- Configure both to add headers (not reject) for testing
- Compare results for several days

**3. Migration steps** (See [SpamAssassin Migration Guide](/tutorials/migrate_sa))
- Retrain Bayesian classifier with your mail corpus
- Import custom SA rules if needed (spamassassin module)
- Adjust thresholds based on comparison
- Gradually transition traffic to Rspamd
- Monitor false positives/negatives

**4. Cutover**
- Switch MTA to Rspamd
- Keep SA available for emergency rollback
- Monitor for 1-2 weeks before removing SA

**Time investment**: 4-6 hours for complete migration + monitoring period

### 📦 Specific MTA Integration

If you already understand spam filtering and just need to integrate Rspamd:

**Quick integration paths**:

**Postfix** (most common):
```nginx
# /etc/postfix/main.cf
smtpd_milters = inet:localhost:11332
non_smtpd_milters = inet:localhost:11332
milter_default_action = accept
milter_protocol = 6
```

**Exim**:
```perl
# ACL check
warn
  spam = nobody:true
  add_header = X-Spam-Score: $spam_score
```

**Sendmail**: Use milter configuration (same as Postfix)

**Full instructions**: See [Integration Tutorial](/tutorials/integration) for complete setup with all MTAs

### 🐳 Docker/Kubernetes Deployment

If you're deploying to containers:

**Docker quick start**:
```bash
docker run -d --name rspamd \
  -p 11334:11334 -p 11332:11332 \
  -v $(pwd)/config:/etc/rspamd/local.d \
  -v $(pwd)/data:/var/lib/rspamd \
  rspamd/rspamd:latest
```

**Important for production**:
- Mount `/etc/rspamd/local.d/` for persistent configuration
- Mount `/var/lib/rspamd/` for statistics data
- Deploy Redis container or external Redis service
- Use local recursive DNS resolver (not 8.8.8.8)
- Configure resource limits (CPU: 1-2 cores, RAM: 512MB-1GB)
- Set up health checks: liveness `/ping`, readiness `/stat`

**Kubernetes**: See [Installation Guide](installation#cloudcontainer-deployment) for manifests and production considerations

## What You'll Achieve

By the end of the Getting Started section, you will have:

### ✅ Working System
- Rspamd installed and running
- Integrated with your MTA
- Redis connected for statistics
- Web interface accessible
- Messages being scanned and scored

### ✅ Core Understanding
- How Rspamd processes email
- Relationship between modules, symbols, scores, actions
- Why Redis is critical
- How authentication (SPF/DKIM/DMARC) works
- What statistical learning does

### ✅ Operational Skills
- Configure action thresholds
- Train Bayesian classifier
- Monitor via web interface
- Test message scanning
- Basic troubleshooting

### ✅ Foundation for Advanced Topics
- Ready to configure specific modules
- Prepared to write custom rules
- Able to optimize performance
- Understanding for scaling deployment

## Prerequisites

Before starting, ensure you have:

### Technical Requirements
- **Linux system** - Ubuntu 20.04+, Debian 11+, CentOS/RHEL 8+, or FreeBSD
- **Root/sudo access** - To install packages and modify configuration
- **Redis server** - For statistics (can install during setup)
- **Mail Transfer Agent** - Postfix, Exim, Sendmail, or other MTA
- **Disk space** - ~500MB for software, 1-5GB for statistics/logs

### Knowledge Requirements
- **Linux command line** - Basic file editing, systemd/service management
- **Email fundamentals** - SMTP, message headers, MTA concepts
- **Network basics** - DNS, ports, localhost vs remote access
- **Text editing** - Vim, nano, or any editor for configuration files

### Recommended (Not Required)
- **Redis knowledge** - Understanding of key-value stores helpful
- **Regular expressions** - For writing custom content rules
- **Lua basics** - For advanced custom rules (can learn later)

## Learning Philosophy

This guide follows a specific approach:

### 1. Concepts Before Commands
We explain *why* Rspamd works a certain way before showing *how* to configure it. This prevents cargo-cult configuration where you copy settings without understanding them.

### 2. Working System First
Get a basic but functional system running, then incrementally add features. Don't try to configure everything perfectly on first attempt.

### 3. Real Examples
All configuration examples are tested and production-ready. No simplified "toy" examples that won't work in real environments.

### 4. Progressive Depth
- **Getting Started**: Broad understanding, working system
- **Configuration Guides**: Specific tasks and decisions
- **Module Documentation**: Complete parameter reference
- **Developer Docs**: Internal architecture and APIs

## Common Questions

### "How long does this take?"
- **Basic working setup**: 2-3 hours
- **Production-ready with testing**: 4-6 hours
- **Optimized for your environment**: Ongoing process

### "Do I need to understand everything before starting?"
No. Start with [Understanding Rspamd](understanding-rspamd) to get the big picture, then follow the practical guides. You'll learn details as you go.

### "Can I skip Understanding Rspamd and go straight to installation?"
You *can*, but you'll likely make configuration mistakes that waste more time than reading would take. The understanding guide is 30 minutes that saves hours of troubleshooting.

### "What if I get stuck?"
- Check the [FAQ](/faq) for common questions
- Review the specific module documentation for detailed parameters
- Ask in community channels (Discord, Telegram, GitHub Discussions)
- Search GitHub issues for similar problems

### "Do I need to know Lua?"
Not for basic setup. Lua is only needed for:
- Writing complex custom rules
- Developing plugins
- Advanced integrations

Most users never write Lua code and just configure built-in modules.

### "Is Redis really required?"
Yes, for production use. Redis stores:
- Bayesian statistics (tokens, probabilities)
- Rate limiting counters
- Greylisting triplets
- Neural network weights
- DMARC report data
- Fuzzy hash checksums

Without Redis, statistical learning doesn't work, which significantly reduces spam detection accuracy.

### "Can I use Rspamd without statistics/learning?"
Yes. Rspamd will still check:
- SPF/DKIM/DMARC/ARC authentication
- RBL/SURBL blacklists
- Content regex rules
- MIME structure
- URL analysis

But you won't have:
- Bayesian classification
- Neural networks
- Fuzzy hash matching
- Rate limiting
- Greylisting

Static rules catch ~70-80% of spam. Adding statistics improves to ~95-98%.

## After Getting Started

Once you complete the Getting Started guides, explore:

### Configuration Guides
- **[Configuration Fundamentals](/guides/configuration/fundamentals)** - Understand the configuration system
- **[Tool Selection](/guides/configuration/tool-selection)** - Choose multimap vs regexp vs Lua vs selectors
- **[Multimap Guide](/tutorials/multimap_guide)** - Powerful pattern matching
- **[Settings Guide](/tutorials/settings_guide)** - Per-domain/per-user configuration
- **[DKIM Signing](/tutorials/dkim_signing_guide)** - Cryptographically sign outbound mail

### Module Documentation
- **[Modules Overview](/modules/)** - Complete list of 60+ modules
- **[SPF](/modules/spf)**, **[DKIM](/modules/dkim)**, **[DMARC](/modules/dmarc)**, **[ARC](/modules/arc)** - Authentication
- **[Bayes Statistics](/configuration/statistic)** - Statistical learning
- **[RBL Module](/modules/rbl)** - Real-time blacklists
- **[Greylisting](/modules/greylisting)**, **[Rate Limit](/modules/ratelimit)** - Anti-abuse

### Advanced Topics
- **[Architecture](/developers/architecture)** - How Rspamd works internally
- **[Writing Rules](/developers/writing_rules)** - Custom detection logic
- **[Protocol](/developers/protocol)** - HTTP API and Milter protocol
- **[Lua API](/lua/)** - Programming interface

### Scaling and Operations
- High availability setups
- Horizontal scaling patterns
- Performance optimization
- Monitoring and alerting
- Backup and disaster recovery

## Support and Community

### Community Help
- **[Discord](https://discord.gg/RsBM5KXtgX)** - Real-time chat for quick questions
- **[Telegram](https://t.me/rspamd)** - Alternative community chat
- **[GitHub Discussions](https://github.com/rspamd/rspamd/discussions)** - Long-form Q&A
- **[Mailing Lists](https://lists.rspamd.com)** - Traditional email-based discussion

### Bug Reports and Features
- **[GitHub Issues](https://github.com/rspamd/rspamd/issues)** - Bug reports and feature requests
- **[Pull Requests](https://github.com/rspamd/rspamd/pulls)** - Code contributions

### Commercial Support
Professional support available from Rspamd developers and certified partners. See [Support page](/support).

### Security Issues
Report security vulnerabilities privately to: security@rspamd.com

Do **not** open public GitHub issues for security problems.

## Documentation Improvements

Found a problem in the documentation?
- **Typos/errors**: Open a [documentation issue](https://github.com/rspamd/rspamd/issues)
- **Missing information**: Suggest what should be added
- **Confusing explanations**: Tell us what's unclear
- **Want to contribute**: Pull requests welcome for documentation improvements

Good documentation helps everyone. Your feedback makes it better.

---

## Ready to Start?

**New users**: Begin with [Understanding Rspamd →](understanding-rspamd)

**SpamAssassin users**: Read [Understanding Rspamd](understanding-rspamd), then [SpamAssassin Migration Guide](/tutorials/migrate_sa)

**Quick integration**: Jump to [Installation →](installation) if you already understand spam filtering

**Remember**: Start simple, get it working, then optimize. Don't try to configure everything perfectly on day one.
