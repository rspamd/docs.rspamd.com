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

## Choose your path

This documentation is designed to help you succeed with Rspamd, whether you're a complete beginner or an experienced administrator. Choose the path that matches your needs:

### 🆕 New to Rspamd?
**Start here**: [Getting started](/getting-started/)

- **[Understanding Rspamd](/getting-started/understanding-rspamd)** - Build the right mental model first
- **[Installation](/getting-started/installation)** - Choose the best installation method for your needs  
- **[First setup](/getting-started/first-setup)** - Get working spam filtering in 30 minutes

### 🎯 Need practical configuration?
**Go to**: [Configuration guides](/guides/configuration/)

- **[Configuration fundamentals](/guides/configuration/fundamentals)** - Understand what to configure and how
- **[Tool selection](/guides/configuration/tool-selection)** - Choose the right approach for your task
- Examples with complete, tested configurations


### 🔧 Need technical reference?
Use the traditional documentation sections below

- **[Module documentation](/modules/)** - Detailed parameter reference
- **[Lua API](/lua/)** - Programming interface documentation  
- **[Developer guides](/developers/)** - Extending Rspamd functionality

 

## Quick start options

If you want to get started immediately:

### Docker test setup (15 minutes)
```bash
# Quick test environment
docker run -d --name rspamd-test -p 11334:11334 rspamd/rspamd:latest
# Access web interface at http://localhost:11334
```

### Production package install (Ubuntu/Debian)
```bash
# Add repository key and list (modern keyring method)
sudo install -d -m 0755 /etc/apt/keyrings
wget -O- https://rspamd.com/apt-stable/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/rspamd.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/rspamd.gpg] https://rspamd.com/apt-stable/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/rspamd.list
sudo apt update && sudo apt install -y rspamd
```

For complete setup instructions, see the [installation guide](/getting-started/installation).

## Community and support

- **[GitHub Discussions](https://github.com/rspamd/rspamd/discussions)** - Ask questions and share ideas
- **[Discord](https://discord.gg/RsBM5KXtgX)** - Real-time chat for quick questions and updates
- **[Telegram](https://t.me/rspamd)** - Community chat

- **[GitHub repository](https://github.com/rspamd/rspamd)** - Source code, issues, and contributions
- **[Mailing lists](https://lists.rspamd.com)** - Mailing lists for long term discussions and questions
- **[Support](/support)** - Commercial support options


## License

This project is licensed under the <a href="https://tldrlegal.com/license/apache-license-2.0-(apache-2.0)" target="_blank" rel="noopener noreferrer">Apache 2.0 License</a>

