---
title: Cryptography & Security
---

# Cryptography & Security

These commands provide cryptographic operations including keypair generation, encryption, decryption, and password management.

## keypair

Manage encryption and signing keypairs.

### Purpose

Generate and use Curve25519 (or NIST) keypairs for encryption and signing operations in Rspamd.

### Common Scenarios

#### Generate Encryption Keypair

```bash
# Generate encryption keypair (default)
rspamadm keypair

# Output as JSON
rspamadm keypair -j

# Output as UCL
rspamadm keypair -u

# Save to file
rspamadm keypair -o encryption.key
```

Output includes both public and private keys in a single structure.

#### Generate Signing Keypair

```bash
# Generate signing keypair
rspamadm keypair -s

# Save to file
rspamadm keypair -s -o signing.key
```

#### Use NIST Curves

```bash
# Generate NIST P-256 keypair
rspamadm keypair -n

# NIST signing keypair
rspamadm keypair -s -n
```

### Subcommands

#### Generate Keypair

```bash
# Explicit generate command
rspamadm keypair generate

# Short forms
rspamadm keypair gen
rspamadm keypair g
```

#### Sign Files

```bash
# Sign a file
rspamadm keypair sign -k keypair.key file.txt

# Verify signature
rspamadm keypair verify -k keypair.key file.txt file.txt.sig
```

#### Encrypt Files

```bash
# Encrypt with recipient's public key
rspamadm keypair encrypt -k recipient-pubkey.key file.txt > encrypted.bin

# Decrypt with your private key
rspamadm keypair decrypt -k your-keypair.key encrypted.bin > decrypted.txt
```

### Options

```
-s, --sign              Generate signing keypair
-n, --nist              Use NIST P-256 curves
-j, --json              Output as JSON
-u, --ucl               Output as UCL
-o, --output <file>     Write to file

Subcommand options:
-k, --key <file>        Keypair or public key file
```

### Use Cases

1. **Controller Authentication**: Encrypt controller passwords
2. **Map Signing**: Sign maps for integrity verification
3. **Secure Configuration**: Encrypt sensitive config values
4. **Inter-Server Communication**: Encrypt data exchanged between servers

### Example: Secure Controller Setup

```bash
# Generate keypair for controller
rspamadm keypair -o controller.key

# Extract public key for workers
grep 'pubkey' controller.key

# Configure in rspamd.conf
# controller { 
#   password = "$2$<encrypted_password>"; 
# }
```

---

## secret_box

Symmetric encryption and decryption utility.

### Purpose

Encrypt and decrypt text using symmetric cryptography (NaCl secretbox). Useful for encrypting sensitive configuration values.

### Common Scenarios

#### Generate Encryption Key

```bash
# Generate a new symmetric key
rspamadm secret_box keygen
```

Outputs a base64-encoded key like:
```
key: rWKukFxPz3p1HPtN3K4xGg==
```

Store this key securely - you'll need it for encryption/decryption.

#### Encrypt Text

```bash
# Encrypt text (interactive)
rspamadm secret_box encrypt
# Paste your text, press Ctrl+D
# Enter key when prompted

# Encrypt from command line
echo "sensitive-password" | rspamadm secret_box encrypt

# Different output formats
echo "secret" | rspamadm secret_box encrypt --base64  # Base64 (default)
echo "secret" | rspamadm secret_box encrypt --base32  # Base32
echo "secret" | rspamadm secret_box encrypt --hex     # Hexadecimal
```

Output format:
```
nonce: <24-byte nonce>
encrypted: <ciphertext>
```

#### Decrypt Text

```bash
# Decrypt (interactive)
rspamadm secret_box decrypt
# Paste nonce and encrypted text
# Enter key when prompted

# Decrypt from environment
export SECRET_KEY="rWKukFxPz3p1HPtN3K4xGg=="
echo "nonce=...; encrypted=..." | rspamadm secret_box decrypt
```

### Options

```
-R, --raw               Raw binary format
-H, --hex               Hexadecimal encoding
-b, --base32            Base32 encoding
-B, --base64            Base64 encoding (default)
```

### Use Cases

#### Encrypt Database Passwords

```bash
# Generate key (save this securely)
rspamadm secret_box keygen > /etc/rspamd/secret.key

# Encrypt database password
echo "MySecretPassword123" | rspamadm secret_box encrypt -B

# Use in configuration
# clickhouse {
#   password = "$SECRET_BOX{nonce=...; encrypted=...}";
# }
```

#### Encrypt API Keys

