---
title: Quick start
---

# Rspamd quick start
{:.no_toc}

**Rspamd** is a powerful, fast and free spam filtering system that uses multiple analysis techniques to identify spam. This guide will help you understand, install, and configure Rspamd step by step.

## What you'll learn

By the end of this guide, you'll understand:
- **What** Rspamd can do and what you can configure
- **How** to install and set up Rspamd with your mail server
- **How** to configure basic settings like spam scores and actions
- **How** to use Rspamd's web interface and command-line tools

## What is Rspamd?

Rspamd is a spam filtering daemon that integrates with your mail server (MTA) to analyze incoming and outgoing emails. It uses various techniques including:
- Bayesian classification (machine learning)
- DNS blacklists (RBLs)
- Fuzzy hashing
- Regular expressions
- SPF, DKIM, and DMARC validation

## Understanding Rspamd Configuration

Before diving into installation, it's important to understand what you can configure in Rspamd. Based on the excellent [alternative introduction guide](https://www.0xf8.org/2018/05/an-alternative-introduction-to-rspamd-configuration-introduction/){:target="&#95;blank"}, here's what Rspamd allows you to configure:

### 1. **Modules** - What tests to perform
Modules are units of code that analyze messages. Each test produces a **symbol** (like `FORGED_SENDER`) if the test matches.

### 2. **Scores/Weights** - How much each test contributes
Each symbol has a numeric score that adds to the message's total "spam score" (e.g., `FORGED_SENDER = 0.30`).

### 3. **Actions** - What to do at different score thresholds
- **Greylist** (score 4.0): Temporarily delay the message
- **Add header** (score 6.0): Mark as spam but deliver
- **Reject** (score 15.0): Refuse the message entirely

### 4. **Workers** - How Rspamd processes operate
Different worker processes handle scanning, web interface, and proxy functions.

### 5. **General options** - Timeouts, DNS settings, etc.

## Installation Overview

This guide covers setting up Rspamd with:
- **Ubuntu** (or any systemd-based OS)
- **Postfix** as the mail server
- **Redis** for caching and statistics
- **Dovecot** for IMAP with automatic spam learning

## Prerequisites

Before installing Rspamd, ensure you have:

1. **A working mail server (MTA)** - This guide uses [Postfix](https://www.postfix.org/){:target="&#95;blank"}, but Rspamd works with other MTAs too (see [integration document](/doc/tutorials/integration.html))
2. **Root access** to your server
3. **A domain** configured for email 
4. **Basic familiarity** with Linux command line

**Note**: While Rspamd can work with Exim, it has limited support and is not recommended.

Consider setting up your own [local DNS resolver](/doc/faq.html#resolver-setup) for better performance.

## Step 1: Install Rspamd

### Installing from packages (Recommended)

Instructions for downloading Rspamd can be found on the [downloads page](/downloads.html). This includes information for various Linux distributions and installation methods.

For Ubuntu/Debian:
```bash
# Add Rspamd repository
curl https://rspamd.com/apt-stable/gpg.key | sudo apt-key add -
echo "deb https://rspamd.com/apt-stable/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/rspamd.list

# Update and install
sudo apt update
sudo apt install rspamd
```

### Start and enable Rspamd

```bash
sudo systemctl start rspamd
sudo systemctl enable rspamd
sudo systemctl status rspamd
```

## Step 2: Basic Rspamd Configuration

### Understanding Rspamd's configuration structure

Rspamd uses a modular configuration system with three main ways to customize settings:

1. **`local.d/`** - For adding/merging settings with defaults
2. **`override.d/`** - For completely replacing default settings  
3. **Web interface** - For runtime adjustments

**Important**: Never edit files in `/etc/rspamd/` directly. Always use `local.d/` or `override.d/` directories.

### Set up basic actions and scores

Create `/etc/rspamd/local.d/actions.conf`:

```hcl
# Basic action thresholds
reject = 15;        # Reject obvious spam
add_header = 6;     # Add spam headers
greylist = 4;       # Temporary delay suspicious mail
```

### Configure Redis (Essential)

Create `/etc/rspamd/local.d/redis.conf`:

```hcl
# Redis connection for statistics and caching
servers = "127.0.0.1:6379";
```

### Set the controller password

Generate a password for the web interface:

```bash
rspamadm pw
```

Create `/etc/rspamd/local.d/worker-controller.inc`:

```hcl
# Replace with your generated password
password = "$2$your_generated_password_here";
```

### Restart Rspamd

```bash
sudo systemctl restart rspamd
```

## Step 3: Install and Configure Redis

Rspamd requires Redis for statistics and caching:

```bash
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

Basic Redis security in `/etc/redis/redis.conf`:

```
# Bind only to localhost for security
bind 127.0.0.1 ::1

# Set memory limit
maxmemory 500mb
maxmemory-policy volatile-ttl
```

Restart Redis:
```bash
sudo systemctl restart redis-server
```

## Step 4: Connect to Your Mail Server

Add milter integration to your Postfix configuration in `/etc/postfix/main.cf`:

```
# Enable Rspamd milter
smtpd_milters = inet:localhost:11332
milter_default_action = accept
milter_protocol = 6
```

Configure Rspamd proxy worker in `/etc/rspamd/local.d/worker-proxy.inc`:

```hcl
# Enable milter mode for Postfix integration
milter = yes;
timeout = 120s;
upstream "local" {
  default = yes;
  self_scan = yes;  # Scan messages directly
}
```

Restart both services:
```bash
sudo systemctl restart rspamd
sudo systemctl restart postfix
```

**Note**: For complete Postfix/Dovecot setup details, TLS configuration, and other mail server settings, see the [MTA Integration Guide](/doc/tutorials/integration.html).

## Step 5: Test Your Setup

### Test message scanning

Test that Rspamd is working properly:

```bash
# Check Rspamd is running
sudo systemctl status rspamd

# Test scanning a message
echo "Test message" | rspamc

# Check logs for activity
sudo tail -f /var/log/rspamd/rspamd.log
```

### Access the Web Interface

1. Open your browser to `http://your-server:11334`
2. Enter the password you configured earlier
3. You should see the Rspamd dashboard with statistics and configuration options

## Step 6: Configure Bayesian Learning

Set up automatic learning to improve spam detection over time:

Create `/etc/rspamd/local.d/classifier-bayes.conf`:

```hcl
# Configure Bayes classifier to use Redis
servers = "127.0.0.1:6379";
backend = "redis";

# Auto-learning thresholds  
autolearn = true;
min_learns = 200;        # Minimum learned messages before classification
```

## Common Configuration Tasks

### Adjusting Spam Score Thresholds

Edit `/etc/rspamd/local.d/actions.conf`:

```hcl
# Lower thresholds for stricter filtering
reject = 12;     # Was 15 - reject obvious spam
add_header = 5;  # Was 6 - add spam headers
greylist = 3;    # Was 4 - temporary delay suspicious mail
```

### Customizing Individual Symbol Scores

Edit `/etc/rspamd/local.d/groups.conf`:

```hcl
symbols = {
  "BAYES_SPAM" = {
    score = 5.5;  # Increase Bayes spam weight
  }
  "SPF_FAIL" = {
    score = 2.0;  # Reduce SPF failure penalty
  }
}
```

### Whitelisting Trusted Senders

Create `/etc/rspamd/local.d/multimap.conf`:

```hcl
WHITELIST_SENDER_DOMAIN {
  type = "from";
  map = "/etc/rspamd/whitelist_domains.map";
  score = -10.0;
  description = "Trusted sender domains";
}
```

Create `/etc/rspamd/whitelist_domains.map`:
```
example.com
trusted-partner.org
```

### Using the Configuration Wizard

Rspamd includes a helpful configuration wizard:

```bash
sudo rspamadm configwizard
```

This interactive tool helps configure:
- Redis server connection
- Controller password
- DKIM signing
- Basic settings

## Using Rspamd

### Command Line Tools

**rspamc** - The main client for interacting with Rspamd:

```bash
# Scan a message file
rspamc message.eml

# Train Bayesian classifier
rspamc learn_spam spam_message.eml
rspamc learn_ham good_message.eml

# Check Rspamd statistics
rspamc stat
```

**rspamadm** - Administrative utilities:

```bash
# Test configuration
sudo rspamadm configtest

# View configuration help
rspamadm confighelp -k classifier

# Generate DKIM keys
rspamadm dkim_keygen -s mail -d example.com
```

### Automatic Learning with Email Clients

Set up automatic spam learning by configuring your email client to move spam to a "Junk" folder. Create a Dovecot Sieve script (`~/.dovecot.sieve`):

```sieve
require ["fileinto"];

if header :is "X-Spam" "Yes" {
    fileinto "Junk";
}
```

## Understanding Rspamd's Configuration System

Rspamd uses a hierarchical configuration system based on the [excellent explanation](https://www.0xf8.org/2018/05/an-alternative-introduction-to-rspamd-configuration-introduction/) from the alternative guide:

### Configuration Directories

- **`/etc/rspamd/`** - Main configuration (DO NOT edit directly)
- **`/etc/rspamd/local.d/`** - Your custom settings (merged with defaults)  
- **`/etc/rspamd/override.d/`** - Complete replacements of default settings

**Important**: Always use `local.d/` or `override.d/` for customizations, never edit the main config files directly.

### How Scoring Works

Rspamd calculates a spam score by adding up weights from various tests (symbols). The final score determines the action:

```
Total Score = Symbol1_weight + Symbol2_weight + Symbol3_weight + ...
```

**Score Components**: Each symbol has two parts:
- **Static weight** (configured value, e.g., 3.0)
- **Runtime confidence** (dynamic value, e.g., 0.5)
- **Final contribution** = static × runtime (e.g., 3.0 × 0.5 = 1.5)

### Common Symbol Groups

Symbols are organized into logical groups you can adjust:

- **`policies_group.conf`** - SPF, DKIM, DMARC validation
- **`rbl_group.conf`** - DNS blacklist results  
- **`statistics_group.conf`** - Bayesian classifier scores
- **`headers_group.conf`** - Email header analysis
- **`phishing_group.conf`** - URL and content analysis

Learn more about [actions and scores](/doc/faq.html#what-are-rspamd-actions) in the documentation.

## Troubleshooting

### Common Issues

**Rspamd not starting:**
```bash
# Check status and logs
sudo systemctl status rspamd
sudo journalctl -u rspamd -f

# Test configuration
sudo rspamadm configtest
```

**Web interface not accessible:**
- Check firewall settings
- Verify controller password is set
- Ensure port 11334 is accessible

**Mail not being scanned:**
- Check Postfix milter configuration
- Verify Rspamd proxy is running on port 11332
- Check mail logs: `sudo tail -f /var/log/mail.log`

**Low accuracy spam detection:**
- Train Bayesian classifier with more examples
- Check and adjust symbol scores
- Monitor learning progress in web interface

### Important Log Files
- **Rspamd**: `/var/log/rspamd/rspamd.log`
- **Mail system**: `/var/log/mail.log`
- **Redis**: `/var/log/redis/redis-server.log`

## Next Steps

### Immediate Improvements
1. **Set up automatic learning** with Dovecot Sieve
2. **Monitor and tune scores** based on your mail patterns
3. **Configure DKIM signing** for outbound mail
4. **Set up proper TLS** certificates

### Performance Optimization
1. **Configure multiple Redis instances** for better performance
2. **Enable neural networks** for improved accuracy
3. **Set up rate limiting** to prevent spam waves
4. **Consider IP reputation** modules

## Advanced Topics

For experienced users who want to dive deeper:

### Multiple Mail Server Integration
- [MTA Integration Guide](/doc/tutorials/integration.html)
- [Milter Protocol Configuration](/doc/workers/rspamd_proxy.html)

### Large-Scale Deployments
- [Redis Replication](/doc/tutorials/redis_replication.html) 
- [Neural Networks Setup](/doc/modules/neural.html)
- [Clickhouse Analytics](/doc/modules/clickhouse.html)

### Security Considerations
- [RBL Usage Policies](/doc/modules/rbl.html) - Important licensing information
- Network security and firewall configuration
- TLS setup with [Let's Encrypt](https://letsencrypt.org){:target="&#95;blank"}

## Additional Resources

### Official Documentation
- [Complete Configuration Reference](/doc/configuration/index.html)
- [Module Documentation](/doc/modules/)
- [WebUI Guide](/webui)

### Community Resources
- [An alternative introduction to rspamd configuration](https://www.0xf8.org/2018/05/an-alternative-introduction-to-rspamd-configuration-introduction/){:target="&#95;blank"} - Detailed configuration guide
- [Own mail server tutorial](https://thomas-leister.de/en/mailserver-debian-stretch/){:target="&#95;blank"} - Complete mail server setup
- [FreeBSD setup guide](https://web.archive.org/web/20240914211825/www.c0ffee.net/blog/mail-server-guide){:target="&#95;blank"} - Alternative platform guide

### Tools and Add-ons
- [Thunderbird Rspamd Add-on](https://addons.thunderbird.net/thunderbird/addon/rspamd-spamness/){:target="&#95;blank"} - Visualize spam scores
- [Rspamd Stats Visualization](https://github.com/moisseev/rspamd-spamness/){:target="&#95;blank"}

**Congratulations!** You now have a working Rspamd installation. Start with the basic configuration and gradually explore advanced features as your needs grow.













