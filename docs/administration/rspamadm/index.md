---
title: Rspamadm Administration Utility
---

# Rspamadm Administration Utility

The `rspamadm` command is a powerful administration utility that provides a comprehensive set of tools for managing, debugging, and operating Rspamd installations. It consolidates various administrative functions into a single command-line interface.

## Quick Start

To see all available commands:

```bash
rspamadm -l
```

To get help for a specific command:

```bash
rspamadm [command] --help
```

## Commands by Category

### Email Analysis & Debugging

Tools for inspecting and analyzing email messages.

| Command | Purpose |
|---------|---------|
| `mime extract` | Extract text, HTML, or words from messages |
| `mime stat` | Extract statistical data (Bayes tokens, fuzzy hashes) |
| `mime urls` | Extract and analyze URLs from messages |
| `mime dump` | Dump messages in various formats |

[Learn more →](email-analysis.md)

### Email Manipulation

Tools for modifying and sanitizing email messages.

| Command | Purpose |
|---------|---------|
| `mime anonymize` | Remove sensitive information for bug reports |
| `mime modify` | Add/remove/rewrite headers and footers |
| `mime strip` | Remove attachments from messages |
| `mime sign` | Perform DKIM/ARC signing |

[Learn more →](email-manipulation.md)

### DNS & SPF Management

Tools for DNS operations and SPF record optimization.

| Command | Purpose |
|---------|---------|
| `dnstool spf` | Query and debug SPF records |
| `dnstool spf-flatten` | Flatten SPF records to avoid lookup limits |

[Learn more →](dns-tools.md)

### DKIM Key Management

Tools for generating and managing DKIM signing keys.

| Command | Purpose |
|---------|---------|
| `dkim_keygen` | Generate DKIM keypairs |
| `vault` | Integrate with Hashicorp Vault for key storage |
| `signtool` | Sign and verify files with keypairs |

[Learn more →](dkim-management.md)

### Cryptography & Security

Tools for encryption, signing, and password management.

| Command | Purpose |
|---------|---------|
| `keypair` | Generate and manage encryption/signing keypairs |
| `secret_box` | Encrypt/decrypt text with symmetric keys |
| `pw` | Generate and check password hashes |
| `signtool` | Sign and verify files |

[Learn more →](cryptography.md)

### Statistics & Machine Learning

Tools for managing statistical classifiers and neural networks.

| Command | Purpose |
|---------|---------|
| `statistics_dump` | Backup and restore Bayes statistics |
| `statconvert` | Convert statistics from SQLite to Redis |
| `classifiertest` | Evaluate Bayes classifier performance |
| `neuraltest` | Test neural network with labeled datasets |
| `clickhouse neural_profile` | Generate neural network profiles |

[Learn more →](statistics-ml.md)

### Operations & Monitoring

Tools for operational tasks and monitoring.

| Command | Purpose |
|---------|---------|
| `grep` | Search and collate logs by pattern |
| `fuzzy_ping` | Test fuzzy storage connectivity |
| `ratelimit` | Manage rate limit buckets |
| `control` | Send commands to running Rspamd instance |
| `dmarc_report` | Send DMARC aggregate reports |
| `fuzzyconvert` | Migrate fuzzy hashes to Redis |

[Learn more →](operations.md)

### Configuration Management

Tools for configuration validation and inspection.

| Command | Purpose |
|---------|---------|
| `configtest` | Validate configuration syntax |
| `configdump` | Show effective configuration |
| `confighelp` | Show configuration option documentation |
| `configgraph` | Visualize configuration include hierarchy |
| `configwizard` | Interactive configuration setup |
| `template` | Apply Jinja templates to files |

[Learn more →](configuration.md)

### Development & Testing

Tools for developers and advanced testing.

| Command | Purpose |
|---------|---------|
| `corpustest` | Test rules against email corpus |
| `cookie` | Generate message IDs and cookies |
| `lua` | Interactive Lua REPL with Rspamd API |
| `publicsuffix` | Compile public suffix lists |

[Learn more →](development.md)

## Common Usage Patterns

### Debugging Email Issues

When investigating why a message was scored incorrectly:

```bash
# Extract all data Rspamd sees
rspamadm mime extract -t message.eml
rspamadm mime urls -f message.eml
rspamadm mime stat -b message.eml

# Search logs for that message
rspamadm grep -p "message-id-here" /var/log/rspamd/rspamd.log
```

### Preparing Bug Reports

Sanitize emails before sharing:

```bash
# Remove sensitive information
rspamadm mime anonymize --gpt message.eml > sanitized.eml
```

### SPF Management

Optimize SPF records that hit DNS lookup limits:

```bash
# Check current SPF
rspamadm dnstool spf -d example.com

# Flatten if needed
rspamadm dnstool spf-flatten example.com
```

### Configuration Validation

Before restarting Rspamd:

```bash
# Validate syntax
rspamadm configtest

# Check effective configuration
rspamadm configdump | less
```

## Global Options

Most commands support these global options:

- `-c, --config` - Path to configuration file (default: `/etc/rspamd/rspamd.conf`)
- `-v, --verbose` - Enable verbose logging
- `--var` - Override environment variables

## Getting Help

- Run `rspamadm -l` to list all commands
- Run `rspamadm [command] --help` for detailed command help
- Check the category pages linked above for practical examples and scenarios
