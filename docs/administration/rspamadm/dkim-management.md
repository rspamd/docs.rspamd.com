---
title: DKIM Key Management
---

# DKIM Key Management

These commands provide comprehensive DKIM key generation, storage, and rotation capabilities, including integration with Hashicorp Vault for enterprise key management.

## dkim_keygen

Generate DKIM keypairs.

### Purpose

Create DKIM private and public keys for email signing. Supports both RSA and Ed25519 algorithms.

### Common Scenarios

#### Basic Key Generation

```bash
# Generate default 1024-bit RSA key
rspamadm dkim_keygen

# Generate 2048-bit RSA key
rspamadm dkim_keygen -b 2048

# Generate Ed25519 key (recommended for new deployments)
rspamadm dkim_keygen -t ed25519
```

#### Generate for Specific Domain and Selector

```bash
# Generate key for domain with selector
rspamadm dkim_keygen -d example.com -s default

# Save private key to file
rspamadm dkim_keygen -d example.com -s mail -k /etc/rspamd/dkim/example.com.key
```

Output includes:
- Private key (PEM format)
- Public key formatted for DNS TXT record

### Example Output

```
-----BEGIN PRIVATE KEY-----
MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEA...
[private key content]
-----END PRIVATE KEY-----

default._domainkey.example.com. IN TXT ( "v=DKIM1; k=rsa; "
    "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..." )
```

### Options

```
-d, --domain <domain>      Domain name
-s, --selector <selector>  DKIM selector (default: "default")
-k, --privkey <file>      Save private key to file
-b, --bits <bits>         Key length in bits (default: 1024)
-t, --type <rsa|ed25519>  Key type (default: rsa)
```

### Key Type Recommendations

**RSA Keys:**
- Standard: 1024-bit (fast, widely supported)
- Recommended: 2048-bit (more secure, slower)
- Maximum: 4096-bit (very secure, compatibility issues)

**Ed25519 Keys:**
- Modern elliptic curve algorithm
- Smaller key size (256-bit equivalent to 3072-bit RSA)
- Faster signing and verification
- Not universally supported by older systems

### Use Cases

1. **Initial DKIM Setup**: Generate keys for new domains
2. **Key Rotation**: Create new keys periodically
3. **Multi-Domain**: Generate keys for each domain
4. **Selector Rotation**: Create multiple selectors for gradual rollover

### Workflow Example

```bash
#!/bin/bash
DOMAIN="example.com"
SELECTOR="$(date +%Y%m)"  # Selector based on year-month
KEY_DIR="/etc/rspamd/dkim"

# Generate key
rspamadm dkim_keygen -d "$DOMAIN" -s "$SELECTOR" -b 2048 \
  -k "$KEY_DIR/$DOMAIN.$SELECTOR.key" \
  > "$KEY_DIR/$DOMAIN.$SELECTOR.dns"

# Display DNS record to add
echo "Add this DNS record:"
cat "$KEY_DIR/$DOMAIN.$SELECTOR.dns"

# Set permissions
chmod 600 "$KEY_DIR/$DOMAIN.$SELECTOR.key"
chown rspamd:rspamd "$KEY_DIR/$DOMAIN.$SELECTOR.key"
```

---

## vault

Integrate with Hashicorp Vault for DKIM key management.

### Purpose

Store and manage DKIM keys in Hashicorp Vault, enabling centralized key management, automatic rotation, and secure key storage for multi-server deployments.

### Prerequisites

1. Hashicorp Vault installed and running
2. Environment variables set:
   - `VAULT_ADDR` - Vault server address (e.g., `https://vault.example.com:8200`)
   - `VAULT_TOKEN` - Authentication token

```bash
export VAULT_ADDR="https://vault.example.com:8200"
export VAULT_TOKEN="your-token-here"
```

### Common Scenarios

#### List Keys in Vault

```bash
# List all DKIM keys
rspamadm vault list

# List keys in custom path
rspamadm vault list -p dkim-keys
```

#### Show Key Details

```bash
# Show key for domain
rspamadm vault show example.com

# Show with UCL output
rspamadm vault show example.com -o ucl

# Show as JSON
rspamadm vault show example.com -o json

# Show as YAML
rspamadm vault show example.com -o yaml
```

#### Create New Key in Vault

```bash
# Create RSA key
rspamadm vault newkey example.com -s default

# Create Ed25519 key
rspamadm vault newkey example.com -s default -A ed25519

# Create 2048-bit RSA key
rspamadm vault newkey example.com -s mail -b 2048

# Create with expiration
rspamadm vault newkey example.com -s default -x 365  # Expires in 365 days

# Rewrite existing key
rspamadm vault newkey example.com -s default -r
```

#### Key Rotation

```bash
# Perform automatic key rollover
rspamadm vault roll example.com
```

This creates a new key with a new selector and marks the old key for gradual deprecation.

#### Delete Keys

```bash
# Delete key for domain
rspamadm vault delete example.com

# Delete multiple domains
rspamadm vault delete example.com example.org example.net
```

### Options

