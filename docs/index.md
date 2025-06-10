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

## Getting Started

A good starting point to study how to install and configure Rspamd is [the quick start guide](/tutorials/quickstart).

Rspamd is [packaged](/downloads) for the major Linux distributions, and is also available via <a href="https://freshports.org/mail/rspamd" target="_blank" rel="noopener noreferrer">FreeBSD ports</a>, <a href="https://pkgsrc.org" target="_blank" rel="noopener noreferrer">NetBSD pkgsrc</a> and <a href="https://openports.pl/path/mail/rspamd" target="_blank" rel="noopener noreferrer">OpenBSD ports</a>.

## Spam filtering features

Rspamd is shipped with various spam filtering modules and features enabled just out of the box.
The full list of built-in modules could be found in the [modules documentation](/modules/).

If that is not enough, Rspamd provides an extensive [Lua API](/lua/) to [write your own rules and plugins](/developers/writing_rules).


## License

This project is licensed under the <a href="https://tldrlegal.com/license/apache-license-2.0-(apache-2.0)" target="_blank" rel="noopener noreferrer">Apache 2.0 License</a>

