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
  filter = "email:domain";
  extract_from = "smtp";  # Check SMTP envelope from (default)
  map = "/etc/rspamd/maps/trusted_domains.map";
  score = -10.0;
  description = "Trusted sender domains";
}

BLOCKED_DOMAINS {
  type = "from"; 
  filter = "email:domain";
  extract_from = "smtp";  # Check SMTP envelope from
  map = "/etc/rspamd/maps/blocked_domains.map";
  score = 15.0;
  description = "Blocked sender domains";
}

# Alternative: Check MIME From header instead of SMTP envelope
BLOCKED_MIME_DOMAINS {
  type = "from";
  filter = "email:domain";
  extract_from = "mime";  # Check From: header
  map = "/etc/rspamd/maps/blocked_mime_domains.map";
  score = 8.0;
  description = "Blocked domains in From header";
}

BLOCKED_RECIPIENTS {
  type = "rcpt";
  filter = "email:addr";  # Check full email address
  map = "/etc/rspamd/maps/blocked_recipients.map"; 
  score = 10.0;
  description = "Block mail to specific recipients";
}
```

**Key Concepts:**

- **SMTP From** (`extract_from = "smtp"`): The envelope sender (MAIL FROM command) - what the receiving server sees
- **MIME From** (`extract_from = "mime"`): The From: header - what users see in their email client
- **Score vs Action**: Use `score` for weighted decisions allowing other rules to influence the final action. Use `action` only for prefilter rules that need immediate decisions (like IP whitelisting)

**Example: Prefilter for immediate decisions:**
```hcl
TRUSTED_IPS_PREFILTER {
  type = "ip";
  map = "/etc/rspamd/maps/trusted_ips.map";
  prefilter = true;   # Runs before other rules
  action = "accept";  # Immediately accept, no scoring
  description = "Trusted IPs - bypass all checks";
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
  map = "redis://ip_whitelist";
  score = -5.0;
  description = "Whitelisted IPs in Redis";
}

IP_REPUTATION {
  type = "ip";
  map = "redis://ip_blacklist";
  score = 8.0;
  description = "Bad IP reputation";
}
```

Configure Redis connection in multimap:
```hcl
# Also add Redis configuration
redis {
  servers = "127.0.0.1:6379";
  # password = "your_redis_password";  # if needed
}
```

Add IPs to Redis:
```bash
# Whitelist an IP (key in hash = IP, value = description)
redis-cli HSET ip_whitelist "192.168.1.100" "trusted_server"

# Add bad reputation IP  
redis-cli HSET ip_blacklist "203.0.113.5" "spam_source"

# You can also use CIDR notation
redis-cli HSET ip_blacklist "203.0.113.0/24" "spam_network"
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
  regexp = true;  # Required for regex patterns
  score = 5.0;
  description = "Suspicious mail clients";
}

FORGED_OUTLOOK {
  type = "from";
  filter = "email:domain";
  extract_from = "smtp";
  map = [
    "outlook.com",
    "hotmail.com", 
    "live.com"
  ];
  score = 7.0;
  description = "Checks if sender claims to be from major email providers";
  # This checks SMTP envelope, combine with DKIM/SPF for spoofing detection
}

BULK_MAIL_HEADERS {
  type = "header";
  header = "Precedence";
  map = [
    "bulk",
    "list",
    "junk"
  ];
  score = 2.0;
  description = "Bulk mail precedence headers";
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
  regexp = true;  # Required for regex patterns
  score = 20.0;
  description = "Archive containing executable";
}
```

Create the TLD map:
```bash
# /etc/rspamd/maps/blocked_tlds.map
tk
ml
ga
cf
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

### Example 6: Content and URL Filtering

Filter message content and URLs for security:

```hcl
FORBIDDEN_CONTENT {
  type = "content";
  filter = "oneline";  # Decoded text without newlines
  map = [
    "/urgent.*transfer.*funds/i",
    "/click.*here.*immediately/i",
    "/congratulations.*winner/i"
  ];
  regexp = true;
  score = 8.0;
  description = "Suspicious content patterns";
}

PHISHING_URLS {
  type = "url";
  filter = "host";  # Check hostname part of URLs
  map = "/etc/rspamd/maps/phishing_domains.map";
  score = 12.0;
  description = "Known phishing domains";
}

SUSPICIOUS_SHORTENERS {
  type = "url";
  filter = "host";
  map = [
    "bit.ly",
    "tinyurl.com", 
    "goo.gl",
    "t.co"
  ];
  score = 2.0;
  description = "URL shortener services";
}

SENSITIVE_KEYWORDS {
  type = "content";
  filter = "text";  # Check all text parts
  map = [
    "/\\bssn\\b/i",           # Social Security Number
    "/\\b\\d{3}-\\d{2}-\\d{4}\\b/",  # SSN format
    "/\\bcredit card\\b/i",
    "/\\bpassword\\b/i"
  ];
  regexp = true;
  score = 5.0;
  description = "Contains sensitive information";
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

### Example 8: Advanced Selector Maps

Use Rspamd selectors for sophisticated matching:

```hcl
SPF_FAIL_FREEMAIL {
  type = "selector";
  selector = "from:domain";
  map = "/etc/rspamd/maps/freemail_domains.map";
  score = 5.0;
  description = "SPF fail from freemail";
  require_symbols = "R_SPF_FAIL";
}

AUTHENTICATED_USER_DOMAIN {
  type = "selector";
  selector = "user";  # Gets authenticated username
  filter = "email:domain";
  map = "/etc/rspamd/maps/allowed_user_domains.map";
  score = -3.0;
  description = "Authenticated user from allowed domain";
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
   map = "redis://hashkey_name";
   # Configure Redis servers in multimap config
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
   debug_modules = ["multimap"];
   ```

2. **Test rules**:
   ```bash
   # Test message against rules
   rspamc -v < test_message.eml
   
   # Check symbol details
   rspamc symbols
   ```


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
