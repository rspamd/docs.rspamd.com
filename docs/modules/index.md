---
title: Modules documentation
---

# Rspamd modules

Rspamd ships with a set of modules. Some modules are written in C to speed up
complex procedures, while others are written in Lua to reduce code size.
We encourage you to write new modules in Lua and add the essential
support to the Lua API itself. Lua modules are very close to
C modules in terms of performance. Lua modules, however, can be written and loaded
dynamically.

## C Modules

C modules provide the core functionality of Rspamd and are statically linked to the
main Rspamd code. C modules are defined in options.inc with the `filters` attribute.
The default configuration enables all C modules explicitly:

~~~hcl
filters = "chartable,dkim,regexp,fuzzy_check";
~~~

If no `filters` attribute is defined, all C modules are disabled. To understand how to
override defaults, see the FAQ on [the difference between local.d and override.d](/faq#what-is-the-difference-between-locald-and-overrided).

Available C modules:

- [chartable](/modules/chartable): checks character sets of text parts in messages. (Note:
"char" as in character, and "table" as in a table of character sets.)
- [dkim](/modules/dkim): performs DKIM signatures checks.
- [fuzzy_check](/modules/fuzzy_check): checks a message's fuzzy hashes against public blacklists.
- [regexp](/modules/regexp): a core module that deals with regular expressions, internal
functions and Lua code to filter messages.

In prior releases other C modules were enabled by default:

- [spf](/modules/spf): checks SPF records for messages processed. This C module was removed in
version 2.3 and replaced by an equivalent Lua module.
- [surbl](/modules/surbl): extracts URLs from messages and check them against
public DNS black-lists to filter messages containing malicious URLs. This module was removed
in version 2.0 and replaced by the [rbl module](/modules/rbl). In an upgrade to v2, the existing
configuration is automatically converted.

## Lua modules

Lua modules are dynamically loaded on Rspamd startup and are reloaded on Rspamd
reconfiguration. Should you want to write a Lua module, consult the
[Lua API documentation](/lua/). To define a path to Lua modules there is a section
named `modules` in common.conf:

~~~hcl
modules {
  path = "${PLUGINSDIR}";
  fallback_path = "${SHAREDIR}/lua"; # Legacy path
  try_path = "${LOCAL_CONFDIR}/plugins.d/"; # User plugins
}
~~~

If a path is a directory then Rspamd scans it for `*.lua` pattern and load all
files matched.

The following Lua modules are enabled in the default configuration (but may require additional configuration to work, see notes below):

- [antivirus](/modules/antivirus) - integrates virus scanners (requires configuration)
- [arc](/modules/arc) - checks and signs ARC signatures
- [asn](/modules/asn) - looks up ASN-related information
- [clickhouse](/modules/clickhouse) - pushes scan-related information to clickhouse DBMS (requires configuration)
- [bayes_expiry](/modules/bayes_expiry) - provides expiration of statistical tokens (requires Redis and configuration)
- [dkim_signing](/modules/dkim_signing) - adds DKIM signatures to messages (requires configuration)
- [dmarc](/modules/dmarc) - performs DMARC policy checks (requires Redis & configuration for reporting)
- [external_services](/modules/external_services) - integrates external scanners such as oletools, DCC, Pyzor, Razor or ICAP servers (requires configuration)
- [force_actions](/modules/force_actions) - forces actions if selected symbols are detected (requires configuration)
- [greylisting](/modules/greylisting) - allows to delay suspicious messages (requires Redis)
- [hfilter](/modules/hfilter) - checks HELO, hostname, sender, recipients, Message-ID and URLs for common bad patterns
- [history redis](/modules/history_redis) - stores history in Redis (requires Redis)
- [maillist](/modules/maillist) - determines the common mailing list signatures in a message.
- [metadata_exporter](/modules/metadata_exporter) - pushes message metadata to external systems (requires configuration)
- [metric_exporter](/modules/metric_exporter) - pushes statistics to external monitoring systems (requires configuration)
- [mid](/modules/mid) - selectively suppresses invalid/missing message-id rules
- [milter_headers](/modules/milter_headers) - adds/removes headers from messages (requires configuration)
- [mime_types](/modules/mime_types) - applies some rules about mime types met in messages
- [multimap](/modules/multimap) - a complex module that operates with different types of maps.
- [neural networks](/modules/neural) - allows to post-process messages using neural network classification. (requires Redis).
- [once_received](/modules/once_received) - detects messages with a single `Received` headers and performs some additional checks for such messages.
- [phishing](/modules/phishing) - detects messages with phished URLs.
- [ratelimit](/modules/ratelimit) - implements leaked bucket algorithm for ratelimiting (requires Redis & configuration)
- [replies](/modules/replies) - checks if an incoming message is a reply for our own message (requires Redis)
- [rbl](/modules/rbl) - a plugin that checks messages against DNS runtime blacklists.
- [reputation](/modules/reputation) - a plugin that manages reputation evaluation based on various rules.
- [spamassassin](/modules/spamassassin) - load spamassassin rules (requires configuration)
- [spf](/modules/spf) - perform SPF checks
- [trie](/modules/trie) - uses suffix trie for extra-fast patterns lookup in messages. (requires configuration)
- [whitelist](/modules/whitelist) - provides a flexible way to whitelist (or blacklist) messages based on SPF/DKIM/DMARC combinations
- [url_redirector](/modules/url_redirector) - dereferences redirects (requires Redis configuration)

The following modules are explicitly disabled in the default configuration, set `enabled = true` in `local.d/${MODULE_NAME}.conf` to enable them:

- [dcc](/modules/dcc) - performs [DCC](https://www.dcc-servers.net/dcc/) lookups to determine message bulkiness (requires configuration)
- [elastic](/modules/elastic) - pushes scan-related information to Elasticsearch (requires configuration)
- [external_relay](/modules/external_relay) - takes the sending IP, hostname and HELO from `Received` headers when Rspamd scans mail after the MX (requires configuration)
- [gpt](/modules/gpt) - sends message content to an OpenAI or Ollama API for a spam assessment (requires configuration)
- [known_senders](/modules/known_senders) - remembers senders from the configured domains and marks known and first-time senders (requires Redis)
- [mx_check](/modules/mx_check) - checks if sending domain has a connectable MX (requires Redis)
- [p0f](/modules/p0f) - performs passive OS fingerprinting of the sender with a local p0f daemon (requires p0f)
- [rspamd_update](/modules/rspamd_update) - load dynamic rules and other Rspamd updates (requires configuration)
- [spamtrap](/modules/spamtrap) - catches mail sent to spamtrap addresses and can learn it as spam (requires configuration)

The aws_s3, bimi, contextal and http_headers modules are disabled in the same way but have no documentation pages yet.

Experimental modules (currently only maps_stats) also need the global option `enable_experimental = true` in `local.d/options.inc`; without it Rspamd disables them at startup. Experimental modules are not recommended for production usage!

The following Lua modules were removed in earlier releases:

- [emails](/modules/emails) - extracted emails from a message and checked them against DNS blacklists. This module was removed in Rspamd 2.0 and replaced by the [rbl module](/modules/rbl). The existing configuration is automatically converted by Rspamd.
- [ip_score](/modules/ip_score) - dynamically scored sender reputation (requires Redis). This module was removed in Rspamd 2.0 and replaced by the [reputation module](/modules/reputation). The existing configuration is not converted, so configure the reputation module instead.
- url_reputation - assigned reputation to domains in URLs (requires Redis). This experimental module was removed in Rspamd 2.0.
- url_tags - persisted URL tags in Redis (requires Redis). This experimental module was removed in Rspamd 2.0.

## Disabling module

To disable an entire module you can set `enabled = false;` in `/etc/rspamd/local.d/${MODULE_NAME}.conf`