```
-a, --addr <addr>          Vault address (or use VAULT_ADDR env)
-t, --token <token>        Vault token (or use VAULT_TOKEN env)
-p, --path <path>          Vault path (default: dkim)
-o, --output <type>        Output format: ucl, json, json-compact, yaml
-k, --kv-version <1|2>     Vault KV store version (default: 1)
-s, --silent               Suppress extra output

newkey options:
-s, --selector <selector>  DKIM selector
-A, --algorithm <type>     Key type: rsa, ed25519
-b, --bits <bits>         Key length for RSA
-x, --expire <days>       Expiration in days
-r, --rewrite             Overwrite existing key
```

### Vault Key Structure

Keys are stored in Vault with this structure:

```json
{
  "domain": "example.com",
  "selector": "default",
  "type": "rsa",
  "bits": 2048,
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "public_key": "v=DKIM1; k=rsa; p=...",
  "created": "2025-11-20T10:30:00Z",
  "expire": "2026-11-20T10:30:00Z"
}
```

### Enterprise Key Management Workflow

#### Initial Setup

```bash
# Set Vault environment
export VAULT_ADDR="https://vault.company.com:8200"
export VAULT_TOKEN="$(cat ~/.vault-token)"

# List current keys
rspamadm vault list -o json > current-keys.json

# Create keys for all company domains
for domain in example.com example.org example.net; do
  rspamadm vault newkey "$domain" -s $(date +%Y%m) -b 2048
done
```

#### Automated Rotation

```bash
#!/bin/bash
# Rotate DKIM keys quarterly

export VAULT_ADDR="https://vault.company.com:8200"
export VAULT_TOKEN="$(vault login -token-only -method=aws)"

DOMAINS=$(rspamadm vault list -o json | jq -r '.[]')

for domain in $DOMAINS; do
  echo "Rotating key for $domain"
  rspamadm vault roll "$domain"
  
  # Extract DNS record
  rspamadm vault show "$domain" -o json | \
    jq -r '.public_key' | \
    mail -s "Update DNS for $domain" dns-team@company.com
done
```

#### Multi-Server Deployment

Vault allows multiple Rspamd servers to access the same keys:

1. **Configure Rspamd** to read from Vault (in `dkim_signing.conf`):

```hcl
dkim_signing {
  use_vault = true;
  vault_url = "https://vault.company.com:8200";
  vault_token = "${VAULT_TOKEN}";
  vault_path = "dkim";
}
```

2. **All servers fetch keys from Vault** - no key distribution needed

3. **Rotate centrally** using `rspamadm vault roll`

### Vault KV Version Support

**KV Version 1** (default):
- Simple key-value storage
- Path: `secret/dkim/example.com`
- No versioning

**KV Version 2**:
- Versioned secrets
- Path: `secret/data/dkim/example.com`
- Metadata stored separately

Use `-k 2` for KV v2:

```bash
rspamadm vault list -k 2
```

### Security Best Practices

1. **Use VAULT_TOKEN env** - Don't pass tokens on command line
2. **Set appropriate Vault policies** - Limit access to DKIM path
3. **Enable audit logging** - Track key access
4. **Use token TTL** - Rotate Vault tokens regularly
5. **TLS required** - Always use HTTPS for Vault
6. **Key expiration** - Set expiration dates on keys

### Example Vault Policy

```hcl
# DKIM key management policy
path "secret/dkim/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

---

## signtool

Sign and verify files using keypairs.

### Purpose

Sign files for integrity verification, commonly used with Rspamd map updates.

### Common Scenarios

#### Create Signing Keypair

```bash
# Generate keypair for signing
rspamadm keypair -s -u > signing-keypair.key
```

#### Sign a File

```bash
# Sign file interactively with editor
rspamadm signtool -e --editor=vim -k signing-keypair.key map.txt

# This opens editor, saves, and adds signature
```

The signed file gets a `.sig` suffix by default.

#### Sign with Custom Suffix

```bash
# Save signature in separate file
rspamadm signtool -S .signature -k signing-keypair.key map.txt

# Creates: map.txt.signature
```

#### Verify Signature

```bash
# Verify with public key (base32 encoded)
rspamadm signtool -v -p <base32-pubkey> map.txt

# Verify with public key from file
rspamadm signtool -v -P pubkey.txt map.txt
```

#### Extract Public Key

```bash
# Extract public key from keypair
rspamadm signtool -k signing-keypair.key --pubout pubkey.txt
```

### Options

```
-k, --keypair <file>      Keypair file for signing
-v, --verify              Verify signature mode
-p, --pubkey <key>        Base32 encoded public key
-P, --pubfile <file>      File containing public key
-S, --suffix <suffix>     Signature file suffix (default: .sig)
-e, --edit                Open editor before signing
--editor <editor>         Editor to use (default: $EDITOR)
-q, --quiet               Quiet mode
-o, --openssl             Use OpenSSL NIST P-256 keys
--pubout <file>           Export public key to file
```

### Use Cases

**Map File Updates:**
- Sign updated maps before distribution
- Verify maps before loading

**Configuration Distribution:**
- Sign configuration snippets
- Verify on remote servers

### Workflow for Map Signing

```bash
#!/bin/bash
# Sign and distribute updated map

