---
title: DCC module
---

# DCC module

This module performs [DCC](https://www.dcc-servers.net/dcc/) (Distributed Checksum Clearinghouses) lookups to determine the *bulkiness* of a message based on how many recipients have seen similar content.

DCC uses fuzzy checksums to identify bulk mail. The bulkiness information is useful in composite rules. For example, if a message is from a freemail domain and is reported as bulk by DCC, it is likely spam and can be assigned a higher score.

**Important:** Before enabling this module, please review the [DCC License terms](https://www.dcc-servers.net/dcc/).

## Symbols

| Symbol | Score | Description |
|--------|-------|-------------|
| `DCC_REJECT` | (varies) | DCC returned reject result |
| `DCC_BULK` | (varies) | Message identified as bulk based on thresholds |
| `DCC_FAIL` | 0.0 | DCC check failed |

## Prerequisites

You must have the `dccifd` daemon installed and running:

1. Download and build the [DCC client](https://www.dcc-servers.net/dcc/source/dcc.tar.Z)
2. Configure `/var/dcc/dcc_conf`:
   ```
   DCCIFD_ENABLE=on
   DCCM_LOG_AT=NEVER
   DCCM_REJECT_AT=MANY
   ```
3. Start the daemon: `/var/dcc/libexec/rcDCC start`

By default, `dccifd` listens on Unix socket `/var/dcc/dccifd`.

## Configuration

Settings go in `/etc/rspamd/local.d/dcc.conf`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable the DCC module |
| `servers` | string | (required) | Socket path or TCP servers (e.g., `/var/dcc/dccifd` or `127.0.0.1:10045`) |
| `socket` | string | - | Alias for `servers` |
| `timeout` | number | `5.0` | Connection timeout in seconds |
| `retransmits` | number | `2` | Number of retry attempts |
| `default_port` | number | `10045` | Default TCP port |
| `body_max` | number | `999999` | Bulkiness threshold for body checksum |
| `fuz1_max` | number | `999999` | Bulkiness threshold for fuz1 checksum |
| `fuz2_max` | number | `999999` | Bulkiness threshold for fuz2 checksum |
| `default_score` | number | `1` | Base score for bulk detection |
| `symbol` | string | `DCC_REJECT` | Symbol for reject result |
| `symbol_bulk` | string | `DCC_BULK` | Symbol for bulk detection |
| `symbol_fail` | string | `DCC_FAIL` | Symbol for check failure |
| `log_clean` | boolean | `false` | Log clean (non-bulk) results |
| `client` | string | `0.0.0.0` | Default client IP if not available |
| `cache_expire` | number | `7200` | Redis cache expiration (seconds) |
| `prefix` | string | `rs_dcc_` | Redis cache key prefix |

## Example configuration

### Unix socket (local dccifd)

~~~hcl
# local.d/dcc.conf

enabled = true;
servers = "/var/dcc/dccifd";

# Thresholds for bulk detection
body_max = 999999;
fuz1_max = 999999;
fuz2_max = 999999;
~~~

### TCP connection (remote or local)

~~~hcl
# local.d/dcc.conf

enabled = true;
servers = "127.0.0.1:10045";
timeout = 5.0;
retransmits = 2;
~~~

### Custom thresholds

Lower thresholds trigger bulk detection more easily:

~~~hcl
# local.d/dcc.conf

enabled = true;
servers = "/var/dcc/dccifd";

# Trigger bulk detection at lower counts
body_max = 100;
fuz1_max = 100;
fuz2_max = 100;

# Custom score
default_score = 2.0;
~~~

## TCP configuration for dccifd

To configure `dccifd` to listen on TCP instead of Unix socket, edit `/var/dcc/dcc_conf`:

```
DCCIFD_ARGS="-SHELO -Smail_host -SSender -SList-ID -p *,10045,127.0.0.0/8"
```

This configures dccifd to:
- Listen on all interfaces, port 10045
- Accept connections from 127.0.0.0/8

## How scoring works

The module calculates a dynamic score based on:

1. **Reputation (rep)**: A percentage indicating message reputation (0-100%)
2. **Checksum counts**: body, fuz1, and fuz2 values

The score formula uses the reputation to adjust the base score:
- Score contribution = `default_score * (rep/100) / 3` for each threshold exceeded

The `DCC_BULK` symbol options show which thresholds were exceeded and the reputation value.

## Using in composites

Example composite rule combining DCC with other checks:

~~~hcl
# local.d/composites.conf

DCC_FREEMAIL_BULK {
  expression = "DCC_BULK & FREEMAIL_FROM";
  score = 5.0;
  description = "Bulk message from freemail";
}
~~~
