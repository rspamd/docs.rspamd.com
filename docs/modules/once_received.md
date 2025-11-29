---
title: Once received module
---

# Once received module

This module is intended to do simple checks for mail with one `Received` header. The underlying concept is that genuine emails tend to have multiple received headers, whereas spam originating from compromised user devices often exhibit certain negative characteristics, such as the use of `dynamic` or `broadband` IP addresses.

## Configuration

Configuring this module is quite straightforward: you simply need to define a `symbol` for generic emails with only one received header, specify a `symbol_strict` for emails that exhibit negative patterns or have unresolved hostnames, and include **good** and **bad** patterns, which can utilise [lua patterns](http://lua-users.org/wiki/PatternsTutorial). Use `good_host` lines to exclude certain hosts from this module, and `bad_host` lines to identify specific negative patterns. Additionally, you can create a `whitelist` to define a list of networks for which the `once_received` checks should be excluded.

### Configuration options

| Option | Default | Description |
|--------|---------|-------------|
| `symbol` | `ONCE_RECEIVED` | Symbol for messages with only one received header |
| `symbol_strict` | nil | Symbol for messages matching bad patterns or unresolved hostnames |
| `symbol_mx` | `DIRECT_TO_MX` | Symbol for direct MUA to MX connections (detected via User-Agent/X-Mailer) |
| `good_host` | - | Lua pattern for hostnames to exclude from checks |
| `bad_host` | - | Lua pattern for hostnames that trigger strict symbol |
| `whitelist` | nil | Map of IP addresses/networks to exclude from checks |
| `check_local` | false | Apply checks to messages from local networks |
| `check_authed` | false | Apply checks to messages from authenticated users |

## Example

~~~hcl
once_received {
    good_host = "^mail";
    bad_host = "static";
    bad_host = "dynamic";
    symbol_strict = "ONCE_RECEIVED_STRICT";
    symbol = "ONCE_RECEIVED";
    whitelist = "/tmp/ip.map";
}
~~~

As is typical, the IP map can include both IPv4 and IPv6 addresses, as well as networks in CIDR notation. You may also add optional comments to the map, indicated by a `#` symbol.
