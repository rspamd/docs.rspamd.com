---
title: DKIM Signing Guide
---

# DKIM Signing: Complete Setup Guide

**DKIM (DomainKeys Identified Mail)** signing allows you to cryptographically sign outbound emails, proving they originated from your domain and haven't been tampered with. This tutorial provides step-by-step instructions for implementing DKIM signing with Rspamd.

## What is DKIM?

DKIM adds a digital signature to your outbound emails using public-key cryptography:
- **Private key**: Kept on your mail server to sign messages
- **Public key**: Published in DNS for verification
- **Selector**: Allows multiple keys per domain

DKIM helps with:
- Email authentication and deliverability
- Protection against spoofing
- Building domain reputation
- Meeting security compliance requirements

## Basic Setup

### Step 1: Generate DKIM Keys

Create DKIM key pairs for your domains:

```bash
# Generate keys for your main domain
sudo mkdir -p /etc/rspamd/dkim
cd /etc/rspamd/dkim

# Generate a 2048-bit RSA key (recommended)
rspamadm dkim_keygen -s mail -d example.com -k mail.key

# This creates:
# - mail.key (private key)  
# - mail.txt (DNS record to publish)
```

Example output:
```
# DNS record to publish:
mail._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."

# Private key written to mail.key
```

### Step 2: Configure DKIM Signing

Create the DKIM signing configuration:

```hcl
# /etc/rspamd/local.d/dkim_signing.conf

# Enable DKIM signing
enabled = true;

# Default signing configuration
domain {
  example.com {
    selector = "mail";
    path = "/etc/rspamd/dkim/mail.key";
  }
}

# Sign outbound mail only
sign_authenticated = true;
sign_local = true;
sign_inbound = false;

# Default settings
use_esld = true;
check_pubkey = true;
```

### Step 3: Set File Permissions

Secure the private keys:

```bash
# Set proper ownership and permissions
sudo chown -R _rspamd:_rspamd /etc/rspamd/dkim/
sudo chmod 600 /etc/rspamd/dkim/*.key
sudo chmod 644 /etc/rspamd/dkim/*.txt
```

### Step 4: Publish DNS Records

Add the DNS record from the generated `.txt` file:

```dns
; Add this to your DNS zone
mail._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4f5wg5l2hKdVBqpxdqTqDPbaohNcGI94vs9lxjzHZl9j7u2B..."
```

### Step 5: Test and Restart

```bash
# Test configuration
sudo rspamadm configtest

# Restart Rspamd
sudo systemctl restart rspamd

# Test DKIM signing
echo "Test message" | rspamc -d example.com -f test@example.com
```

## Advanced Configurations

### Multi-Domain Setup

Configure signing for multiple domains:

```hcl
# /etc/rspamd/local.d/dkim_signing.conf

enabled = true;

# Multiple domain configuration
domain {
  example.com {
    selector = "mail";
    path = "/etc/rspamd/dkim/example.com/mail.key";
  }
  
  subdomain.example.com {
    selector = "sub";
    path = "/etc/rspamd/dkim/subdomain.example.com/sub.key";
  }
  
  anotherdomain.org {
    selector = "rspamd";
    path = "/etc/rspamd/dkim/anotherdomain.org/rspamd.key";
  }
}

# Sign authenticated and local mail
sign_authenticated = true;
sign_local = true;
```

Generate keys for each domain:

```bash
# Create directory structure
sudo mkdir -p /etc/rspamd/dkim/{example.com,subdomain.example.com,anotherdomain.org}

# Generate keys for each domain
rspamadm dkim_keygen -s mail -d example.com -k /etc/rspamd/dkim/example.com/mail.key
rspamadm dkim_keygen -s sub -d subdomain.example.com -k /etc/rspamd/dkim/subdomain.example.com/sub.key  
rspamadm dkim_keygen -s rspamd -d anotherdomain.org -k /etc/rspamd/dkim/anotherdomain.org/rspamd.key
```

### Key Rotation Strategy

Implement regular key rotation for security:

```hcl
# /etc/rspamd/local.d/dkim_signing.conf

domain {
  example.com {
    # Current key
    selector = "2024a";
    path = "/etc/rspamd/dkim/example.com/2024a.key";
    
    # Alternative selectors for rotation
    selector_map = "/etc/rspamd/dkim_selectors.map";
  }
}
```

Create selector mapping:

```bash
# /etc/rspamd/dkim_selectors.map
# Format: domain selector_name path_to_key

example.com 2024a /etc/rspamd/dkim/example.com/2024a.key
example.com 2024b /etc/rspamd/dkim/example.com/2024b.key
example.com 2023  /etc/rspamd/dkim/example.com/2023.key
```

Key rotation script:

```bash
#!/bin/bash
# rotate_dkim.sh

DOMAIN="example.com"
NEW_SELECTOR="2024b"
OLD_SELECTOR="2024a"

# Generate new key
rspamadm dkim_keygen -s $NEW_SELECTOR -d $DOMAIN -k /etc/rspamd/dkim/$DOMAIN/$NEW_SELECTOR.key

# Update DNS with new public key
echo "Publish this DNS record:"
cat /etc/rspamd/dkim/$DOMAIN/$NEW_SELECTOR.txt

echo "After DNS propagation, update selector in configuration"
echo "Then remove old DNS record after 30 days"
```

### Conditional Signing

Sign based on specific conditions:

```hcl
# /etc/rspamd/local.d/dkim_signing.conf

enabled = true;

# Basic domain configuration
domain {
  example.com {
    selector = "mail";
    path = "/etc/rspamd/dkim/mail.key";
  }
}

# Conditional signing rules
sign_condition = <<EOD
return function(task)
  local from = task:get_from('mime')
  if not from or not from[1] then
    return false
  end
  
  local from_addr = from[1]['addr']
  local from_domain = from[1]['domain']
  
  -- Only sign if sender is authenticated
  if not task:get_user() then
    return false
  end
  
  -- Don't sign forwarded mail
  if task:has_symbol('FORWARDED') then
    return false
  end
  
  -- Don't sign if From domain differs from auth domain
  local auth_domain = task:get_user():match("@(.+)")
  if from_domain ~= auth_domain then
    return false
  end
  
  return true
end
EOD
```

### Per-User DKIM Signing

Different keys based on authenticated user:

```hcl
# /etc/rspamd/local.d/dkim_signing.conf

enabled = true;

# Use selector based on user domain
selector_map = "/etc/rspamd/user_selectors.map";
path_map = "/etc/rspamd/user_keys.map";

# Fallback configuration
domain {
  "*" {
    selector = "default";
    path = "/etc/rspamd/dkim/default.key";
  }
}
```

Create user mapping files:

```bash
# /etc/rspamd/user_selectors.map
@sales.example.com     sales2024
@support.example.com   support
@marketing.example.com marketing

# /etc/rspamd/user_keys.map  
@sales.example.com     /etc/rspamd/dkim/sales/sales2024.key
@support.example.com   /etc/rspamd/dkim/support/support.key
@marketing.example.com /etc/rspamd/dkim/marketing/marketing.key
```

### DKIM with ARC Signing

Enable both DKIM and ARC signing:

```hcl
# /etc/rspamd/local.d/dkim_signing.conf
enabled = true;

# DKIM configuration
domain {
  example.com {
    selector = "mail";
    path = "/etc/rspamd/dkim/mail.key";
  }
}

# /etc/rspamd/local.d/arc.conf
enabled = true;

# ARC signing configuration  
domain {
  example.com {
    selector = "arc";
    path = "/etc/rspamd/dkim/arc.key";
  }
}

sign_authenticated = true;
sign_local = true;
```

## Integration Examples

### Postfix Integration

DKIM signing works automatically with Postfix milter integration:

```bash
# /etc/postfix/main.cf
# Rspamd milter configuration
smtpd_milters = inet:localhost:11332
non_smtpd_milters = inet:localhost:11332  # Important for DKIM signing
milter_default_action = accept
milter_protocol = 6
```

### Multi-Server Setup

For multiple mail servers sharing DKIM keys:

```hcl
# /etc/rspamd/local.d/dkim_signing.conf

enabled = true;

# Shared key location (e.g., NFS mount)
domain {
  example.com {
    selector = "shared";
    path = "/shared/dkim/example.com/shared.key";
  }
}

# Server-specific keys
server_keys = "/etc/rspamd/local_dkim_keys.map";
```

```bash
# /etc/rspamd/local_dkim_keys.map
# server-specific keys for different mail servers
mx1.example.com mx1 /etc/rspamd/dkim/mx1.key
mx2.example.com mx2 /etc/rspamd/dkim/mx2.key
```

### Cloud Provider Setup

Configuration for cloud email services:

```hcl
# /etc/rspamd/local.d/dkim_signing.conf

enabled = true;

# Use environment-specific selectors
domain {
  example.com {
    selector = "aws-prod";
    path = "/etc/rspamd/dkim/aws-prod.key";
  }
}

# Cloud-specific settings
sign_networks = [
  "10.0.0.0/8",      # AWS VPC
  "172.16.0.0/12",   # Docker networks
  "192.168.0.0/16"   # Local networks
];
```

## Best Practices

### Security

1. **Secure key storage**:
   ```bash
   # Proper permissions
   chmod 600 /etc/rspamd/dkim/*.key
   chown _rspamd:_rspamd /etc/rspamd/dkim/*.key
   
   # Consider using external key storage
   # - Hardware Security Modules (HSM)
   # - Cloud key management services
   # - Encrypted filesystems
   ```

