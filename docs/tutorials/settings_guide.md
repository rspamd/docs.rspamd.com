---
title: Settings Module Guide
---

# Settings Module: Per-Domain and Per-User Configuration

The **settings module** allows you to apply different Rspamd configurations based on various conditions like sender domain, recipient, IP address, or authentication status. This enables fine-grained control over spam filtering for different users and domains.

## What are Settings?

Settings are conditional configuration overrides that allow you to:
- Apply different spam thresholds per domain
- Enable/disable specific modules for certain users
- Create custom rules for VIP customers
- Implement tiered service levels
- Handle special routing scenarios

## Basic Concepts

### Setting Structure
```hcl
settingname {
  # Conditions when this setting applies
  condition = "...";
  
  # What to apply when condition matches
  apply {
    # Configuration changes
  }
}
```

### Common Conditions
- **ip**: Sender IP address
- **from**: Sender email address
- **rcpt**: Recipient email address  
- **user**: Authenticated username
- **hostname**: Client hostname
- **authenticated**: Authentication status

## Practical Examples

### Example 1: Per-Domain Spam Thresholds

Create different filtering levels for different domains:

```hcl
# /etc/rspamd/local.d/settings.conf

# Strict filtering for executive domain
executives {
  rcpt = "@executives.company.com";
  apply {
    actions {
      reject = 5.0;      # Very strict
      add_header = 2.0;
      greylist = 1.0;
    }
    
    # Enable additional protection
    symbols_enabled = [
      "EXECUTIVE_PROTECTION"
    ];
  }
}

# Relaxed filtering for marketing domain  
marketing {
  rcpt = "@marketing.company.com";
  apply {
    actions {
      reject = 20.0;     # Very lenient
      add_header = 15.0;
      greylist = 10.0;
    }
    
    # Disable some checks for newsletters
    symbols_disabled = [
      "BULK_EMAIL",
      "MAILLIST"
    ];
  }
}

# Standard filtering for main domain
standard {
  rcpt = "@company.com";
  apply {
    actions {
      reject = 15.0;     # Standard thresholds
      add_header = 6.0;
      greylist = 4.0;
    }
  }
}
```

### Example 2: VIP User Configuration

Special handling for important customers:

```hcl
# VIP customers with priority processing
vip_customers {
  rcpt = [
    "ceo@bigclient.com",
    "admin@importantpartner.org",
    "@vip-domain.com"
  ];
  
  apply {
    # Very permissive for VIPs
    actions {
      reject = 25.0;
      add_header = 20.0;
      greylist = -1;    # Disable greylisting
    }
    
    # Disable reputation checks
    symbols_disabled = [
      "IP_SCORE",
      "URL_REPUTATION"
    ];
    
    # Add VIP symbol for identification
    symbols_enabled = [
      "VIP_RECIPIENT"
    ];
    
    # Custom headers
    milter_headers {
      extended_spam_headers = true;
      add_headers {
        "X-VIP-Processing" = "enabled";
      }
    }
  }
}

# VIP senders - always allow
vip_senders {
  from = [
    "noreply@trusted-bank.com",
    "alerts@security-vendor.com",
    "@government.gov"
  ];
  
  apply {
    actions {
      reject = -1;      # Never reject
      add_header = -1;  # Never add headers
      greylist = -1;    # Never greylist
    }
    
    # Bypass most checks
    symbols_disabled = [
      "DMARC_POLICY_REJECT",
      "SPF_FAIL", 
      "DKIM_INVALID"
    ];
  }
}
```

### Example 3: Authenticated vs. Unauthenticated Users

Different rules based on authentication:

```hcl
# Authenticated users (outbound)
authenticated_users {
  authenticated = true;
  
  apply {
    # Relaxed outbound filtering
    actions {
      reject = 30.0;
      add_header = 25.0;
      greylist = -1;
    }
    
    # Disable inbound-specific checks
    symbols_disabled = [
      "BAYES_SPAM",
      "SURBL_MULTI",
      "RBL_*"
    ];
    
    # Enable outbound-specific checks
    symbols_enabled = [
      "DKIM_SIGN",
      "ARC_SIGN"
    ];
    
    # Custom DKIM signing
    dkim_signing {
      domain = "%{selector_domain}";
      selector = "outbound";
      path = "/etc/rspamd/dkim/outbound.key";
    }
  }
}

# Unauthenticated external mail
unauthenticated_external {
  authenticated = false;
  ip = "!192.168.0.0/16";
  
  apply {
    # Strict inbound filtering
    actions {
      reject = 10.0;
      add_header = 5.0;
      greylist = 3.0;
    }
    
    # Enable all protection modules
    symbols_enabled = [
      "PHISHING",
      "MALWARE_SCAN",
      "ATTACHMENT_CHECK"
    ];
  }
}
```

### Example 4: Geographic and Network-Based Settings

Configure based on source location:

```hcl
# Internal network - trusted
internal_network {
  ip = [
    "192.168.0.0/16",
    "10.0.0.0/8",
    "172.16.0.0/12"
  ];
  
  apply {
    # Relaxed for internal
    actions {
      reject = 20.0;
      add_header = 15.0;
      greylist = -1;
    }
    
    # Skip external checks
    symbols_disabled = [
      "RBL_*",
      "SURBL_*",
      "PHISHING"
    ];
  }
}

# Known good mail servers
trusted_relays {
  ip = [
    "203.0.113.10",     # Partner MX
    "198.51.100.20",    # Backup MX
    "2001:db8::1"       # IPv6 relay
  ];
  
  apply {
    actions {
      reject = 25.0;
      add_header = 20.0;
      greylist = -1;
    }
    
    symbols_disabled = [
      "IP_SCORE_UNDER",
      "ONCE_RECEIVED"
    ];
  }
}

# High-risk countries
high_risk_geoip {
  ip = [
    "CN",    # China
    "RU",    # Russia  
    "KP"     # North Korea
  ];
  
  apply {
    actions {
      reject = 8.0;     # Very strict
      add_header = 3.0;
      greylist = 1.0;
    }
    
    # Extra scrutiny
    symbols_enabled = [
      "SUSPICIOUS_GEO",
      "ENHANCED_PHISHING_CHECK"
    ];
  }
}
```

### Example 5: Service-Level Configurations

Different service tiers:

```hcl
# Premium service customers
premium_service {
  rcpt = "@premium.company.com";
  
  apply {
    # Advanced features enabled
    neural {
      enabled = true;
      max_trains = 5000;
    }
    
    actions {
      reject = 18.0;
      add_header = 8.0;
      greylist = 5.0;
    }
    
    # Enable premium modules
    symbols_enabled = [
      "NEURAL_SPAM",
      "ADVANCED_PHISHING",
      "ATTACHMENT_SCAN",
      "URL_REPUTATION"
    ];
    
    # Custom processing
    milter_headers {
      extended_spam_headers = true;
      add_headers {
        "X-Service-Level" = "premium";
        "X-Scan-Time" = "%{scan_time}";
      }
    }
  }
}

# Basic service
basic_service {
  rcpt = "@basic.company.com";
  
  apply {
    actions {
      reject = 12.0;
      add_header = 6.0;
      greylist = 4.0;
    }
    
    # Limited feature set
    symbols_disabled = [
      "NEURAL_*",
      "CLICKHOUSE",
      "ADVANCED_*"
    ];
    
    milter_headers {
      add_headers {
        "X-Service-Level" = "basic";
      }
    }
  }
}
```

### Example 6: Conditional Module Configuration

Enable/disable modules based on conditions:

```hcl
# Enable neural networks for high-volume domains
neural_enabled {
  rcpt = [
    "@highvolume.com",
    "@enterprise.org"
  ];
  
  apply {
    neural {
      enabled = true;
      servers = "redis://neural-redis:6379/2";
      max_trains = 10000;
      max_usages = 50;
    }
  }
}

# Disable Bayes for certain domains (GDPR compliance)
bayes_disabled {
  rcpt = [
    "@eu-only.company.eu",
    "@privacy-sensitive.org"
  ];
  
  apply {
    classifier "bayes" {
      enabled = false;
    }
    
    symbols_disabled = [
      "BAYES_SPAM", 
      "BAYES_HAM"
    ];
    
    milter_headers {
      add_headers {
        "X-Privacy-Mode" = "gdpr-compliant";
      }
    }
  }
}

# Enable ClickHouse logging for audit domains
audit_logging {
  rcpt = [
    "@financial.company.com",
    "@compliance.company.com"
  ];
  
  apply {
    clickhouse {
      enabled = true;
      server = "clickhouse://audit-db:8123/";
      table = "rspamd_audit";
      retention {
        enable = true;
        period = "1y";
      }
    }
  }
}
```

### Example 7: Complex Conditional Logic

Advanced condition combinations:

```hcl
# Authenticated internal users with special handling
auth_internal {
  and = [
    {authenticated = true},
    {ip = "192.168.0.0/16"}
  ];
  
  apply {
    actions {
      reject = 25.0;
      add_header = 20.0;
      greylist = -1;
    }
    
    # Enable DKIM signing for internal auth
    dkim_signing {
      enabled = true;
      selector = "internal";
    }
  }
}

# External authenticated but suspicious
suspicious_auth {
  and = [
    {authenticated = true},
    {not = {ip = "192.168.0.0/16"}},
    {symbols = ["SUSPICIOUS_LOGIN"]}
  ];
  
  apply {
    actions {
      reject = 12.0;
      add_header = 6.0;
      greylist = 4.0;
    }
    
    symbols_enabled = [
      "AUTH_ANOMALY_DETECT"
    ];
  }
}

# First-time senders to VIP recipients  
first_time_to_vip {
  and = [
    {rcpt = "@executives.company.com"},
    {not = {symbols = ["KNOWN_SENDER"]}}
  ];
  
  apply {
    actions {
      reject = 8.0;      # Extra strict
      add_header = 3.0;
      greylist = 2.0;
    }
    
    symbols_enabled = [
      "FIRST_TIME_SENDER",
      "EXECUTIVE_PROTECTION"
    ];
  }
}
```

