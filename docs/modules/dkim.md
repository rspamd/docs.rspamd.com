---
title: DKIM module
---

# DKIM module

This module verifies the authenticity of emails through the analysis of [DKIM](http://dkim.org/) signatures.
The presence of a valid DKIM signature indicates that the message has been trusted and signed by a recognized source.
For example, if a message comes from `gmail.com` then a valid DKIM signature means that this message was definitely signed by `gmail.com` (unless gmail.com private key has been compromised, which is not a likewise case).

## Supported features

Rspamd effectively handles a variety of DKIM signatures and message canonicalization techniques. 
However, a common challenge in DKIM is the handling of line endings, as different mail transfer agents (MTAs) may treat them differently, resulting in invalid signatures. 
To mitigate this issue, Rspamd treats line endings as `CR+LF` that which is compatible with the majority of DKIM implementations.

## Configuration

DKIM module has several useful configuration options:

 *  `symbol_allow` (_string_): symbol to insert in case of allow (default: 'R_DKIM_ALLOW')
 *  `symbol_reject` (_string_): symbol to insert (default: 'R_DKIM_REJECT')
 *  `symbol_tempfail` (_string_): symbol to insert in case of temporary fail (default: 'R_DKIM_TEMPFAIL')
 *  `symbol_permfail` (_string_): symbol to insert in case of permanent failure (default: 'R_DKIM_PERMFAIL')
 *  `symbol_na` (_string_): symbol to insert in case of no signing (default: 'R_DKIM_NA')
 *  `whitelist` (_map_): map of whitelisted networks
 *  `domains` (_map_): map of domains to check
 *  `strict_multiplier` (_number_): multiplier for strict domains
 *  `time_jitter` (_number_): jitter in seconds to allow time diff while checking
 *  `trusted_only` (_boolean_): check signatures only for domains in 'domains' map
 *  `max_sigs` (_number_): maximum number of `DKIM-Signature` headers to examine per message (default: 5), see [Multiple signatures](#multiple-signatures)
 *  `dkim_cache_size` (_number_): maximum number of DKIM public keys kept in the LRU cache (built-in default: 2048, the stock configuration sets `2k`, i.e. 2000; `0` disables the cache); a cached key normally expires according to the TTL of its DNS record

## Multiple signatures

A message may carry several `DKIM-Signature` headers, for example when a sender signs with both RSA and Ed25519 keys, or when a mailing list or a forwarder adds its own signature. Rspamd examines at most `max_sigs` of them (5 by default) and ignores the rest: signatures beyond the limit produce no DKIM symbols and cannot provide an aligned pass for DMARC.

 *  The headers are examined in the order they appear in the message, from top to bottom. Signers prepend their signatures, so the ones at the top are normally the most recent, and the signatures that are left out are the oldest ones at the bottom, which usually include the original sender's signature.
 *  Every `DKIM-Signature` header that is looked at counts towards the limit, including empty or unparseable ones and those skipped because of `trusted_only`.
 *  When a message carries more than `max_sigs` signature headers, Rspamd logs (at info level) `message has multiple signatures but we stopped after N checked signatures as limit is reached`.

These counting rules apply since Rspamd 4.1.3. Earlier versions effectively allowed one signature more than `max_sigs` and did not count unparseable or skipped headers.

If the log line above shows up for legitimate mail, raise the limit in `local.d/dkim.conf`:

~~~hcl
# local.d/dkim.conf
max_sigs = 10;
~~~

## DKIM signatures

Please use [dkim_signing module](/modules/dkim_signing) for DKIM signatures.
