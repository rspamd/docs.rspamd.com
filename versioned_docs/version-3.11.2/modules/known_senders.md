---
title: known_senders module
---

# Rspamd `known_senders` Plugin Documentation

The `known_senders` plugin is designed to help you track and categorize email senders based on their domains. It allows you to maintain a list of known senders and classify incoming emails from these senders. This documentation will guide you through the configuration and usage of the `known_senders` plugin.

## Plugin Overview

The `known_senders` plugin is used to maintain a list of known sender domains and classify incoming emails based on these domains. It can be especially useful for distinguishing known senders from potentially malicious or unknown ones. Also it can check if incoming `in-reply-to` mail sender and recipients are verified. This plugin is available from the version 3.7.0.

## Configuration

To configure the `known_senders` plugin, you need to define it in your Rspamd configuration file (usually `local.d/known_senders.conf`). Below is an example configuration with explanations for each parameter:

```hcl
# This plugin must be explicitly enabled to work
enabled = true;
# Domains to track senders
domains = "https://maps.rspamd.com/freemail/free.txt.zst";

# Maximum number of elements
max_senders = 100000;

# Maximum time to live (when not using bloom filters)
max_ttl = 30d;

# Use bloom filters (must be enabled in Redis as a plugin)
use_bloom = false;

# Insert symbol for new senders from the specific domains
symbol_unknown = 'UNKNOWN_SENDER';

# Insert symbol for verified sender in global replies set
symbol_check_mail_global = 'INC_MAIL_KNOWN_GLOBALLY';

# Insert symbol for verified recipients in local replies set
symbol_check_mail_local = 'INC_MAIL_KNOWN_LOCALLY';

# Prefix for replies sets
sender_prefix = 'rsrk';
```

### Domains

- **Description**: The `domains` parameter specifies the URLs or file paths from which the plugin will retrieve sender domains to track. These domains are typically listed in a file in plain text or compressed format.

### Maximum Senders

- **Description**: The `max_senders` parameter sets the maximum number of sender domains that can be stored in the known senders list. Once this limit is reached, older entries may be removed to make room for new ones.

### Maximum Time to Live

- **Description**: The `max_ttl` parameter defines the maximum time a sender domain can remain in the known senders list when not using bloom filters. It is specified in days (e.g., `30d`). After this period, the sender domain is considered unknown again.

### Use Bloom Filters

- **Description**: The `use_bloom` parameter enables or disables the use of bloom filters for faster and memory-efficient lookup of known sender domains. To use bloom filters, follow these steps:

   1. **Enable Redis Bloom Plugin**: In your Redis configuration (usually `redis.conf`), enable the Redis Bloom plugin. This typically involves adding or uncommenting the following line (please bear in mind that you might need to [compile this plugin](https://github.com/RedisBloom/RedisBloom) manually):

      ```
      loadmodule /path/to/redisbloom.so
      ```

   Once you have completed these steps, the `known_senders` plugin will be able to use bloom filters for efficient tracking and classification of known sender domains.
### Unknown Sender Symbol

- **Description**: The `symbol_unknown` parameter specifies the symbol that will be inserted for new senders from the domains listed in the `domains` configuration. This symbol can be used to further classify emails from unknown senders.

### Verified Incoming Mail Global Symbol

- **Description**: The `symbol_check_mail_global` parameter specifies the symbol that will be inserted if sender in the incoming mail is verified by `replies` module.
 
### Verified Incoming Mail Local Symbol

- **Description**: The `symbol_check_mail_local` parameter specifies the symbol that will be inserted if recipients in the incoming mail is verified by `replies` module.

### Sender Prefix

- **Description**: The `sender_prefix` parameter is used to define keys in the redis that denote replies sets.
- **Note**: If you changed `sender_prefix` in `local.d/replies.conf` you also need to change it in the `local.d/known_senders.conf`.  
