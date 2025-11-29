---
title: Replies module
---


# Replies module

This module gathers the `message-id` header of emails that authenticated users have sent and saves the corresponding hashes to Redis. These hashes expire after a predetermined length of time, which can be set to a maximum of 24 hours by default. Additionally, the module creates hashes of the `in-reply-to` headers of all received messages and checks them for matches, i.e., messages that were sent in response to messages that our system initiated. After that it approves all recipients of the current sender and adds them to the `local replies set` of this sender (default maximum size is 20). `local replies set` is used to check approved recipients for current sender. This `local replies set` has the time to expire (default is 1 day) after which it is removed from the redis. After this all recipients are also added to the `global replies set` (default maximum size is 30). `global replies set` is used to determine whether the sender is approved. The module then generates a symbol that can be used to adjust the scoring or force an action, such as accepting the message with no action taken, depending on the configuration.


## Configuration

Settings for the module are described below (default values are indicated in brackets).

- `action`: apply the given action to messages identified as replies (should typically be set to "no action" to accept)
- `expire`: time, in seconds, after which to expire records (default is one day).
- `key_prefix`: string prefixed to keys in Redis (default `rr`)
- `key_size`: length of hash keys (default 20)
- `sender_prefix`: string prefixed to replies sets (default `rsrk`)
- `sender_key_global`: string that is used as a key to the global replies set (default `verified_senders`)
- `sender_key_size`: length of sender hash keys (default 20)
- `symbol`: symbol yielded on messages identified as replies (default `REPLY`)
- `score`: default score for the symbol (default -4)
- `max_local_size`: maximum amount of senders that are in the local replies set (default is 20)
- `max_global_size`: maximum amount of senders that are in the global replies set (default is 30)
- `use_auth`: track replies for authenticated users (default true)
- `use_local`: track replies for local IPs (default true)
- `min_message_id`: minimum length of message-id header to consider (default 2)
- `cookie`: enable DKIM-like reply cookie in message-id
- `cookie_key`: key for cookie generation
- `cookie_is_pattern`: treat cookie as a pattern
- `cookie_valid_time`: how long cookie is valid (default `2w`)
- `reply_sender_privacy`: enable sender address obfuscation in Redis (default false)
- `reply_sender_privacy_alg`: hash algorithm for obfuscation (default `blake2`)
- `reply_sender_privacy_prefix`: prefix for obfuscated addresses (default `obf`)
- `reply_sender_privacy_length`: length of obfuscated hash (default 16)

Additionally, you will need to set up Redis servers to store data, such as `servers` or `read_servers` and `write_servers`. You can specify all standard Redis arguments, including password, timeout, database, and so on.

## Example

Configuration should be added to `/etc/rspamd/local.d/replies.conf`:

~~~hcl
# This setting is non-default & may be desirable
#action = "no action";
# These are default settings you may want to change
expire = 1d;
key_prefix = "rr";
sender_prefix = "rsrk";
message = "Message is reply to one we originated";
symbol = "REPLY";
max_local_size = 20;
max_global_size = 30;
# Module specific redis configuration
#servers = "localhost";
~~~
