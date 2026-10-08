---
title: Usage of fuzzy hashes
---


# Usage of fuzzy hashes

[Russian version](/tutorials/fuzzy_storage.ru/)

## Introduction

Fuzzy hashing can be used to search for similar messages, allowing us to identify messages with the same or slightly modified text. This technique is particularly useful for blocking spam that is sent to many users simultaneously.

Starting from version **3.14.0**, fuzzy hashing extends to HTML structure matching. This enables:
- Detecting spam campaigns with varying personalized text but same HTML template
- Phishing protection: a copy of a legitimate template whose links point to other domains matches the original only partially
- Brand protection: identifying legitimate vs. fake branded emails
- Newsletter grouping: same template with different weekly content

HTML fuzzy works alongside text fuzzy and uses the same storage infrastructure.



The purpose of this page is to explain how to use fuzzy hashes, not to provide extensive details or a thorough understanding of how they work within Rspamd. However, the following summary should provide a basic understanding of the content covered on this page.

Textual content is divided into tokens, also known as chunks or shingles, each of which represents a window of text with a certain number of characters. These tokens are then hashed individually and stored. When new email arrives, it is also tokenized and the hashes of these tokens are compared to the stored corpus of data. Calculations based on the position and number of matches are performed to determine if the current email is similar to or identical to previously encountered emails.

For images and other attachments, a single hash is calculated and used to check for an exact match in storage.

Since the hash function is unidirectional, it is not possible to restore the original text using the hashed data. This allows us to send requests to third-party hash storages without the risk of disclosure and to benefit from a larger corpus of data aggregated from various unrelated sources.

The source data for fuzzy hash storage includes both spam and legitimate (non-spam) emails. Fuzzy hashes are used to match emails, not to classify them as spam or non-spam. First, we determine if an email is similar to other emails, and then we evaluate the significance of this similarity separately. The weight assigned to fuzzy hash matches (that is, the measure of how closely the current email matches or does not match content in the pool of many other emails) is just one factor among many in the determination of whether an email is spam or non-spam.

This page is intended for mail system administrators who want to create and maintain their own hash storage and for those who want to understand how rspamd.com serves as a third-party resource. More details can be found in other pages here, including:

- [Fuzzy Check module](/modules/fuzzy_check)
- [Fuzzy Storage Workers](/workers/fuzzy_storage)
- [Rspamd.com infrastructure policies](/other/usage_policy)

----

**There are three high-level steps toward using fuzzy hashes**

- Step 1: Hash sources selection
- Step 2: Configuring storage
- Step 3: Configuring fuzzy_check plugin

**Optional:** Hashes replication  
**Suggested:** Storage testing

----

## Step 1: Hash sources selection

It is important to carefully select the sources of spam samples for training. The general principle is to use spam messages that are received by a large number of users. There are two main approaches to this task:

- working with users complaints
- creating spam traps (honeypot)

### Working with user complaints

User complaints can be a useful source for improving the quality of the hash storage, but it is important to be aware that users may sometimes complain about legitimate emails that they have subscribed to themselves, such as store newsletters, ticket booking notifications, and even personal emails that they do not like for some reason. Many users do not differentiate between the "Delete" and "Mark as Spam" buttons.

One solution to this issue is to prompt the user for additional information about the complaint, such as why they believe the email is spam. This may draw the user's attention to the fact that they can unsubscribe from receiving unwanted emails rather than marking them as spam. Another approach is manual processing of user spam complaints.

A combination of these methods may also be effective: assign greater weight to the emails that have been manually processed and a smaller weight to all other complaints.

There are two features in Rspamd that can help filter out false positives (emails that are mistakenly marked as spam). (Note: In this documentation, FP stands for "False Positive" and FN stands for "False Negative".)

1. Hash weight
2. Learning filters

#### Hash weight

One method to filter out false positives is to assign a weight to each complaint and add this weight to the stored hash value during each subsequent learning step.

When a message matches a stored hash, Rspamd does not assign the full symbol score at once. The score grows with the hash weight and gets close to the full symbol score when the weight reaches the `hits_limit` value of the fuzzy rule (the factor is `tanh(e * weight / hits_limit)`). For example, if the weight of a complaint is `w=1` and `hits_limit` is 20, a single complaint gives about 14% of the symbol score, 10 complaints give about 88%, and 20 complaints give about 99%.

Hashes with a small weight therefore still add a small score. To ignore weak matches completely, set the `weight_threshold` option of the rule: matches whose factor (the fraction of the symbol score described above) is below this value are not added.

#### Learning filters

The second method for filtering out false positives based on user complaints involves writing conditions in the Lua language that can skip the learning process or modify the value of a hash for emails from specific domains, for example. These filters offer a wide range of possibilities, but they require manual writing and configuration.

### Configuring spam traps 

