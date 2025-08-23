---
title: About Rspamd
---

# About Rspamd

## Introduction

**Rspamd** is an advanced mail processing framework that works as a secure addition to your Mail Transfer Agent (MTA).
Operating independently from MTA internal mail flows, Rspamd provides enhanced security isolation while delivering
comprehensive message analysis and processing capabilities.

Built around a complete **Lua scripting framework**, Rspamd enables flexible message processing through:
- **Spam filtering** with statistical analysis and rule-based detection
- **Policy control** and compliance enforcement  
- **DKIM signing** and authentication
- **Machine learning integration** for adaptive filtering
- **Security tools orchestration** and threat intelligence

Each message is evaluated using multiple detection methods including regular expressions, statistical analysis,
and custom services such as URL blacklists. Based on the computed spam score and configured policies,
Rspamd recommends actions for the MTA - whether to pass, reject, quarantine, or modify messages.

Designed for high-performance environments, Rspamd processes hundreds of messages per second while maintaining
the flexibility to adapt to evolving security requirements through its extensible Lua API.

## Choose Your Path

This documentation is designed to help you succeed with Rspamd, whether you're a complete beginner or an experienced administrator. Choose the path that matches your needs:

### 🆕 New to Rspamd?
**Start here**: [Getting Started Guide](/getting-started/)

- **[Understanding Rspamd](/getting-started/understanding-rspamd)** - Build the right mental model first
- **[Installation Guide](/getting-started/installation)** - Choose the best installation method for your needs  
- **[First Success Setup](/getting-started/first-setup)** - Get working spam filtering in 30 minutes

### 🎯 Need Practical Configuration?
**Go to**: [Configuration Guide](/guides/configuration/)

- **[Configuration Fundamentals](/guides/configuration/fundamentals)** - Understand what to configure and how
- **[Tool Selection Guide](/guides/configuration/tool-selection)** - Choose the right approach for your task
- **Real-world examples** with complete, tested configurations

### 🏢 Looking for Your Specific Scenario?
**Browse**: [Real-World Scenarios](/scenarios/)

- **[Small Business Setup](/scenarios/small-business)** - Complete guide for businesses with < 1000 users
- **Enterprise configurations** - Scalable setups for large organizations
- **Migration guides** - Move from SpamAssassin or other solutions

### 🔧 Need Technical Reference?
**Reference**: Traditional documentation sections below

- **[Module Documentation](/modules/)** - Detailed parameter reference
- **[Lua API](/lua/)** - Programming interface documentation  
- **[Developer Guides](/developers/)** - Extending Rspamd functionality

## What Makes This Documentation Different?

Traditional Rspamd documentation has been reference-focused. We've added practical, user-friendly guides that:

✅ **Answer "how to accomplish X"** instead of just "what parameter Y does"
✅ **Provide decision frameworks** to help you choose the right approach
✅ **Include real-world scenarios** beyond basic setup examples  
✅ **Connect related concepts** so you understand how pieces fit together
✅ **Offer multiple learning paths** for different user needs and experience levels

## Quick Start Options

If you want to get started immediately:

### Docker Test Setup (15 minutes)
```bash
# Quick test environment
docker run -d --name rspamd-test -p 11334:11334 rspamd/rspamd:latest
# Access web interface at http://localhost:11334
```

### Production Package Install (Ubuntu/Debian)
```bash
# Add repository and install
curl -sSL https://rspamd.com/apt-stable/gpg.key | sudo apt-key add -
echo "deb https://rspamd.com/apt-stable/ $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/rspamd.list
sudo apt update && sudo apt install rspamd
```

For complete setup instructions, see the [Installation Guide](/getting-started/installation).

## Community and Support

- **[Community Forum](https://forum.rspamd.com/)** - Get help from users and developers
- **[GitHub Repository](https://github.com/rspamd/rspamd)** - Source code, issues, and contributions
- **[IRC Channel](https://web.libera.chat/#rspamd)** - Real-time chat support
- **[Professional Support](/support)** - Commercial support options


## License

This project is licensed under the <a href="https://tldrlegal.com/license/apache-license-2.0-(apache-2.0)" target="_blank" rel="noopener noreferrer">Apache 2.0 License</a>

