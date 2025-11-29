---
title: P0f module
---

# P0f module

The P0f module performs passive OS fingerprinting by querying a local [p0f](https://lcamtuf.coredump.cx/p0f3/) daemon. This allows Rspamd to identify the operating system of the connecting client based on TCP/IP stack characteristics.

## Prerequisites

You need to have p0f v3 installed and running. The p0f daemon should be configured to listen on a Unix socket that Rspamd can connect to.

Example p0f startup:
```bash
p0f -i eth0 -s /var/run/p0f.sock
```

## Configuration

To enable the module, create `/etc/rspamd/local.d/p0f.conf`:

```hcl
# Enable the module
enabled = true;

# Path to the unix socket that p0f listens on
socket = "/var/run/p0f.sock";

# Connection timeout
timeout = 5s;

# If defined, insert symbol with lookup results
symbol = "P0F";

# Patterns to match against results returned by p0f
# Symbol will be yielded on OS string, link type or distance matches
patterns = {
  WINDOWS = "^Windows.*";
  LINUX = "^Linux.*";
  # DSL = "^DSL$";
  # DISTANCE10 = "^distance:10$";
}

# Cache lifetime in seconds (default - 2 hours)
expire = 7200;

# Cache key prefix for Redis
prefix = "p0f";
```

## Configuration options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | false | Enable the p0f module |
| `socket` | required | Path to the p0f Unix socket |
| `timeout` | 5s | Connection timeout |
| `symbol` | `P0F` | Symbol to insert with OS fingerprint results |
| `patterns` | {} | Map of symbol names to regex patterns for matching p0f results |
| `expire` | 7200 | Cache lifetime in seconds |
| `prefix` | `p0f` | Redis cache key prefix |

## Pattern matching

The `patterns` option allows you to define custom symbols that fire when the p0f result matches a specific pattern. Patterns can match against:

- Operating system name (e.g., `Windows`, `Linux`)
- Link type (e.g., `DSL`, `Ethernet`)
- Network distance (e.g., `distance:10`)

## Symbols

The module registers the following symbols:

- `P0F_CHECK` - callback symbol (internal)
- `P0F` - virtual symbol containing OS fingerprint (if `symbol` is set)
- Custom pattern symbols as defined in `patterns` configuration

## Redis caching

If Redis is configured globally or for this module, p0f results are cached to avoid repeated lookups for the same IP address.