The "honeypot" method of improving the value of the hash storage involves using a mailbox that only receives spam emails and does not receive legitimate emails. The idea is that a large volume of fresh, guaranteed spam (possibly 100%) will be continually received, following current patterns, providing a vast corpus of fuzzy hash data for comparison with email received by live mailboxes. As mentioned earlier, user interpretation of spam can be somewhat error-prone. A corpus of user-reported spam is not as reliable as a spam trap, where matches are very likely to indicate that a new incoming email is also spam.

One way to set up a spam trap is to expose addresses to spammer databases, but not to legitimate users. This can be done by placing email addresses in a hidden *iframe* element on a popular website, for example. The element is not visible to users due to the *hidden* property or zero size, but it is visible to spam bots. This method is not as effective as it used to be, as spammers have learned how to avoid such traps.

Another way to create a trap is to find domains that were popular in the past but are no longer functional. These domain names can be found in many spam databases. Purchase these domains and allow all incoming mail to go to a catch-all address, where it is processed for fuzzy hashing and then discarded. In general, setting up your own traps like this is only practical for large mail systems, as it can be costly in terms of maintenance and direct expenses such as domain purchases.

### HTML Structure Hashing

When selecting sources for HTML fuzzy learning, consider:

**For whitelists (legitimate templates):**
- Newsletter templates from known brands
- Notification templates from services (social networks, marketplaces)
- Transactional email templates (receipts, confirmations)

These should be learned with appropriate flags for later identification.

**For blacklists (spam/phishing):**
- Known phishing templates (especially brand impersonation)
- Spam campaign templates
- Confirmed malicious HTML structures

**Important:** HTML fuzzy tokens include the registered domain (eTLD+1) of links and images, so a copy of a legitimate template whose links point to other domains shares fewer shingles with the original.

----

## Step 2: Configuring storage

The Rspamd process that is responsible for fuzzy hash storage is called the [`fuzzy_storage`](/workers/fuzzy_storage) worker. The information here should be useful whether you are using local or remote storage.

This process performs the following functions which will be detailed below.

1. Data storage
1. Hash expiration
1. Access control (read and write)
1. Transport protocol encryption
1. Replication (through Redis)

The configuration for the `worker "fuzzy"` section begins in `/etc/rspamd/rspamd.conf`.  
It includes the default settings from `/etc/rspamd/worker-fuzzy.inc`, and an `.include` directive there links to `/etc/rspamd/local.d/worker-fuzzy.inc`, which is where local settings activate and configure this process. (Earlier documentation referred to `/etc/rspamd/rspamd.conf.local`.)


### Sample configuration

