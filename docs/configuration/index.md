---
title: Configuration Guide
sidebar_position: 2
---

# Rspamd Configuration Guide

This page links the guides and reference pages for configuring Rspamd. The guides explain **what to configure** and which file each change goes in; the reference pages describe the options of one area in detail. If Rspamd is not installed yet, start with [installation](/getting-started/installation) and [first setup](/getting-started/first-setup).

## How the Configuration Is Layered

Rspamd filters spam with its shipped configuration, so you only add the settings you want to change. Don't edit the shipped files: upgrades bring new versions of them. Rspamd reads the configuration in layers, from lowest to highest precedence:

1. Shipped defaults: `rspamd.conf` and the files next to it, `modules.d/` and `scores.d/`
2. `local.d/`: merged with the defaults, so a file holds only the settings you change
3. Scores and action thresholds saved from the web interface (`/var/lib/rspamd/rspamd_dynamic`)
4. `override.d/`: each key or block you define replaces the default as a whole

[Precedence](/guides/configuration/fundamentals#precedence) has examples. Change one thing at a time, check it with `rspamadm configtest`, and watch the results in the web interface before you make the next change.

## Getting Started with Configuration

### New to Rspamd Configuration?

1. **[Configuration Fundamentals](/guides/configuration/fundamentals)** - What to configure and how
2. **[Tool Selection Guide](/guides/configuration/tool-selection)** - Which mechanism to use for a custom check
3. **[Common Setups](/guides/configuration/fundamentals#common-setups)** - Which files a minimal, a tuned and a high-volume setup change
4. **[Testing Changes](/guides/configuration/fundamentals#testing-changes)** - Check the configuration before you restart Rspamd

### Specific Configuration Tasks?

- **[Spam Filtering Tuning](/configuration/metrics)** - Adjust thresholds and scores
- **[Performance Tuning](/getting-started/first-setup#performance-tuning)** - Worker count, DNS and scan limits
- **[Custom Rules](/developers/writing_rules)** - Create rules for your specific needs
- **[Integration Configuration](/tutorials/integration)** - Connect with MTAs and other systems

## Configuration Areas

| Area | What it controls | Where you change it | Reference |
|------|------------------|---------------------|-----------|
| [Actions](/guides/configuration/fundamentals#actions) | What Rspamd tells the MTA to do at each score | `local.d/actions.conf` | [Actions and scores](/configuration/metrics) |
| [Scores](/guides/configuration/fundamentals#scores) | How much each symbol adds to the message score | `local.d/groups.conf` or `local.d/<group>_group.conf`, or the web interface | [Actions and scores](/configuration/metrics) |
| [Modules](/guides/configuration/fundamentals#modules) | Which checks run and how they are set up | `local.d/<module>.conf` | [Modules](/modules/) |
| [Workers](/guides/configuration/fundamentals#workers) | The processes that scan mail, serve the web interface and talk to the MTA | `local.d/worker-<name>.inc` | [Workers](/workers/) |
| [General options](/guides/configuration/fundamentals#general-options) | DNS, timeouts, size limits | `local.d/options.inc` | [Common options](/configuration/options) |
| [Logging](/guides/configuration/fundamentals#logging) | Log level, destination and format | `local.d/logging.inc` | [Logging](/configuration/logging) |
| Redis | Servers for Bayes, greylisting, rate limiting and other modules that keep data in Redis | `local.d/redis.conf` | [Redis configuration](/configuration/redis) |
| Bayes | The statistical classifier | `local.d/classifier-bayes.conf` | [Statistics](/configuration/statistic) |

Other reference pages:

- [User settings](/configuration/settings): different scores, thresholds and checks for selected users, domains or IP addresses
- [Composite symbols](/configuration/composites): new symbols from expressions over other symbols
- [Maps](/configuration/maps): lists that Rspamd loads from files or URLs and reloads without a restart
- [Selectors](/configuration/selectors): extract data from messages for multimap, ratelimit and other modules
- [Upstreams](/configuration/upstream): server lists and how Rspamd picks a server from them
- [UCL](/configuration/ucl): the syntax of the configuration files
- [Configuration templates](/configuration/templates): Jinja templates and environment variables in configuration files

## Configuration by Scenario

Different environments have different needs. Find the guide that matches your situation:

### By Use Case
- **[Migration from SpamAssassin](/tutorials/migrate_sa)** - Migration path, rule conversion and rollout
- **[Per-Domain and Per-User Settings](/tutorials/settings_guide)** - Different thresholds and checks for different domains, users or senders
- **[Allow and Block Lists](/tutorials/multimap_guide)** - Multimap rules for domains, IP addresses, headers, URLs and attachments
- **[Scanning Outbound Mail](/tutorials/scanning_outbound)** - How modules treat mail sent by your users, and how to control it
- **[DKIM Signing](/tutorials/dkim_signing_guide)** - Sign outgoing mail

### By Integration Type
- **[Postfix Integration](/getting-started/first-setup)** - Complete Postfix + Rspamd setup
- **[Other MTAs](/tutorials/integration)** - Exim, Sendmail, Haraka, Stalwart and others
- **[Docker](/getting-started/installation#docker-installation)** - The official image and a Compose file with Redis and a recursive resolver
- **[Kubernetes](/getting-started/installation#kubernetes)** - Deployment example, probes, and what to run separately
- **[Alongside SpamAssassin](/getting-started/installation#testing-alongside-spamassassin)** - Run Rspamd next to SpamAssassin and compare results before Rspamd rejects anything

## Configuration Best Practices

### File Organization
```bash
/etc/rspamd/
├── local.d/          # Your customizations (recommended)
│   ├── actions.conf      # Spam thresholds
│   ├── groups.conf       # Symbol scores
│   └── worker-*.inc      # Worker settings
├── override.d/       # Replaces defaults key by key (advanced)
└── modules.d/        # Don't edit - defaults only
```

On FreeBSD the directory is `/usr/local/etc/rspamd/`. A file in `local.d/` contains only the settings you change, without the section name around them: `local.d/actions.conf` contains `reject = 20;`, not `actions { reject = 20; }`. Older guides set scores in `local.d/metrics.conf`; that file has been deprecated since Rspamd 1.7.

### Change Management Process
1. **Backup current configuration** before making changes
2. **Test syntax** with `rspamadm configtest` before restarting
3. **Monitor results** in web interface after changes
4. **Document changes** for future reference
5. **Have rollback plan** for critical changes

### Common Mistakes to Avoid
- ❌ Editing the shipped files in `/etc/rspamd/` instead of adding files to `local.d/`
- ❌ Making multiple changes without testing  
- ❌ Setting unrealistic action thresholds
- ❌ Disabling essential modules without understanding impact
- ❌ Ignoring log files during troubleshooting

## Configuration Tools and Interfaces

### Web Interface (Recommended for Beginners)
- **Access**: `http://localhost:11334`. The controller listens only on localhost by default, so from another machine use an [SSH tunnel](/getting-started/first-setup#web-interface-password)
- **Best for**: Monitoring, basic adjustments, learning
- **Limitations**: It changes only symbol scores, action thresholds and maps; everything else needs the configuration files

### Configuration Files (Advanced Users)
- **Location**: `/etc/rspamd/local.d/`
- **Best for**: Complex customizations, automation
- **Requirements**: Understanding of Rspamd configuration syntax ([UCL](/configuration/ucl))

### Command Line Tools
- **`rspamc`** - Query statistics, test messages
- **[`rspamadm`](/administration/rspamadm/)** - Administrative tasks, configuration management
- **`rspamadm configtest`** - Configuration validation

## Getting Help with Configuration

### Built-in Help
```bash
# Show the configuration as Rspamd loads it
rspamadm configdump

# Validate configuration files
sudo rspamadm configtest

# Describe a configuration option
rspamadm confighelp options.task_timeout

# List rspamadm commands, or show the options of one command
rspamadm help
rspamadm help configdump
```

### Documentation Resources
- **[Configuration FAQ](/faq#configuration)** - `local.d` and `override.d`, changing scores, disabling modules and rules
- **[Module Documentation](/modules/)** - Detailed module configuration
- **[Why Isn't My Configuration Working?](/faq#why-isnt-my-configuration-working)** - A section wrapper inside a `local.d/` file
- **[Common Issues](/getting-started/first-setup#common-issues)** - Connection refused, missing spam headers, too much or too little mail marked as spam

### Community Support
- **[GitHub Issues](https://github.com/rspamd/rspamd/issues)** - Report bugs and feature requests
- **[GitHub Discussions](https://github.com/rspamd/rspamd/discussions)** - Propose or discuss an idea
- **[Discord](https://discord.gg/RsBM5KXtgX)** and **[Telegram](https://t.me/rspamd)** - Quick questions and troubleshooting help
- **[Mailing Lists](https://lists.rspamd.com)** - Announcements and long-form threads

[Support](/support) also describes commercial support.

## Configuration Examples

### Quick Start Configuration
The shipped configuration filters spam without changes. Its action thresholds are `reject = 15`, `add_header = 6` and `greylist = 4`, so you don't need `local.d/actions.conf` to start. Add Redis, which Bayes, greylisting and rate limiting need, and a password for the web interface:

```hcl
# /etc/rspamd/local.d/redis.conf
servers = "127.0.0.1";
```

```hcl
# /etc/rspamd/local.d/worker-controller.inc
password = "$2$...";   # hash printed by rspamadm pw
```

### Tuned Configuration
Lower action thresholds and a higher score for one symbol. Change values like these only after you have checked the results in the History tab of the web interface:

```hcl
# /etc/rspamd/local.d/actions.conf
reject = 12;       # default 15
add_header = 5;    # default 6
greylist = 3;      # default 4
```

```hcl
# /etc/rspamd/local.d/groups.conf
symbols {
  "FORGED_SENDER" {
    weight = 1.0;    # default 0.3
  }
}
```

### High-Volume Configuration
More scanner processes and a local recursive resolver:

```hcl
# /etc/rspamd/local.d/worker-normal.inc
count = 8;   # example value
```

```hcl
# /etc/rspamd/local.d/options.inc
dns {
  nameserver = ["127.0.0.1"];   # local recursive resolver
}
```

Leave `max_tasks` and the other `dns` options at their defaults. `max_tasks` caps how many messages one process handles at the same time; it does not increase throughput. See [Normal worker](/guides/configuration/fundamentals#normal-worker) for `count` and `max_tasks`, and [Performance tuning](/getting-started/first-setup#performance-tuning) for the DNS options.

## What's Next?

Choose your path based on your current needs:

- **Just getting started?** → [Configuration Fundamentals](/guides/configuration/fundamentals)
- **Need a custom check?** → [Tool Selection Guide](/guides/configuration/tool-selection)
- **Want to optimize performance?** → [Performance Tuning](/getting-started/first-setup#performance-tuning)
- **Ready for advanced features?** → [Writing Rules](/developers/writing_rules)

Remember: **Effective configuration is an iterative process**. Start with the basics, monitor results, and refine based on your actual email patterns and business requirements.
