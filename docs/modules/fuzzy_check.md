---
title: Fuzzy check module
---

# Fuzzy check module

The `fuzzy_check` module queries [fuzzy storage workers](/workers/fuzzy_storage) to find messages matching known fuzzy patterns. It also handles learning (adding hashes to storage) when triggered via `rspamc` or the controller API.

For a comprehensive guide on setting up fuzzy storage, configuring hash sources, and deployment strategies, see the [Fuzzy Storage Tutorial](/tutorials/fuzzy_storage).

## How Fuzzy Matching Works

Fuzzy hashing allows detection of similar (not just identical) messages. This is particularly effective against spam campaigns where the same message template is sent to many recipients with minor variations.

### Text Fuzzy Matching

Rspamd uses the **shingles algorithm** for text matching:

1. Text is split into overlapping word sequences (trigrams/3-grams)
2. Each sequence is hashed using multiple hash functions (32 hashes per shingle)
3. These shingles are stored and later compared probabilistically

When a new message arrives, its shingles are compared against stored patterns. The similarity score reflects how many shingles match, allowing detection of messages that are similar but not identical.

For technical details on the shingles algorithm, see the [original research paper](https://dl.acm.org/doi/10.5555/283554.283370).

### Attachment and Image Matching

Unlike text, attachments and images use **exact matching** via blake2b digests. A hash is computed for the entire content and matched exactly against stored hashes.

### HTML Structure Matching (Since 3.14.0)

HTML fuzzy matching detects similar emails based on DOM structure, layout, and link patterns—independent of text content. This is particularly useful for:

- **Spam campaigns**: Same HTML template with personalized text
- **Phishing detection**: Copied legitimate HTML with different CTA (Call-To-Action) links
- **Newsletter grouping**: Same template with different weekly content

See [HTML Structure Fuzzy Hashing](#html-structure-fuzzy-hashing) below for details.

## Basic Configuration

The `fuzzy_check` module is configured in `/etc/rspamd/local.d/fuzzy_check.conf`. Each fuzzy storage is defined as a `rule`:

```hcl
rule "FUZZY_EXAMPLE" {
  # Server(s) to query - required
  servers = "localhost:11335";

  # Hash algorithm: mumhash (default), fasthash, xxhash, siphash
  algorithm = "mumhash";

  # Allow learning to this storage (default: true = read-only)
  read_only = false;

  # Map flags to symbols
  fuzzy_map = {
    FUZZY_DENIED {
      flag = 1;
      max_score = 20.0;
    }
    FUZZY_PROB {
      flag = 2;
      max_score = 10.0;
    }
    FUZZY_WHITE {
      flag = 3;
      max_score = 2.0;
    }
  }
}
```

## Understanding Scores and Thresholds

Fuzzy matching involves two distinct scoring concepts that are often confused:

### Hash Weight (Hits)

Each hash in storage has a **weight** (also called "hits") that accumulates as users report the same content:

- When you run `rspamc -w 10 fuzzy_add message.eml`, you add weight 10 to the hash
- If 50 users report the same spam with weight 1 each, the hash weight becomes 50
- Higher weights indicate more confidence that the content is spam (or ham)

### `max_score` / `hits_limit` Parameter

The `max_score` parameter (being renamed to `hits_limit` in future versions) defines the **hash weight threshold** for symbol activation:

```hcl
FUZZY_DENIED {
  flag = 1;
  max_score = 20.0;  # Hash weight must reach 20 for full symbol score
}
```

**How it works:**

| Hash Weight | Symbol Score (if metric weight = 10.0) |
|-------------|----------------------------------------|
| < 20        | 0 (below threshold)                    |
| 20          | ~5.0 (threshold reached, partial)      |
| 40 (2×max)  | 10.0 (full score)                      |
| 100+        | 10.0 (capped at full score)            |

The score increases gradually from threshold to 2× threshold using a hyperbolic tangent function:

```
if weight < max_score:
    symbol_score = 0
else:
    symbol_score = tanh((weight - max_score) / max_score) × metric_weight
```

This prevents a single report from triggering the maximum score while ensuring well-confirmed spam gets full weight.

**Important:** The parameter is being renamed from `max_score` to `hits_limit` to better reflect its purpose. Both names are currently accepted for backward compatibility. See [commit 7fd47da](https://github.com/rspamd/rspamd/commit/7fd47dad2f9e8b63b5bc6d9576e96c8a329b4737).

### `max_hits` Parameter

The `max_hits` parameter limits how many times a single fuzzy rule can match within one message:

```hcl
rule "FUZZY_CUSTOM" {
  max_hits = 4;  # Maximum 4 fuzzy matches per message for this rule
  ...
}
```

This is useful when a message contains multiple parts (attachments, embedded images) that might each match different fuzzy hashes. Without a limit, a message with 10 spam attachments could accumulate 10× the intended score.

## Module Configuration Reference

### Global Options

These options apply to all rules unless overridden:

```hcl
fuzzy_check {
  # Minimum bytes for attachments/images to be checked
  min_bytes = 1k;

  # Minimum pixel dimensions for images
  min_height = 32;
  min_width = 32;

  # Minimum words for text parts (default: check all)
  min_length = 0;

  # Multiplier for min_bytes when checking text parts
  text_multiplier = 4.0;

  # Maximum retransmissions before giving up
  retransmits = 1;

  # Timeout for fuzzy server response
  timeout = 2s;

  # Default symbol if no flags match
  symbol = "FUZZY_UNKNOWN";

  # IPs that bypass all fuzzy checks
  whitelist = "/path/to/whitelist.map";

  # Maximum errors before upstream is marked dead
  max_errors = 3;

  # Time before re-checking failed upstream
  revive_time = 60s;

  rule { ... }
}
```

### Rule Options

Each `rule` section defines a fuzzy storage connection:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `servers` | string/array | — | **Required.** Fuzzy storage server(s). Supports [upstream](/configuration/upstream) syntax for load balancing. |
| `algorithm` | string | `mumhash` | Hash algorithm: `mumhash`, `fasthash` (or `fast`), `xxhash`, `siphash` (or `old`). |
| `encryption_key` | string | — | Public key for transport encryption (base32). |
| `fuzzy_key` | string | — | Key for hash generation (private storages). |
| `fuzzy_shingles_key` | string | — | Key for shingles generation (private storages). |
| `fuzzy_map` | object | — | Maps flags to symbols. See [Flag Mapping](#flag-mapping). |
| `max_score` | float | — | Global threshold for this rule (deprecated, use per-flag). |
| `max_hits` | int | — | Maximum matches per message for this rule. |
| `mime_types` | array | — | MIME types to check: `["*"]`, `["application/*"]`, etc. |
| `read_only` | boolean | `true` | If `false`, allow learning to this storage. |
| `skip_unknown` | boolean | `false` | If `true`, don't add default symbol for unmatched flags. |
| `symbol` | string | — | Default symbol for this rule. |
| `short_text_direct_hash` | boolean | `false` | Use exact hash for texts shorter than `min_length`. |
| `skip_hashes` | string | — | Map of hashes to skip (whitelist). |
| `headers` | array | — | Headers to include in hash generation. |
| `learn_condition` | string | — | Lua script to filter learning. See [Learning Conditions](#learning-conditions). |

### Flag Mapping

The `fuzzy_map` connects storage flags to Rspamd symbols:

```hcl
fuzzy_map = {
  SYMBOL_NAME {
    flag = 1;              # Storage flag number
    max_score = 20.0;      # Weight threshold (alias: hits_limit)
  }
}
```

Different flags allow a single storage to contain multiple hash categories:

| Flag | Purpose | Example Symbol |
|------|---------|----------------|
| 1 | Confirmed spam (blacklist) | `FUZZY_DENIED` |
| 2 | Probable spam | `FUZZY_PROB` |
| 3 | Legitimate content (whitelist) | `FUZZY_WHITE` |

When learning, specify the flag with `-f`:

```bash
rspamc -f 1 -w 10 fuzzy_add spam_message.eml      # Add to blacklist
rspamc -f 3 -w 5 fuzzy_add legitimate.eml          # Add to whitelist
```

Or use the symbol name with `-S`:

```bash
rspamc -S FUZZY_DENIED -w 10 fuzzy_add spam_message.eml
```

## Structured Checks Configuration (Since 3.14)

The `checks` object provides structured configuration for different content types:

```hcl
rule "FUZZY_CUSTOM" {
  servers = "127.0.0.1:11335";

  checks = {
    text {
      enabled = true;
      min_length = 64;            # Minimum words
      text_multiplier = 4.0;      # Divide min_bytes by this for text
      short_text_direct_hash = true;
    }
    html {
      enabled = true;
      min_html_tags = 15;
      weight = 1.2;               # Score multiplier for HTML matches
    }
    image {
      enabled = false;            # Equivalent to skip_images = true
      min_height = 32;
      min_width = 32;
    }
    archive {
      enabled = true;             # Check files inside archives
    }
  }

  fuzzy_map = { ... }
}
```

Legacy boolean options (`text_hashes`, `html_shingles`, `skip_images`, `scan_archives`) are still supported and merged with the structured configuration.

## HTML Structure Fuzzy Hashing

Since version 3.14.0, Rspamd can match emails based on HTML structure rather than text content.

### Why HTML Fuzzy?

Many emails share HTML templates while varying text:

| Use Case | Text Fuzzy | HTML Fuzzy |
|----------|------------|------------|
| Spam campaign with personalized text | Misses (text varies) | Catches (same template) |
| Newsletter with weekly content | Misses (content changes) | Catches (same structure) |
| Phishing copying legitimate brand | May match (similar text) | Detects via CTA mismatch |

### How It Works

HTML fuzzy generates multiple hash components:

| Component | Weight | Purpose |
|-----------|--------|---------|
| Structure shingles | 50% | DOM tag sequence with classes |
| CTA domains | 30% | Call-to-action link destinations |
| All domains | 15% | Top-10 link domains |
| Features | 5% | Tag count, link count, DOM depth |

**CTA domain verification** is critical for phishing detection:

```
Legitimate Amazon email:
  Structure: [div.header → a@amazon.com → div.content → a.button@amazon.com]
  CTA: amazon.com

Phishing attempt:
  Structure: [div.header → a@evil.com → div.content → a.button@evil.com]
  CTA: evil.com

Result: Despite identical DOM structure, CTA mismatch heavily penalizes
similarity (×0.3), exposing the phishing attempt.
```

### HTML Token Format

Each HTML tag becomes a token: `tagname[.class][@domain]`

- `div.header` — div with "header" class
- `a.button@example.com` — link with "button" class to example.com
- `img@cdn.example.com` — image from cdn.example.com
- `form@evil.com` — form posting to evil.com

**Normalization:**
- Only first CSS class used (multiple classes cause instability)
- Tracking classes filtered (`utm_*`, `analytics_*`, etc.)
- Dynamic classes ignored (GUIDs, timestamps)
- Domains normalized to eTLD+1

### Configuration

```hcl
rule "HTML_FUZZY" {
  servers = "localhost:11335";
  algorithm = "mumhash";

  checks = {
    html {
      enabled = true;
      min_html_tags = 15;    # Minimum tags to generate hash
      weight = 1.2;          # Score multiplier
    }
    text {
      enabled = true;        # Can enable both
    }
  }

  fuzzy_map = {
    FUZZY_HTML_SPAM {
      flag = 100;
      max_score = 20.0;
    }
  }
}
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `false` | Enable HTML fuzzy for this rule |
| `min_html_tags` | 10 | Minimum tags required (prevents simple HTML false positives) |
| `weight` | 1.0 | Score multiplier for HTML matches |

**Minimum complexity requirements:**
- At least `min_html_tags` tags
- At least 2 links
- At least DOM depth 3

### Use Cases

**Phishing detection:**
```hcl
rule "PHISHING" {
  checks = {
    html {
      enabled = true;
      min_html_tags = 20;   # Brands use complex HTML
      weight = 1.5;         # Prioritize structure
    }
  }
  fuzzy_map = {
    FUZZY_LEGIT_BRAND { flag = 1; max_score = 20.0; }
  }
}
```

Learn legitimate brand templates, then detect copies with different CTAs.

**Spam campaigns:**
```hcl
rule "SPAM_CAMPAIGNS" {
  checks = {
    html {
      enabled = true;
      min_html_tags = 15;
      weight = 1.0;
    }
  }
  fuzzy_map = {
    FUZZY_SPAM_TEMPLATE { flag = 200; max_score = 15.0; }
  }
}
```

Learn one sample from a campaign, catch all variations.

For deployment strategies and best practices, see [HTML Fuzzy for Phishing Detection](/tutorials/fuzzy_storage#html-fuzzy-for-phishing-detection) in the tutorial.

## Learning Conditions

The `learn_condition` parameter accepts a Lua script that controls whether a message should be learned:

```hcl
rule "FUZZY_FILTERED" {
  servers = "localhost:11335";

  learn_condition = <<EOD
return function(task)
  -- Skip learning for certain domains
  local dominated = {'example.com', 'trusted.org'}
  local from = task:get_from()

  if from and from[1] and from[1]['addr'] then
    for _, d in ipairs(dominated) do
      if string.find(from[1]['addr'], d) then
        return false  -- Don't learn
      end
    end
  end

  return true  -- Learn this message
end
EOD;

  fuzzy_map = { ... }
}
```

The function can also return a modified flag:

```lua
return function(task)
  local source = task:get_header('X-Source')
  local flag_map = {
    honeypot = 1,
    user_report = 2,
    whitelist = 3
  }

  if source and flag_map[source] then
    return true, flag_map[source]  -- Learn with modified flag
  end

  return false  -- Don't learn without valid source
end
```

## Learning Commands

Learning requires:
1. `read_only = false` in the rule configuration
2. Controller access (check `enable_password` or `secure_ip`)
3. Fuzzy storage allowing updates (`allow_update` in worker-fuzzy.inc)

**Add hashes:**
```bash
rspamc -f <flag> -w <weight> fuzzy_add <message|directory>
rspamc -S <SYMBOL> -w <weight> fuzzy_add <message|directory>
```

**Remove hashes:**
```bash
rspamc -f <flag> fuzzy_del <message|directory>
rspamc -f <flag> fuzzy_delhash <hash-id>
```

The hash-id can be found in Rspamd logs when a fuzzy match occurs.

For detailed learning setup, sources selection, and best practices, see [Training fuzzy_check](/tutorials/fuzzy_storage#step-3-configuring-fuzzy_check-plugin) in the tutorial.

## Rspamd.com Fuzzy Feeds

By default, Rspamd uses fuzzy feeds from rspamd.com. These are enabled in the default configuration and require compliance with the [usage policy](/other/usage_policy).

If your usage is blocked, the `FUZZY_BLOCKED` symbol will appear (with zero weight, not affecting mail processing).

To test connectivity to the public fuzzy storage:

```bash
rspamadm fuzzyping
```

If you see packet loss or no replies, check your firewall allows **UDP port 1335** outbound.

## Complete Example

```hcl
# /etc/rspamd/local.d/fuzzy_check.conf

# Global settings
fuzzy_check {
  min_bytes = 1k;
  timeout = 2s;
  retransmits = 1;
}

# Local fuzzy storage
rule "LOCAL" {
  servers = "localhost:11335";
  algorithm = "mumhash";
  read_only = false;
  skip_unknown = true;

  checks = {
    text {
      enabled = true;
      min_length = 32;
      short_text_direct_hash = true;
    }
    html {
      enabled = true;
      min_html_tags = 15;
    }
    image {
      enabled = true;
      min_width = 32;
      min_height = 32;
    }
    archive {
      enabled = true;
    }
  }

  fuzzy_map = {
    LOCAL_FUZZY_DENIED {
      flag = 1;
      max_score = 20.0;
    }
    LOCAL_FUZZY_PROB {
      flag = 2;
      max_score = 10.0;
    }
    LOCAL_FUZZY_WHITE {
      flag = 3;
      max_score = 5.0;
    }
  }
}
```

Define symbol weights in `/etc/rspamd/local.d/fuzzy_group.conf`:

```hcl
max_score = 12.0;

symbols = {
  "LOCAL_FUZZY_DENIED" {
    weight = 12.0;
    description = "Denied fuzzy hash";
  }
  "LOCAL_FUZZY_PROB" {
    weight = 5.0;
    description = "Probable spam fuzzy hash";
  }
  "LOCAL_FUZZY_WHITE" {
    weight = -2.0;
    description = "Whitelisted fuzzy hash";
  }
}
```

## See Also

- [Fuzzy Storage Tutorial](/tutorials/fuzzy_storage) — Comprehensive setup guide
- [Fuzzy Storage Worker](/workers/fuzzy_storage) — Storage worker configuration
- [Usage Policy](/other/usage_policy) — Rspamd.com feeds policy
