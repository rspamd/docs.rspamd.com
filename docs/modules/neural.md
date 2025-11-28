---
title: Neural network module
---

# Neural network module

The neural network module performs post-classification of messages using a small neural network trained on features extracted from messages. It learns patterns from spam and ham samples and adjusts its scoring based on observed symbol combinations and message metadata.

Since Rspamd 2.0, the module uses [kann](https://github.com/attractivechaos/kann), a lightweight neural network library compiled into Rspamd. Earlier versions (1.7-2.0) used `libfann`, which is no longer supported.

## Architecture overview

The neural module operates as a distributed system where multiple Rspamd instances share neural network data through Redis:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Scanner Worker │     │  Scanner Worker │     │ Primary Controller │
│  (inference)    │     │  (inference)    │     │ (training)         │
└────────┬────────┘     └────────┬────────┘     └─────────┬──────────┘
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

**Primary controller worker** periodically checks if enough training vectors have accumulated and spawns training processes. It also cleans up old ANN profiles.

## Feature extraction

The neural network input is a numeric vector constructed from two sources:

### 1. Symbol scores

Each symbol in the current Rspamd configuration produces one input value. The value is typically the symbol's score normalized to a 0-1 range. Symbols marked with `nostat`, `idempotent`, `skip`, or `composite` flags are excluded, as are any symbols listed in `blacklisted_symbols`.

### 2. Metatokens

Metatokens are 39+ numeric features extracted from message structure and content:

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

## Dimensionality reduction with PCA

When `max_inputs` is configured, the module uses Principal Component Analysis (PCA) to reduce the input vector size. This is useful for large symbol configurations where the full vector would be too large for efficient training.

PCA is computed during training by:
1. Building a scatter matrix from all training vectors
2. Computing eigenvalues and eigenvectors
3. Selecting the top `max_inputs` eigenvectors as the projection matrix

The PCA matrix is stored alongside the ANN in Redis and applied during both training and inference.

**Note**: PCA requires Rspamd to be compiled with BLAS support. Check with `rspamd --version`.

## Feature providers

Starting from recent versions, the neural module supports pluggable feature providers that can supply additional input features beyond symbols and metatokens.

### Built-in providers

| Provider | Description |
|----------|-------------|
| `symbols` | Traditional symbols + metatokens vector (default) |
| `metatokens` | Metatokens only, without symbol scores |
| `llm` | LLM-based embeddings from OpenAI or Ollama APIs |

### LLM provider

The LLM provider requests text embeddings from an external API:

~~~hcl
# local.d/neural.conf
rules {
  default {
    providers = [
      {
        type = "llm";
        llm_type = "openai";  # or "ollama"
        model = "text-embedding-3-small";
        url = "https://api.openai.com/v1/embeddings";
        api_key = "sk-...";
        weight = 1.0;
        cache_ttl = 86400;  # Cache embeddings for 1 day
      }
    ];
    # When using LLM, autotrain is disabled; use manual training
    train {
      autotrain = false;
    }
  }
}
~~~

When LLM providers are configured, automatic training is suppressed unless manual training is explicitly requested via the `ANN-Train` header.

### Fusion options

When multiple providers are used, their outputs are concatenated into a single vector:

~~~hcl
fusion {
  normalization = "zscore";  # none, unit, or zscore
  include_meta = true;       # Include metatokens provider
  meta_weight = 1.0;         # Weight for metatokens
}
~~~

## Configuration

### Basic setup

The module requires Redis and is disabled by default:

~~~hcl
# local.d/neural.conf
servers = "127.0.0.1:6379";
enabled = true;
~~~

Define symbol scores in `local.d/neural_group.conf`:

~~~hcl
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
~~~

### Configuration options

#### Training options (`train` section)

| Option | Default | Description |
|--------|---------|-------------|
| `max_trains` | 1000 | Number of spam+ham samples needed to start training |
| `max_usages` | 10 | How many times an ANN can be retrained before creating new one |
| `max_iterations` | 25 | Maximum training epochs |
| `learning_rate` | 0.01 | Neural network learning rate |
| `max_epoch` | 1000 | Alternative name for max_iterations |
| `mse` | 0.001 | Target mean squared error |
| `autotrain` | true | Enable automatic training based on verdicts |
| `train_prob` | 1.0 | Probability of storing a training sample (0-1) |
| `learn_threads` | 1 | Training threads (currently unused) |
| `learn_mode` | "balanced" | Training mode: `balanced` or `proportional` |
| `classes_bias` | 0.0 | Allowed class imbalance in balanced mode (0-1) |
| `spam_skip_prob` | 0.0 | Spam skip probability in proportional mode |
| `ham_skip_prob` | 0.0 | Ham skip probability in proportional mode |
| `spam_score` | nil | Score threshold for spam (overrides verdict) |
| `ham_score` | nil | Score threshold for ham (overrides verdict) |
| `store_pool_only` | false | Store vectors without training (for external training) |

#### Network architecture options

| Option | Default | Description |
|--------|---------|-------------|
| `hidden_layer_mult` | 1.5 | Hidden layer size = inputs × this multiplier |
| `max_inputs` | nil | Enable PCA to reduce inputs to this size |

#### Scoring options

| Option | Default | Description |
|--------|---------|-------------|
| `symbol_spam` | "NEURAL_SPAM" | Symbol inserted for spam classification |
| `symbol_ham` | "NEURAL_HAM" | Symbol inserted for ham classification |
| `spam_score_threshold` | nil | ANN output threshold for spam (0-1) |
| `ham_score_threshold` | nil | ANN output threshold for ham (0-1) |
| `flat_threshold_curve` | false | Use binary 0/1 scores instead of ANN output |
| `roc_enabled` | false | Compute optimal thresholds using ROC analysis |
| `roc_misclassification_cost` | 0.5 | Cost weight for ROC threshold computation |

#### Storage options

| Option | Default | Description |
|--------|---------|-------------|
| `ann_expire` | 172800 | ANN expiration time in seconds (2 days) |
| `watch_interval` | 60.0 | How often to check Redis for updates |
| `lock_expire` | 600 | Training lock timeout in seconds |

#### Other options

| Option | Default | Description |
|--------|---------|-------------|
| `blacklisted_symbols` | [] | Symbols to exclude from input vector |
| `allowed_settings` | nil | Settings IDs that can train this rule |
| `profile` | {} | Static symbol profiles per settings |

### Training modes

#### Balanced mode (default)

Maintains equal proportions of spam and ham samples. The `classes_bias` parameter allows some imbalance:
- `classes_bias = 0.0`: Strict 1:1 ratio
- `classes_bias = 0.25`: Allows up to 75%/25% imbalance

#### Proportional mode

Uses `spam_skip_prob` and `ham_skip_prob` to probabilistically skip samples, allowing natural class distribution.

### Multiple rules

You can define multiple neural networks with different training parameters:

~~~hcl
# local.d/neural.conf
rules {
  "LONG" {
    train {
      max_trains = 5000;
      max_usages = 200;
    }
    symbol_spam = "NEURAL_SPAM_LONG";
    symbol_ham = "NEURAL_HAM_LONG";
    ann_expire = 8640000;  # 100 days
  }
  "SHORT" {
    train {
      max_trains = 100;
      max_usages = 2;
    }
    symbol_spam = "NEURAL_SPAM_SHORT";
    symbol_ham = "NEURAL_HAM_SHORT";
    ann_expire = 86400;  # 1 day
  }
}
~~~

### Settings integration

The module automatically creates separate ANNs for different [settings](/configuration/settings) IDs:

~~~hcl
rules {
  default {
    allowed_settings = ["inbound", "outbound"];
    # or: allowed_settings = "all";
  }
}
~~~

Messages with different settings IDs train and use separate neural networks, which is useful for separating inbound and outbound mail processing.

## Manual training

### Via HTTP header

Add `ANN-Train: spam` or `ANN-Train: ham` header to force training:

```bash
rspamc --header "ANN-Train: spam" < spam_message.eml
rspamc --header "ANN-Train: ham" < ham_message.eml
```

### Via controller endpoint

The `/plugins/neural/learn` endpoint accepts JSON POST:

```bash
curl -X POST http://localhost:11334/plugins/neural/learn \
  -H "Content-Type: application/json" \
  -d '{
    "rule": "default",
    "spam_vec": [[0.1, 0.2, ...], [0.3, 0.4, ...]],
    "ham_vec": [[0.5, 0.6, ...], [0.7, 0.8, ...]]
  }'
```

### Store pool only mode

For external training pipelines, enable `store_pool_only`:

~~~hcl
train {
  store_pool_only = true;
}
~~~

This stores training vectors in the task cache as MessagePack, which can be exported to ClickHouse:

~~~hcl
# local.d/clickhouse.conf
extra_columns = {
  Neural_Vec = {
    selector = "task_cache('neural_vec_mpack')";
    type = "String";
    comment = "Training vector for neural";
  }
  Neural_Digest = {
    selector = "task_cache('neural_profile_digest')";
    type = "String";
    comment = "Digest of neural profile";
  }
}
~~~

## Redis key structure

The neural module uses several Redis key patterns:

### Profile index (Sorted Set)

**Key**: `rn{plugin_ver}_{rule_prefix}_{metatoken_ver}_{settings_name}`

**Example**: `rn3_default_3_default`

Stores JSON-serialized profiles ranked by timestamp. Each profile contains:
- `digest`: Symbol configuration hash
- `symbols`: Array of symbol names
- `version`: Profile version number
- `redis_key`: Key where ANN data is stored
- `providers_digest`: Hash of provider configuration (if providers used)

### ANN storage (Hash)

**Key**: `{prefix}_{rule}_{settings}_{digest}_{version}`

**Example**: `rn_default_default_a1b2c3d4_1`

Hash fields:
| Field | Type | Description |
|-------|------|-------------|
| `ann` | string | Zstd-compressed neural network data |
| `pca` | string | Zstd-compressed PCA matrix (if `max_inputs` set) |
| `roc_thresholds` | JSON | Spam and ham thresholds from ROC analysis |
| `providers_meta` | JSON | Provider metadata (dimensions, weights) |
| `norm_stats` | JSON | Normalization statistics (mean, std for zscore) |
| `lock` | string | Unix timestamp when training lock was acquired |
| `hostname` | string | Hostname holding the training lock |

### Training sets (Sets)

**Keys**:
- `{ann_key}_spam_set` - Set of zstd-compressed spam training vectors
- `{ann_key}_ham_set` - Set of zstd-compressed ham training vectors

Each vector is semicolon-separated numeric values, compressed with zstd.

## Troubleshooting

### Check ANN status

```bash
redis-cli ZRANGE "rn3_default_3_default" 0 -1 WITHSCORES
```

### Check training vector counts

```bash
redis-cli SCARD "rn_default_default_a1b2c3d4_1_spam_set"
redis-cli SCARD "rn_default_default_a1b2c3d4_1_ham_set"
```

### Debug logging

~~~hcl
# local.d/logging.inc
debug_modules = ["neural"];
~~~

### Common issues

1. **ANN not loading**: Check that symbols digest matches between workers. Different plugin configurations create incompatible ANNs.

2. **Training not starting**: Verify both spam and ham sets have enough samples (`max_trains`). Check for training locks.

3. **Poor accuracy**: Ensure balanced training data. Consider adjusting `classes_bias` or using `roc_enabled` for automatic threshold tuning.

4. **High memory usage**: Use `max_inputs` with PCA to reduce vector size for large symbol configurations.

## Symbol registration

The module registers the following symbols:

| Symbol | Type | Description |
|--------|------|-------------|
| `NEURAL_CHECK` | postfilter | Main scoring callback |
| `NEURAL_LEARN` | idempotent | Training vector storage callback |
| `NEURAL_SPAM` | virtual | Inserted when ANN classifies as spam |
| `NEURAL_HAM` | virtual | Inserted when ANN classifies as ham |

Custom symbol names can be configured per rule using `symbol_spam` and `symbol_ham` options.