The following is a sample configuration for this fuzzy storage worker process, which will be explained and referred to below. Please refer to [this page](/workers/fuzzy_storage#configuration) for any settings not profiled here.

~~~hcl
# local.d/worker-fuzzy.inc
# Socket to listen on (UDP and TCP)
bind_socket = "*:11335";

# Number of processes to serve this storage (useful for read scaling)
count = 4;

# Storage backend: "redis" (default) or "sqlite"
backend = "redis";

# Redis servers for this storage only; if not set, the servers
# from local.d/redis.conf are used
#servers = "127.0.0.1:6379";

# Prefix for Redis keys (default: "fuzzy")
#prefix = "fuzzy";

# Hashes storage time (3 months)
expire = 90d;

# Write queued updates to the storage each minute
sync = 1min;
~~~

Put these settings in `/etc/rspamd/local.d/worker-fuzzy.inc`. This file is included inside the `worker "fuzzy"` section of `rspamd.conf`, so it must not contain a `worker "fuzzy" { ... }` wrapper. The same applies to the other fuzzy storage snippets on this page.

By default, the fuzzy_storage process is not active, with the `count = -1` directive found in `rspamd.conf`. To activate fuzzy storage, the local .inc file gets the `count = 4` directive as seen above. The default `bind_socket` is `localhost:11335`; the `*:11335` value in the sample also accepts requests from other hosts.

The storage keeps the hashes in Redis. Unless you set `servers` (or `read_servers` and `write_servers`) in `local.d/worker-fuzzy.inc`, the worker uses the Redis servers from `local.d/redis.conf`, see [Redis configuration](/configuration/redis). The `expire` and `sync` values are related to hash expiration and write performance, as described below.

Fuzzy storage works with hashes and not with email messages. A [worker/scanner process](/workers/normal) or a [controller process](/workers/controller) convert emails to hashes before connecting to this process for fuzzy processing. In this sample, the fuzzy storage process listens on port 11335 for UDP and TCP requests from the other processes to query or update the storage, and keeps the hashes in Redis. 

<center><img class="img-fluid" src="/img/rspamd-fuzzy-2.png" width="75%"></center>


### Data storage

By default, the hashes are stored in Redis (`backend = "redis"` in `/etc/rspamd/worker-fuzzy.inc`). Each hash is a Redis key made of the `prefix` (`fuzzy` by default) and the hash value, and the shingles of text hashes are stored as separate keys. To use different Redis servers for the fuzzy storage than for the rest of Rspamd, set `servers` in `local.d/worker-fuzzy.inc` or add a `fuzzy` section to `local.d/redis.conf`:

~~~hcl
# local.d/redis.conf
servers = "127.0.0.1:6379";

# Redis servers for the fuzzy storage only
fuzzy {
  servers = "10.0.0.5:6379";
}
~~~

Rspamd hash storage always writes to the database from a single process, the first fuzzy storage worker. This process maintains an updates queue, while all other processes simply forward write requests from clients to this process. By default, the updates queue is written to the storage once per minute, but this can be configured using the `sync` setting in the sample configuration. The `rspamadm control fuzzysync` command writes the queue immediately.

This architecture is optimized for read requests and prioritizes them.

The older SQLite backend is still supported. To use it, set the backend and the path to the database file, which must be owned by the rspamd user:

~~~hcl
# local.d/worker-fuzzy.inc
backend = "sqlite";
hash_file = "${DBDIR}/fuzzy.db";
~~~

SQLite cannot handle concurrent write requests well, which can lead to significant degradation in database performance; the single writer process described above avoids this. Hashes from an existing SQLite database can be copied to Redis with `rspamadm fuzzyconvert`.


### Hash expiration

Another important function of the fuzzy storage worker is to remove obsolete hashes using the `expire` setting. With Redis, each hash and its shingles are stored with a TTL equal to `expire`, so Redis removes them itself. With SQLite, the worker deletes expired hashes from the database.

Spam patterns change as certain tactics become more or less effective. Spammers send out blasts of spam and, after a period of time ranging from days to months, they change the patterns because they know systems like this are analyzing their data. Since the "effective lifetime" of spam emails is always limited, there is no reason to store all hashes permanently. Based on experience, it is recommended to store hashes for no longer than about three months.

It is a good idea to compare the volume of hashes learned over a certain period with the available RAM. Redis keeps all hashes in memory. For example, in a test with Rspamd 4.2.2 each text hash, stored together with its 32 shingles, used about 7.5 KB of Redis memory, so 400,000 text hashes need about 3 GB. Hashes of images and attachments have no shingles and take much less. To avoid a significant performance degradation, it is not recommended to increase the storage size beyond the available RAM size. That is, do not rely on swap space or allocate too many resources to other processes. If you have a small volume of hashes suitable for learning, start with an expiration time of 90 days. If the volume of data over that time period results in an unacceptable amount of available RAM, such as peak-time available RAM going down to 20%, you may want to reduce the expiration time to 70 days and see if expiring data from storage releases a more acceptable amount of RAM.


### Access control

Unless access is restricted with `blocked` or `encrypted_only` (see below), any client can query the fuzzy storage, but only the addresses listed in `allow_update` can add or delete hashes. The shipped `/etc/rspamd/worker-fuzzy.inc` sets `allow_update = ["localhost"]`, so by default changes are accepted from the local host only. In practice, it is better to write from the local address only (127.0.0.1) because fuzzy storage uses UDP, which is not protected from source IP forgery.

~~~hcl
# local.d/worker-fuzzy.inc
allow_update = ["127.0.0.1", "::1"];

# or 10.0.0.0/8, for internal network
~~~

The `allow_update` setting is a comma-delimited array of strings, or a [map](/modules/multimap) of IP addresses, that are allowed to perform changes to fuzzy storage. Host names such as `localhost` are resolved to all their addresses. Addresses set in `local.d/worker-fuzzy.inc` are added to the shipped list; to replace the list, set `allow_update` in `override.d/worker-fuzzy.inc` instead. You should also set `read_only = no` in your fuzzy_check plugin, see step 3 below.


### Transport protocol encryption

The fuzzy hashes protocol allows optional (opportunistic) or mandatory encryption based on public-key cryptography. This feature is useful for creating restricted storages where access is allowed exclusively to customers or other business partners who have a generated public key.

**How this works:**

- The configuration is modified in `/etc/rspamd/local.d/worker-fuzzy.inc` of the local system running the fuzzy_storage worker. One public/private keypair is set for each remote UDP client that will connect on port 11335.
- One unique **public** key is given to each unique client system, so that only that one system can use that one key.

<center><img class="img-fluid" src="/img/rspamd-fuzzy-3.png" width="75%"></center>

The encryption architecture uses cryptobox construction: <https://nacl.cr.yp.to/box.html> and it is similar to the algorithm for end-to-end encryption used in the DNSCurve protocol: <https://dnscurve.org/>.

To configure transport encryption, create a keypair for the storage server, using the command `rspamadm keypair -u`. Each time this command is run, unique output is returned, as shown in this example (the order of the name=value pairs may change each time this is run) :

~~~hcl
keypair {
    pubkey = "og3snn8s37znxz53mr5yyyzktt3d5uczxecsp3kkrs495p4iaxzy";
    privkey = "o6wnij9r4wegqjnd46dyifwgf5gwuqguqxzntseectroq7b3gwty";
    id = "f5yior1ag3csbzjiuuynff9tczknoj9s9b454kuonqknthrdbwbqj63h3g9dht97fhp4a5jgof1eiifshcsnnrbj73ak8hkq6sbrhed";
    algorithm = "curve25519";
    type = "kex";
}
~~~

The  **public** `pubkey` should be copied manually to the remote host, or published in any way that guarantees the reliability (e.g. certified digital signature or HTTPS-site hosting). As always the **private** `privkey` should never be published or shared.

Each storage can use any number of keys simultaneously, one for each remote client (or a group of clients):

~~~hcl
# local.d/worker-fuzzy.inc
keypair = [
  {
    pubkey = "...";
    privkey = "...";
  },
  {
    pubkey = "...";
    privkey = "...";
  },
  {
    pubkey = "...";
    privkey = "...";
  }
]
~~~

This mechanism is optional, but it can be made mandatory by adding the `encrypted_only` option. In this mode, client systems that do not have a valid public key will be unable to access the storage.

~~~hcl
# local.d/worker-fuzzy.inc
encrypted_only = true;

keypair = [
  {
    pubkey = "...";
    privkey = "...";
  }
]
~~~


### Hashes replication

Having a local copy of remote fuzzy storage can be useful in many situations. Since Rspamd 2.0, the fuzzy storage worker does not replicate hashes itself; with the Redis backend, Redis replication is used instead. Instructions for setting up replication can be found in the [Hashes replication](#hashes-replication-1) section below.

----

## Step 3: Configuring `fuzzy_check` plugin

The `fuzzy_check` plugin is used by scanner processes for querying a storage, and by controller processes for learning fuzzy hashes.

Plugin functions:

1. Email processing and hash creation from email parts and attachments
2. Querying from and learning to storage
3. Transport Encryption

Learning is performed by the `rspamc fuzzy_add` command:

```
$ rspamc -f 11 -w 10 fuzzy_add <message|directory|stdin>
```

The `-w` parameter is used to set the hash weight, as mentioned earlier, while the `-f` parameter specifies the flag number. The flag must be listed in the `fuzzy_map` of a rule that is not read-only, otherwise the controller replies with error 404. In the `local.d/fuzzy_check.conf` example below, flag 11 is `LOCAL_FUZZY_DENIED`.

Flags enable the storage of hashes from different sources. For example, a hash may originate from a spam trap, another hash may be the result of user complaints, and a third hash may come from emails on a whitelist. Each flag can be associated with its own symbol and have a weight when checking emails:

<center><img class="img-fluid" src="/img/rspamd-fuzzy-4.png" width="75%"></center>

A symbol name can be used instead of a numeric flag during learning, for example:

```
$ rspamc -S LOCAL_FUZZY_DENIED -w 10 fuzzy_add <message|directory|stdin>
```

The LOCAL_FUZZY_DENIED symbol is equivalent to flag=11, as defined in the local.d/fuzzy_check.conf example below. In the same way, FUZZY_DENIED is flag 1 of the read-only `rspamd.com` rule in modules.d/fuzzy_check.conf, so it cannot be used to learn the local storage from this example. To match symbols with the corresponding flags you can use the `fuzzy_map` of the `rule` section.

local.d/fuzzy_check.conf example:

~~~hcl
# local.d/fuzzy_check.conf
rule "local" {
    # Fuzzy storage server list
    servers = "localhost:11335";
    # Default symbol for unknown flags
    symbol = "LOCAL_FUZZY_UNKNOWN";
    # Additional mime types to store/check
    mime_types = ["*"];
    # Default hits_limit for flags without their own value
    hits_limit = 20.0;
    # Whether we can learn this storage
    read_only = no;
    # Ignore unknown flags
    skip_unknown = yes;
    # Hash generation algorithm
    algorithm = "mumhash";
    # Use direct hash for short texts
    short_text_direct_hash = true;

    # Map flags to symbols
    fuzzy_map = {
        LOCAL_FUZZY_DENIED {
            # Hash weight for nearly the full symbol score
            hits_limit = 20.0;
            # Flag to match
            flag = 11;
        }
        LOCAL_FUZZY_PROB {
            hits_limit = 10.0;
            flag = 12;
        }
        LOCAL_FUZZY_WHITE {
            hits_limit = 2.0;
            flag = 13;
        }
    }
}
~~~

local.d/fuzzy_group.conf example:

~~~hcl
# local.d/fuzzy_group.conf
max_score = 12.0;
symbols = {
    "LOCAL_FUZZY_UNKNOWN" {
        weight = 5.0;
        description = "Generic fuzzy hash match";
    }
    "LOCAL_FUZZY_DENIED" {
        weight = 12.0;
        description = "Denied fuzzy hash";
    }
    "LOCAL_FUZZY_PROB" {
        weight = 5.0;
        description = "Probable fuzzy hash";
    }
    "LOCAL_FUZZY_WHITE" {
        weight = -2.1;
        description = "Whitelisted fuzzy hash";
    }
}
~~~

Here are some useful options that can be set in the module:

One option is `hits_limit` (called `max_score` before Rspamd 3.14.3; the old name is still accepted). It sets the hash weight at which a match gets nearly the full symbol score, as described in [Hash weight](#hash-weight). It can be set for the whole rule and for each flag in `fuzzy_map`; a flag without its own value uses the rule value.

The `mime_types` option specifies which attachment types are checked (or learned) using this fuzzy rule. This option takes a list of valid types in the following format: `["type/subtype", "*/subtype", "type/*", "*"]`, where `*` represents any valid type. In practice, it can be useful to save the hashes for all `application/*` attachments. Texts and embedded images are implicitly checked by `fuzzy_check` plugin, so there is no need to add `image/*` in the list of scanned attachments. Note that attachments and images are searched for an exact match, while texts are matched using the approximate algorithm (shingles).

`read_only` is quite an important option required for storage learning. By default, a rule allows learning (`read_only = false`):

~~~hcl
read_only = true; # disallow learning
read_only = false; # allow learning (default)
~~~

:::warning Flag Uniqueness for Writable Rules
Flag numbers must be unique across all rules that do not have `read_only = true`. Write operations (add/delete) are sent to **all** rules whose `fuzzy_map` contains the matching flag and that are not read-only—regardless of which rule was used for scanning. If two writable rules share a flag and one storage rejects writes (e.g., a public or third-party server that does not permit writes from your host), a 503 error will be returned.

To avoid this: use distinct flag numbers for each writable rule, or explicitly set `read_only = true` on third-party rules that should not receive write operations. Setting `read_only = true` on your own local storage rule instead will result in a 404 error when attempting to learn.
:::

The `encryption_key` parameter specifies the **public** key of a storage and enables encryption for all requests.

The `algorithm` parameter specifies the algorithm for generating hashes from text parts of emails (for attachments and images [blake2b](https://blake2.net/) is always used).

Initially, rspamd only supported the [siphash](https://en.wikipedia.org/wiki/SipHash) algorithm. However, this algorithm had some performance issues, particularly on older hardware (CPU models up to Intel Haswell). Subsequently, support was added for the following algorithms:

* `mumhash`
* `xxhash`
* `fasthash`

For the vast majority of configurations we recommend `mumhash` or `fasthash` (also called `fast`). These algorithms perform well on a wide range of platforms, and the shipped `rspamd.com` rule uses `mumhash`. A rule without the `algorithm` option uses `siphash`, so set the algorithm explicitly for a new storage. `siphash` (also called `old`) is only supported for legacy purposes.

You can evaluate the performance of different algorithms yourself by [compiling the tests set](/developers/writing_tests) from rspamd sources:

```
$ make rspamd-test
```

Run the test suite of different variants of hash algorithms on a specific platform:

```
test/rspamd-test -p /rspamd/shingles
```

**Important note:** Changing this parameter **will result in losing all data in the fuzzy hash storage**, since only one algorithm can be used for each storage at a time. It is not possible to convert one type of hash to another, as hash functions are designed to be irreversible.

### HTML Fuzzy Configuration (Since 3.14.0)

HTML fuzzy hashing can be enabled per-rule:

~~~hcl
# local.d/fuzzy_check.conf
rule "HTML_ENABLED" {
  servers = "localhost:11335";
  algorithm = "mumhash";  # Used for HTML shingles too
  
  # Enable HTML structure fuzzy hashing
  html_shingles = true;
  
  # Minimum HTML tags (default: 10)
  # Lower values = more emails hashed, higher FP risk
  # Higher values = fewer emails, more unique structures
  min_html_tags = 15;
  
  # Weight multiplier for HTML matches (default: 1.0)
  html_weight = 1.0;
  
  # Text fuzzy can be enabled simultaneously
  text_shingles = true;
  min_length = 32;
  
  fuzzy_map = {
    FUZZY_HTML_SPAM {
      flag = 100;
      hits_limit = 20.0;
    }
  }
}
~~~

**When HTML hash is generated:**

For each HTML text part, if `html_shingles = true`:
1. Check if part is HTML with parsed structure
2. Verify `tags_count >= min_html_tags`
3. Verify at least 2 links (prevent generic templates)
4. Verify DOM depth >= 3 (prevent flat structures)
5. Generate HTML tokens from DOM structure
6. Create shingles + metadata hashes
7. Send to storage alongside text hash (if enabled)

**HTML token format:** `tagname[.class][@domain]`

Example tokens from a newsletter:
```
html → head → title → body → div.header → a@brand.com → img@cdn.brand.com →
div.content → h1 → p → div.article → h2 → p → a.button@brand.com →
div.footer → p → a@brand.com
```

**What makes HTML fuzzy special:**

1. **Structure-based**: Ignores text content completely
2. **Domain-aware**: Captures eTLD+1 from all links and images; link domains are part of the tokens unless `ignore_link_domains` is set in the `html` block of the rule's [`checks`](/modules/fuzzy_check#structured-checks-configuration-since-314)
3. **Stable**: Filters tracking classes, normalizes dynamic attributes

### HTML Fuzzy for Phishing Detection

HTML fuzzy puts link domains into the hashed tokens, which helps against phishing that copies a legitimate template:

#### The Problem

Traditional fuzzy matching can miss phishing that:
- Copies text from legitimate emails (high text fuzzy match)
- Copies HTML structure from legitimate emails (high HTML match)
- But changes the links to phishing domains

#### The Solution

HTML fuzzy includes link domains in the hash: each token of a link or an image carries the eTLD+1 of its URL, so a copy of a legitimate template with different link domains produces different tokens:

```
Legitimate email from Amazon:
  HTML structure: div.header → a@amazon.com → div.content → a.button@amazon.com
  HTML hash: HASH_A

Phishing attempt:
  HTML structure: div.header → a@phishing.com → div.content → a.button@phishing.com
  HTML hash: HASH_B (DIFFERENT!)

Even if DOM structure identical:
  Tags and classes: same
  Link tokens: a@amazon.com vs a@phishing.com (different)
  Shared shingles: fewer than for a real copy of the template
```

**Result:** The phishing copy gets a different HTML hash than the legitimate template and matches its shingles only partially, despite the same structure.

#### Deployment Strategy

**Step 1: Learn legitimate templates**

```bash
# Learn legitimate emails from known brands
rspamc -f 1 -w 10 fuzzy_add legitimate/amazon_notification.eml
rspamc -f 1 -w 10 fuzzy_add legitimate/facebook_notification.eml
rspamc -f 1 -w 10 fuzzy_add legitimate/paypal_receipt.eml
```

**Step 2: Configure phishing detection**

~~~hcl
# local.d/fuzzy_check.conf
rule "BRAND_PROTECTION" {
  servers = "localhost:11335";
  algorithm = "mumhash";
  html_shingles = true;
  min_html_tags = 20;  # Brands use complex HTML
  html_weight = 1.5;   # Prioritize structure
  
  fuzzy_map = {
    FUZZY_LEGIT_BRANDS {
      flag = 1;
      hits_limit = 20.0;
    }
  }
}
~~~

**Step 3: Monitor and refine**

Look for:
- Partial `html` match (probability well below 1.0) of a learned legitimate template = copied structure with other link domains, possible phishing
- High HTML match + low text match = legitimate variation (newsletter)

### HTML Fuzzy for Spam Campaigns

Spam campaigns often use:
- Same HTML template across thousands of messages
- Personalized text (recipient name, dates, offers)
- Rotating domains but similar structure

**Traditional fuzzy:** Misses campaign due to text variations  
**HTML fuzzy:** Catches entire campaign via structure match

**Configuration:**

~~~hcl
# local.d/fuzzy_check.conf
rule "SPAM_CAMPAIGNS" {
  servers = "localhost:11335";
  algorithm = "mumhash";
  html_shingles = true;
  min_html_tags = 15;
  html_weight = 1.0;
  
  fuzzy_map = {
    FUZZY_SPAM_TEMPLATES {
      flag = 200;
      hits_limit = 15.0;
    }
  }
}
~~~

**Learning:**

```bash
# Learn first spam from campaign
rspamc -f 200 -w 15 fuzzy_add spam_campaign_sample.eml

# All subsequent emails from campaign will match via HTML
```

### Best Practices

**1. Use appropriate min_html_tags:**

- **Low (5-10)**: More matches, higher FP risk, useful for spam campaigns
- **Medium (10-15)**: Balanced, recommended for general use
- **High (20+)**: Fewer matches, low FP, best for brand protection

**2. Adjust html_weight based on use case:**

- **Phishing detection**: `1.2-1.5` (prioritize structure)
- **Spam campaigns**: `1.0` (equal to text)
- **Newsletter grouping**: `0.8-1.0` (structure important but not critical)

**3. Separate flags for different purposes:**

```hcl
fuzzy_map = {
  FUZZY_LEGIT_TEMPLATES { flag = 1; hits_limit = 10.0; }  # Whitelist
  FUZZY_SPAM_TEMPLATES { flag = 2; hits_limit = 15.0; }    # Spam
  FUZZY_PHISHING_TEMPLATES { flag = 3; hits_limit = 25.0; } # Phishing
}
```

Keep `hits_limit` positive. To make a whitelist symbol lower the score, give the symbol a negative weight in `local.d/fuzzy_group.conf`, as `LOCAL_FUZZY_WHITE` in Step 3 above; a negative `hits_limit` would invert the result.

**4. Monitor false positives:**

Check logs for `html` type matches and verify:
- Link domains are the same as in the learned template
- Structure genuinely matches
- No legitimate templates mis-flagged

**5. Combine with text fuzzy:**

Enable both for comprehensive coverage:
```hcl
text_shingles = true;   # Catch text-based spam
html_shingles = true;   # Catch structure-based spam/phishing
```

### Limitations

- **Only for HTML parts**: Plain text emails not processed
- **Requires complex HTML**: Simple HTML (<10 tags) skipped
- **Memory**: Additional ~300 bytes per HTML part
- **Storage**: Separate cache key per rule to avoid conflicts

### Troubleshooting

**HTML hashes not generated:**

Check debug logs for:
```
HTML part has X tags, less than minimum Y
HTML part has only 1 links, too few for reliable matching
HTML part has depth 2, too shallow for reliable matching
```

Adjust `min_html_tags` or verify HTML complexity.

**Unwanted matches (false positives):**

- Increase `min_html_tags` (reduce generic matches)
- Check if tracking classes causing instability
- Check that `ignore_link_domains` is not enabled

**Phishing not detected:**

- Verify legitimate templates are learned (`flag = 1`)
- Check that the link domains in the phishing copy differ from the learned template
- Ensure `html_weight >= 1.0` for structure priority
- Review similarity calculation in logs

### Condition scripts for the learning

As the `fuzzy_check` plugin is responsible for learning, we create the script within its configuration. This script determines whether an email is suitable for learning. The script should return a Lua function with a single argument of type [`rspamd_task`](/lua/rspamd_task) type. The function should return a boolean value (`true` to learn, `false` to skip learning), or a pair consisting of a boolean value and a numeric value (to modify the hash flag value, if necessary). Parameter `learn_condition` is used to setup learn script. The most convenient way to set the script is to write it as a multiline string supported by `UCL`:

~~~hcl
# Fuzzy check plugin configuration snippet
learn_condition = <<EOD
return function(task)
  return true -- Always learn
end
EOD;
~~~

Here are some practical examples of useful scripts. For instance, if we want to restrict learning for messages that come from certain domains:

~~~lua
return function(task)
  local skip_domains = {
    'example.com',
    'google.com',
  }

  local from = task:get_from()

  if from and from[1] and from[1]['addr'] then
    for i,d in ipairs(skip_domains) do
      if string.find(from[1]['addr'], d) then
        return false
      end
    end
  end

  return true
end
~~~

The function must return a boolean in every case: if it returns nothing, the message is not learned.

It can also be useful to split hashes into different flags based on their source. For example, such sources may be encoded in the `X-Source` header. For instance, we have the following match between flags and sources:

* `honeypot` - "black" list: 1
* `users_unfiltered` - "gray" list: 2
* `users_filtered` - "black" list: 1
* `FP` - "white" list: 3

Then the script that provides this logic may be as following:

~~~lua
return function(task)
  local skip_headers = {
    ['X-Source'] = function(hdr)
      local sources = {
        honeypot = 1,
        users_unfiltered = 2,
        users_filtered = 1,
        FP = 3
      }
      local fl = sources[hdr]

      if fl then return true,fl end -- Return true + new flag
      return false
    end
  }

  for h,f in pairs(skip_headers) do
    local hdr = task:get_header(h) -- Check for interesting header
    if hdr then
      return f(hdr) -- Call its handler and return result
    end
  end

  return false -- Do not learn if specified header is missing
end
~~~

----

## Hashes replication

It is often desired to have a local copy of the remote storage. Rspamd 1.3 to 1.9 replicated hashes between fuzzy storage workers (the `sync_keypair`, `slave`, `masters`, `master_key` and `master_flags` options). This replication was removed in Rspamd 2.0, and the fuzzy storage worker now ignores these options. With the Redis backend, use Redis replication instead:

<center><img class="img-fluid" src="/img/rspamd-fuzzy-5.png" width="75%"></center>

The **master** is a Redis primary that receives all hash updates, such as adding, modifying or deleting. Each slave site runs a Redis replica of the primary and a fuzzy storage worker that serves checks from the local replica. Redis replicas are read-only, so the fuzzy storage workers must send their updates to the primary, and the replicas must be able to connect to the primary. This should be taken into account when configuring the firewall.

### Backup and restore

This procedure is used to back up the storage, to move it to another host, or to load a copy of the hashes into a new Redis server.

With the Redis backend, the hashes are saved by Redis persistence, so enable RDB snapshots or AOF in the Redis configuration if the hashes must survive a Redis restart. To make a backup copy, write the pending updates of the fuzzy storage to Redis and ask Redis for a snapshot:

```
rspamadm control fuzzysync
redis-cli BGSAVE
```

Redis writes the snapshot to `dump.rdb` in its data directory (`redis-cli CONFIG GET dir` shows it). Copy the file when `redis-cli LASTSAVE` reports a new time. To restore, stop Redis, put the copy of `dump.rdb` into its data directory, and start Redis again. If AOF is enabled (`appendonly yes`), Redis loads the AOF files and ignores `dump.rdb`, so disable AOF while restoring and enable it again afterwards. The snapshot contains everything stored in this Redis server, including the data of other Rspamd modules that use it; the fuzzy hashes are the keys that start with the `prefix` (`fuzzy` by default).

With the SQLite backend, use the `sqlite3` tool. Run `rspamadm control fuzzysync` first, so that the pending updates are included, and make a copy of the database:

```
sqlite3 /var/lib/rspamd/fuzzy.db ".backup fuzzy-backup.db"
```

To restore the copy, stop rspamd and run:

```
sqlite3 /var/lib/rspamd/fuzzy.db ".restore fuzzy-backup.db"
```

### Replication setup

Configure each replica with the `replicaof` directive in its Redis configuration, as described in the Redis replication documentation. Then configure the fuzzy storage worker on the replica site to read from the local replica and to send updates to the primary:

~~~hcl
# local.d/worker-fuzzy.inc on a site with a local Redis replica
count = 4;
# Checks are served by the local replica
read_servers = "127.0.0.1:6379";
# Updates go to the Redis primary
write_servers = "fuzzy-redis.example.com:6379";
~~~

The same `read_servers` and `write_servers` options can be set in the `fuzzy` section of `local.d/redis.conf` instead. Allow connections to the Redis primary only from your own hosts and protect it with a Redis `password`.

Flag translation from the master to the slaves (`master_flags`) is no longer available. If several sources write to the same storage, give them distinct flag numbers.


## Storage testing

To test the storage you can use `rspamadm control fuzzystat` command. Here is its output for a small test storage with the Redis backend:

```
Statistics for storage u33g775t7jfns8x4ca118c4q1wbfdo3
blocked_requests: 0
decrypt_errors: 0
ratelimited_requests: 0
fuzzy_checked: (v0.6: 0), (v0.8: 0), (v0.9: 24)
fuzzy_shingles: (v0.6: 0), (v0.8: 0), (v0.9: 24)
fuzzy_found: (v0.6: 0), (v0.8: 0), (v0.9: 23)
fuzzy_stored: 53
fuzzy_expired: 0
invalid_requests: 0
delayed_hashes: 0

Storage statistics (1 in 10 digests sampled, 8 of 53, scanned 2026-10-08 10:43:59 on 127.0.0.1:6379 in 0 seconds):
        Flag 11: 53 hashes, weight avg 10.0, max 10
        Multi-flag hashes: 0
        Shingled hashes: 53 (1.70k shingle slots)
        Age: <1d 53, <7d 0, <30d 0, older 0

Keys statistics:
Key id: r5fc7ix5t86mq
        Checked: 23 (0 per hour in average)
        Matched: 22 (0 per hour in average)
        Errors: 0
        Added: 1
        Deleted: 0

        Flags stat:
        [11]:
                Matched: 22 (0 per hour in average)
                Errors: 0
                Added: 0
                Deleted: 0
        ...
```

Primarily, a general storage statistics is shown, such as the number of stored and expired hashes, and the numbers of checked hashes, shingle checks and found hashes. These three counters are split by the protocol version of the clients. The storage accepts requests from rspamd 1.0 and newer, and the three values count requests from rspamd 1.0 - 1.6, from rspamd 1.7 - 3.x, and from rspamd 4.0 and newer (multi-flag support). In rspamd 4.2.2, `rspamadm` still labels these columns with the old names `v0.6`, `v0.8` and `v0.9`.

With the Redis backend, the number of stored hashes and the `Storage statistics` block come from a periodic scan of the Redis keys (at most once per 4 hours by default, see `count_scan` in `/etc/rspamd/worker-fuzzy.inc`). The per-flag, shingle and age values are computed from a sample of the hashes.

And then detailed statistics is displayed for each of the keys configured in the storage, with per-flag counters, and for the latest requested client IP-addresses. In conclusion, we see the overall statistics on IP-addresses.

To change the output from this command, you can use the following options:

* `-n`: display raw numbers without reduction
* `--short`: do not display detailed statistics on the keys and IP-addresses
* `--no-keys`: do not show statistics on keys
* `--no-ips`: do not show statistics on IP-addresses
* `--sort`: sort:
  + `checked`: by the number of checked hashes (default)
  + `matched`: by the number of found hashes
  + `errors`: by the number of failed requests
  + `name`: by key id or IP address

e.g.

```
rspamadm control fuzzystat -n
```
