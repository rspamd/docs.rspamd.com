---
title: Known senders module
---


# Known senders module

The `known_senders` module maintains a Redis-backed set of hashed sender addresses for a configured set of domains. It lets you:

- mark messages from previously seen senders as known
- flag first-time senders from those domains
- verify inbound replies using data produced by the [`replies`](./replies.md) module (global and per-sender local checks)

Requires Redis; optional support for RedisBloom.

## How it works

1. For SMTP and MIME `From` addresses belonging to the configured `domains`, Rspamd hashes the full address and checks storage:
   - with `use_bloom = false`: a Redis ZSET named by `redis_key`
   - with `use_bloom = true`: a RedisBloom filter named by `redis_key`
2. If found, Rspamd inserts `symbol` (default `KNOWN_SENDER`). If not found, it inserts `symbol_unknown` and stores the sender, trimming to `max_senders`.
3. If the [`replies`](./replies.md) module is enabled, two additional checks are available:
   - `symbol_check_mail_global`: sender exists in the global replies set
   - `symbol_check_mail_local`: at least one of current recipients exists in the sender’s local replies set

Result options indicate which key matched, e.g. `smtp:<hash>` or `mime:<hash>`.

## Configuration

Add configuration to `/etc/rspamd/local.d/known_senders.conf` (or configure Redis globally):

```hcl
# local.d/known_senders.conf
enabled = true;

# Redis (can be configured globally as well)
#servers = 127.0.0.1:6379;

# Domains to track senders (map or list)
domains = "https://maps.rspamd.com/freemail/free.txt.zst";

# Storage
use_bloom = false;           # requires RedisBloom if true
redis_key = "rs_known_senders";
max_senders = 100000;        # max elements kept in set/filter
max_ttl = 30d;               # accepted, but entries are not expired; the ZSET is only trimmed to max_senders

# Symbols
symbol = "KNOWN_SENDER";
symbol_unknown = "UNKNOWN_SENDER";
symbol_check_mail_global = "INC_MAIL_KNOWN_GLOBALLY";
symbol_check_mail_local = "INC_MAIL_KNOWN_LOCALLY";

# Replies-related (must match settings in the replies module when changed)
sender_prefix = "rsrk";
sender_key_global = "verified_senders";
sender_key_size = 20;        # applies to global reply-set keys only; local keys are always 8 chars
max_recipients = 15;         # recipients to verify for local set

# Optional privacy for reply sender before hashing
reply_sender_privacy = false;
reply_sender_privacy_alg = "blake2";
reply_sender_privacy_prefix = "obf";
reply_sender_privacy_length = 16;
```

## Symbols

The module registers the following symbols with hard-coded default scores:

| Symbol | Option | Default score | Meaning |
|--------|--------|---------------|---------|
| `KNOWN_SENDER` | `symbol` | -1.0 | sender already known |
| `UNKNOWN_SENDER` | `symbol_unknown` | +0.5 | first-time sender stored now |
| `INC_MAIL_KNOWN_GLOBALLY` | `symbol_check_mail_global` | -1.0 | sender verified by global replies set |
| `INC_MAIL_KNOWN_LOCALLY` | `symbol_check_mail_local` | -1.0 | at least one recipient verified by the sender’s local replies set |

Override these scores in your metrics configuration as needed.

## Requirements

- **Redis**: configure Redis servers globally or per-module, see [Redis configuration](/configuration/redis)
- **RedisBloom (optional)**: required if `use_bloom = true`. Enable in Redis, e.g. in `redis.conf`:

```
loadmodule /path/to/redisbloom.so
```

## Notes

- If you change `sender_prefix` in `local.d/replies.conf`, change it here as well to keep sets aligned.
- `domains` accepts the same map forms used elsewhere (file/HTTP/HTTPS, compressed maps, etc.).
- `sender_key_size` (default 20) controls the length of the **global** reply-set key only. Local per-sender reply-set keys are always truncated to 8 characters regardless of this setting.

