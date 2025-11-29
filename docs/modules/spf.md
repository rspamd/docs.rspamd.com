---
title: SPF module
---

# SPF module

The SPF module checks the sender's [SPF](http://www.open-spf.org/) Many mail providers use SPF records to determine eligible hosts for sending email on a specific domain. There are various ways to create and use SPF records, but they all primarily verify the sender's domain and IP.

A specific scenario involves automated messages from the special mailer daemon address: `<>`. In this case, Rspamd utilizes `HELO` to retrieve domain information according to the standard.

## Principles of work

When used correctly, `SPF` can be a valuable tool. However, it often becomes vulnerable in situations where a message is redirected or modified by mailing list software.

Furthermore, numerous mail providers lack a proper understanding of this technology, resulting in the misuse of SPF techniques. As a result, the scores for SPF symbols in Rspamd tend to be relatively low.

The cache follows the principle of `least recently used` expiration, meaning that the lifetime of each cached item is determined by the time to live of the corresponding DNS record.

To configure the SPF module, you have the option to manually specify the cache size and maximum expiration time. Additionally, you can define parameters such as the maximum number of recursive DNS subrequests (including chain length), the maximum count of DNS requests per record, the minimum TTL enforced for all elements in SPF records, and the ability to disable all IPv6 lookups.

## Configuration options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | true | Enable or disable the SPF module |
| `spf_cache_size` | 2048 | Number of elements in the cache of parsed SPF records |
| `spf_cache_expire` | 1d | Default max expire for an element in this cache |
| `max_dns_nesting` | 10 | Maximum number of recursive DNS subrequests (include chain length) |
| `max_dns_requests` | 30 | Maximum count of DNS requests per record |
| `min_cache_ttl` | 5min | Minimum TTL enforced for all elements in SPF records |
| `disable_ipv6` | false | Disable all IPv6 lookups |
| `whitelist` | nil | Map of IP addresses to whitelist from checks |

## Symbols

The module produces the following symbols:

| Symbol | Description |
|--------|-------------|
| `R_SPF_ALLOW` | SPF check passed |
| `R_SPF_FAIL` | SPF check failed (hard fail) |
| `R_SPF_SOFTFAIL` | SPF check soft failed |
| `R_SPF_NEUTRAL` | SPF neutral result |
| `R_SPF_DNSFAIL` | DNS failure during SPF check |
| `R_SPF_PERMFAIL` | Permanent SPF failure (e.g., invalid record) |
| `R_SPF_NA` | No SPF record found |
| `R_SPF_PLUSALL` | SPF record contains +all (accepts all) |

## Example configuration

~~~hcl
# local.d/spf.conf

spf_cache_size = 1k; # cache up to 1000 of the most recent SPF records
spf_cache_expire = 1d; # default max expire for an element in this cache
max_dns_nesting = 10; # maximum number of recursive DNS subrequests
max_dns_requests = 30; # maximum count of DNS requests per record
min_cache_ttl = 5min; # minimum TTL enforced for all elements in SPF records
disable_ipv6 = false; # disable all IPv6 lookups
whitelist = "/path/to/some/file"; # whitelist IPs from checks
~~~

## Using SPF with forwarding

If your MTA is placed behind some trusted forwarder you can still check SPF policies for the originating domains and IP addresses. Please consider checking the [external relay](/modules/external_relay) documentation. There is a legacy option `external_relay` in SPF plugin itself but it is kept for compatibility and should not be used nowadays.
