---
title: Statistics settings
---

# Rspamd statistic settings

## Introduction

Rspamd utilizes statistics to determine the classification of messages into either spam or ham categories. This classification process is based on the Bayesian theorem, which combines probabilities to assess the likelihood of a message belonging to a particular class, such as `spam` or `ham`. The following factors play a role in determining this probability:

- the probability of a specific token to be spam or ham (which means efficiently count of a token's occurrences in spam and ham messages)
- the probability of a specific token to appear in a message (which efficiently means frequency of a token divided by a number of tokens in a message)

## Statistics Architecture

However, Rspamd employs more advanced techniques to combine probabilities, including sparsed bigrams (OSB) and the inverse chi-square distribution.

The `OSB` algorithm goes beyond considering single words as tokens and instead takes into account combinations of words, taking into consideration their positions. This schema is visually represented in the following diagram:

<img class="img-fluid" width="50%" src="/img/rspamd-schemes.004.png">

The main drawback of this approach is the increased number of tokens, which is multiplied by the size of the window. In Rspamd, we use a window size of 5 tokens, resulting in the number of tokens being approximately **5 times larger** than the number of words.

Statistical tokens are stored in statfiles, which are then mapped to specific backends. This architecture is visually represented in the following diagram:

<img class="img-fluid" width="50%" src="/img/rspamd-schemes.005.png">

## Statistics Configuration

Starting from Rspamd 2.0, we recommend using `redis` as the backend and `osb` as the tokenizer, which are set as the default settings.

The default configuration settings can be found in the `$CONFDIR/statistic.conf` file.

~~~hcl
classifier "bayes" {
  # name = "custom";  # 'name' parameter must be set if multiple classifiers are defined
  tokenizer {
    name = "osb";
  }
  cache {
  }
  new_schema = true; # Always use new schema
  store_tokens = false; # Redefine if storing of tokens is desired
  signatures = false; # Store learn signatures
  #per_user = true; # Enable per user classifier
  min_tokens = 11;
  backend = "redis";
  min_learns = 200;

  statfile {
    symbol = "BAYES_HAM";
    spam = false;
  }
  statfile {
    symbol = "BAYES_SPAM";
    spam = true;
  }
  learn_condition = 'return require("lua_bayes_learn").can_learn';

  # Autolearn sample
  # autolearn {
  #  spam_threshold = 6.0; # When to learn spam (score >= threshold)
  #  ham_threshold = -0.5; # When to learn ham (score <= threshold)
  #  check_balance = true; # Check spam and ham balance
  #  min_balance = 0.9; # Keep diff for spam/ham learns for at least this value
  #}

  .include(try=true; priority=1) "$LOCAL_CONFDIR/local.d/classifier-bayes.conf"
  .include(try=true; priority=10) "$LOCAL_CONFDIR/override.d/classifier-bayes.conf"
}

.include(try=true; priority=1) "$LOCAL_CONFDIR/local.d/statistic.conf"
.include(try=true; priority=10) "$LOCAL_CONFDIR/override.d/statistic.conf"
~~~

You are also recommended to use the [`bayes_expiry` module](/modules/bayes_expiry) to maintain your statistics database.

Please note that `statistic.conf` includes the configuration from `classifier-bayes.conf` for your convenience.

In most setups (where a single classifier is used) you can tune the bayes classifier in `local.d/classifier-bayes.conf`, and `statistic.conf` can remain unmodified.

However, if you need to define multiple classifiers, you should create a `local.d/statistic.conf` file. There you must describe each classifier section explicitly: each classifier **must** have its own `name` and define **all options** of the default configuration as no fallback will be applied. A common use case for this setup is when one classifier is configured as `per_user` and another is not.

## Multi-class Bayes (3.13+)

Starting with Rspamd 3.13, the Bayes classifier supports multiple classes (e.g. newsletters, transactional, phishing) in addition to the classic binary spam/ham. For production setups we strongly recommend keeping spam/ham as a separate classifier and adding another classifier for non-binary classes. This preserves clear decision making for actions (reject, add header, etc.) while allowing additional categorisation.

### Configuration model and incompatibilities

- In a multi-class classifier every `statfile` must define `class = "<name>"`.
- Do not mix `spam = true/false` with `class = "..."` in the same classifier.
- A multi-class classifier must have at least two classes (two or more `statfile` sections with distinct `class`).
- `min_learns` (if set) is applied per class.

### Recommended layout: two separate classifiers

Create two classifiers in `local.d/statistic.conf`: one strictly binary (spam/ham), and a second one for other classes.

~~~hcl
# local.d/statistic.conf

# 1) Binary classifier: spam/ham only (reuses existing data if you already have it)
classifier "bayes" {
  name = "bayes_binary";
  tokenizer { name = "osb"; }
  backend = "redis";
  min_tokens = 11;
  min_learns = 200;

  statfile { symbol = "BAYES_HAM"; spam = false; }
  statfile { symbol = "BAYES_SPAM"; spam = true; }

  learn_condition = 'return require("lua_bayes_learn").can_learn';
}

# 2) Multi-class classifier: additional categories (builds its own data)
classifier "bayes" {
  name = "bayes_multi";
  tokenizer { name = "osb"; }
  backend = "redis";
  min_tokens = 11;
  min_learns = 200;

  # Define non-binary classes
  statfile { symbol = "BAYES_NEWSLETTER"; class = "newsletter"; }
  statfile { symbol = "BAYES_TRANSACTIONAL"; class = "transactional"; }
  statfile { symbol = "BAYES_PHISHING"; class = "phishing"; }

  # Optional:
  # per_user = true;  # enable per-user multi-class stats if desired

  learn_condition = 'return require("lua_bayes_learn").can_learn';
}
~~~

### Learning

- Binary classifier (unchanged):

```bash
rspamc learn_spam message.eml
rspamc learn_ham message.eml
```

- Multi-class classifier (new command format):

```bash
rspamc learn_class:newsletter newsletter.eml
rspamc learn_class:transactional order_confirmation.eml
```

### Backwards compatibility (existing Bayes database)

- If you already have Bayes data for spam/ham in Redis, keep your existing binary classifier section intact (same symbols, same backend parameters). No relearning is needed for spam/ham.
- Add the new `bayes_multi` classifier alongside it as shown above. It will build its own database independently from the binary classifier.
- Avoid changing symbol names or backend addressing for the binary classifier to ensure it continues using the old database.

See the Migration notes for 3.13.0 for a concise upgrade checklist.

### Classifier and headers

The classifier in Rspamd learns headers that are specifically defined in the `classify_headers` section of the `options.inc `file. Therefore, there is no need to remove any additional headers (e.g., X-Spam) before the learning process, as these headers will not be utilized for classification purposes. Rspamd also takes into account the `Subject` header, which is tokenized according to the aforementioned rules. Additionally, Rspamd considers various meta-tokens, such as message size or the number of attachments, which are extracted from the messages for further analysis.

## Redis statistics

Supported parameters for the Redis backend are:

### Required parameters
- `name`: Unique name of the classifier. Must be set when multiple classifiers are defined; otherwise, optional.
- `tokenizer`: Currently, only OSB is supported. Must be set as shown in the default configuration.
- `new_schema`: Must be set to `true`.
- `backend`: Must be set to `"redis"`.
- `learn_condition`: Lua function that verifies that learning is needed. The default function **must** be set if you have not written your own. Omitting `learn_condition` from `statistic.conf` will lead to losing protection from overlearning.
- `servers`: IP or hostname with a port for the Redis server. Use an IP for the loopback interface if you have defined localhost in /etc/hosts for IPv4 and IPv6, or your Redis server will not be found!
- `min_tokens`: Minimum number of words required for statistics processing.
- `statfile`: Defines keys for spam and ham mails.

### Optional parameters
- `write_servers`: For write-only Redis servers (usually masters).
- `read_servers`: For read-only Redis servers (usually replicas).
- `password`: Password for the Redis server.
- `db`: Database to use, **must be a non-negative integer** (though it is recommended to use dedicated Redis instances and not databases in Redis).
- `min_learns`: Minimum learn to count for **both** spam and ham classes to perform classification.
- **`autolearn {}`**: This section defines the behavior of automatic learning for spam and ham messages based on specific thresholds and balance settings. It includes the following options:
  - `spam_threshold` (No default value): Specifies the score threshold above which a message is considered spam and is eligible for automatic spam learning. If a message’s score exceeds this threshold, it will be learned as spam. If not set, autolearning for spam will depend on the verdict of the message.
  - `ham_threshold` (No default value): Specifies the score threshold below which a message is considered ham and is eligible for automatic ham learning. If a message’s score is below this threshold, it will be learned as ham. If not set, autolearning for ham will depend on the verdict of the message.
  - `check_balance` (Default: `true`): Enables checking of the balance between spam and ham learns. If the balance is too skewed, learning will be skipped based on the ratio defined by `min_balance`.
  - `min_balance` (Default: `0.9`): Ensures balance between spam and ham learns. If the ratio of spam learns to ham learns (or vice versa) exceeds `1 / min_balance`, learning for the more frequent type is skipped until the other type catches up. For example, with the default value of `0.9`, learning is skipped if one type exceeds the other by a ratio of approximately `1.11` (1/0.9). This helps prevent bias in the learning process.

  For further details, see the [Autolearning section](#autolearning).
- `per_user`: For more details, see the Per-user statistics section.
- `cache_prefix`: Prefix used to create keys where to store hashes of already learned IDs, defaults to `"learned_ids"`.
- `cache_max_elt`: Amount of elements to store in one `learned_ids` key.
- `cache_max_keys`: Amount of `learned_ids` keys to store.
- `cache_elt_len`: Length of hash to store in one element of `learned_ids`.


## Autolearning

Starting from version 1.1, Rspamd introduces autolearning functionality for statfiles. Autolearning occurs after all rules, including statistics, have been processed. However, it only applies if the same symbol has not already been added. For example, if `BAYES_SPAM` is already present in the checking results, the message will not be learned as spam.

There are three options available for specifying autolearning:

* `autolearn = true`: autolearning is performing as spam if a message has `reject` action and as ham if a message has **negative** score
* `autolearn = [-5, 5]`: autolearn as ham if the score is less than `-5` and as spam if the score is more than `5`
* `autolearn = "return function(task) ... end"`: use the following Lua function to detect if autolearn is needed (function should return 'ham' if learn as ham is needed and string 'spam' if learn as spam is needed, if no learning is needed then a function can return anything including `nil`)

Redis backend is highly recommended for autolearning purposes due to its ability to handle high concurrency levels when multiple writers are synchronized properly. Using Redis as the backend ensures efficient and reliable autolearning functionality.

### Per-user statistics

To enable per-user statistics, you can add the `per_user = true` property to the configuration of the classifier. However, it is *important* to ensure that Rspamd is called at the final delivery stage (e.g., LDA mode) to avoid issues with multi-recipient messages. When dealing with multi-recipient messages, Rspamd will use the first recipient for user-based statistics. 

Rspamd prioritizes SMTP recipients over MIME ones and gives preference to the special LDA header called `Delivered-To`, which can be appended using the `-d` option for `rspamc`. This allows for more accurate per-user statistics in your configuration.

You can change per-user statistics to per-domain (or any other) by utilizing a Lua function. The function should return the user as a string or `nil` as a fallback. For example:
~~~lua
per_user = <<EOD
return function(task)
  local rcpt = task:get_recipients('any')
  if rcpt then
    local first_rcpt = rcpt[1]
    if first_rcpt['domain'] then
      return first_rcpt['domain']
    end
  end
  return nil
end
EOD
~~~

#### Sharding

Starting from version 3.9, per-user statistics can be sharded across different Redis servers using the [hash algorithm](/configuration/upstream#hash-algorithm).

Example of using two stand-alone master shards without read replicas:
~~~hcl
servers = "hash:bayes-peruser-0-master,bayes-peruser-1-master";
~~~

Example of using a setup with three master-replica shards:
~~~hcl
write_servers = "hash:bayes-peruser-0-master,bayes-peruser-1-master,bayes-peruser-2-master";
read_servers = "hash:bayes-peruser-0-replica,bayes-peruser-1-replica,bayes-peruser-2-replica";
~~~

Important notes:
1. Changing the shard count requires dropping all Bayes statistics, so please make decisions wisely.
2. Each replica should have the same position in `read_servers` as its master in `write_servers`; otherwise, this will result in misaligned read-write hash slot assignments.
3. You can't use more than one replica per master in a sharded setup; this will result in misaligned read-write hash slot assignments.
4. Redis Sentinel cannot be used for a sharded setup.
5. In the controller, you will see incorrect `Bayesian statistics` for the count of learns and users.
