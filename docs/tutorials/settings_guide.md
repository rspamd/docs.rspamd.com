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
      greylist = null;    # Disable greylisting
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
      reject = null;      # Never reject
      add_header = null;  # Never add headers
      greylist = null;    # Never greylist
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
      greylist = null;
    }
    
    # Disable inbound-specific checks
    symbols_disabled = [
      "BAYES_SPAM",
      "SURBL_MULTI"
    ];
    
    # Enable outbound-specific checks
    symbols_enabled = [
      "DKIM_SIGN",
      "ARC_SIGN"
    ];
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
      greylist = null;
    }
    
    # Skip external checks
    symbols_disabled = [
      "RBL_CHECK",
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
      greylist = null;
    }
    
    symbols_disabled = [
      "IP_SCORE_UNDER",
      "ONCE_RECEIVED"
    ];
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

## Troubleshooting

### Common Issues

1. **Settings not applying**:
   ```bash
   # Check condition syntax
   rspamadm configtest
   
   # Verify conditions match
   grep "setting.*applied" /var/log/rspamd/rspamd.log
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
# local.d/settings.conf

# Enable debug logging for settings
debug_modules = ["settings"];
```

```bash
# Test specific setting conditions
rspamc --header="X-Test: value" -f sender@test.com -r recipient@domain.com < test.eml

# Check setting application in logs
tail -f /var/log/rspamd/rspamd.log | grep -i setting
```