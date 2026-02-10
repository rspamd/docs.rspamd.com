---
title: Migrating from SpamAssassin
---

# Migrating from SpamAssassin to Rspamd

This guide walks you through replacing SpamAssassin (SA) with Rspamd. It covers the key architectural differences, a step-by-step migration path, and practical advice for a safe rollout.

## Overview

| | SpamAssassin | Rspamd |
|---|---|---|
| Language | Perl | C core + Lua plugins |
| I/O model | Synchronous, per-message fork/thread | Asynchronous event loop, multi-worker |
| Configuration | Perl-style `.cf` files | UCL (HCL-like) + Lua |
| Statistics backend | Berkeley DB / SQL / Redis | Redis (recommended) |
| Verdict model | Numeric score; MTA decides | Score + **action** (`no action`, `greylist`, `add header`, `rewrite subject`, `reject`) returned to MTA |
| Web UI | None (third-party tools) | Built-in controller worker |

Rspamd ships with native equivalents for most SA functionality -- DKIM, DMARC, SPF, Bayes, fuzzy hashes, URL blocklists, and more -- enabled by default. In most cases you do not need to port SA rules; Rspamd's built-in modules provide equal or better detection quality with significantly lower resource usage.

## Migration checklist

1. [Install Rspamd](/downloads) from official packages.
2. [Integrate with your MTA](#mta-integration).
3. [Set up Redis](#redis) for statistics and other modules.
4. [Review action thresholds](#actions-and-thresholds) to match your policy.
5. [Migrate custom SA rules](#migrating-spamassassin-rules) if needed (most users can skip this).
6. [Train Bayes statistics](#statistics-and-training) from your mail corpora.
7. [Run in shadow mode](#rollout-strategy) alongside SA, then cut over.

## MTA integration

See the full [MTA integration guide](/tutorials/integration). The recommended patterns are:

| MTA | Method |
|-----|--------|
| Postfix / Sendmail | Milter protocol via Rspamd [proxy worker](/workers/rspamd_proxy) (default on port 11332) |
| Exim | HTTP integration via `spamd_address` with `variant=rspamd` |
| Any HTTP-capable MTA | POST to `/checkv2` on the [normal worker](/workers/normal) (default on port 11333) |

If you currently use SA via `spamc`/`spamd`, the closest equivalent is `rspamc` talking to the normal or controller worker over HTTP.

## Redis

Rspamd relies on Redis for Bayes statistics, greylisting state, rate limits, reply tracking, and several other modules. Ensure a Redis instance is reachable and configure it in `local.d/redis.conf`:

~~~hcl
# local.d/redis.conf
servers = "127.0.0.1";
~~~

For full details see [Redis configuration](/configuration/redis).

## Actions and thresholds

SA produces a numeric score and leaves the delivery decision to the MTA or a wrapper script. Rspamd returns both a score **and** an action. The default action thresholds are:

~~~hcl
# Default actions (configured in local.d/actions.conf or via metrics)
actions {
  reject = 15;
  add_header = 6;
  greylist = 4;
}
~~~

If your SA setup marks messages as spam above score 5.0 (the common SA default), consider setting `add_header` to a similar value. You can also define `rewrite subject` if your users rely on subject-line markers:

~~~hcl
actions {
  reject = 15;
  rewrite_subject = 7;
  add_header = 5;
  greylist = 4;
}
~~~

See [Actions and scores](/configuration/metrics) for the full reference.

## Mapping SA features to Rspamd

The table below maps common SA plugins and features to their Rspamd equivalents:

| SpamAssassin | Rspamd equivalent |
|---|---|
| Bayes classifier | Built-in [Bayes classifier](/configuration/statistic) (Redis backend) |
| Network tests (DNS blocklists) | [RBL module](/modules/rbl) (enabled by default) |
| URIBL / SURBL | [RBL module](/modules/rbl) with URL-specific lists |
| DKIM verification | [DKIM module](/modules/dkim) |
| DKIM signing | [DKIM signing module](/modules/dkim_signing) |
| SPF checks | [SPF module](/modules/spf) |
| DMARC | [DMARC module](/modules/dmarc) |
| Razor | [External services module](/modules/external_services) (Razor integration) |
| Pyzor | [External services module](/modules/external_services) (Pyzor integration) |
| DCC | [DCC module](/modules/dcc) or [External services](/modules/external_services) |
| Fuzzy hashes | [Fuzzy check module](/modules/fuzzy_check) (Rspamd native fuzzy storage) |
| AWL (auto-whitelist) | [Reputation module](/modules/reputation) |
| TextCat (language) | Built-in language detection |
| `body` / `rawbody` / `header` rules | [Regexp module](/modules/regexp) or [SpamAssassin module](/modules/spamassassin) for direct import |
| Meta rules | [Composites](/configuration/composites) |
| `rewrite_header Subject` | `rewrite subject` action with `subject` pattern in [actions](/configuration/metrics) |
| Per-user preferences | [Settings module](/configuration/settings) |
| SA shortcircuit | [Force actions module](/modules/force_actions) or `want_spam` in [settings](/configuration/settings) |

## Migrating SpamAssassin rules

Most SA checks have native Rspamd equivalents that are faster and better maintained. **Migrate only custom rules that you have written yourself** and that have no Rspamd equivalent. Importing the entire SA ruleset is unnecessary and will degrade performance.

If you do need to import SA rules, use the [SpamAssassin module](/modules/spamassassin):

~~~hcl
# local.d/spamassassin.conf
spamassassin {
  # Your custom rules only
  ruleset = "/etc/rspamd/sa-rules/local.cf";
  # Optionally include upstream SA rules as a baseline
  base_ruleset = "/var/db/spamassassin/3.004002/updates_spamassassin_org/*.cf";
  # Limit regex match window for performance
  match_limit = 100k;
}
~~~

Supported SA features inside the module include: `body`, `rawbody`, `meta`, `header`, `uri` rules, some `eval` functions, and a subset of plugins (`HeaderEval`, `MIMEEval`, `BodyEval`, `FreeMail`, `ReplaceTags`, `RelayEval`, `MIMEHeader`). Network plugins and HTML-specific plugins are **not** supported -- use Rspamd's native modules instead. See the [module documentation](/modules/spamassassin) for full details.

:::tip
Set `alpha = 0.1` in the `spamassassin` config to promote all SA rules with a score above 0.1 to full Rspamd symbols. This makes them visible in the web UI and logs, which helps during the migration period.
:::

## Statistics and training

Rspamd uses the OSB (Orthogonal Sparse Bigram) tokenizer with Redis storage. **SA Bayes databases cannot be imported** -- you must retrain from scratch.

### Initial training

Feed your existing ham and spam corpora to Rspamd using `rspamc`:

~~~
rspamc learn_ham /path/to/ham/maildir/
rspamc learn_spam /path/to/spam/maildir/
~~~

Both commands accept individual files, directories (recursed), and mbox files. Rspamd requires a minimum number of learns for both classes before Bayes produces results (default: 200, controlled by `min_learns`). See [Statistics settings](/configuration/statistic) for all options.

### Autolearn

Rspamd can learn automatically from messages that score clearly above or below configurable thresholds. Enable autolearn in `local.d/classifier-bayes.conf`:

~~~hcl
autolearn {
  spam_threshold = 6.0;
  ham_threshold = -0.5;
  check_balance = true;
  min_balance = 0.9;
}
~~~

This is equivalent to SA's `bayes_auto_learn` but with finer-grained controls. See the [autolearn reference](/configuration/statistic#autolearn-configuration-reference-314) for all options.

### User feedback via IMAP

For ongoing training from user actions (moving messages to/from Junk), configure [IMAPSieve with Dovecot](/tutorials/feedback_from_users_with_IMAPSieve) to call `rspamc learn_spam` or `rspamc learn_ham` when users reclassify messages.

### Statistics expiry

Unlike SA, Rspamd can automatically expire old statistical tokens to keep the database fresh. Enable the [bayes_expiry module](/modules/bayes_expiry) to prevent unbounded growth.

## Rollout strategy

A safe migration follows these stages:

### 1. Shadow mode

Run Rspamd alongside SA without affecting mail delivery. Use the [proxy worker's mirroring feature](/workers/rspamd_proxy#mirroring) to send a copy of traffic to Rspamd while SA remains the production filter:

~~~hcl
# local.d/worker-proxy.inc
upstream "production" {
  default = yes;
  self_scan = yes;
}
~~~

Compare Rspamd headers (`X-Spamd-Result`) with SA headers to identify threshold differences.

### 2. Tune thresholds

Adjust action scores in `local.d/actions.conf` until false positive and false negative rates match or improve on your SA setup. Pay special attention to:

- `add_header` threshold vs. your SA `required_score`
- `reject` threshold (SA typically does not reject; set this conservatively)
- Greylisting threshold if you did not use greylisting with SA

### 3. Cut over

Switch your MTA content filter from SA to Rspamd. Keep SA installed but disabled for a rollback window.

### 4. Monitor

Use the built-in web UI (controller worker, default port 11334) to monitor symbol hits, action rates, and Bayes accuracy. Check `BAYES_SPAM` and `BAYES_HAM` hit rates to verify that autolearn is keeping the corpus balanced.

## Common pitfalls

| Problem | Solution |
|---------|----------|
| Attempting to import SA Bayes database | Not supported. Retrain using `rspamc learn_ham`/`learn_spam` from corpora. |
| Importing the entire SA ruleset | Unnecessary and slow. Migrate only your custom rules; disable or remove upstream SA rules. |
| Redis not running or unreachable | Statistics, greylisting, ratelimiting, and replies all require Redis. Verify connectivity before starting Rspamd. |
| Score mismatch after migration | SA and Rspamd use different scoring scales. Do not copy SA scores verbatim; tune Rspamd action thresholds independently. |
| Missing X-Spam headers for downstream filters | Configure [milter_headers module](/modules/milter_headers) to add `X-Spamd-Result`, `X-Spam-Status`, or custom headers. |
| Per-user Bayes with multiple recipients | Enable `per_user` in the classifier config and use LDA-mode delivery so each message is attributed to the correct user. See [Statistics settings](/configuration/statistic). |

## See also

- [MTA integration](/tutorials/integration)
- [Actions and scores](/configuration/metrics)
- [Statistics settings](/configuration/statistic)
- [Bayes expiry module](/modules/bayes_expiry)
- [SpamAssassin rules module](/modules/spamassassin)
- [External services (Razor, Pyzor, DCC)](/modules/external_services)
- [IMAPSieve feedback](/tutorials/feedback_from_users_with_IMAPSieve)
- [Upgrading Rspamd](/tutorials/migration)
