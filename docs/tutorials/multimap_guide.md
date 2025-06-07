---
title: Multimap Module Guide
---

# Multimap Module: Practical Examples and Use Cases

The **multimap module** is one of Rspamd's most powerful features for creating custom filtering rules without writing Lua code. This tutorial provides practical examples to help you implement real-world filtering scenarios.

## What is Multimap?

Multimap allows you to create custom symbols based on various message attributes (sender, recipient, URLs, headers) matched against lists (files, HTTP endpoints, Redis). Think of it as a universal "if-then" rule engine.

## Basic Concepts

### Map Types
- **File maps**: Static lists in files
- **HTTP maps**: Dynamic lists from web servers  
- **Redis maps**: Key-value lookups in Redis
- **Embedded maps**: Small lists directly in config

### Check Types
- **from**: Check sender address
- **rcpt**: Check recipient address
- **ip**: Check sender IP
- **url**: Check URLs in message
- **header**: Check message headers
- **filename**: Check attachment names

## Practical Examples

### Example 1: Domain Whitelist/Blacklist

Create trusted and blocked domain lists:

```hcl
# /etc/rspamd/local.d/multimap.conf

TRUSTED_DOMAINS {
  type = "from";
  map = "/etc/rspamd/maps/trusted_domains.map";
  score = -10.0;
  description = "Trusted sender domains";
  action = "accept";
}

BLOCKED_DOMAINS {
  type = "from"; 
  map = "/etc/rspamd/maps/blocked_domains.map";
  score = 15.0;
  description = "Blocked sender domains";
  action = "reject";
}

BLOCKED_RECIPIENTS {
  type = "rcpt";
  map = "/etc/rspamd/maps/blocked_recipients.map"; 
  score = 10.0;
  description = "Block mail to specific recipients";
}
```

Create the map files:

```bash
# /etc/rspamd/maps/trusted_domains.map
example.com
partner-company.org
bank.com

# /etc/rspamd/maps/blocked_domains.map  
spam-domain.com
phishing-site.net
malware-host.org

# /etc/rspamd/maps/blocked_recipients.map
spam-trap@yourdomain.com
honeypot@yourdomain.com
```

### Example 2: IP Reputation with Redis

Use Redis for dynamic IP scoring:

```hcl
IP_WHITELIST {
  type = "ip";
  map = "redis+selector";
  selector = "ip";
  score = -5.0;
  description = "Whitelisted IPs in Redis";
}

IP_REPUTATION {
  type = "ip";
  map = "redis+selector";
  selector = "ip";
  score = 8.0;
  description = "Bad IP reputation";
}
```

Add IPs to Redis:
```bash
# Whitelist an IP
redis-cli HSET rspamd_ip_wl "192.168.1.100" "trusted_server"

# Add bad reputation IP  
redis-cli HSET rspamd_ip_bl "203.0.113.5" "spam_source"
```

### Example 3: Advanced Header Checks

Check various message headers:

```hcl
SUSPICIOUS_MAILERS {
  type = "header";
  header = "X-Mailer";
  map = [
    "/Mass Mailer/i",
    "/Bulk.*Mail/i", 
    "/spam/i"
  ];
  score = 5.0;
  description = "Suspicious mail clients";
}

FORGED_OUTLOOK {
  type = "header";
  header = "X-Mailer";
  filter = "email:domain:addr";
  map = [
    "outlook.com",
    "hotmail.com", 
    "live.com"
  ];
  score = 7.0;
  description = "Forged Outlook sender";
  regexp = true;
}

MISSING_DATE {
  type = "header";
  header = "Date";
  map = "";
  score = 2.0;
  description = "Missing Date header";
  missing = true;
}
```

### Example 4: URL and Attachment Filtering

Filter based on URLs and file attachments:

```hcl
BLOCKED_URLS {
  type = "url";
  filter = "tld";
  map = "/etc/rspamd/maps/blocked_tlds.map";
  score = 10.0;
  description = "Blocked TLD in URLs";
}

SUSPICIOUS_ATTACHMENTS {
  type = "filename";
  filter = "extension";
  map = [
    "exe",
    "scr",
    "bat", 
    "com",
    "pif"
  ];
  score = 15.0;
  description = "Dangerous file extensions";
}

ARCHIVE_WITH_EXE {
  type = "filename";
  filter = "full";
  map = [
    "/.*\\.zip:.*\\.exe$/i",
    "/.*\\.rar:.*\\.scr$/i"
  ];
  score = 20.0;
  description = "Archive containing executable";
  regexp = true;
}
```

Create the TLD map:
```bash
# /etc/rspamd/maps/blocked_tlds.map
.tk
.ml
.ga
.cf
```

### Example 5: Per-User/Per-Domain Rules

Create different rules for different domains:

```hcl
VIP_DOMAINS {
  type = "rcpt";
  filter = "email:domain";
  map = "/etc/rspamd/maps/vip_domains.map";
  score = -5.0;
  description = "VIP domain recipients";
}

VIP_SENDER_WHITELIST {
  type = "from";
  filter = "email:domain"; 
  map = "/etc/rspamd/maps/vip_sender_whitelist.map";
  score = -8.0;
  description = "VIP sender whitelist";
  require_symbols = "VIP_DOMAINS";
}

MARKETING_DOMAINS {
  type = "rcpt";
  filter = "email:domain";
  map = [
    "marketing.company.com",
    "newsletter.company.com"
  ];
  score = -2.0;
  description = "Marketing domains - relaxed filtering";
}
```

### Example 6: Complex Conditional Logic