MAP_FILE="blacklist.map"
KEYPAIR="map-signing.key"
SERVERS="server1 server2 server3"

# Sign the map
rspamadm signtool -k "$KEYPAIR" "$MAP_FILE"

# Distribute to servers
for server in $SERVERS; do
  scp "$MAP_FILE" "$MAP_FILE.sig" "$server:/etc/rspamd/maps/"
  ssh "$server" "systemctl reload rspamd"
done
```

---

## Practical Examples

### Complete DKIM Setup for New Domain

```bash
#!/bin/bash
DOMAIN="newdomain.com"
SELECTOR="mail"
KEY_DIR="/etc/rspamd/dkim"

mkdir -p "$KEY_DIR"

# Generate key
echo "Generating DKIM key for $DOMAIN..."
rspamadm dkim_keygen -d "$DOMAIN" -s "$SELECTOR" -b 2048 \
  -k "$KEY_DIR/$DOMAIN.key"  > "$KEY_DIR/$DOMAIN.dns"

# Set permissions
chmod 600 "$KEY_DIR/$DOMAIN.key"
chown rspamd:rspamd "$KEY_DIR/$DOMAIN.key"

# Show DNS record
echo -e "\n=== Add this DNS record ==="
cat "$KEY_DIR/$DOMAIN.dns"

# Test signing (requires message.eml)
if [ -f "test-message.eml" ]; then
  rspamadm mime sign -d "$DOMAIN" -s "$SELECTOR" \
    -k "$KEY_DIR/$DOMAIN.key" test-message.eml > signed.eml
  echo -e "\nTest message signed successfully"
fi
```

### Vault-Based Multi-Domain Setup

```bash
#!/bin/bash
# Setup DKIM keys in Vault for multiple domains

export VAULT_ADDR="https://vault.example.com:8200"
export VAULT_TOKEN="your-token"

DOMAINS=(
  "example.com"
  "example.org"
  "example.net"
  "mail.example.com"
)

SELECTOR=$(date +%Y%m)

for domain in "${DOMAINS[@]}"; do
  echo "Creating key for $domain with selector $SELECTOR"
  
  # Create key in Vault
  rspamadm vault newkey "$domain" -s "$SELECTOR" -b 2048 -x 365
  
  # Extract DNS record
  echo "=== DNS Record for $domain ==="
  rspamadm vault show "$domain" -o json | \
    jq -r '.public_key' | \
    awk -v sel="$SELECTOR" -v dom="$domain" \
      '{printf "%s._domainkey.%s. IN TXT \"%s\"\n", sel, dom, $0}'
  echo
done
```

### Quarterly Key Rotation

```bash
#!/bin/bash
# Automated quarterly DKIM rotation

DOMAINS="example.com example.org example.net"
OLD_SELECTOR=$(date -d "3 months ago" +%Y%m)
NEW_SELECTOR=$(date +%Y%m)

for domain in $DOMAINS; do
  echo "Rotating $domain: $OLD_SELECTOR -> $NEW_SELECTOR"
  
  # Generate new key
  rspamadm dkim_keygen -d "$domain" -s "$NEW_SELECTOR" -b 2048 \
    -k "/etc/rspamd/dkim/$domain.$NEW_SELECTOR.key" \
    > "/tmp/$domain.$NEW_SELECTOR.dns"
  
  # Update Rspamd config to use new selector
  # (This step depends on your configuration management)
  
  # Email DNS team
  mail -s "DKIM rotation: $domain" dns-team@example.com < \
    "/tmp/$domain.$NEW_SELECTOR.dns"
  
  echo "Keep old key active for 7 days, then remove DNS record"
done
```

## Tips and Best Practices

### DKIM Key Management

1. **Regular rotation** - Rotate keys every 3-6 months
2. **Multiple selectors** - Use dated selectors for easy tracking (e.g., `202511`)
3. **Key length** - Use 2048-bit RSA for good security/compatibility balance
4. **Consider Ed25519** - For new deployments with modern infrastructure
5. **Backup keys** - Keep secure backups of private keys
6. **Document selectors** - Maintain a record of which selector is active

### Vault Usage

1. **Centralized management** - Use Vault for multi-server deployments
2. **Automated rotation** - Script quarterly rotations
3. **Access control** - Use Vault policies to restrict access
4. **Audit logging** - Enable Vault audit logs
5. **Token management** - Use short-lived tokens with renewal

### Security

1. **Protect private keys** - Permissions 600, owner rspamd
2. **Separate keys per domain** - Don't reuse keys
3. **Monitor DKIM failures** - Check DMARC reports
4. **Gradual rollover** - Keep old keys active during transition
5. **Test before deployment** - Use `mime sign` to verify

## Related Documentation

- [Email Manipulation](email-manipulation.md) - `mime sign` command
- [Cryptography](cryptography.md) - Keypair management
- [Configuration](configuration.md) - DKIM signing configuration
- [DKIM Module](/modules/dkim_signing) - Rspamd DKIM signing module
