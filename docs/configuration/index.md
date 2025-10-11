---
title: Configuration Guide
sidebar_position: 2
---

# Rspamd Configuration Guide

This section helps you understand and customize Rspamd configuration for your specific needs. Unlike pure reference documentation, these guides focus on **what to configure** and **how to configure it effectively**.

## Configuration Philosophy

Rspamd configuration follows a **layered approach**:

1. **Start simple** - Get working spam filtering with minimal changes
2. **Understand the system** - Learn what each configuration area controls  
3. **Customize incrementally** - Make targeted changes based on real-world results
4. **Monitor and iterate** - Continuously improve based on feedback

## Getting Started with Configuration

### New to Rspamd Configuration?
**Recommended path**: Foundation → Practical → Advanced

1. **[Configuration Fundamentals](/guides/configuration/fundamentals)** - What to configure and how
2. **[Tool Selection Guide](/guides/configuration/tool-selection)** - Choose the right approach for your task
3. **[Common Patterns](common-patterns)** - Proven configuration approaches
4. **[Testing and Validation](testing)** - Ensure your changes work correctly

### Specific Configuration Tasks?
**Recommended path**: Find your task → Apply → Validate

- **[Spam Filtering Tuning](/configuration/metrics)** - Adjust thresholds and scores
- **[Performance Optimization](/about/performance)** - Speed up Rspamd operation  
- **[Custom Rules](/developers/writing_rules)** - Create rules for your specific needs
- **[Integration Configuration](/tutorials/integration)** - Connect with MTAs and other systems

## Configuration Areas

### Core Configuration
These are the essential areas most users need to understand:

| Area | Purpose | Typical Changes | Impact Level |
|------|---------|-----------------|--------------|
| **[Actions & Thresholds](/configuration/metrics)** | What to do at different spam scores | Almost everyone adjusts | 🔥 High |
| **[Module Settings](/modules)** | Which tests to run and how | Common for customization | 🔶 Medium |
| **[Worker Configuration](/workers)** | Process behavior and integration | MTA integration required | 🔶 Medium |

### Advanced Configuration  
These areas require deeper understanding but offer powerful customization:

| Area | Purpose | When to Modify | Impact Level |
|------|---------|----------------|--------------|
| **[Symbol Scores](/configuration/metrics)** | Fine-tune individual test weights | Performance optimization | 🔥 High |
| **[Custom Rules](custom-rules)** | Business-specific detection logic | Unique requirements | 🔶 Medium |
| **[System Options](/configuration/options)** | DNS, timeouts, resource limits | Infrastructure adaptation | 🔵 Low |

## Configuration by Scenario

Different environments have different needs. Find the guide that matches your situation:

### By Organization Size
- **[Small Business (< 1000 users)](/scenarios/small-business)** - Simple, low-maintenance setup
- **[Enterprise (1000+ users)](/scenarios/enterprise)** - Scalable, policy-driven configuration
- **[ISP/Hosting Provider](/scenarios/isp-hosting)** - High-volume, multi-tenant setup

### By Use Case
- **[Migration from SpamAssassin](/scenarios/spamassassin-migration)** - Maintain effectiveness while switching
- **[High-Security Environment](/scenarios/high-security)** - Stricter filtering, compliance requirements
- **[Development/Testing](/scenarios/development)** - Flexible setup for testing and development

### By Integration Type
- **[Postfix Integration](/integration/postfix)** - Complete Postfix + Rspamd setup
- **[Cloud Deployment](/integration/cloud)** - Container and Kubernetes configuration
- **[Hybrid Setup](/integration/hybrid)** - Rspamd alongside existing solutions

## Configuration Best Practices

### File Organization
```bash
/etc/rspamd/
├── local.d/          # Your customizations (recommended)
│   ├── actions.conf      # Spam thresholds
│   ├── metrics.conf      # Symbol scores  
│   └── worker-*.inc      # Worker settings
├── override.d/       # Complete replacements (advanced)
└── modules.d/        # Don't edit - defaults only
```

### Change Management Process
1. **Backup current configuration** before making changes
2. **Test syntax** with `rspamd -t` before restarting
3. **Monitor results** in web interface after changes
4. **Document changes** for future reference
5. **Have rollback plan** for critical changes

### Common Mistakes to Avoid
- ❌ Editing files in `/etc/rspamd/` directly
- ❌ Making multiple changes without testing  
- ❌ Setting unrealistic action thresholds
- ❌ Disabling essential modules without understanding impact
- ❌ Ignoring log files during troubleshooting

## Configuration Tools and Interfaces

### Web Interface (Recommended for Beginners)
- **Access**: http://your-server:11334
- **Best for**: Monitoring, basic adjustments, learning
- **Limitations**: Not all settings available

### Configuration Files (Advanced Users)
- **Location**: `/etc/rspamd/local.d/`
- **Best for**: Complex customizations, automation
- **Requirements**: Understanding of Rspamd configuration syntax

### Command Line Tools
- **`rspamc`** - Query statistics, test messages
- **`rspamadm`** - Administrative tasks, configuration management
- **`rspamd -t`** - Configuration validation

## Getting Help with Configuration

### Built-in Help
```bash
# Check current configuration
rspamc configdump

# Validate configuration files
rspamd -t

# Get help on specific commands
rspamadm help
```

### Documentation Resources
- **[Configuration Reference](/configuration/)** - Complete parameter documentation
- **[Module Documentation](/modules/)** - Detailed module configuration
- **[Troubleshooting Guide](/troubleshooting/)** - Common configuration problems

### Community Support
- **[Community Forum](https://forum.rspamd.com/)** - Get help from other users
- **[GitHub Issues](https://github.com/rspamd/rspamd/issues)** - Report bugs and feature requests
- **[IRC Channel](https://web.libera.chat/#rspamd)** - Real-time help from developers

## Configuration Examples

### Quick Start Configuration
Minimal setup for immediate spam filtering:

```hcl
# /etc/rspamd/local.d/actions.conf
reject = 15;
add_header = 6; 
greylist = 4;
```

### Production Configuration
Balanced setup for business email:

``hcl
# /etc/rspamd/local.d/actions.conf
reject = 12;
add_header = 5;
greylist = 3;

# /etc/rspamd/local.d/metrics.conf
symbol "FORGED_SENDER" {
  score = 1.0;
}
```

### High-Volume Configuration
Optimized for performance:

``hcl
# /etc/rspamd/local.d/worker-normal.inc
max_tasks = 200;
task_timeout = 5s;

# /etc/rspamd/local.d/options.inc
dns {
  sockets = 32;
  timeout = 2s;
}
```

## What's Next?

Choose your path based on your current needs:

- **Just getting started?** → [Configuration Fundamentals](/guides/configuration/fundamentals)
- **Need to solve a specific problem?** → [Tool Selection Guide](/guides/configuration/tool-selection)
- **Want to optimize performance?** → [Performance Configuration](performance)
- **Ready for advanced features?** → [Custom Rules and Advanced Configuration](advanced)

Remember: **Effective configuration is an iterative process**. Start with the basics, monitor results, and refine based on your actual email patterns and business requirements.
