---
title: First Setup
sidebar_position: 3
---

# First Setup

This guide covers basic Rspamd configuration for spam filtering.

## Prerequisites

Before starting:

- Rspamd installed - see [installation guide](/getting-started/installation)
- Redis running (required for statistics and Bayesian learning)
- Mail server (MTA) - Postfix, Exim, or Sendmail
- Root access to modify `/etc/rspamd/` configuration
- Test email accounts for validation

Rspamd uses a [multi-worker architecture](/developers/architecture) with specialized workers. This setup configures:
- Normal worker (message scanning)
- Controller worker (web UI)
- Proxy worker (milter protocol bridge)

## Step 1: Essential Configuration

Set spam filtering thresholds in `/etc/rspamd/local.d/actions.conf`:

```hcl
reject = 15;        # Reject obvious spam
add_header = 6;     # Add spam headers, deliver
greylist = 4;       # Temporarily delay suspicious messages
```

These thresholds determine actions based on cumulative scores from [symbols](/getting-started/understanding-rspamd) (SPF, DKIM, Bayes, content rules, RBLs). Actions are applied via [milter protocol](/developers/protocol) and can be overridden per-domain via [settings module](/configuration/settings).

Configure Redis in `/etc/rspamd/local.d/redis.conf`:

```hcl
servers = "127.0.0.1:6379";
timeout = 1s;
# db = "0";
# password = "your_redis_password";
```

Redis is used for:
- Bayesian statistics
- Rate limiting and greylisting
- DMARC reports and neural network weights
- Message processing history

Without Redis, statistical learning and rate limiting are disabled. Static rules (SPF, DKIM, DMARC, RBLs) will still work.

Set web interface password:

```bash
rspamadm pw
```

Create `/etc/rspamd/local.d/worker-controller.inc`:

```hcl
password = "$2$your_generated_hash_here";
bind_socket = "localhost:11334";
# enable_password = "$2$another_hash";  # For dangerous operations
```

For remote access, use SSH tunnel: `ssh -L 11334:localhost:11334 user@your-server`

Do not bind to `0.0.0.0:11334` without firewall protection.

Validate configuration:

```bash
sudo rspamadm configtest
```

Should output `syntax OK`. Common errors: missing semicolons, unmatched braces, typos.

Restart Rspamd:

```bash
sudo systemctl restart rspamd
sudo systemctl status rspamd
```

Check logs if needed:

```bash
sudo journalctl -u rspamd -n 50
```

## Step 2: Test Basic Functionality

Test message scanning:

```bash
echo -e "Subject: Test\n\nThis is a test message" | rspamc
```

Output shows action, symbols, and score.

Test spam-like content:

```bash
echo -e "Subject: FREE VIAGRA\n\nBUY NOW CLICK HERE" | rspamc
```

Should show higher score and `add header` action.

Access web interface at `http://your-server-ip:11334`.

Verify Redis connection:

```bash
rspamc stat
```

Should show statistics and Bayes data. If Redis connection fails:

```bash
redis-cli ping  # Should return PONG
sudo ss -tlnp | grep 6379  # Check Redis listening
sudo journalctl -u rspamd | grep -i redis  # Check logs
```

## Step 3: Mail Server Integration

### For Postfix

Configure Rspamd proxy worker in `/etc/rspamd/local.d/worker-proxy.inc`:

```hcl
milter = yes;
timeout = 120s;
upstream "local" {
  default = yes;
  self_scan = yes;
}
```

The [proxy worker](/workers/rspamd_proxy) bridges your MTA and the normal worker, handling milter protocol translation and connection pooling.

Add to `/etc/postfix/main.cf`:

```
smtpd_milters = inet:localhost:11332
non_smtpd_milters = inet:localhost:11332
milter_default_action = accept
milter_protocol = 6
```

Note: `milter_default_action = accept` means mail is accepted if Rspamd is down. Use `tempfail` for stricter behavior.

Restart services:

```bash
sudo systemctl restart rspamd postfix
```

### For Other MTAs

See [integration guide](/tutorials/integration) for Exim, Sendmail, and other MTAs.

## Step 4: Verify End-to-End Functionality

Send a regular email and check for `X-Spam-Status` header with low score.

Test with [GTUBE pattern](/other/gtube_patterns):

```bash
echo -e "Subject: GTUBE Test\n\nXJS*C4JDBQADN1.NSBN3*2IDNEN*GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL*C.34X" | \
  sendmail test@yourdomain.com
```

Should trigger `GTUBE` symbol with high score and `reject` action. Check MTA logs for rejection.

Test spam-like content:

```bash
echo -e "Subject: FREE MONEY NOW\n\nCLICK HERE FOR FREE MONEY" | sendmail test@yourdomain.com
```

Should add spam headers and deliver with higher score.

Check message processing in web interface History tab.

## Step 5: Fine-tuning

Adjust thresholds:

Edit `/etc/rspamd/local.d/actions.conf` based on results:
- Too many false positives: increase `add_header` to 8
- Missing spam: decrease `add_header` to 4
- Greylisting delays: increase `greylist` to 6

Enable Bayesian learning in `/etc/rspamd/local.d/classifier-bayes.conf`:

```hcl
backend = "redis";
new_schema = true;
expire = 8640000;  # 100 days

autolearn {
  spam_threshold = 12.0;
  ham_threshold = -2.0;
  check_balance = true;
}
```

Train with spam and ham samples:

```bash
rspamc learn_spam /path/to/spam-message.eml
rspamc learn_ham /path/to/ham-message.eml

# Bulk training
find /path/to/spam/ -type f | xargs -I {} rspamc learn_spam {}
find /path/to/ham/ -type f | xargs -I {} rspamc learn_ham {}

# Check statistics
rspamc stat | grep -A2 BAYES
```

Train with at least 200 spam and 200 ham messages. Keep ratio balanced (within 2:1).

Restart:

```bash
sudo systemctl restart rspamd
```

## Checklist

After setup:
- Messages analyzed and scored
- Spam rejected or marked based on thresholds
- Web interface accessible
- MTA integrated with Rspamd
- Message processing visible in web UI

## Common Issues

### Connection Refused

If MTA can't connect to port 11332:

```bash
sudo systemctl status rspamd
sudo ss -tlnp | grep rspamd  # Should show 11332, 11333, 11334
sudo lsof -i :11332  # Check port conflicts
```

Fix: Verify `/etc/rspamd/local.d/worker-proxy.inc` exists and restart Rspamd.

For SELinux (RHEL/CentOS):

```bash
sudo setsebool -P antivirus_can_scan_system 1
```

### No Spam Headers

If messages have no `X-Spam-*` headers:

```bash
rspamc configdump milter_headers
rspamc stat  # Check messages scanned
```

Enable in `/etc/rspamd/local.d/milter_headers.conf`:

```hcl
use = ["x-spamd-bar", "x-spam-level", "x-spam-status", "authentication-results"];
```

Verify Postfix configuration:

```bash
postconf | grep milter
```

### All Messages Marked as Spam

Check which symbols are triggering:

```bash
echo "test message" | rspamc
rspamc stat | grep -A2 BAYES
```

Common causes:

1. **Imbalanced Bayes training**: Reset and retrain with balanced samples
   ```bash
   rspamc learn_spam --reset
   rspamc learn_ham --reset
   ```

2. **DNS issues**: Configure local resolver in `/etc/rspamd/local.d/options.inc`
   ```hcl
   dns {
     nameserver = ["127.0.0.1"];
     timeout = 2s;
   }
   ```

3. **Low thresholds**: Increase values in `actions.conf`

### Web Interface Won't Load

Check controller is running:

```bash
sudo ss -tlnp | grep 11334
curl -I http://localhost:11334/
```

Fix: Verify `/etc/rspamd/local.d/worker-controller.inc` exists with password.

For remote access, use SSH tunnel:

```bash
ssh -L 11334:localhost:11334 user@your-server
```

For SELinux:

```bash
sudo setsebool -P antivirus_can_scan_system 1
sudo semanage port -a -t antivirus_port_t -p tcp 11334
```

## Next Steps

- Monitor history tab and adjust thresholds
- Read [configuration fundamentals](/guides/configuration/fundamentals)
- Review [architecture](/developers/architecture) for troubleshooting
- Back up `/etc/rspamd/local.d/` and Redis data
- Explore [rule writing](/developers/writing_rules) for custom rules

## Getting Help

- [Configuration reference](/configuration/)
- [Community support](/support)
- [FAQ](/faq)

## Performance Tuning

### Worker Count

In `/etc/rspamd/local.d/worker-normal.inc`:

```hcl
count = 4;  # Match CPU cores
```

### DNS Configuration

In `/etc/rspamd/local.d/options.inc`:

```hcl
dns {
  timeout = 1s;
  retransmits = 2;
  sockets = 16;
  nameserver = ["127.0.0.1"];
}
```

### Memory and Size Limits

In `/etc/rspamd/local.d/options.inc`:

```hcl
max_lua_urls = 1024;
max_urls = 10000;
max_recipients = 1024;
```

In `/etc/rspamd/local.d/worker-normal.inc`:

```hcl
task_timeout = 8s;
max_message_size = 50M;
```

## Security Hardening

### Web Interface Access

Keep controller bound to localhost. Use SSH tunnel for remote access.

### HTTPS (Optional)

In `/etc/rspamd/local.d/worker-controller.inc`:

```hcl
secure_ip = "127.0.0.1";
ssl_certificate = "/path/to/cert.pem";
ssl_certificate_key = "/path/to/key.pem";
```

### Rate Limiting

In `/etc/rspamd/local.d/ratelimit.conf`:

```hcl
rates {
  to = {
    bucket = {
      rate = "10 / 1m";
    }
  }
}
```

### Updates

```bash
sudo apt update && sudo apt upgrade rspamd  # Debian/Ubuntu
sudo dnf update rspamd                      # RHEL/Rocky
```

## Backup and Recovery

### Configuration Backup

```bash
sudo tar -czf rspamd-config-$(date +%F).tar.gz /etc/rspamd/local.d/ /etc/rspamd/override.d/
```

### Redis Data Backup

```bash
redis-cli SAVE
sudo cp /var/lib/redis/dump.rdb /backup/
```

### Restore

```bash
sudo tar -xzf rspamd-config-YYYY-MM-DD.tar.gz -C /
sudo systemctl restart rspamd
```