2. **Key rotation**:
   ```bash
   # Rotate keys annually
   # Keep old keys available for 30 days
   # Use date-based selectors: 2024a, 2024b, etc.
   ```

3. **Monitoring**:
   ```bash
   # Monitor DKIM signing
   grep "dkim.*signed" /var/log/rspamd/rspamd.log
   
   # Check for signing failures
   grep "dkim.*failed" /var/log/rspamd/rspamd.log
   ```

### DNS Configuration

1. **Recommended DNS record**:
   ```dns
   ; Use specific flags
   mail._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; t=s; p=MIIBIjAN..."
   
   ; Flags explanation:
   ; v=DKIM1 - Version
   ; k=rsa   - Key type  
   ; t=s     - Strict mode (recommended)
   ; p=...   - Public key
   ```

2. **DNS testing**:
   ```bash
   # Test DNS propagation
   dig TXT mail._domainkey.example.com
   
   # Test DKIM validation
   rspamadm dkim_keygen -t -s mail -d example.com
   ```

### Performance Optimization

1. **Key caching**:
   ```hcl
   # /etc/rspamd/local.d/dkim_signing.conf
   
   # Cache keys in memory
   cache_key = true;
   cache_expiry = 3600;
   ```

2. **Selective signing**:
   ```hcl
   # Only sign necessary mail
   sign_authenticated = true;   # Sign authenticated mail
   sign_local = false;          # Skip local mail if not needed
   sign_inbound = false;        # Never sign inbound
   ```

## Troubleshooting

### Common Issues

1. **Keys not loading**:
   ```bash
   # Check file permissions
   ls -la /etc/rspamd/dkim/
   
   # Check configuration syntax
   rspamadm configtest
   
   # Check key format
   openssl rsa -in /etc/rspamd/dkim/mail.key -check
   ```

2. **DNS issues**:
   ```bash
   # Verify DNS record
   dig TXT mail._domainkey.example.com
   
   # Test with external tools
   rspamadm dkim_keygen -t -s mail -d example.com
   ```

3. **Signing not working**:
   ```bash
   # Enable debug logging
   # /etc/rspamd/local.d/logging.inc
   level = "debug";
   debug_modules = ["dkim_signing"];
   
   # Check logs
   tail -f /var/log/rspamd/rspamd.log | grep -i dkim
   
   # Test manually
   echo "test" | rspamc -d example.com -f test@example.com
   ```

### Testing DKIM

1. **Manual testing**:
   ```bash
   # Test signing with rspamc
   rspamc -d example.com -f sender@example.com -r recipient@test.com < test_message.eml
   
   # Check for DKIM-Signature header
   ```

2. **External validation**:
   ```bash
   # Send test message to:
   # - Gmail (check Authentication-Results header)
   # - mail-tester.com
   # - dkimvalidator.com
   ```

3. **Automated testing**:
   ```bash
   #!/bin/bash
   # dkim_test.sh
   
   DOMAIN="example.com"
   SELECTOR="mail"
   
   # Test key generation
   if rspamadm dkim_keygen -t -s $SELECTOR -d $DOMAIN; then
     echo "DKIM validation: PASS"
   else
     echo "DKIM validation: FAIL"
   fi
   
   # Test signing
   if echo "test" | rspamc -d $DOMAIN | grep -q "DKIM-Signature"; then
     echo "DKIM signing: PASS"
   else
     echo "DKIM signing: FAIL"
   fi
   ```

## Monitoring and Maintenance

### Monitoring Scripts

```bash
#!/bin/bash
# dkim_monitor.sh

# Check key file permissions
find /etc/rspamd/dkim/ -name "*.key" ! -perm 600 -exec echo "Bad permissions: {}" \;

# Check expiring certificates (if using cert-based keys)
for key in /etc/rspamd/dkim/*.key; do
  if openssl rsa -in "$key" -noout -check 2>/dev/null; then
    echo "Key OK: $key"
  else
    echo "Key ERROR: $key"
  fi
done

# Check DNS records
for domain in $(awk '/domain.*{/ {print $1}' /etc/rspamd/local.d/dkim_signing.conf); do
  if dig TXT mail._domainkey.$domain +short | grep -q "v=DKIM1"; then
    echo "DNS OK: $domain"
  else
    echo "DNS MISSING: $domain"
  fi
done
```

### Log Analysis

```bash
# Analyze DKIM signing statistics
grep "dkim.*signed" /var/log/rspamd/rspamd.log | \
  awk '{print $6}' | sort | uniq -c | sort -rn

# Check for signing failures
grep "dkim.*failed\|dkim.*error" /var/log/rspamd/rspamd.log | tail -20

# Monitor key usage
grep "dkim.*selector" /var/log/rspamd/rspamd.log | \
  awk '{print $8}' | sort | uniq -c
```

This comprehensive guide covers all aspects of DKIM signing with Rspamd, from basic setup to advanced enterprise configurations. 