Use symbol dependencies and conditions:

```hcl
EXTERNAL_SENDER {
  type = "from";
  filter = "email:domain";
  map = "/etc/rspamd/maps/internal_domains.map";
  score = 0.0;
  description = "External sender marker";
  symbols_set = ["EXTERNAL"];
}

EXTERNAL_WITH_INTERNAL_LINKS {
  type = "url";
  filter = "tld";
  map = "/etc/rspamd/maps/internal_domains.map";
  score = 8.0;
  description = "External sender with internal links";
  require_symbols = "EXTERNAL";
}

BULK_MAIL_HEADERS {
  type = "header";
  header = "Precedence";
  map = [
    "bulk",
    "list"
  ];
  score = 0.0;
  description = "Bulk mail marker";
  symbols_set = ["BULK_MAIL"];
}

BULK_TO_SINGLE_USER {
  type = "rcpt";
  filter = "email:user";
  map = "/etc/rspamd/maps/single_users.map";
  score = 5.0;
  description = "Bulk mail to single user";
  require_symbols = "BULK_MAIL";
}
```

### Example 7: Dynamic HTTP Maps

Use HTTP endpoints for dynamic lists:

```hcl
DYNAMIC_IP_BLACKLIST {
  type = "ip";
  map = "http://security.company.com/rspamd/bad_ips.txt";
  score = 10.0;
  description = "Dynamic IP blacklist";
  upstreams = "http://security.company.com";
}

PHISHING_DOMAINS {
  type = "url";
  filter = "host";
  map = "http://threat-intel.company.com/phishing_domains.json";
  score = 15.0;
  description = "Real-time phishing domains";
  upstreams = "http://threat-intel.company.com";
}
```

### Example 8: Advanced Selectors

Use complex selectors for sophisticated matching:

```hcl
SPF_FAIL_FREEMAIL {
  type = "combined";
  filter = "email:domain";
  selector = "from";
  map = "/etc/rspamd/maps/freemail_domains.map";
  score = 5.0;
  description = "SPF fail from freemail";
  require_symbols = "R_SPF_FAIL";
}

DKIM_SIGNED_MISMATCH {
  type = "header";
  header = "from";
  filter = "email:domain";
  selector = "dkim:domain";
  score = 3.0;
  description = "DKIM domain differs from From";
  comparison = "ne";
}
```

## Best Practices

### Performance Optimization

1. **Use appropriate map types**:
   ```hcl
   # For small static lists
   map = ["item1", "item2", "item3"];
   
   # For large lists
   map = "file:///etc/rspamd/maps/large_list.map";
   
   # For frequently changing data
   map = "redis+selector";
   ```

2. **Order rules by frequency**:
   Place frequently matching rules first.

3. **Use Redis for dynamic data**:
   ```hcl
   # Instead of file updates
   map = "redis+selector";
   selector = "ip";
   ```

### Map Management

1. **Automatic map updates**:
   ```bash
   # Update HTTP maps automatically
   # Rspamd checks If-Modified-Since headers
   
   # For file maps, use inotify or cron:
   */5 * * * * /usr/bin/rspamc reload
   ```

2. **Map validation**:
   ```bash
   # Test map syntax
   rspamadm configtest
   
   # Check map loading
   grep "multimap" /var/log/rspamd/rspamd.log
   ```

### Debugging

1. **Enable debug logging**:
   ```hcl
   # /etc/rspamd/local.d/logging.inc
   level = "debug";
   debug_modules = ["multimap"];
   ```

2. **Test rules**:
   ```bash
   # Test message against rules
   rspamc -v < test_message.eml
   
   # Check symbol details
   rspamc symbols
   ```

## Common Use Cases

### Email Security

- **Phishing protection**: Block known phishing domains
- **Malware filtering**: Block dangerous file extensions
- **Data loss prevention**: Block sensitive keywords
- **Business email compromise**: Detect spoofed executives

### Compliance

- **GDPR compliance**: Different rules per region
- **Industry regulations**: Financial/healthcare specific rules
- **Corporate policies**: Block personal email domains

### Performance

- **VIP handling**: Fast-track important senders
- **Bulk mail routing**: Separate processing for newsletters
- **Resource protection**: Rate limiting per domain

## Troubleshooting

### Common Issues

1. **Maps not loading**:
   ```bash
   # Check file permissions
   ls -la /etc/rspamd/maps/
   
   # Check syntax
   rspamadm configtest
   ```

2. **Rules not matching**:
   ```bash
   # Enable debug logging
   # Check filter and selector syntax
   # Verify map contents
   ```

3. **Performance problems**:
   ```bash
   # Monitor map reload frequency
   # Check Redis connection
   # Use appropriate map types
   ```

### Testing

```bash
# Test specific multimap rules
echo "Test message" | rspamc -v

# Check loaded maps
rspamc stat | grep -i map

# Reload maps without restart
rspamc reload
```

## Advanced Examples

### Machine Learning Integration

```hcl
ML_SUSPICIOUS_DOMAINS {
  type = "url";
  filter = "host";
  map = "http://ml-service.internal/suspicious_domains";
  score = 8.0;
  description = "ML-detected suspicious domains";
}
```

### Threat Intelligence Feeds

```hcl
THREAT_INTEL_IPS {
  type = "ip";
  map = "http://threat-feed.company.com/ips.json";
  score = 12.0;
  description = "Threat intelligence IPs";
  prefilter = true;
}
```

This guide provides a solid foundation for using multimap effectively. Start with simple rules and gradually build more complex filtering logic as needed. 