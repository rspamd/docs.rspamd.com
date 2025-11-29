---
title: ARC module
---

# ARC module

This module verifies and signs [ARC](https://arc-spec.org/) (Authenticated Received Chain) signatures and seals for emails. ARC provides a mechanism for preserving email authentication results across trusted intermediaries, which is particularly useful for mailing lists and forwarding services that may modify messages in ways that break SPF and DKIM alignment.

The ARC standard is defined in [RFC 8617](https://tools.ietf.org/html/rfc8617). An overview presentation is available at <https://dmarc.org/presentations/ARC-Overview-2016Q2-v03.pdf>.

Rspamd supports both ARC verification and signing since version 1.6. It uses the [dkim](/modules/dkim) module internally for cryptographic operations.

## Symbols

The module registers the following symbols:

| Symbol | Score | Description |
|--------|-------|-------------|
| `ARC_ALLOW` | -1.0 | Valid ARC chain found |
| `ARC_REJECT` | 2.0 | ARC chain validation failed |
| `ARC_INVALID` | 1.0 | ARC chain structure is invalid |
| `ARC_DNSFAIL` | 0.0 | DNS lookup failed during validation |
| `ARC_NA` | 0.0 | No ARC headers present |
| `ARC_ALLOW_TRUSTED` | -2.0 | Valid ARC chain from a trusted forwarder (requires `whitelisted_signers_map`) |
| `ARC_SIGNED` | 0.0 | Message was signed with ARC |

## Configuration

Settings should be added to `/etc/rspamd/local.d/arc.conf`.

### Basic settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `selector` | string | `arc` | Default selector for ARC signing |
| `path` | string | `${DBDIR}/arc/$domain.$selector.key` | Path to signing key (supports `$domain` and `$selector` variables) |
| `sign_symbol` | string | `ARC_SIGNED` | Symbol added when message is signed |
| `try_fallback` | boolean | `true` | Fall back to global config if domain-specific config not found |

### Domain selection

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `use_domain` | string | `header` | Domain source: `header` (MIME From), `envelope` (SMTP From), `recipient` (SMTP To), `auth` (authenticated user), or explicit domain name |
| `use_esld` | boolean | `true` | Normalize domains to effective second-level domain (eSLD) |
| `use_domain_sign_networks` | string | - | Override `use_domain` for sign_networks |
| `use_domain_sign_local` | string | - | Override `use_domain` for local IPs |
| `use_domain_sign_inbound` | string | - | Override `use_domain` for inbound mail |
| `use_domain_custom` | string/function | - | Custom Lua function to determine signing domain |

### Signing eligibility

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sign_authenticated` | boolean | `true` | Sign messages from authenticated users |
| `sign_local` | boolean | `true` | Sign messages from local IP addresses |
| `sign_inbound` | boolean | `false` | Sign inbound messages (not local, not authenticated) |
| `sign_networks` | map | - | Map of networks eligible for signing |
| `skip_spam_sign` | boolean | `false` | Skip signing if message is marked as spam |
| `allowed_ids` | table | - | List of settings IDs that allow signing |
| `forbidden_ids` | table | - | List of settings IDs that forbid signing |

### Header/envelope validation

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allow_envfrom_empty` | boolean | `true` | Allow signing with empty envelope From |
| `allow_hdrfrom_mismatch` | boolean | `false` | Allow envelope/header From domain mismatch |
| `allow_hdrfrom_mismatch_local` | boolean | `false` | Allow mismatch for local IPs |
| `allow_hdrfrom_mismatch_sign_networks` | boolean | `false` | Allow mismatch for sign_networks |
| `allow_hdrfrom_multiple` | boolean | `false` | Allow multiple From headers (only first is used) |
| `allow_username_mismatch` | boolean | `false` | Allow authenticated user domain to differ from signing domain |

### Trusted forwarders and whitelisting

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `whitelisted_signers_map` | map | - | Map of trusted ARC forwarder domains |
| `whitelist` | map | - | Map of domains with broken ARC implementations to trust despite validation failures |
| `adjust_dmarc` | boolean | `true` | Adjust DMARC score when trusted forwarder provides valid ARC chain |

### Redis integration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `use_redis` | boolean | `false` | Load signing keys from Redis |
| `key_prefix` | string | `arc_keys` | Redis hash name for keys |
| `selector_prefix` | string | - | Redis hash name for selectors (optional) |

### Vault integration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `use_vault` | boolean | `false` | Load signing keys from HashiCorp Vault |
| `vault_url` | string | - | Vault server URL |
| `vault_token` | string | - | Vault authentication token |
| `vault_path` | string | `dkim` | Path in Vault for keys |
| `vault_kv_version` | number | `1` | Vault KV secrets engine version (1 or 2) |
| `vault_domains` | map | - | Map of domains to look up in Vault |

### Public key verification

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `check_pubkey` | boolean | `false` | Verify public key exists before signing |
| `allow_pubkey_mismatch` | boolean | `false` | Continue signing even if public key lookup fails |

### Authentication results

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `reuse_auth_results` | boolean | `false` | Reuse existing Authentication-Results header instead of generating new one |

### HTTP headers (for proxy integration)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `use_http_headers` | boolean | `false` | Get signing parameters from HTTP request headers |
| `http_sign_header` | string | `PerformDkimSign` | Header indicating signing should be performed |
| `http_domain_header` | string | `DkimDomain` | Header containing domain |
| `http_selector_header` | string | `DkimSelector` | Header containing selector |
| `http_key_header` | string | `DkimPrivateKey` | Header containing private key |
| `allow_headers_fallback` | boolean | `false` | Fall back to normal signing if headers missing |

## Basic configuration example

~~~hcl
# local.d/arc.conf

# Default signing selector
selector = "arc";

# Path template for keys
path = "${DBDIR}/arc/$domain.$selector.key";

# Sign mail from authenticated users and local networks
sign_authenticated = true;
sign_local = true;

# Use header From domain for signing
use_domain = "header";
use_esld = true;

# Domain-specific configuration
domain {
  example.com {
    path = "${DBDIR}/arc/example.com.key";
    selector = "arc2024";
  }
}
~~~

## Trusted ARC forwarders

The `whitelisted_signers_map` setting allows you to configure trusted ARC forwarders. When an email has a valid ARC chain that includes a signature from one of these trusted domains, Rspamd will:

1. Add the `ARC_ALLOW_TRUSTED` symbol with a score of -2.0
2. If `adjust_dmarc` is enabled (default), reduce the impact of DMARC failures

This is particularly useful for legitimate email forwarding services that may alter messages in ways that break DKIM signatures, but can be trusted based on their ARC signatures.

~~~hcl
# local.d/arc.conf

# Inline array
whitelisted_signers_map = ["mailgun.org", "sendgrid.net", "amazonses.com"];

# Or file-based map
whitelisted_signers_map = "file:///etc/rspamd/maps/arc_trusted_signers.map";

# Adjust DMARC policy for trusted forwarders (enabled by default)
adjust_dmarc = true;
~~~

For file-based maps, create a simple text file with one domain per line:
~~~
mailgun.org
sendgrid.net
amazonses.com
~~~

## Handling broken ARC implementations

Some email services have broken ARC implementations that fail validation despite being legitimate forwarders. The `whitelist` option allows ARC chain validation to continue despite failures from specified domains.

When a domain is in the whitelist:
- ARC signature/seal validation failures for that domain are logged but treated as valid
- The ARC chain validation continues to the next step
- This preserves the security of the overall chain while accommodating known bugs

~~~hcl
# local.d/arc.conf

# Domains with known broken ARC implementations
whitelist = ["broken-forwarder.com", "buggy-arc.example"];

# Or file-based map
whitelist = "file:///etc/rspamd/maps/arc_whitelist.map";
~~~

## ARC keys in Redis

To store ARC signing keys in Redis:

~~~hcl
# local.d/arc.conf
use_redis = true;
key_prefix = "arc_keys";
selector = "myselector";
~~~

Populate the hash with keys using the format `selector.domain`:

~~~lua
-- Run with: redis-cli --eval script.lua
local key = [[-----BEGIN PRIVATE KEY-----
MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBANe3EETkiI1Exyrb
...
-----END PRIVATE KEY-----]]
redis.call('HMSET', 'arc_keys', 'myselector.example.com', key)
~~~

## Using maps for selectors and paths

Use `selector_map` and `path_map` to configure per-domain selectors and key paths:

~~~hcl
# local.d/arc.conf
try_fallback = true;
path = "${DBDIR}/arc/$domain.$selector.key";
selector_map = "/etc/rspamd/arc_selectors.map";
selector = "arc";
~~~

Map format (domain followed by value):
~~~
example.net arc2024
example.org default
~~~

For paths:
~~~
example.net /var/lib/rspamd/arc/example.net.$selector.key
example.org /etc/rspamd/arc/example.org.key
~~~

To require explicit configuration for each domain (no fallback):

~~~hcl
# local.d/arc.conf
try_fallback = false;
selector_map = "/etc/rspamd/arc_selectors.map";
path_map = "/etc/rspamd/arc_paths.map";
~~~

## Vault integration

For HashiCorp Vault integration:

~~~hcl
# local.d/arc.conf
use_vault = true;
vault_url = "https://vault.example.com:8200";
vault_token = "your-vault-token";
vault_path = "secret/dkim";
vault_kv_version = 2;

# Optional: restrict to specific domains
vault_domains = ["example.com", "example.org"];
~~~

Expected Vault secret structure at `secret/dkim/example.com`:
~~~json
{
  "selectors": [
    {
      "selector": "arc2024",
      "domain": "example.com",
      "key": "-----BEGIN PRIVATE KEY-----\n...",
      "valid_start": 1704067200,
      "valid_end": 1735689600
    }
  ]
}
~~~

## Sign headers

From version 1.8.4, Rspamd uses a specific set of headers for ARC signing. The default can be overridden:

~~~hcl
# local.d/arc.conf
sign_headers = "(o)from:(o)sender:(o)reply-to:(o)subject:(o)date:(o)message-id:(o)to:(o)cc:(o)mime-version:(o)content-type:(o)content-transfer-encoding:resent-to:resent-cc:resent-from:resent-sender:resent-message-id:(o)in-reply-to:(o)references:list-id:list-owner:list-unsubscribe:list-subscribe:list-post:dkim-signature";
~~~

The `(o)` prefix indicates optional headers (included only if present).
