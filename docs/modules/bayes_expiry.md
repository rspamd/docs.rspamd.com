---
title: Bayes expiry module
---

# Bayes expiry module

The `bayes expiry` module provides intelligent expiration of statistical tokens for Redis-based Bayesian classifiers using the `new schema` storage format.

## Overview

The module automatically manages token lifetimes based on their statistical significance:
- **Significant tokens** (strongly associated with spam or ham) are kept permanently
- **Common tokens** (appear equally in both classes) have reduced TTL
- **Infrequent/insignificant tokens** expire according to the configured TTL

This ensures that valuable statistical data is preserved while less useful tokens are eventually purged.

## Classifier configuration

Classifier settings go in `/etc/rspamd/local.d/classifier-bayes.conf`:

```hcl
# Required: enable new schema (default since 2.0)
new_schema = true;

# Token expiry time (seconds, or -1 for persistent, or false to disable)
expire = 8640000;  # ~100 days
```

### Expire option values

| Value | Behavior |
|-------|----------|
| `N` (seconds) | Set TTL to N seconds for non-significant tokens. Max: 2147483647 |
| `-1` | Make tokens persistent (no expiration) |
| `false` | Disable bayes expiry for this classifier |

**Note:** Setting `expire = false` does not change existing token TTLs; only newly learned tokens will be persistent.

## Module configuration

Global module settings go in `/etc/rspamd/local.d/bayes_expiry.conf`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interval` | number | `60` | Seconds between expiry steps |
| `count` | number | `1000` | Number of keys to check per step |
| `epsilon_common` | number | `0.01` | Tolerance for classifying tokens as "common" |
| `common_ttl` | number | `864000` | TTL for common tokens (10 days) |
| `significant_factor` | number | `0.75` | Threshold for token significance (75%) |
| `cluster_nodes` | number | `0` | Number of cluster nodes (auto-detected from neighbours) |

```hcl
# local.d/bayes_expiry.conf
interval = 90;
count = 15000;
```

### Cluster configuration

In a clustered setup, the module automatically detects the number of neighbour nodes and adjusts the expiry interval to prevent multiple nodes from performing expiry simultaneously. You can override this with `cluster_nodes`.

## Principles of operation

The module runs on the primary controller worker and performs expiry steps at regular intervals (default: every 60 seconds). Each step:

1. Scans approximately 1000 tokens using Redis SCAN
2. Analyzes each token's occurrence frequency across classes
3. Adjusts TTLs based on token classification
4. Continues from where the previous step stopped

A full iteration through all tokens depends on database size. For 10 million tokens, expect approximately one week per complete cycle.

## Token classification

Tokens are categorized based on their occurrence patterns:

| Category | Description | Action |
|----------|-------------|--------|
| **Significant** | Strongly associated with one class (>75% of occurrences) | Made persistent |
| **Common** | Similar frequency in all classes (within epsilon) | TTL reduced to 10 days |
| **Insignificant** | Between significant and common | TTL set to expire value |
| **Infrequent** | Very low total occurrences | TTL set to expire value |

## Expiration behavior

Since Rspamd 2.0, the module operates in "lazy" mode:

- **Significant tokens**: Set to persistent (TTL = -1) if they have a TTL
- **Insignificant/infrequent tokens**: TTL reduced to `expire` value if current TTL exceeds it
- **Common tokens**: TTL reduced to `common_ttl` (10 days) if current TTL exceeds it

### Advantages

- Statistics can be stored offline indefinitely without losing significant tokens
- Minimizes unnecessary TTL updates
- Simple backup: just copy the RDB file

### Changing expire value

**Decreasing expire**: TTLs exceeding the new value will be updated during the next cycle.

**Increasing expire**: First set `expire = -1` and wait for one complete cycle to make tokens persistent, then set the new expire value.

## Limiting memory usage

Use Redis memory limits with eviction to cap statistics storage:

### Classifier configuration

```hcl
# local.d/classifier-bayes.conf
backend = "redis";
servers = "localhost:6378";
new_schema = true;
expire = 2144448000;  # ~68 years (effectively never expires)
```

### Redis configuration

```sh
# /etc/redis/redis-bayes.conf
include /etc/redis/redis.conf

port 6378
pidfile /var/run/redis/bayes.pid
logfile /var/log/redis/bayes.log
dbfilename bayes.rdb
dir /var/db/redis/bayes/

maxmemory 500MB
maxmemory-policy volatile-ttl
```

With `volatile-ttl` eviction policy, Redis evicts keys with shorter TTLs first when memory limit is reached. Since significant tokens are persistent (no TTL), they're never evicted. Less important tokens with TTLs will be evicted as needed.

**Important:** For this to work correctly, store Bayesian statistics in a separate Redis instance. See the [Redis replication](/tutorials/redis_replication) tutorial for multi-instance setup.

## Multi-class support

The module supports classifiers with more than two classes (not just spam/ham). Token significance is evaluated across all configured classes, with tokens being considered significant if they strongly associate with any single class.

## Monitoring

The module logs statistics after each step and complete cycle:

```
finished expiry step 42: 1000 items checked, 150 significant (5 made persistent), 
50 insignificant (30 ttls set), 200 common (10 discriminated), 
600 infrequent (400 ttls set), 3.5 mean, 2.1 std
```

At the end of each complete cycle, token occurrence distributions are also logged for each class.
