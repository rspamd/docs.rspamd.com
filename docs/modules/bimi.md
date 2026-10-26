---
title: BIMI module
---

# BIMI module

The BIMI module implements [Brand Indicators for Message Identification (BIMI)](https://bimigroup.org/), a standard that allows domain owners to attach their brand logo to authenticated emails. When a message passes strict DMARC authentication, Rspamd looks up the sender's BIMI DNS record, validates the associated Verified Mark Certificate (VMC), and inserts a `BIMI-Indicator` header containing the base64-encoded SVG logo for display by supporting mail clients.

## Prerequisites

BIMI requires:

1. **DMARC with a strict policy** — the sender's domain must have a DMARC record with `p=reject` or `p=quarantine`. Messages passing only with a `none` policy are not eligible.
2. **Redis** — used to cache BIMI validation results to avoid repeated DNS lookups and VMC verifications.
3. **BIMI helper service** — a sidecar HTTP service (e.g., [rspamd-bimi-helper](https://github.com/rspamd/bimi-helper)) that fetches and validates the SVG logo and VMC. The helper is not bundled with Rspamd and must be deployed separately.

## How it works

1. Rspamd checks whether the `DMARC_POLICY_ALLOW` symbol is present with a `reject` or `quarantine` policy.
2. It resolves the `default._bimi.<domain>` TXT DNS record and parses the BIMI record fields `l` (logo URL) and `a` (authority evidence / VMC URL).
3. When `vmc_only = true` (the default), records without the `a=` field are ignored.
4. Rspamd queries Redis for a cached validation result. On a cache hit, the result is used directly.
5. On a cache miss, Rspamd contacts the BIMI helper, which fetches and verifies the VMC and SVG logo.
6. In **synchronous mode** (`helper_sync = true`), the helper returns the validated logo directly; Rspamd inserts the `BIMI-Indicator` header and stores the result in Redis.
7. In **asynchronous mode** (`helper_sync = false`), the helper writes the result to Redis itself, so the logo is available for the *next* message from that domain.
8. On success, Rspamd adds the virtual symbol `BIMI_VALID` and the `BIMI-Indicator` header.

## Symbols

| Symbol | Score | Description |
|--------|-------|-------------|
| `BIMI_CHECK` | — | Normal symbol that drives the BIMI check (internal) |
| `BIMI_VALID` | 0.0 | BIMI record was found and the logo was successfully validated |

## Enabling the module

The module is **disabled by default**. Enable it by creating `local.d/bimi.conf`:

~~~hcl
# local.d/bimi.conf
helper_url = "http://127.0.0.1:3030";
enabled = true;
~~~

Redis must also be configured. See the [Redis configuration guide](/configuration/redis) for details.

## Configuration

Settings should be placed in `/etc/rspamd/local.d/bimi.conf`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `helper_url` | string | `http://127.0.0.1:3030` | Base URL of the BIMI helper service |
| `helper_timeout` | number/time | `5s` | Total timeout for helper requests |
| `helper_connect_timeout` | number/time | — | Optional separate connection timeout |
| `helper_ssl_timeout` | number/time | — | Optional separate SSL handshake timeout |
| `helper_write_timeout` | number/time | — | Optional separate write timeout |
| `helper_read_timeout` | number/time | — | Optional separate read timeout |
| `helper_sync` | boolean | `true` | Use synchronous mode (helper returns result directly) |
| `vmc_only` | boolean | `true` | Only accept records with a VMC (`a=` field) |
| `redis_prefix` | string | `rs_bimi` | Redis key prefix for cached results |
| `redis_min_expiry` | number/time | `24h` | Minimum TTL for cached Redis entries |
| `enabled` | boolean | `false` | Enable/disable the module |

## Configuration examples

### Minimal setup (sync mode)

~~~hcl
# local.d/bimi.conf
helper_url = "http://127.0.0.1:3030";
enabled = true;
~~~

### Asynchronous helper mode

In async mode the helper writes validated logos directly to Redis. This allows Rspamd to skip waiting for the helper on each individual message — the logo is available on the next scan after initial validation.

~~~hcl
# local.d/bimi.conf
helper_url = "http://127.0.0.1:3030";
helper_sync = false;
enabled = true;
~~~

### Custom timeouts

~~~hcl
# local.d/bimi.conf
helper_url = "http://127.0.0.1:3030";
helper_timeout = 10s;
helper_connect_timeout = 2s;
helper_read_timeout = 8s;
redis_min_expiry = 48h;
enabled = true;
~~~

### Accept logos without VMC

By default only BIMI records with a Verified Mark Certificate (`a=` field) are processed. To also accept self-asserted logos (the `l=` field only), set:

~~~hcl
# local.d/bimi.conf
helper_url = "http://127.0.0.1:3030";
vmc_only = false;
enabled = true;
~~~

:::note
Self-asserted `l=`-only BIMI is not yet fully implemented in Rspamd. Setting `vmc_only = false` will prevent the module from filtering such records, but no logo indicator will be inserted for them until support is added.
:::

## Redis configuration

Redis is used both for caching BIMI results (lookup key: `<redis_prefix><domain>`) and, in async mode, as the channel through which the helper delivers validated logos to Rspamd.

Configure Redis in the `bimi` section using the standard Rspamd Redis parameters:

~~~hcl
# local.d/bimi.conf
helper_url = "http://127.0.0.1:3030";
enabled = true;

servers = "127.0.0.1:6379";
# db = "1";
# password = "secret";
~~~

See the [Redis configuration guide](/configuration/redis) for all available options.

## BIMI DNS record format

A BIMI TXT record is published at `default._bimi.<domain>` and has the following format:

~~~
v=BIMI1; l=<logo-url>; a=<vmc-url>
~~~

- `l=` — HTTPS URL pointing to a Tiny PS (SVG) logo file
- `a=` — HTTPS URL pointing to a PEM-encoded Verified Mark Certificate (VMC)

Example:

~~~
default._bimi.example.com. IN TXT "v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem"
~~~

## Troubleshooting

Enable debug logging for the module to trace the decision process:

~~~hcl
# local.d/logging.inc
debug_modules = ["bimi"];
~~~

Common issues:

- **No DMARC allow symbol** — the sender's domain does not pass DMARC or the policy is `none`. BIMI requires `reject` or `quarantine`.
- **BIMI for domain has no VMC** — with `vmc_only = true`, a record without `a=` is skipped.
- **Helper not reachable** — check that the BIMI helper service is running at the configured `helper_url`.
- **Logo not shown after enabling** — in async mode the logo is stored in Redis on the first helper call and displayed from the *second* message onward.
