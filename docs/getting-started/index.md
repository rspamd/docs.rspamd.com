---
title: Getting Started with Rspamd
sidebar_position: 1
---

# Getting started with Rspamd

The pages below take you from a new server to Rspamd checking mail for your MTA. If you are new to Rspamd, read them in order. If you are migrating from SpamAssassin, connecting an existing installation to your MTA, or running Rspamd in containers, see [Other starting points](#other-starting-points).

## Prerequisites

- Debian, Ubuntu or a RHEL-compatible distribution (the EL packages need EPEL), FreeBSD, or any host that runs Docker. [Downloads](/downloads) lists the supported releases, packages for other systems and how to build from source.
- Root or sudo access to install packages and edit the Rspamd configuration in `/etc/rspamd` (`/usr/local/etc/rspamd` on FreeBSD).
- Redis, for Bayes and the other features listed under [Is Redis required?](#is-redis-required). You can install it during setup.
- A local recursive DNS resolver, for example Unbound. Spamhaus and other DNS blocklists refuse queries that arrive through public resolvers.
- An MTA to connect Rspamd to.
- Working knowledge of the Unix command line, DNS, SMTP and message headers.

## Reading order

1. [Understanding Rspamd](/getting-started/understanding-rspamd) explains how a message moves through Rspamd: the processing pipeline, symbols, scores and actions, and the worker processes. Read it before you change any configuration.
2. [Installation](/getting-started/installation) covers installing Rspamd and Redis from the official packages or running the official Docker image, connecting Rspamd to Redis, setting the web interface password and checking that the workers are listening. [Downloads](/downloads) also has the experimental and ASAN packages.
3. [First setup](/getting-started/first-setup) checks the Redis connection and the web interface password, then covers the action thresholds, Postfix integration, an end-to-end test and Bayes training (by hand with `rspamc learn_spam` and `rspamc learn_ham`, or with autolearn). For Exim, Sendmail and other MTAs, use the [MTA integration tutorial](/tutorials/integration).
4. [Configuration fundamentals](/guides/configuration/fundamentals) covers modules, scores, actions, workers and the `local.d`/`override.d` layout, so you know where each change goes.
5. [Tool selection](/guides/configuration/tool-selection) helps you choose between regexp rules, multimap, Lua rules, plugins and composites when you write your own rules.

## Other starting points

### Migrating from SpamAssassin

Read [Understanding Rspamd](/getting-started/understanding-rspamd), then follow the [SpamAssassin migration guide](/tutorials/migrate_sa). The main differences from SpamAssassin:

- SpamAssassin Bayes databases cannot be imported. Retrain Rspamd from your own ham and spam with `rspamc learn_ham` and `rspamc learn_spam`.
- Rspamd returns an action (such as `add header` or `reject`) together with the score. The default thresholds in `actions.conf` are `greylist = 4`, `add_header = 6` and `reject = 15`. Tune them against your own mail instead of copying SpamAssassin's `required_score`.
- Rspamd has its own modules for SPF, DKIM, DMARC, DNS blocklists, Bayes and fuzzy hashes. Import only custom rules you wrote yourself, using the [SpamAssassin module](/modules/spamassassin).
- Rspamd can also sign outbound mail ([DKIM signing](/modules/dkim_signing), [ARC](/modules/arc)) and send [DMARC](/modules/dmarc) aggregate reports. SpamAssassin only checks DMARC and ARC.
- Rspamd is event-driven: each worker scans many messages at once and does DNS and Redis lookups without blocking, while each SpamAssassin `spamd` child process handles one message at a time. The project reports roughly ten times SpamAssassin's throughput with the same rules; see [Performance](/about/performance).

The migration guide describes a staged [rollout](/tutorials/migrate_sa#rollout-strategy). Run Rspamd next to SpamAssassin without rejecting mail ([Testing alongside SpamAssassin](/getting-started/installation#testing-alongside-spamassassin) shows the action settings) and compare the verdicts. Tune the thresholds, then switch the MTA over. Keep SpamAssassin installed until you no longer need a rollback.

### Connecting a mail server

If Rspamd is already installed and you only need to connect your MTA:

| MTA | Protocol | Rspamd worker (default address) | Instructions |
|---|---|---|---|
| Postfix | Milter | Proxy (`localhost:11332`) | [First setup](/getting-started/first-setup#step-3-mail-server-integration) |
| Sendmail | Milter | Proxy (`localhost:11332`) | [MTA integration](/tutorials/integration#using-rspamd-with-sendmail-mta) |
| Exim | `spamd_address` with `variant=rspamd` (legacy RSPAMC protocol) | Normal (`localhost:11333`) | [MTA integration](/tutorials/integration#integration-with-exim-mta) |

The [MTA integration tutorial](/tutorials/integration) also covers Haraka, EmailSuccess, Apache James, Stalwart and LDA mode.

### Docker and Kubernetes

The official image is `rspamd/rspamd`. See the Docker section of [Installation](/getting-started/installation#docker-installation) and the [image README](https://github.com/rspamd/rspamd-docker), which also describes production use with your configuration baked into a derived image. Some things work differently from a package install:

- Put your configuration in `/etc/rspamd/local.d` (and `override.d` if needed): mount a host directory there, or copy the files into a derived image.
- The image binds every worker to all container interfaces. Publish the ports on `127.0.0.1` only. Set a controller password before you use the web interface: connections through a published port come from outside `secure_ip` (loopback by default), and the controller refuses the default password `q1` from such addresses.
- Bayes, neural, ratelimit and greylisting data live in Redis, so run Redis too and persist its data. `/var/lib/rspamd` holds caches, history and counters. It is already a volume in the image; if you bind-mount a host directory there, it must be writable by uid/gid 11333.
- Use a local recursive DNS resolver. The [Compose example](https://github.com/rspamd/rspamd-docker/tree/main/examples/compose) runs Rspamd with Redis and Unbound.
- The image has a `HEALTHCHECK` on the controller's `/ping` endpoint, which needs no password; use `/ping` for liveness probes too. For readiness use `/ready` on the controller, which needs the controller password unless the probe comes from `secure_ip`. See [Production notes](/getting-started/installation#production-notes).

For Kubernetes, see [Kubernetes](/getting-started/installation#kubernetes) in the installation guide and the [Tanka example](https://github.com/rspamd/rspamd-docker/tree/main/examples/k8s/tanka) in the same repository.

## Common questions

### Is Redis required?

Rspamd starts without Redis, but install it for any production setup. Set the servers in `/etc/rspamd/local.d/redis.conf`. In the default configuration, these features keep their data in Redis and do not work without it:

- the Bayes classifier (per-token spam and ham counters)
- the neural module
- ratelimit and greylisting
- DMARC aggregate reporting
- your own [fuzzy storage worker](/workers/fuzzy_storage), if you run one (disabled by default)

The `history_redis` module also stores the scan history for the web interface's History tab in Redis. Without Redis, the History tab shows the controller's built-in history instead. Fuzzy checks against the public rspamd.com storage need no local Redis.

### What works without training?

Most checks need no training: SPF, DKIM, DMARC and ARC verification, DNS blocklists for IP addresses and URLs, regexp content rules, MIME and URL checks, and fuzzy checks against the public rspamd.com storage. Bayes gives no result until it has learned at least 200 spam and 200 ham messages (the `min_learns` setting), and the neural module also has to collect training data first. Training Bayes on your own mail usually improves detection noticeably over static rules alone.

### Is Lua required?

No. You configure the built-in modules with UCL files in `/etc/rspamd/local.d/`, and multimap, regexp rules, selectors and composites cover many custom rules without code. You need Lua only for writing plugins and for rules these tools can't express. Put such rules in `/etc/rspamd/rspamd.local.lua` or in a `*.lua` file in `/etc/rspamd/lua.local.d/`. [Tool selection](/guides/configuration/tool-selection) explains which to use.

## After getting started

Configuration guides:

- [Multimap guide](/tutorials/multimap_guide) for allow and block lists keyed on senders, IP addresses, URLs and other message data
- [Settings guide](/tutorials/settings_guide) for different settings per domain, user or source
- [DKIM signing guide](/tutorials/dkim_signing_guide) for signing outbound mail

Module reference:

- [Modules](/modules/) lists the built-in modules
- [SPF](/modules/spf), [DKIM](/modules/dkim), [DMARC](/modules/dmarc) and [ARC](/modules/arc) for sender authentication
- [Statistics](/configuration/statistic) for the Bayes classifier, its Redis storage and autolearn
- [RBL](/modules/rbl) for DNS blocklists
- [Greylisting](/modules/greylisting) and [Ratelimit](/modules/ratelimit)

Internals and development:

- [Architecture](/developers/architecture) for processes, the event loop and the processing pipeline
- [Writing rules](/developers/writing_rules) for custom rules, from simple symbols to selectors, Lua and plugins
- [Protocol](/developers/protocol) for the HTTP scanning protocol and reply format
- [Controller endpoints](/developers/controller_endpoints) for the controller's HTTP API
- [Lua API](/lua/) reference

Operations:

- [Proxy worker](/workers/rspamd_proxy) for milter mode and spreading load over several scanners
- [Redis replication](/tutorials/redis_replication)
- [ClickHouse analytics](/tutorials/clickhouse_analytics) for storing scan results and building dashboards
- [Performance](/about/performance)

## Getting help

| You need | Go to |
|---|---|
| Answers to common questions | [FAQ](/faq) |
| Help from other users | [Discord](https://discord.gg/RsBM5KXtgX), [Telegram](https://t.me/rspamd), [GitHub Discussions](https://github.com/rspamd/rspamd/discussions) or the [mailing lists](https://lists.rspamd.com) |
| To report a bug or request a feature | [GitHub Issues](https://github.com/rspamd/rspamd/issues) |
| To contribute code | [Pull requests](https://github.com/rspamd/rspamd/pulls) on rspamd/rspamd |
| Commercial support (consulting, NDA, dedicated access to fuzzy storage or DNS lists) | support@rspamd.com, see [Support](/support#commercial-support) |
| To report a security vulnerability | [GitHub private vulnerability reporting](https://github.com/rspamd/rspamd/security/advisories/new) (preferred), or email vsevolod@rspamd.com with `[SECURITY]` in the subject |
| To report a documentation problem | [docs.rspamd.com issues](https://github.com/rspamd/docs.rspamd.com/issues), or a pull request through the "Edit this page" link |

Do not open public GitHub issues for security problems. [SECURITY.md](https://github.com/rspamd/rspamd/blob/master/SECURITY.md) explains what the project treats as a vulnerability.