```bash
# Encrypt API key
echo "sk-1234567890abcdef" | rspamadm secret_box encrypt > api-key.enc

# Store encrypted, decrypt when needed
rspamadm secret_box decrypt < api-key.enc
```

#### Secure Configuration Distribution

```bash
#!/bin/bash
# Encrypt sensitive config values before committing to git

KEY=$(cat /secure/location/secret.key)

# Encrypt Redis password
REDIS_PASS=$(echo "redis-password" | \
  rspamadm secret_box encrypt -B <<< "$KEY")

# Update config template
sed -i "s/REDIS_PASSWORD/$REDIS_PASS/" config.template
```

---

## pw

Generate and verify password hashes for Rspamd.

### Purpose

Create password hashes for controller authentication and verify existing hashes.

### Common Scenarios

#### Generate Password Hash

```bash
# Interactive (password hidden)
rspamadm pw

# From command line (avoid - shows in history)
rspamadm pw -p "mypassword"

# Quiet mode (only output hash)
rspamadm pw -q
```

Output example:
```
$2$g6crbhd33hb3jwzh6r6yq9d1ynq4uqkj$8wdq6hjzfbzwq4m7crmzn5k8qyxzg1ygkbqx7dj1y8n
```

#### Choose Hash Algorithm

```bash
# List available algorithms
rspamadm pw -l

# Use specific algorithm
rspamadm pw -t pbkdf2
```

#### Verify Password

```bash
# Check if password matches hash
rspamadm pw --check -p "mypassword"
# Paste the hash when prompted

# Verify from file
rspamadm pw --check -p "mypassword" < hash.txt
```

### Options

```
-e, --encrypt           Encrypt password (default)
-c, --check             Verify password against hash
-p, --password <pass>   Specify password (not recommended)
-t, --type <type>       Hash algorithm
-l, --list              List available algorithms
-q, --quiet             Suppress output, only show hash
```

### Available Algorithms

- `pbkdf2` - PBKDF2-HMAC-SHA256 (default, recommended)
- `catena` - Catena (memory-hard)

### Use Cases

#### Set Controller Password

```bash
# Generate hash
HASH=$(rspamadm pw -q)

# Add to local.d/worker-controller.inc
echo "password = \"$HASH\";" >> /etc/rspamd/local.d/worker-controller.inc

# Restart Rspamd
systemctl restart rspamd
```

#### Rotate Passwords

```bash
#!/bin/bash
# Script to rotate controller password

echo "Enter new password:"
NEW_HASH=$(rspamadm pw -q)

# Backup config
cp /etc/rspamd/local.d/worker-controller.inc{,.bak}

# Update config
sed -i "s|password = \".*\";|password = \"$NEW_HASH\";|" \
  /etc/rspamd/local.d/worker-controller.inc

# Test config
if rspamadm configtest -q; then
  systemctl restart rspamd
  echo "Password updated successfully"
else
  # Restore backup
  mv /etc/rspamd/local.d/worker-controller.inc{.bak,}
  echo "Configuration error, password not changed"
fi
```

#### Verify Stored Hash

```bash
# Check if current password still works
STORED_HASH=$(grep password /etc/rspamd/local.d/worker-controller.inc | \
  cut -d'"' -f2)

echo "$STORED_HASH" | rspamadm pw --check -p "current-password"
```

---

## Practical Examples

### Complete Secure Configuration Setup

```bash
#!/bin/bash
# Set up secure configuration with encrypted values

# 1. Generate symmetric key for encrypting secrets
echo "=== Generating encryption key ==="
rspamadm secret_box keygen > /etc/rspamd/secret.key
chmod 600 /etc/rspamd/secret.key
SECRET_KEY=$(cat /etc/rspamd/secret.key | cut -d' ' -f2)

# 2. Generate controller password
echo "=== Generating controller password ==="
CONTROLLER_HASH=$(rspamadm pw -q)

# 3. Encrypt Redis password
echo "=== Encrypting Redis password ==="
read -sp "Enter Redis password: " REDIS_PASS
echo
REDIS_ENCRYPTED=$(echo "$REDIS_PASS" | rspamadm secret_box encrypt -B <<< "$SECRET_KEY")

# 4. Generate keypair for signing
echo "=== Generating signing keypair ==="
rspamadm keypair -s -o /etc/rspamd/signing.key

# 5. Update configuration
cat > /etc/rspamd/local.d/options.inc << EOF
# Secure configuration
secret_key = "$SECRET_KEY";
EOF

cat > /etc/rspamd/local.d/worker-controller.inc << EOF
password = "$CONTROLLER_HASH";
EOF

cat > /etc/rspamd/local.d/redis.conf << EOF
servers = "localhost";
password = "\$SECRET_BOX{$REDIS_ENCRYPTED}";
EOF

echo "=== Configuration complete ==="
rspamadm configtest
```

