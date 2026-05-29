---
title: MX Check module
---


# MX Check module

The MX Check module verifies that the sending domains in a message actually have working mail infrastructure. For each candidate domain it resolves the MX records (falling back to A/AAAA per [RFC 5321 §5.1](https://datatracker.ietf.org/doc/html/rfc5321#section-5.1) when no MX exists), classifies the resolved IP addresses, and — for routable, public addresses — opens a short TCP probe to port 25 to confirm that something is listening. The outcome is expressed through a rich set of symbols so that the spam filter can score legitimate senders, forged/parked domains, and transient failures differently.

All probe and resolution results are cached in [Redis](/configuration/redis), so a domain that has already been seen is answered from cache without any new DNS query or TCP connection.

The behaviour described on this page — the three-layer cache, IP classification, multi-source checking, SMTP banner validation, trust/punishment maps and the expanded symbol set — is available **starting from Rspamd 4.1.0**. Earlier versions shipped a much simpler module that emitted only `MX_GOOD`, `MX_INVALID`, `MX_MISSING` and `MX_WHITE`. The legacy `timeout` and `wait_for_greeting` options are still accepted but deprecated — see [Migration from pre-4.1.0](#migration-from-pre-410) below.

To activate this module, set `enabled = true` in `/etc/rspamd/local.d/mx_check.conf` and configure [Redis](/configuration/redis) either globally or for this specific module. Redis is mandatory: without a configured Redis server the module disables itself.

## How it works

For every message the module builds a deduplicated set of candidate domains from the message's sources (see [Sources checked](#sources-checked)) and runs one lookup per unique domain. A lookup walks three cache layers and short-circuits as soon as it can produce a verdict:

1. **`d:<domain>` (domain layer).** Caches the MX resolution result for the domain: the sorted MX list, an A/AAAA fallback list, or a terminal state (`no` records, `null` MX, `broken`, DNS failure). On a miss the module queries MX records.
2. **`m:<mxhost>` (MX-host layer).** Caches the A/AAAA resolution for an individual MX hostname. On a miss the module resolves the host's addresses.
3. **`i:<ip>` (IP layer).** Caches the probe verdict for an individual IP address (good, refused, timeout, invalid, or an SMTP reply code). On a miss the module performs a TCP probe.

### IP classification

Before any probe runs, every resolved IP is classified into one of three classes:

- **PUBLIC** — a routable address. Only public addresses are probed.
- **LOCAL** — private ranges: RFC 1918 (`10/8`, `172.16/12`, `192.168/16`), CGNAT (`100.64/10`, RFC 6598), and IPv6 unique-local (`fc00::/7`, RFC 4193).
- **BOGON** — non-routable / reserved: loopback, link-local/APIPA, TEST-NET-1/2/3, `0.0.0.0/8`, IPv4 multicast and reserved (Class E), 6to4 anycast, benchmarking, IPv6 unspecified/documentation/multicast, NAT64 and discard prefixes.

LOCAL and BOGON addresses are never probed but they do emit dedicated symbols (`MX_LOCAL_*`, `MX_BOGON_*`) so the shape of the resolution can be scored. The offending addresses are attached to the symbol as options. If a domain resolves to a mix of public and non-public addresses, only the public subset is probed and the `*_MIX` variant of the class symbol fires.

### Probe shapes

There are two probe shapes, selected with `verify_greeting`:

- **Connect-only** (`verify_greeting = false`, the default): open a TCP connection to port 25; success on connect, then close. Only `connect_timeout` applies. Fast and cheap.
- **Greeting validation** (`verify_greeting = true`): open the connection, read the SMTP banner and validate the reply code. A `220` greeting is a working MX; `4xx`/`5xx` is treated as a real (but probe-rejecting) SMTP server; anything that is not a valid SMTP banner yields an "invalid" verdict. With just `verify_greeting`, the verdict is decided on the first banner line. When `send_quit = true` the module additionally drains multi-line continuation banners and then issues a graceful `QUIT` after a successful greeting. The connect phase is bounded by `connect_timeout` and the banner-read phase by `read_timeout`; a connect timeout yields `MX_TIMEOUT_CONNECT` while a read timeout yields `MX_TIMEOUT_READ`.

### A-fallback path

When a domain publishes no MX record but does have A/AAAA records, those addresses are used as an implicit MX (RFC 5321 §5.1). Probe outcomes on this path emit the `MX_A_*` family of symbols instead of the `MX_*` family. The A-fallback failure symbols carry slightly higher default scores than their MX-RR equivalents, because a domain with no published mail intent *and* no working listener is a strong forgery/parked-domain signal.

### Concurrency and graceful degradation

When several Rspamd workers probe the same IP simultaneously, a Redis lock (`SET NX` at `i:<ip>`) ensures only one worker actually opens the connection. Other workers defer and emit `MX_INFLIGHT`; the winning worker's verdict is published to cache for everyone. If Redis is unreachable during the lock claim the probe is skipped and `MX_REDIS_ERROR` is emitted. The DNS cache layers (`d:`/`m:`) degrade gracefully — a Redis loss simply forces re-resolution rather than failing the check.

## Sources checked

By default the module checks three sources and runs **one probe and one symbol per unique domain**. When the same domain appears in more than one source, the highest-priority source wins: **envelope-from > Reply-To > MIME From**. Each source carries its own symbol prefix so you can tell — and score — them apart:

| Source | Symbol prefix |
|---|---|
| Envelope (SMTP) From — falls back to HELO when the SMTP From is empty | *(none)* |
| MIME `From:` header | `MIME_FROM_` |
| `Reply-To:` header | `REPLYTO_` |

Each source can be toggled independently (`check_from` / `check_mime_from` / `check_reply_to`); disabling all three disables the module at config load.

Authenticated traffic and locally-originated traffic (sender IP is local) are skipped by default. Opt back in with `check_authorized` / `check_local`.

## Configuration

Here is a minimalistic example configuration in `local.d/mx_check.conf`:

~~~hcl
enabled = true;

exclude_domains = [
  "${CONFDIR}/local.d/maps.d/mx_check_exclude_domains.inc",
  "https://maps.rspamd.com/rspamd/dmarc_whitelist_new.inc",
  "https://maps.rspamd.com/rspamd/spf_dkim_whitelist.inc",
  "https://maps.rspamd.com/rspamd/maillist.inc",
  "https://maps.rspamd.com/freemail/free.txt.zst",
  "https://maps.rspamd.com/freemail/disposable.txt.zst",
];

exclude_mxs = [
    "${CONFDIR}/local.d/maps.d/mx_check_exclude_mxs.inc",
];
~~~

### Options

All symbol names are configurable as well (`symbol_good_mx`, `symbol_bad_mx`, `symbol_mx_none`, …); their defaults are listed in the [Symbols](#symbols) section.

**TCP probe**

| Option | Type | Default | Description |
|---|---|---|---|
| `connect_timeout` | number | `2.0` | Seconds allowed to establish the TCP connection |
| `read_timeout` | number | `5.0` | Seconds allowed to read the SMTP banner (only used when `verify_greeting = true`) |
| `verify_greeting` | boolean | `false` | Read and validate the SMTP greeting reply code instead of just connecting |
| `send_quit` | boolean | `false` | Drain multi-line banners and issue a graceful `QUIT` after a good greeting (requires `verify_greeting`) |
| `port` | number | `25` | Port to probe |

**Cache TTLs (seconds)**

| Option | Type | Default | Description |
|---|---|---|---|
| `expire` | number | `86400` | Good verdicts, SMTP error codes and read timeouts (1 day) |
| `expire_dns` | number | `1800` | DNS results at the `d:`/`m:` layers (30 min). `0` disables DNS caching |
| `expire_novalid` | number | `14400` | Hard failures: refused / invalid (4 hours) |
| `expire_timeout` | number | `7200` | Connect timeouts (2 hours) |

**Sources**

| Option | Type | Default | Description |
|---|---|---|---|
| `check_from` | boolean | `true` | Check the envelope (SMTP) From, falling back to HELO |
| `check_mime_from` | boolean | `true` | Check the MIME `From:` header |
| `check_reply_to` | boolean | `true` | Check the `Reply-To:` header |
| `symbol_prefix_from` | string | `""` | Symbol prefix for the envelope-from source |
| `symbol_prefix_mime_from` | string | `"MIME_FROM_"` | Symbol prefix for the MIME-From source |
| `symbol_prefix_reply_to` | string | `"REPLYTO_"` | Symbol prefix for the Reply-To source |

**Address family**

| Option | Type | Default | Description |
|---|---|---|---|
| `probe_ipv4` | boolean | `true` | Resolve and probe IPv4 (A) addresses |
| `probe_ipv6` | boolean | `false` | Resolve and probe IPv6 (AAAA) addresses |
| `prefer_ipv6` | boolean | `true` | When both families are enabled, order IPv6 first in the probe list |
| `max_mx_a_records` | number | `3` | Caps both the MX list length and the per-MX A/AAAA fan-out. Must be ≥ 1, and ≥ 2 when both families are enabled |

**Authenticated / local traffic**

| Option | Type | Default | Description |
|---|---|---|---|
| `check_authorized` | boolean | `false` | Also check authenticated traffic |
| `check_local` | boolean | `false` | Also check locally-originated traffic |

**Rejection (Null MX)**

| Option | Type | Default | Description |
|---|---|---|---|
| `reject_null_mx` | boolean | `false` | Force-reject messages from a domain with an RFC 7505 Null MX |
| `reject_null_mx_message` | string | `"Domain published RFC 7505 Null MX"` | Reject message |
| `reject_authorized` | boolean | `false` | Allow rejecting authenticated traffic |
| `reject_local` | boolean | `false` | Allow rejecting locally-originated traffic |

**Greylisting advice** (requires the [greylist](/modules/greylisting) plugin)

| Option | Type | Default | Description |
|---|---|---|---|
| `greylist_invalid` | boolean | `true` | Advise greylisting on `MX_INVALID` |
| `greylist_none` | boolean | `true` | Advise greylisting on `MX_NONE` |
| `greylist_broken` | boolean | `true` | Advise greylisting on `MX_BROKEN` |
| `greylist_refused` | boolean | `true` | Advise greylisting on `MX_REFUSED` |
| `greylist_null` | boolean | `true` | Advise greylisting on `MX_NULL` |
| `greylist_timeout_connect` | boolean | `true` | Advise greylisting on `MX_TIMEOUT_CONNECT` |
| `greylist_timeout_read` | boolean | `true` | Advise greylisting on `MX_TIMEOUT_READ` |
| `greylist_authorized` | boolean | `false` | Allow greylisting authenticated traffic |
| `greylist_local` | boolean | `false` | Allow greylisting locally-originated traffic |

**Miscellaneous**

| Option | Type | Default | Description |
|---|---|---|---|
| `key_prefix` | string | `"rmx"` | Redis key prefix |
| `test_mode` | boolean | `false` | Treat loopback as a probeable address. **Never enable in production** |

### Maps

The module supports five optional maps. Two of them are *trust* statements (a hit whitelists the domain/MX), two are *punishment* statements (a hit penalises it), and one is a probe-set filter. When an entry appears in both a trust map and a punishment map, **punishment wins**.

| Map | Type | Effect on a hit |
|---|---|---|
| `exclude_domains` | glob | Domain is trusted → `MX_WHITE`, no resolution/probe |
| `exclude_mxs` | glob (MX hostnames) | MX hostname is trusted → `MX_WHITE`, short-circuit |
| `exclude_ips` | radix (IP/CIDR) | Matched IPs are dropped from the probe set; if *every* routable IP is filtered → `MX_SKIP` |
| `bad_mxs` | glob (MX hostnames) | Punish → `MX_BAD`, short-circuit |
| `bad_ips` | radix (IP/CIDR) | Punish → `MX_IP_BAD`, short-circuit |

`bad_mxs` and `bad_ips` entries may carry an optional trailing numeric token that becomes a **weight multiplier** on top of the symbol's group score (default `1.0`). For example:

~~~
# bad_mxs
trapmx.example.com 3
*.bad.example 0.5
~~~

~~~
# bad_ips
192.0.2.0/24 0.5
198.51.100.10 5
~~~

### Recommended: pre-seed `exclude_mxs` with well-known shared MXs

We **highly recommend** populating `exclude_mxs` with the large, shared MX pools that most of your mail legitimately comes from. A hit on `exclude_mxs` short-circuits the lookup with `MX_WHITE` before any A/AAAA resolution or TCP probe runs, so listing the big providers removes the vast majority of unnecessary TCP probes.

A good starting list (extend it with whatever MXs your users commonly receive mail from):

~~~
# exclude_mxs — well-known shared MX pools
# Microsoft 365 / Outlook / Exchange Online
*.olc.protection.outlook.com
*.mail.protection.outlook.com
# Google (consumer: gmail.com; business: Google Workspace via *.aspmx)
gmail-smtp-in.l.google.com
alt?.gmail-smtp-in.l.google.com
aspmx.l.google.com
alt?.aspmx.l.google.com
# Yahoo / AOL / Verizon Media. Two MX pool subzones: am0 (regional MTAs)
# and gm0 (gateway).
*.am0.yahoodns.net
*.gm0.yahoodns.net
mx?.mail.yahoo.co.jp
~~~

Because `exclude_mxs` is a glob map, `*` matches a label segment and `?` matches a single character (so `alt?.aspmx.l.google.com` covers `alt1`–`alt4`). Add the MX hostnames of any other high-volume senders relevant to your deployment — regional providers, large ESPs, etc.

### DNS-only mode (no TCP probing)

If you want the DNS-level signal — missing MX, Null MX, unresolvable MX hosts, bogon/local MX addresses — but never want the module to open a single TCP connection, exclude the entire address space:

~~~hcl
exclude_ips = ["0.0.0.0/0", "::/0"];
~~~

Every routable IP is then filtered out before the probe step, so no connection is ever attempted. The module still resolves MX/A/AAAA and emits all the DNS- and classification-level symbols (`MX_NONE`, `MX_NULL`, `MX_BROKEN`, `MX_DNS_FAIL`, `MX_LOCAL_*`, `MX_BOGON_*`), and a domain whose MXs would otherwise have been probed yields `MX_SKIP` instead of `MX_GOOD`/`MX_INVALID`/etc. This is useful where outbound port 25 is blocked, or where you only want MX *existence/sanity* checks without the cost and footprint of active probing.

The punishment maps still apply in this mode: `bad_mxs` and `bad_ips` are checked **before** their `exclude_*` counterparts, so a known-bad MX hostname still fires `MX_BAD` and a known-bad IP still fires `MX_IP_BAD` — even though the catch-all `exclude_ips` would otherwise have filtered that IP away. Punishment wins over the skip.

## Symbols

Every symbol below is registered in three flavours — unprefixed (envelope-from), `MIME_FROM_`-prefixed and `REPLYTO_`-prefixed — sharing the same default score. All belong to the `mx` group and are `one_shot`.

| Symbol | Score | Description |
|---|---|---|
| `MX_GOOD` | -0.1 | Domain has a working MX |
| `MX_WHITE` | -0.1 | Domain/MX is whitelisted from MX check |
| `MX_INVALID` | 3.0 | MX target accepted TCP but the listener does not speak SMTP |
| `MX_REFUSED` | 3.0 | MX target sent TCP RST (port 25 closed) |
| `MX_TIMEOUT_CONNECT` | 2.0 | MX target did not respond to the connect attempt |
| `MX_TIMEOUT_READ` | 0.1 | MX target accepted TCP but did not send a greeting |
| `MX_ERROR` | 0.0 | MX target greeted with 4xx/5xx (real SMTP, rejected the probe) |
| `MX_NONE` | 4.0 | From domain has no MX/A/AAAA records (covers NXDOMAIN and NOREC) |
| `MX_NULL` | 6.0 | Domain published an RFC 7505 Null MX |
| `MX_BROKEN` | 4.0 | All MX RRs point at hostnames that do not resolve |
| `MX_DNS_FAIL` | 0.0 | Transient DNS path failure (SERVFAIL/REFUSED/timeout); sender not at fault |
| `MX_LOCAL_ONLY` | 3.0 | All resolved MX IPs are in private ranges (RFC1918 / CGNAT / ULA); no probe run |
| `MX_LOCAL_MIX` | 3.0 | Some resolved MX IPs are in private ranges; public subset probed |
| `MX_BOGON_ONLY` | 8.0 | All resolved MX IPs are bogon / non-routable; no probe run |
| `MX_BOGON_MIX` | 5.0 | Some resolved MX IPs are bogon / non-routable; public subset probed |
| `MX_SKIP` | 0.0 | `exclude_ips` filtered every routable MX IP away; no probe run |
| `MX_BAD` | 6.0 | MX hostname listed in `bad_mxs` (operator-defined punishment glob) |
| `MX_IP_BAD` | 6.0 | Resolved MX IP listed in `bad_ips` (operator-defined punishment radix) |
| `MX_INFLIGHT` | 0.0 | Another worker holds the probe lock; the verdict will land via that worker |
| `MX_REDIS_ERROR` | 0.0 | Redis error during probe-lock claim; probe skipped (cache layer degraded) |

### A-fallback symbols (no MX RR; A/AAAA used as implicit MX)

| Symbol | Score | Description |
|---|---|---|
| `MX_A_GOOD` | 0.0 | A-fallback target accepted SMTP (RFC 5321 §5.1 compliant) |
| `MX_A_REFUSED` | 3.0 | A-fallback target sent TCP RST (port 25 closed) |
| `MX_A_TIMEOUT_CONNECT` | 2.5 | A-fallback target did not respond to the connect attempt |
| `MX_A_TIMEOUT_READ` | 0.1 | A-fallback target accepted TCP but did not send an SMTP greeting |
| `MX_A_ERROR` | 0.0 | A-fallback target greeted with 4xx/5xx (real SMTP, rejected the probe) |
| `MX_A_INVALID` | 3.0 | A-fallback target accepted TCP but the listener does not speak SMTP |

Default scores can be overridden per deployment through `local.d/mx_group.conf` or `override.d/mx_group.conf`.

## Greylisting and rejection

When the [greylist plugin](/modules/greylisting) is enabled, the recoverable failure outcomes can advise greylisting of the first message (controlled by the `greylist_*` options). Authenticated and locally-originated traffic is never greylisted unless `greylist_authorized` / `greylist_local` is set.

Only the Null MX outcome can force a pre-result **reject**, and only when `reject_null_mx = true`. As with greylisting, authenticated/local traffic is exempt unless `reject_authorized` / `reject_local` is enabled. When an outcome would be both rejected and greylisted, the reject takes precedence and greylisting is suppressed.

## Caching

Cache values use short codes to minimise the Redis footprint and encode which address families were queried (so a partial cache written under IPv4-only is re-resolved when IPv6 is later enabled):

- `d:<domain>` → `mx:host:prio,…` | `a:<v>:ip,…` | `no` | `null` | `bkn` | `df`
- `m:<host>` → `<v>:ip,…` | `no` | `df`
- `i:<ip>` → `gd` | `rf` | `tc` | `tr` | `inv` | `err:<code>` | `l` (probe in flight)

where `<v>` is `v4`, `v6` or `v64`. Setting `expire_dns = 0` disables the `d:`/`m:` DNS cache layers entirely (the `i:` probe cache always stays on, and its TTLs must be positive). This is useful on systems with a fast, reliable upstream resolver (for example a local caching resolver), where re-resolving MX/A/AAAA on every lookup is cheaper than the extra Redis round-trips the DNS cache would add.

The `i:` probe verdict is cached with a TTL chosen by the verdict, which is deliberately **not** uniform:

| Verdict | Cached as | TTL |
|---|---|---|
| `gd` (good), `err:<code>` (4xx/5xx) | good/alive | `expire` (1 day) |
| `tr` (read timeout) | good/alive | `expire` (1 day) |
| `tc` (connect timeout) | timeout | `expire_timeout` (2 hours) |
| `rf` (refused), `inv` (invalid) | hard failure | `expire_novalid` (4 hours) |

The key distinction is between the two timeouts. A **read timeout** (`tr`) means the TCP connection *succeeded* — the host is alive and listening, it just did not send a banner in time (Postfix postscreen, tarpitting, or big-provider rate-limiting are the usual causes). Because the host is demonstrably up, the verdict is cached at the long `expire` TTL like a good result; re-probing it sooner would gain nothing and, since the connection completes every time, repeated probes are exactly the pattern a target is likely to flag as abuse. A **connect timeout** (`tc`), by contrast, never completed a connection, so it is far more likely to be transient (a route flap, a host coming up) and is cached at the much shorter `expire_timeout` so the next message re-probes relatively soon.

Once the module has been running in a stable configuration for a while, we **highly recommend** raising `expire` to **1–3 weeks**. Working MXs rarely change, so a longer TTL on the good/alive verdicts further cuts down on repeat probing without any practical loss of accuracy.

## Migration from pre-4.1.0

The following legacy options are still accepted and mapped automatically, with a warning logged at startup:

| Legacy option | Replacement | Notes |
|---|---|---|
| `timeout` | `connect_timeout` | Mapped only if `connect_timeout` is not set |
| `wait_for_greeting` | `verify_greeting` | Mapped only if `verify_greeting` is not set. The new flag additionally performs multi-line banner parsing and reply-code validation. |

The old `MX_MISSING` symbol has been replaced by the `MX_A_*` family symbols. If you previously scored or referenced `MX_MISSING`, please review new symbols and their scores.

The symbol group was renamed from `MX` to `mx`. If you reference the group by name (for example in score overrides via `local.d/groups.conf`), use the lowercase `mx` or better move settings to `mx_group.conf` specific config file.