### Example 8: Time-Based Settings

Different rules based on time:

```hcl
# Business hours - more relaxed for expected mail
business_hours {
  and = [
    {time = "9:00-17:00"},
    {weekday = "1-5"}
  ];
  
  apply {
    actions {
      reject = 18.0;
      add_header = 8.0;
      greylist = 5.0;
    }
  }
}

# After hours - stricter filtering
after_hours {
  or = [
    {time = "17:01-8:59"},
    {weekday = "6-7"}
  ];
  
  apply {
    actions {
      reject = 10.0;     # Much stricter
      add_header = 4.0;
      greylist = 2.0;
    }
    
    symbols_enabled = [
      "AFTER_HOURS_ANOMALY"
    ];
  }
}
```

## Advanced Features

### Using Selectors in Settings

```hcl
# Based on custom header values
department_routing {
  selector = "header('X-Department')";
  value = "finance";
  
  apply {
    actions {
      reject = 20.0;     # Finance needs higher threshold
      add_header = 15.0;
    }
    
    symbols_enabled = [
      "FINANCIAL_COMPLIANCE"
    ];
  }
}

# Based on message size
large_messages {
  selector = "size";
  value = ">1048576";    # > 1MB
  
  apply {
    symbols_enabled = [
      "LARGE_MESSAGE_SCAN"
    ];
    
    # Different timeouts for large messages
    options {
      task_timeout = 120;
    }
  }
}
```

### Dynamic Settings from Redis

```hcl
# Load settings from Redis
redis_settings {
  redis_key = "rspamd_settings_%{rcpt_domain}";
  
  apply {
    # Settings loaded from Redis value
    dynamic = true;
  }
}
```

## Best Practices

### Performance Optimization

1. **Order settings by frequency**:
   ```hcl
   # Most common conditions first
   common_domain { ... }
   specific_users { ... }
   edge_cases { ... }
   ```

2. **Use efficient conditions**:
   ```hcl
   # Fast IP lookups
   ip = "192.168.1.0/24";
   
   # Avoid complex regex in hot paths
   from = "user@domain.com";  # Better than regex
   ```

3. **Minimize setting complexity**:
   ```hcl
   # Simple conditions perform better
   rcpt = "@domain.com";
   
   # Complex conditions only when needed
   and = [{ip = "..."}, {time = "..."}];
   ```

### Configuration Management

1. **Use includes for organization**:
   ```hcl
   # /etc/rspamd/local.d/settings.conf
   .include(try=true,priority=1,duplicate=merge) "$LOCAL_CONFDIR/local.d/settings-domains.conf"
   .include(try=true,priority=1,duplicate=merge) "$LOCAL_CONFDIR/local.d/settings-users.conf"
   ```

2. **Document your settings**:
   ```hcl
   # VIP customer configuration
   # Updated: 2024-01-15
   # Contact: admin@company.com
   vip_config {
     # ... configuration
   }
   ```

3. **Version control settings**:
   ```bash
   # Track changes to settings
   git add /etc/rspamd/local.d/settings*.conf
   git commit -m "Updated VIP customer thresholds"
   ```

### Testing and Validation

1. **Test settings syntax**:
   ```bash
   rspamadm configtest
   ```

2. **Verify setting application**:
   ```bash
   # Test with specific message
   rspamc -f sender@domain.com -r recipient@company.com < test.eml
   
   # Check which settings applied
   grep "applied.*setting" /var/log/rspamd/rspamd.log
   ```

3. **Monitor setting usage**:
   ```bash
   # See setting statistics  
   rspamc stat | grep -A5 "Settings"
   ```

## Troubleshooting

### Common Issues

1. **Settings not applying**:
   ```bash
   # Check condition syntax
   rspamadm configtest
   
   # Verify conditions match
   grep "setting.*applied" /var/log/rspamd/rspamd.log
   
   # Debug mode for detailed info
   rspamc -v -f test@domain.com < message.eml
   ```

2. **Conflicting settings**:
   ```bash
   # Check setting priorities
   # Later settings override earlier ones
   # Use priority parameter to control order
   ```

3. **Performance problems**:
   ```bash
   # Monitor setting evaluation time
   # Simplify complex conditions
   # Move frequently-matched settings first
   ```

### Debugging

```hcl
# Enable debug logging for settings
logging {
  level = "debug";
  debug_modules = ["settings"];
}
```

```bash
# Test specific setting conditions
rspamc --header="X-Test: value" -f sender@test.com -r recipient@domain.com < test.eml

# Check setting application in logs
tail -f /var/log/rspamd/rspamd.log | grep -i setting
```

## Common Use Cases

### Multi-Tenant Hosting
- Different thresholds per customer domain
- Isolated configurations per tenant
- Billing-based feature enablement

### Enterprise Deployment
- Department-specific filtering rules
- Executive protection policies
- Compliance requirements per region

### Service Provider
- Tiered service offerings
- Customer-specific customizations
- SLA-based configurations

This guide provides a comprehensive foundation for implementing sophisticated per-domain and per-user configurations with Rspamd settings. 