### Encrypting Multiple Configuration Values

```bash
#!/bin/bash
# Encrypt multiple sensitive values

KEY=$(rspamadm secret_box keygen | cut -d' ' -f2)
echo "Encryption key: $KEY" > encryption-key.txt

declare -A secrets=(
  ["clickhouse_password"]="ch_pass_123"
  ["redis_password"]="redis_pass_456"
  ["api_key"]="api_key_789"
)

echo "Encrypted values:"
for name in "${!secrets[@]}"; do
  encrypted=$(echo "${secrets[$name]}" | \
    rspamadm secret_box encrypt -B <<< "$KEY")
  echo "$name = \$SECRET_BOX{$encrypted}"
done
```

### Key Rotation Workflow

```bash
#!/bin/bash
# Rotate encryption keys and re-encrypt all secrets

OLD_KEY=$(cat /etc/rspamd/secret.key | cut -d' ' -f2)
NEW_KEY=$(rspamadm secret_box keygen | cut -d' ' -f2)

# List of encrypted values to rotate
ENCRYPTED_VARS=(
  "clickhouse_password"
  "redis_password"
)

for var in "${ENCRYPTED_VARS[@]}"; do
  # Extract encrypted value from config
  encrypted=$(grep "$var" /etc/rspamd/local.d/*.conf | \
    cut -d'{' -f2 | cut -d'}' -f1)
  
  # Decrypt with old key
  decrypted=$(echo "$encrypted" | \
    rspamadm secret_box decrypt <<< "$OLD_KEY")
  
  # Re-encrypt with new key
  new_encrypted=$(echo "$decrypted" | \
    rspamadm secret_box encrypt -B <<< "$NEW_KEY")
  
  echo "Rotated $var"
  # Update config files (implementation depends on your setup)
done

# Save new key
echo "key: $NEW_KEY" > /etc/rspamd/secret.key.new
```

### Interactive Security Setup

```bash
#!/bin/bash
# Interactive setup for Rspamd security

echo "=== Rspamd Security Setup ==="

# Controller password
echo -e "\n1. Controller Password"
echo "Enter password for web interface:"
CONTROLLER_HASH=$(rspamadm pw -q)
echo "Generated hash: $CONTROLLER_HASH"

# Encryption key
echo -e "\n2. Encryption Key"
ENCRYPTION_KEY=$(rspamadm secret_box keygen | cut -d' ' -f2)
echo "Generated key: $ENCRYPTION_KEY"
echo "Save this key securely!"

# Signing keypair
echo -e "\n3. Signing Keypair"
rspamadm keypair -s -o /etc/rspamd/signing.key
echo "Signing keypair saved to /etc/rspamd/signing.key"

# Summary
echo -e "\n=== Configuration Summary ==="
cat << EOF

Add these to your configuration:

# local.d/worker-controller.inc
password = "$CONTROLLER_HASH";

# local.d/options.inc
secret_key = "$ENCRYPTION_KEY";

# For encrypted values in config, use:
\$SECRET_BOX{<encrypted_value>}

EOF
```

## Tips and Best Practices

### Key Management

1. **Secure storage** - Store keys with 600 permissions, owned by rspamd
2. **Backup keys** - Keep secure backups of all keys
3. **Rotate regularly** - Change passwords and keys periodically
4. **Document keys** - Maintain a secure record of what each key is for
5. **Separate keys** - Use different keys for different purposes

### Password Security

1. **Use strong passwords** - Minimum 16 characters, mix of types
2. **Use pw quietly** - Use `-q` flag and capture output
3. **Avoid command line** - Use interactive mode to avoid shell history
4. **Regular rotation** - Change passwords quarterly
5. **Verify hashes** - Test password after setting

### Encryption

1. **Use secret_box for configs** - Built-in support in Rspamd
2. **Base64 for configs** - Most compatible encoding
3. **Document encrypted values** - Comment what each is for
4. **Test decryption** - Verify encrypted values work
5. **Key rotation** - Plan for periodic key rotation

### Security

1. **Protect private keys** - Never commit to version control
2. **Use environment variables** - For sensitive runtime values
3. **Audit access** - Monitor who accesses keys
4. **Principle of least privilege** - Only encrypt what's necessary
5. **Disaster recovery** - Have procedures for key loss

## Related Documentation

- [DKIM Management](dkim-management.md) - DKIM key generation
- [Configuration](configuration.md) - Using encrypted values in config
- [Operations](operations.md) - Controller commands
