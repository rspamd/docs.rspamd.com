---
title: Fuzzy check module
---

# Fuzzy check module

The purpose of this module is to verify messages for certain fuzzy patterns that are stored in the
[fuzzy storage workers](/workers/fuzzy_storage). At the same time, this module
is responsible for teaching fuzzy storage with message patterns.

## Fuzzy patterns

Rspamd utilizes the `shingles` algorithm to conduct fuzzy matching of messages. This algorithm 
operates in a probabilistic manner by using word chains as patterns, which helps to filter 
out spam or ham messages. A detailed description of the `shingles` algorithm can be found in the
[research paper](https://dl.acm.org/doi/10.5555/283554.283370).

In Rspamd, we employ trigrams (3-grams) for the shingles algorithm, and we use 
a set of hash functions, including siphash, mumhash, and others.
Currently, Rspamd uses 32 hashes for `shingles`.

Note that attachments and images are currently not matched against fuzzy hashes. 
Instead, they are verified by blake2 digests using strict match.

## HTML Structure Fuzzy Hashing (Since 3.14.0)

In addition to text content fuzzy matching, Rspamd 3.14.0 introduces **HTML structure fuzzy hashing**. This feature enables detection of similar emails based on their DOM structure, layout, and link patterns, independent of text content variations.

### Why HTML fuzzy matching?

Many legitimate emails (newsletters, notifications) and spam campaigns share common HTML templates while varying text content:

- **Newsletters**: Same HTML structure, different article titles/content each week
- **Notifications**: Fixed template from services (Facebook, Amazon), varying user data
- **Spam campaigns**: Identical HTML layout, personalized text (names, dates)
- **Phishing**: Copied legitimate HTML structure, but different CTA (Call-To-Action) domains

Text fuzzy hashing misses these patterns because text changes, but HTML structure fuzzy can detect them.

### Architecture

HTML fuzzy hashing uses a multi-layer approach for robust matching:

#### 1. Direct Hash (Exact Matching)

Similar to text parts, a direct `blake2b` hash of all HTML tokens ensures no false positives:

```
direct_hash = blake2b(token1 + token2 + ... + tokenN)
```

This guarantees two HTML structures with different tokens will have different hashes,
preventing MinHash collision issues.

#### 2. Structure Shingles (Fuzzy Matching)

32 shingles generated using sliding window (size 3) over HTML token sequence:

```
Tokens: div → a@example.com → img → p → span
Windows:
  [div, a@example.com, img] → hash1
  [a@example.com, img, p]   → hash2
  [img, p, span]            → hash3
→ Apply MinHash → 32 shingles
```

This provides tolerance to small structural changes (1-2 tags added/removed).

#### 3. CTA Domains Hash (Phishing Protection)

Separate hash of Call-To-Action link domains, contributing **30% weight** to similarity score.

CTA links are automatically detected using button heuristics:
- Links with `class="button"`, `class="cta"`, etc.
- Links with button-like styling
- Links from `url_button_weights` analysis

**Why critical for phishing:**
```
Legitimate: HTML_structure + CTA=facebook.com → hash_A
Phishing:   HTML_structure + CTA=evil.com     → hash_B

CTA mismatch → similarity heavily penalized (×0.3)
```

#### 4. All Domains Hash (15% weight)

Hash of top-10 most frequent link domains (sorted, deduplicated). Captures overall
domain usage pattern without being sensitive to single tracking pixels.

#### 5. Features Hash (5% weight)

Bucketed HTML statistics for additional matching:
- Tag count (buckets: <10, 10-50, 50-100, 100-200, >200)
- Link count (buckets: <5, 5-10, 10-20, 20-50, >50)
- DOM depth (buckets: <5, 5-10, 10-15, 15-20, >20)
- Image count, forms presence, password inputs

Bucketing ensures minor variations don't affect hash.

### HTML Token Format

Each HTML tag becomes a structural token:

```
tagname[.class][@domain]
```

**Examples:**
- `div.header` - div with "header" class
- `a.button@example.com` - link with "button" class to example.com
- `img@cdn.example.com` - image from cdn.example.com
- `p` - plain paragraph (no class, no link)
- `form@evil.com` - form with action to evil.com

**Normalization rules:**
- Only first CSS class used (multiple classes cause instability)
- Tracking classes filtered out (`utm`, `analytics`, `campaign`, `guid`)
- Dynamic classes ignored (mostly digits, UUIDs)
- Domains extracted as eTLD+1 (registrable domain)

### Similarity Comparison

When comparing two HTML structures:

```
similarity = 0.50 × structure_shingles_similarity
           + 0.30 × cta_domains_match
           + 0.15 × all_domains_similarity
           + 0.05 × features_similarity
```

**Key: CTA domains must match for high similarity!**

If CTA domains differ completely, overall similarity is penalized:
```
result = structure_similarity × 0.3  (heavy penalty)
```

### Configuration

#### Per-rule options:

- **`html_shingles`**: `true|false` (default: `false`)
  - Enable HTML structure fuzzy hashing for this rule

- **`min_html_tags`**: integer (default: `10`)
  - Minimum HTML tags required to generate hash
  - Prevents false positives on trivial HTML snippets
  - Recommended: 10-20 depending on use case

- **`html_weight`**: float (default: `1.0`)
  - Score multiplier for HTML fuzzy matches
  - `<1.0`: reduce HTML match impact
  - `>1.0`: increase HTML match importance (e.g., for phishing detection)

- **`checks`**: object (default: `null`)
  - Structured configuration for content hashing routines. The following sections are recognised:
    - `text` – controls text hashing; supports `enabled`, `no_subject`, `short_text_direct_hash`, `text_multiplier`, `min_length`
    - `html` – controls HTML structure hashing; supports `enabled`, `min_html_tags`, `html_weight` (alias `weight`)
    - `image`/`images` – controls image hashing; supports `enabled`, `min_height`, `min_width`
    - `archive`/`archives` – controls archive hashing; supports `enabled`
  - Legacy boolean flags (`text_hashes`, `html_shingles`, `skip_images`, `scan_archives`, etc.) remain supported and are merged with the structured configuration for backward compatibility.

#### Example configurations:

**Phishing detection (prioritize structure):**
```hcl
rule "PHISHING_DETECT" {
  servers = "localhost:11335";
  algorithm = "mumhash";
  
  html_shingles = true;
  min_html_tags = 20;  # Require complex HTML
  html_weight = 1.5;   # Prioritize structure over text
  
  fuzzy_map = {
    FUZZY_PHISHING {
      flag = 20;
      max_score = 25.0;
    }
    FUZZY_LEGIT_BRANDS {
      flag = 21;
      max_score = -25.0;  # Whitelist
    }
  }
}
```

**Spam campaigns (balanced):**
```hcl
rule "SPAM_CAMPAIGNS" {
  checks = {
    html {
      enabled = true;
      min_html_tags = 15;
      html_weight = 1.0;  # Equal to text
    }
    text { enabled = true; }
  }
  
  fuzzy_map = {
    FUZZY_SPAM_TEMPLATES {
      flag = 200;
      max_score = 15.0;
    }
  }
}
```

**Combined text+HTML:**
```hcl
rule "COMBINED" {
  checks = {
    text {
      enabled = true;
      min_length = 32;      # Text: min words
    }
    html {
      enabled = true;
      min_html_tags = 10;   # HTML: min tags
    }
  }
  
  # Both use same storage/flags
  fuzzy_map = {
    FUZZY_COMBINED_SPAM {
      flag = 10;
      max_score = 20.0;
    }
  }
}
```

### Safety and False Positives

To prevent false positives, HTML fuzzy has multiple safety checks:

1. **Minimum complexity requirements:**
   - At least `min_html_tags` tags (default 10)
   - At least 2 links (single link too generic)
   - At least DOM depth 3 (flat HTML too common)

2. **Stable tokenization:**
   - Only first CSS class (multiple classes unstable)
   - Tracking tokens filtered (`utm_*`, `analytics_*`, etc.)
   - Dynamic classes ignored (GUIDs, timestamps)

3. **Domain-aware:**
   - eTLD+1 used (registrable domain)
   - CTA verification prevents phishing false positives
   - Top-N domains reduce tracking pixel noise

**Simple HTML that will be skipped:**
```html
<html><body><p>Hello <a href="...">link</a></p></body></html>
```
(Only 5 tags, 1 link, depth 2 - too simple)

**Complex HTML that will be hashed:**
```html
<html><head>...</head>
<body>
  <div class="header"><a href="...">logo</a></div>
  <div class="content">
    <p>Text</p>
    <a class="button" href="...">CTA</a>
    <img src="..." />
  </div>
  <div class="footer"><a href="...">unsubscribe</a></div>
</body></html>
```
(15+ tags, 3+ links, depth 4+ - complex enough)

### Phishing Detection Workflow

**Scenario 1: Legitimate brand email copied with fake CTA**

1. Legitimate email learned:
   ```bash
   rspamc -f 1 -w 10 fuzzy_add amazon_legit.eml
   ```
   Stores: text_hash_A, html_hash_A (with CTA=amazon.com)

2. Phishing attempt arrives:
   - Same HTML structure
   - Same or similar text
   - But CTA points to `fake-amazon.evil`

3. Matching:
   - Text fuzzy: HIGH match (0.8-0.9)
   - HTML structure: HIGH initial (0.8)
   - But CTA differs: similarity × 0.3 = 0.24 (LOW!)
   - Result: Suspicious pattern detected

**Scenario 2: Template with varying content (legitimate)**

1. Newsletter template learned:
   ```bash
   rspamc -f 300 -w 5 fuzzy_add newsletter_week1.eml
   ```

2. Next week's newsletter:
   - Same HTML structure
   - Different article titles/content
   - Same CTA domains (same brand)

3. Matching:
   - Text fuzzy: LOW match (0.1-0.3) - expected
   - HTML fuzzy: HIGH match (0.9) - same template
   - CTA matches: similarity maintained
   - Result: Legitimate newsletter variation

### Performance

- **Generation time**: <1ms for typical HTML (100-200 tags)
- **Memory**: ~300 bytes final structure, ~1KB temporary during generation
- **Algorithm**: MurmurHash recommended for speed
- **Overhead**: Minimal - only for HTML text parts with html_shingles enabled

### Lua API

For advanced use cases, Lua API provides direct access:

```lua
local text_parts = task:get_text_parts()
for _, part in ipairs(text_parts) do
  if part:is_html() then
    local digest, shingles = part:get_html_fuzzy_hashes(task:get_mempool())
    
    if digest and shingles then
      -- digest: hex string (direct hash)
      -- shingles[1..32]: structure shingles
      -- shingles.cta_domains_hash: CTA hash
      -- shingles.all_domains_hash: all domains
      -- shingles.features_hash: statistics
      -- shingles.tags_count: metadata
    end
  end
end
```

## Structured checks configuration

Starting with Rspamd 3.14, the preferred way to configure per-rule hashing behaviour is via the `checks` object. The `text`, `html`, `image(s)` and `archive(s)` sections transparently map to the legacy options listed above. Example:

```hcl
rule "FUZZY_CUSTOM" {
  servers = "127.0.0.1:11335";

  checks = {
    text {
      enabled = true;
      min_length = 64;
      text_multiplier = 4.0;
      short_text_direct_hash = true;
    }
    html {
      enabled = true;
      min_html_tags = 15;
      html_weight = 1.2;
    }
    image {
      enabled = false; # keep legacy skip_images semantics
    }
  }

  fuzzy_map = {
    FUZZY_DENIED {
      flag = 1;
      max_score = 20.0;
    }
  }
}
```

Legacy boolean knobs (`text_hashes`, `html_shingles`, `skip_images`, `scan_archives`, etc.) continue to work and are merged with the structured configuration, but the `checks` block makes the rule definition clearer and avoids an ever-growing list of top-level flags.

## Module outline
~~~hcl
# local.d/fuzzy_check.conf
fuzzy_check
{
    max_errors = ...; //int: Maximum number of upstream errors; affects error rate threshold
    min_bytes = ...; //int: Minimum number of *bytes* to check a non-text part
    min_height = ...; //int: Minimum pixel height of embedded images to check using fuzzy storage
    min_length = ...; //int: Minimum number of *words* to check a text part
    min_width = ...; //int: Minimum pixel width of embedded images to check using fuzzy storage
    retransmits = ...; //int: Maximum number of retransmissions for a single request
    revive_time = ...; //float: Time (seconds?) to lapse before re-resolving faulty upstream
    symbol = "default symbol"; //string: Default symbol for rule (if no flags defined or matched)
    text_multiplier = ...; //float: Multiplier for bytes limit when checking for text parts
    timeout = ...; //time: Timeout to wait for a reply from a fuzzy server, e.g. 1s, 2m, 5h
    whitelist = "..."; //string: Whitelisted IPs map

    rule { //Fuzzy check rule
        algorithm = "..."; //string: rule hashing algo
        encryption_key = "..."; //string: Base32 value for the protocol encryption public key
        fuzzy_key = "..."; //string: Base32 value for the hashing key (for private storages)
        fuzzy_map = { //object: Map of SYMBOL -> data for flags configuration
            max_score = ... ; //int: Maximum score for this flag
            flag = ... ; //int: Flag number (ordinal)
        }; 
        fuzzy_shingles_key = "..."; //string: Base32 value for the shingles hashing key (for private storages)
        headers = "..."; //array: Headers that are used to make a separate hash
        learn_condition = "..."; //string: Lua script that returns boolean function to check whether this task should be considered when training fuzzy storage
        max_score = ...; //int: Max value for fuzzy hash when weight of symbol is exactly 1.0 (if value is higher, then the score is still 1.0)
        checks = { ... }; //object: Structured hashing configuration (text/html/images/archives)
        mime_types = "..."; //array: Set of mime types (in form type/subtype, or type/*, or *) to check with fuzzy
        min_bytes = ...; //int: Override module default min bytes for this rule
        read_only = ...; //boolean: If true then never try to train this fuzzy storage
        servers = "..."; //string: List of servers to check (or train)
        short_text_direct_hash = ...; //boolean: Use direct hash for short texts
        skip_hashes = "..."; //string: Whitelisted hashes map
        skip_unknown = ...; //boolean: If true then ignores unknown flags and does not add the default fuzzy symbol
        symbol = "..."; //string: Default symbol for rule (if no flags defined or matched)
    }
}
~~~

## Module configuration

The ```fuzzy_check``` module has several global options, including:

- `min_bytes`: minimum length of attachments and images in bytes to check them in fuzzy storage
- `min_height`: minimum pixel height of images to be checked
- `min_length`: minimum length of text parts in words to perform fuzzy check (default - check all text parts)
- `min_width`: minimum pixel width of images to be checked
- `retransmits`: maximum retransmissions before giving up
- `symbol`: default symbol to insert (if no flags match)
- `timeout`: timeout to wait for a reply, e.g. 1s, 2m, 5h
- `whitelist`: IPs in this list bypass all fuzzy checks

e.g.
~~~hcl
# local.d/fuzzy_check.conf
# the following are defaults in 1.9.4
fuzzy_check {
    min_bytes = 1k; # Since small parts and small attachments cause too many FP
    timeout = 2s;
    retransmits = 1;
    ...
    rule {...}
}
~~~


A fuzzy `rule` is defined as a set of `rule` definitions. Each `rule` is required to have a `servers` list for checking or teaching (training), along with a set of flags and optional parameters. 

The `servers` parameter defines [upstream](/configuration/upstream) object that can be configured to rotate or shard as needed. Sharding is performed based on the hash value itself.

The available parameters include:

- `algorithm`: rule hashing algo; one of: `fasthash` (or just `fast`), `mumhash`, `siphash` (or `old`) or `xxhash`. The default value is `mumhash` currently.
- `encryption_key`: Base32 value public key to perform wire encryption
- `fuzzy_map`: Map of SYMBOL -> data for flags configuration
- `fuzzy_key`: Base32 value for the hashing key (for private storages).
- `learn_condition`: An Lua script that returns a boolean function to check whether this task
    should be considered when training fuzzy storage
- `max_score`: float value: score threshold for this rule's activation/trigger
- `mime_types`: array or list of acceptable mime-type regexs for this rule. Can be: `["*"]` to match anything
- `read_only`: set to `no` to enable training, set to `yes` for no training
- `servers`: list of servers to check or train
- `short_text_direct_hash`: whether to check the exact hash match for short texts where fuzzy algorithm is not applicable.
- `skip_unknown`: whether or not to ignore unmatched content; if `true` or `yes` then ignore unknown flags and 
    does not add the default fuzzy symbol
- `symbol`: the default symbol applied for a rule. 


Here is an example `rule`:

~~~hcl
# local.d/fuzzy_check.conf
...
rule "FUZZY_CUSTOM" {
  # List of servers. Can be an array or multi-value item
  servers = "127.0.0.1:11335";

  # List of additional mime types to be checked in this fuzzy ("*" for any)
  mime_types = ["application/*"];

  # Maximum global score for all maps combined
  max_score = 20.0;

  # Ignore flags that are not listed in maps for this rule
  skip_unknown = yes;

  # If this value is false (i.e. no), then allow learning for this fuzzy rule
  read_only = no;

  # Fast hash type
  algorithm = "mumhash";
  # This is used for binary parts and for text parts (size in bytes)
  min_bytes = 1024;

  checks = {
    text {
      enabled = true;
      min_length = 64;      # Text parts only: minimum number of words
      text_multiplier = 4.0;# Divide min_bytes by 4 for texts
      short_text_direct_hash = true; # If part has num words < min_length, use direct hash
    }
    html {
      enabled = true;
      min_html_tags = 10;
    }
    image {
      enabled = false;      # Equivalent to skip_images = true
    }
    archives {
      enabled = true;       # Equivalent to scan_archives = true
    }
  }

  # Apply fuzzy logic for text parts
  text_shingles = true;
  # Skip images if needed
  skip_images = false;
}
...
~~~

Each `rule` can have several `fuzzy_map` values, ordered by an ordinal `flag` value. A single
fuzzy storage can contain both good and bad hashes that should have different symbols,
and thus, different weights. To accommodate these varying needs, multiple `fuzzy_maps` 
can be defined within a fuzzy `rule`, as follows:

~~~hcl
# local.d/fuzzy_check.conf
rule "FUZZY_LOCAL" {
...
fuzzy_map = {
  FUZZY_DENIED {
    # Maximum weight for this list
    max_score = 20.0;
    # Flag value
    flag = 1
  }
  FUZZY_PROB {
    max_score = 10.0;
    flag = 2
  }
  FUZZY_WHITE {
    max_score = 2.0;
    flag = 3
  }
}
...
}
~~~

Based on the information provided above, we can deduce that email messages accumulating 
a `max_score` above 20.0 will be assigned the `FUZZY_DENIED` mapping, thus being categorized as spam.

However, the concept of `max_score` can be somewhat ambiguous. It's important to note that all hashes 
in the fuzzy storage have individual weights. For instance, if we have a hash `A` that has been marked 
as spam by 100 users, then its weight will be `100 * single_vote_weight`. 
Consequently, if the `single_vote_weight` is `1`, the final weight will be `100`.

In the context of fuzzy rules, `max_score` refers to the weight that must be achieved by a rule in order 
for it to add its symbol to the maximum score of 1.0 (which is then multiplied by the `metric` value's weight). 
For example, if the weight of a hash is `100` and the `max_score` is set to `20`, then the rule will be added 
with a weight of `1`. However, if the `max_score` is set to `200`, the rule will be added with a weight 
likely calculated through hyperbolic tangent as `0.2`.

In the following configuration:

~~~hcl
metric {
    name = "default";
    ...
    symbol {
        name = "FUZZY_DENIED";
        weight = "10.0";
    }
    ...
}
fuzzy_check {
    rule {
    ...
    fuzzy_map = {
        FUZZY_DENIED {
            # Maximum weight for this list
            max_score = 20.0;
            # Flag value
            flag = 1
        }
        ...
    }
}
~~~

If a hash has value `10`, then a symbol `FUZZY_DENIED` with weight of `2.0` will be added.
If a hash has value `100500`, then `FUZZY_DENIED` will have weight `10.0`.

## Training fuzzy_check

Module `fuzzy_check` is not only able to check messages for fuzzy patterns, but it can also learn from them. 
To accomplish this, you can use the `rspamc` command or connect to the **controller** worker using HTTP protocol. 
For learning, you must check the following settings:

1. Controller worker should be accessible by `rspamc` or HTTP (check `bind_socket`)
2. Controller should allow privileged commands for this client (check `enable_password` or `secure_ip` settings)
3. Controller should have `fuzzy_check` module configured to the servers specified
4. You should know `fuzzy_key` and `fuzzy_shingles_key` to operate with this storage
5. Your `fuzzy_check` module should have `fuzzy_map` configured to the flags used by server
6. Your `fuzzy_check` rule must have `read_only` option turned off (`read_only = false`)
7. Your `fuzzy_storage` worker should allow updates from the controller's host (`allow_update` option)
8. Your controller should be able to communicate with fuzzy storage by means of the `UDP` protocol

If all these conditions are met, then you can teach rspamd messages with rspamc:

    rspamc -w <weight> -f <flag> fuzzy_add ...

or delete hashes:

    rspamc -f <flag> fuzzy_del ...

you can also delete a hash that you find in the log output:

    rspamc -f <flag> fuzzy_delhash <hash-id>

On learning, rspamd sends commands to **all** servers inside a specific rule. On check,
rspamd selects a server in a round-robin manner.

## Usage of the feeds provided by `rspamd.com`

By default, `rspamd.com` feeds are enabled. However, if you decide to use these feeds, 
it's important to ensure that you comply with the [**free usage policy**](/other/usage_policy). 
Failure to do so may result in being blocked from using the service. In such cases, the special `FUZZY_BLOCKED` symbol 
will be assigned to the messages in question. It's worth noting that this symbol has no weight and will not affect any mail processing operations.
