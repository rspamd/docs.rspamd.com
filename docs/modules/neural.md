---
title: Neural network module
---

# Neural network module

The neural network module performs post-classification of messages using a small neural network. It operates in two fundamentally different modes depending on configuration:

**Symbol-based mode** (default): The neural network learns patterns from which Rspamd filters triggered on messages. This is essentially a **clustering classifier** that groups messages by their filter fingerprint, not their content. It learns "messages that trigger filters X, Y, Z together are usually spam."

**LLM embedding mode**: When configured with an LLM provider, the neural network receives text embeddings from an external API. This is a **true content classifier** that learns from actual message text, independent of which filters triggered.

Since Rspamd 2.0, the module uses [kann](https://github.com/attractivechaos/kann), a lightweight neural network library compiled into Rspamd. Earlier versions (1.7-2.0) used `libfann`, which is no longer supported.

## Architecture overview

The neural module operates as a distributed system where multiple Rspamd instances share neural network data through Redis:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│  Scanner Worker │     │  Scanner Worker │     │ Primary Controller  │
│  (inference)    │     │  (inference)    │     │ (training)          │
└────────┬────────┘     └────────┬────────┘     └─────────┬───────────┘
         │                       │                        │
         │  load ANN             │  load ANN              │ train ANN
         │  store vectors        │  store vectors         │ cleanup old ANNs
         │                       │                        │
         └───────────────────────┴────────────────────────┘
                                 │
                          ┌──────┴──────┐
                          │    Redis    │
                          │  (storage)  │
                          └─────────────┘
```

**Scanner workers** periodically check Redis for updated neural networks and load them for inference. They also store training vectors when messages meet training criteria.

**Primary controller worker** (only one per cluster) periodically checks if enough training vectors have accumulated and spawns training processes. It also cleans up old ANN profiles.

## Input vectors: what the network learns from

The neural network input is a numeric vector whose composition depends on the configured mode.

### Symbol-based mode (default)

In symbol-based mode, the input vector contains:

#### 1. Metatokens (message metadata)

Metatokens are 39+ numeric features extracted from message structure:

| Category | Features |
|----------|----------|
| **Size** | Message size (bucketed) |
| **Images** | Total count, PNG ratio, JPEG ratio, large images, small images |
| **Parts** | Text parts ratio, attachments ratio |
| **Encoding** | UTF-8 parts ratio, ASCII parts ratio |
| **Recipients** | MIME recipients count, SMTP recipients count |
| **Received** | Header count, invalid headers, time skew, secure relays |
| **URLs** | URL count |
| **Words** | Average length, short words, spaces rate, double spaces, non-spaces, ASCII rate, non-ASCII rate, capitals rate, numerics rate |
| **HTML links** | Link count, HTTP ratio, query ratio, same eTLD+1 ratio, domains per link, max links per domain |
| **HTML forms** | Form count, unaffiliated POST ratio, affiliated POST ratio |
| **CTA** | Affiliated flag, weight, affiliated links ratio, trackerish ratio |
| **Visibility** | Hidden text ratio, transparent ratio, hidden blocks, transparent blocks, offscreen blocks, meta refresh count |

The metatoken schema has a version number (currently 3) that is included in the ANN key prefix. When metatokens change, new ANNs are automatically created.

#### 2. Symbol scores

Each symbol in the current Rspamd configuration produces one input value. The value is typically the symbol's score normalized to a 0-1 range. Symbols are automatically filtered:

**Excluded symbols:**
- Symbols with `nostat` flag (statistical symbols like Bayes)
- Symbols with `idempotent` flag (side-effect only)
- Symbols with `skip` flag
- Symbols with `composite` flag (meta-rules)
- Symbols listed in `blacklisted_symbols` configuration

**Why this is clustering, not content classification:**

The symbol-based input vector doesn't contain any actual message content. It only records which filters triggered and with what scores. The neural network learns correlations between filter patterns, effectively clustering messages by their "filter fingerprint." Two completely different messages might produce identical vectors if they trigger the same set of filters.

### LLM embedding mode

When configured with an LLM provider, the input vector comes from an external embedding API:

```hcl
providers = [
  {
    type = "llm";
    llm_type = "openai";  # or "ollama"
    model = "text-embedding-3-small";
    url = "https://api.openai.com/v1/embeddings";
    api_key = "sk-...";
  }
];
```

The LLM provider:
1. Extracts text content from the message
2. Sends it to the embedding API
3. Receives a high-dimensional vector representing the text's semantic content
4. Caches embeddings in Redis to avoid redundant API calls

This mode enables **true content-based classification** because the embedding vector represents actual message content, not just which filters triggered.

**Important:** When LLM providers are configured, automatic training is disabled. You must use manual training via the `ANN-Train` header to control training quality.

### Fusion mode

Multiple providers can be combined:

```hcl
providers = [
  { type = "llm"; llm_type = "openai"; model = "text-embedding-3-small"; }
];
fusion {
  include_meta = true;       # Include metatokens
  meta_weight = 1.0;
  normalization = "zscore";  # none, unit, or zscore
}
```

Vectors from all providers are concatenated. Use `normalization` to scale vectors to comparable ranges.

## Symbol profiles

Symbol profiles determine which symbols are included in the ANN's input vector. This is critical for ANN compatibility across workers.

### How profiles work

1. **Collection**: At startup, each rule collects its symbol profile from either:
   - Static configuration in `profile` section
   - Dynamic extraction from symcache (default)

2. **Filtering**: Symbols with excluded flags are removed

3. **Sorting and hashing**: Symbols are sorted alphabetically and hashed to produce a `digest`

4. **Profile storage**: The profile (symbols list + digest) is stored in Redis alongside the ANN

### Profile matching

When loading ANNs from Redis:

1. Compare local symbol profile digest with stored profiles
2. If exact match: load the ANN
3. If within 30% symbol difference: load with distance penalty
4. If too different: don't load (incompatible configuration)

This allows some flexibility when configurations change slightly, but prevents using ANNs trained with completely different symbol sets.

### Static profiles

For stable deployments, you can define static profiles:

```hcl
profile = {
  default = ["SYMBOL_1", "SYMBOL_2", "SYMBOL_3"];
}
```

Static profiles aren't filtered, giving you complete control over which symbols are included.

## Training lifecycle

### Automatic training (default)

When `autotrain = true` (default), the module automatically decides which messages to learn from:

1. **Verdict-based**: Learn spam from messages with `spam` or `junk` verdict; learn ham from `ham` verdict
2. **Score-based**: If `spam_score` or `ham_score` is set, use score thresholds instead of verdicts

```hcl
train {
  autotrain = true;
  spam_score = 10.0;  # Learn as spam if score >= 10
  ham_score = -1.0;   # Learn as ham if score <= -1
}
```

### Manual training

Force training via HTTP header:

```bash
rspamc --header "ANN-Train: spam" < spam_message.eml
rspamc --header "ANN-Train: ham" < ham_message.eml
```

Manual training bypasses all automatic training decisions. This is **required** when using LLM providers, since automatic training is suppressed to ensure training quality.

### Training balance

Neural networks perform poorly when training classes are imbalanced. The module maintains balance through two modes:

#### Balanced mode (default)

Maintains approximately equal spam and ham samples:

```hcl
train {
  learn_mode = "balanced";
  classes_bias = 0.0;  # Strict 1:1 ratio
}
```

The `classes_bias` parameter allows some imbalance:
- `0.0`: Strict 1:1 ratio
- `0.25`: Allows up to 75%/25% imbalance

When one class exceeds the other, additional samples of the majority class are probabilistically skipped to maintain balance.

#### Proportional mode

Uses explicit skip probabilities:

```hcl
train {
  learn_mode = "proportional";
  spam_skip_prob = 0.0;
  ham_skip_prob = 0.5;  # Skip 50% of ham samples
}
```

### When training triggers

Training starts when **both** conditions are met:

1. At least one class has `max_trains` samples
2. In balanced mode: all classes have at least `max_trains * (1 - classes_bias)` samples

```hcl
train {
  max_trains = 1000;  # Need 1000 samples to train
}
```

### ANN versioning and retraining

Each ANN has a version number. When training completes:

1. Version is incremented
2. New ANN is stored with new version
3. Old training vectors expire (10 minutes grace period)

The `max_usages` parameter controls how many times an ANN profile can be retrained:

```hcl
train {
  max_usages = 10;  # Retrain up to 10 times, then create new profile
}
```

After `max_usages` retrains, a new profile with version 0 is created, starting fresh.

## Training process

Training runs exclusively on the **primary controller worker** to prevent conflicts.

### Process flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Primary Controller                            │
├──────────────────────────────────────────────────────────────────┤
│ 1. Periodic check (watch_interval)                               │
│    └─> Check spam_set and ham_set sizes                          │
│                                                                  │
│ 2. If enough samples:                                            │
│    └─> Acquire lock in Redis (atomic)                            │
│        └─> If locked by another host, skip                       │
│                                                                  │
│ 3. Load training vectors from Redis                              │
│    └─> SMEMBERS spam_set, ham_set                                │
│    └─> Decompress (zstd) and parse each vector                   │
│                                                                  │
│ 4. Spawn child process for training                              │
│    └─> Parent extends lock every 30 seconds                      │
│    └─> Child performs actual training epochs                     │
│                                                                  │
│ 5. On completion:                                                │
│    └─> Save ANN to Redis                                         │
│    └─> Release lock                                              │
│    └─> Expire old training vectors (10 min grace)                │
└──────────────────────────────────────────────────────────────────┘
```

### Training isolation

Training runs in a **separate child process** spawned via `worker:spawn_process`. This:

- Prevents training from blocking mail processing
- Isolates potential crashes
- Allows CPU-intensive training without affecting latency

### Distributed locking

Only one Rspamd instance can train at a time:

```lua
-- Lock structure in Redis hash
HSET ann_key lock <timestamp>
HSET ann_key hostname <hostname>
```

Lock timeout is `lock_expire` (default 600 seconds). The training process extends the lock every 30 seconds. If a process crashes, the lock eventually expires.

### Dimensionality reduction (PCA)

For large symbol configurations, you can reduce input vector size:

```hcl
max_inputs = 100;  # Reduce to 100 dimensions via PCA
```

PCA is computed during training:
1. Build scatter matrix from all training vectors
2. Compute eigenvalues and eigenvectors
3. Select top `max_inputs` eigenvectors as projection matrix

**Note**: PCA requires Rspamd compiled with BLAS support. Check with `rspamd --version`.

## Redis storage structure

### Profile index (Sorted Set)

**Key pattern**: `rn{plugin_ver}_{rule_prefix}_{metatoken_ver}_{settings_name}`

**Example**: `rn3_default_3_default`

Stores JSON-serialized profiles ranked by timestamp (most recent = highest rank):

```json
{
  "digest": "a1b2c3d4",
  "symbols": ["SYMBOL_1", "SYMBOL_2", ...],
  "version": 5,
  "redis_key": "rn_default_default_a1b2c3d4_5",
  "providers_digest": "e5f6g7h8"
}
```

The `max_profiles` setting (default 3) limits how many profiles are kept. Older profiles are automatically deleted.

### ANN storage (Hash)

**Key pattern**: `{prefix}_{rule}_{settings}_{digest}_{version}`

**Example**: `rn_default_default_a1b2c3d4_5`

| Field | Type | Description |
|-------|------|-------------|
| `ann` | binary | Zstd-compressed neural network data (kann format) |
| `pca` | binary | Zstd-compressed PCA matrix (if `max_inputs` set) |
| `roc_thresholds` | JSON | `[spam_threshold, ham_threshold]` from ROC analysis |
| `providers_meta` | JSON | Provider metadata (dimensions, weights) |
| `norm_stats` | JSON | Normalization stats `{mode, mean, std}` for zscore |
| `lock` | string | Unix timestamp when training lock acquired |
| `hostname` | string | Hostname holding the training lock |

**Expiration**: `ann_expire` (default 2 days). Accessed ANNs have their rank updated to prevent expiration.

### Training vectors (Sets)

**Key patterns**:
- `{ann_key}_spam_set`
- `{ann_key}_ham_set`

Each set contains zstd-compressed training vectors. Vector format: semicolon-separated numeric values.

**Expiration**: After training completes, old training sets expire in 10 minutes (grace period for other workers to finish writing).

### Key lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    Key Lifecycle                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Profile Created    Training Vectors    Training Triggers       │
│       │                  │                    │                 │
│       v                  v                    v                 │
│  ┌─────────┐       ┌──────────┐        ┌──────────┐             │
│  │ Profile │       │ spam_set │        │ Lock     │             │
│  │ (ZADD)  │       │ ham_set  │        │ acquired │             │
│  └─────────┘       │ (SADD)   │        └──────────┘             │
│       │            └──────────┘              │                  │
│       │                  │                   │                  │
│       │                  │            Training completes        │
│       │                  │                   │                  │
│       v                  v                   v                  │
│  ┌─────────┐       ┌──────────┐        ┌──────────┐             │
│  │ New ver │       │ EXPIRE   │        │ New ANN  │             │
│  │ profile │       │ 10 min   │        │ stored   │             │
│  └─────────┘       └──────────┘        └──────────┘             │
│       │                  │                   │                  │
│       │                  v                   │                  │
│       │            Keys deleted              │                  │
│       │                                      │                  │
│       └──────────────────┬───────────────────┘                  │
│                          │                                      │
│                    Cleanup runs                                 │
│                    (max_profiles)                               │
│                          │                                      │
│                          v                                      │
│                    Old profiles                                 │
│                    deleted                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration reference

### Basic setup

The module requires Redis and is disabled by default:

```hcl
# local.d/neural.conf
servers = "127.0.0.1:6379";
enabled = true;
```

Define symbol scores in `local.d/neural_group.conf`:

```hcl
# local.d/neural_group.conf
symbols = {
  "NEURAL_SPAM" {
    weight = 3.0;
    description = "Neural network spam";
  }
  "NEURAL_HAM" {
    weight = -3.0;
    description = "Neural network ham";
  }
}
```

### Training options

| Option | Default | Description |
|--------|---------|-------------|
| `max_trains` | 1000 | Samples needed per class to start training |
| `max_usages` | 10 | Retrains before creating new profile |
| `max_iterations` | 25 | Training epochs per run |
| `learning_rate` | 0.01 | Neural network learning rate |
| `mse` | 0.001 | Target mean squared error |
| `autotrain` | true | Enable automatic training |
| `train_prob` | 1.0 | Probability of storing each sample (0-1) |
| `learn_mode` | "balanced" | `balanced` or `proportional` |
| `classes_bias` | 0.0 | Allowed imbalance in balanced mode (0-1) |
| `spam_skip_prob` | 0.0 | Spam skip rate in proportional mode |
| `ham_skip_prob` | 0.0 | Ham skip rate in proportional mode |
| `spam_score` | nil | Score threshold for spam (overrides verdict) |
| `ham_score` | nil | Score threshold for ham (overrides verdict) |
| `store_pool_only` | false | Store vectors without training |

### Network architecture

| Option | Default | Description |
|--------|---------|-------------|
| `hidden_layer_mult` | 1.5 | Hidden layer size multiplier |
| `max_inputs` | nil | Enable PCA to reduce dimensions |

### Scoring options

| Option | Default | Description |
|--------|---------|-------------|
| `symbol_spam` | "NEURAL_SPAM" | Symbol for spam classification |
| `symbol_ham` | "NEURAL_HAM" | Symbol for ham classification |
| `spam_score_threshold` | nil | Output threshold for spam (0-1) |
| `ham_score_threshold` | nil | Output threshold for ham (0-1) |
| `flat_threshold_curve` | false | Use binary 0/1 scores |
| `roc_enabled` | false | Compute thresholds via ROC analysis |
| `roc_misclassification_cost` | 0.5 | Cost weight for ROC computation |

### Storage options

| Option | Default | Description |
|--------|---------|-------------|
| `ann_expire` | 172800 | ANN TTL in seconds (2 days) |
| `watch_interval` | 60.0 | Redis check interval |
| `lock_expire` | 600 | Training lock timeout |

### Provider options

| Option | Default | Description |
|--------|---------|-------------|
| `providers` | nil | List of feature provider configs |
| `disable_symbols_input` | false | Don't use symbols provider |

### Fusion options

| Option | Default | Description |
|--------|---------|-------------|
| `fusion.normalization` | "none" | `none`, `unit`, or `zscore` |
| `fusion.include_meta` | true | Include metatokens with providers |
| `fusion.meta_weight` | 1.0 | Weight for metatokens |

### Other options

| Option | Default | Description |
|--------|---------|-------------|
| `blacklisted_symbols` | [] | Symbols to exclude |
| `allowed_settings` | nil | Settings IDs that can train |
| `profile` | {} | Static symbol profiles |

## Example configurations

### Basic setup (symbol-based)

```hcl
# local.d/neural.conf
servers = "127.0.0.1:6379";
enabled = true;

rules {
  default {
    train {
      max_trains = 1000;
      max_usages = 10;
      learning_rate = 0.01;
    }
  }
}
```

### Multiple rules with different training windows

```hcl
rules {
  "SHORT" {
    train {
      max_trains = 100;
      max_usages = 2;
    }
    symbol_spam = "NEURAL_SPAM_SHORT";
    symbol_ham = "NEURAL_HAM_SHORT";
    ann_expire = 86400;  # 1 day
  }
  "LONG" {
    train {
      max_trains = 5000;
      max_usages = 200;
    }
    symbol_spam = "NEURAL_SPAM_LONG";
    symbol_ham = "NEURAL_HAM_LONG";
    ann_expire = 8640000;  # 100 days
  }
}
```

### LLM embedding mode

```hcl
rules {
  default {
    providers = [
      {
        type = "llm";
        llm_type = "openai";
        model = "text-embedding-3-small";
        url = "https://api.openai.com/v1/embeddings";
        api_key = "sk-...";
        cache_ttl = 86400;
      }
    ];
    fusion {
      include_meta = true;
      normalization = "zscore";
    }
    train {
      autotrain = false;  # Required for LLM - use manual training
      max_trains = 500;
    }
  }
}
```

### Settings integration

Separate ANNs for different mail flows:

```hcl
rules {
  default {
    allowed_settings = ["inbound", "outbound"];
    # Creates separate ANNs: rn3_default_3_inbound, rn3_default_3_outbound
  }
}
```

### External training pipeline

Store vectors for external processing:

```hcl
# local.d/neural.conf
rules {
  default {
    train {
      store_pool_only = true;
    }
  }
}

# local.d/clickhouse.conf
extra_columns = {
  Neural_Vec = {
    selector = "task_cache('neural_vec_mpack')";
    type = "String";
  }
  Neural_Digest = {
    selector = "task_cache('neural_profile_digest')";
    type = "String";
  }
}
```

## Troubleshooting

### Check ANN status

```bash
# List profiles (most recent first)
redis-cli ZREVRANGE "rn3_default_3_default" 0 -1 WITHSCORES

# Check specific ANN exists
redis-cli HGETALL "rn_default_default_a1b2c3d4_1"
```

### Check training progress

```bash
# Training vector counts
redis-cli SCARD "rn_default_default_a1b2c3d4_1_spam_set"
redis-cli SCARD "rn_default_default_a1b2c3d4_1_ham_set"

# Check if locked
redis-cli HGET "rn_default_default_a1b2c3d4_1" lock
redis-cli HGET "rn_default_default_a1b2c3d4_1" hostname
```

### Debug logging

```hcl
# local.d/logging.inc
debug_modules = ["neural"];
```

### Common issues

**ANN not loading across workers:**
- Different symbol configurations produce different digests
- Check that all workers have identical plugin configurations
- Use static profiles for stable deployments

**Training not starting:**
- Verify both spam and ham sets have enough samples
- Check for stale training locks (older than `lock_expire`)
- Ensure primary controller is running

**Poor classification accuracy:**
- Check training data balance with SCARD commands
- Consider enabling `roc_enabled` for automatic threshold tuning
- In symbol mode: ensure meaningful symbols aren't blacklisted
- In LLM mode: verify embedding API is returning valid vectors

**High memory usage:**
- Use `max_inputs` with PCA for large symbol configurations
- Reduce `max_trains` to use smaller training batches

**Vectors not being stored:**
- Check `autotrain` is enabled (or use manual training)
- Verify message isn't skipped (passthrough verdict, rspamc scan)
- Check `allow_local` if scanning from localhost

## Symbol registration

| Symbol | Type | Description |
|--------|------|-------------|
| `NEURAL_CHECK` | postfilter | Main scoring callback |
| `NEURAL_LEARN` | idempotent | Training vector storage |
| `NEURAL_SPAM` | virtual | ANN classified as spam |
| `NEURAL_HAM` | virtual | ANN classified as ham |

Custom symbols can be configured per rule using `symbol_spam` and `symbol_ham`.
