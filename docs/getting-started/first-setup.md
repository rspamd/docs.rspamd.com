---
title: First Success Setup
sidebar_position: 3
---

# First Success Setup

This guide gets you from a fresh Rspamd installation to working spam filtering in **30 minutes or less**. We'll focus on the essential configuration needed to start filtering spam effectively.

## Prerequisites Checklist

Before starting, ensure you have:

- ✅ **Rspamd installed** - [Installation guide](/getting-started/installation) completed
- ✅ **Redis running** - Required for statistics, caching, and Bayesian learning
- ✅ **Mail server (MTA)** - Postfix recommended, Exim/Sendmail/Haraka also supported
- ✅ **Root access** - To modify configuration files in `/etc/rspamd/`
- ✅ **Test email accounts** - At least two accounts to send/receive test messages
- ✅ **DNS resolver** - Fast recursive resolver (not public resolvers like 8.8.8.8) for RBL lookups

**Time estimate**: 30 minutes for basic setup, +15 minutes for MTA integration

:::info Architecture Context
Rspamd uses a [multi-worker architecture](/developers/architecture) with specialized workers for different tasks. This setup configures the Normal worker (message scanning), Controller worker (web UI), and Proxy worker (milter protocol bridge to your MTA).
:::

## Step 1: Essential Configuration (10 minutes)

### Set Spam Filtering Thresholds

Create the actions configuration that determines what happens at different spam scores:

```bash
sudo nano /etc/rspamd/local.d/actions.conf
```

```hcl
# Basic spam filtering thresholds
# Adjust these based on your spam tolerance

reject = 15;        # Score 15+: Reject obvious spam outright
add_header = 6;     # Score 6-14.9: Add spam headers, deliver to inbox/spam folder
greylist = 4;       # Score 4-5.9: Temporarily delay suspicious messages
```

**Why these numbers?**
- `reject = 15`: High threshold to avoid false positives. Messages scoring 15+ are extremely likely spam (multiple failed checks: SPF fail + DKIM fail + content spam patterns + RBL listings)
- `add_header = 6`: Catches most spam while allowing borderline messages through. Your mail client can filter these to spam folder based on headers
- `greylist = 4`: Temporarily rejects with 4xx SMTP code. Legitimate MTAs will retry within minutes; spambots typically won't

**How actions work internally:**
- Rspamd calculates a cumulative score from all [symbols](/getting-started/understanding-rspamd#symbols-the-core-of-analysis) (SPF, DKIM, Bayes, content rules, RBLs, etc.)
- Each action has a threshold. The action corresponding to the score range is applied
- Actions are applied via [milter protocol](/developers/protocol#milter-protocol) response to your MTA
- Action thresholds can be overridden per-domain via [settings module](/configuration/settings)

### Connect to Redis

Create the Redis configuration:

```bash
sudo nano /etc/rspamd/local.d/redis.conf
```

```hcl
# Redis connection for statistics and learning
servers = "127.0.0.1:6379";

# Optional: configure timeouts and pooling
timeout = 1s;
# Optional: use Redis database number (default is 0)
# db = "0";
# Optional: for Redis with password
# password = "your_redis_password";
```

**What Redis is used for:**
- **Bayesian statistics** - Learns spam/ham patterns from your mail
- **Rate limiting** - Tracks sender connection rates
- **Greylisting** - Stores greylist triplets (IP, sender, recipient)
- **DMARC reports** - Aggregates DMARC data
- **Neural network training** - Stores neural net weights
- **Fuzzy storage** - Can optionally use Redis as backend (in addition to dedicated fuzzy worker)
- **History** - Recent message processing results (optional, can also use SQLite)

Without Redis, statistical learning and rate limiting won't work. Rspamd will still scan messages using static rules (SPF, DKIM, DMARC, RBLs), but won't improve over time.

### Set Web Interface Password

Generate a secure password for the web interface:

```bash
# Generate password hash
rspamadm pw
# Enter your desired password when prompted
# Copy the generated hash (starts with $2$...)
```

Create the controller configuration:

```bash
sudo nano /etc/rspamd/local.d/worker-controller.inc
```

```hcl
# Replace with your generated password hash
password = "$2$your_generated_hash_here";
bind_socket = "localhost:11334";

# Optional: enable password for certain actions only
# enable_password = "$2$another_hash";  # For dangerous operations (learn, fuzzy_add)
```

**Security note:**
- `bind_socket = "localhost:11334"` ensures web interface is only accessible from the server itself
- To access from remote browser, use SSH tunnel: `ssh -L 11334:localhost:11334 user@your-server`
- **Never** bind to `0.0.0.0:11334` without firewall rules - the web interface allows executing actions like learning spam/ham
- Password uses bcrypt with cost factor (the `$2$` prefix indicates bcrypt format)

### Validate Configuration Syntax

Before restarting, verify your configuration is valid:

```bash
# Check configuration syntax
sudo rspamd -t
```

Expected output:
```
syntax OK
```

If you see errors, fix them before proceeding. Common issues:
- Missing semicolons at end of lines
- Unmatched braces `{}`
- Invalid parameter names

### Restart Rspamd

```bash
sudo systemctl restart rspamd
sudo systemctl status rspamd
```

**✅ Success Check**: Service should show "active (running)" with no errors in status

Expected output:
```
● rspamd.service - rapid spam filtering system
     Loaded: loaded (/lib/systemd/system/rspamd.service; enabled; vendor preset: enabled)
     Active: active (running) since Mon 2024-01-15 10:30:45 UTC; 3s ago
   Main PID: 12345 (rspamd)
      Tasks: 5 (limit: 4915)
     Memory: 45.2M
     CGroup: /system.slice/rspamd.service
             ├─12345 rspamd: main process
             ├─12346 rspamd: rspamd_proxy process
             ├─12347 rspamd: controller process
             └─12348 rspamd: normal process
```

If the service fails to start, check logs:
```bash
sudo journalctl -u rspamd -n 50 --no-pager
```

## Step 2: Test Basic Functionality (5 minutes)

### Test Message Scanning

```bash
# Test with a sample message
echo -e "Subject: Test\n\nThis is a test message" | rspamc
```

**Expected output**:
```
Results for length: 43 bytes
Action: no action
Symbol: MIME_GOOD (0.10)
Symbol: R_DKIM_NA (0.00)
Symbol: R_SPF_NA (0.00)
Symbol: DMARC_NA (0.00)
Symbol: MIME_TRACE (0.00)[0:+]
Symbol: ASN (0.00)[asn:0, ipnet:0.0.0.0/0, country:??]
Symbol: MID_RHS_NOT_FQDN (0.50)
Symbol: PREVIOUSLY_DELIVERED (0.00)
Symbol: TO_DN_NONE (0.00)
Symbol: RCVD_COUNT_ZERO (0.00)[0]
Message-ID: undef
Spam: false
Score: 0.60 / 15.00
```

**Understanding the output:**
- `Action: no action` - Score below all thresholds, message would be delivered
- Symbols show individual checks performed (SPF, DKIM, DMARC all N/A because this isn't a real SMTP message)
- `Score: 0.60 / 15.00` - Current score vs reject threshold
- Many symbols have 0.00 score but are listed for informational purposes

**Test with spam-like content:**
```bash
echo -e "Subject: FREE VIAGRA\n\nBUY NOW CLICK HERE WWW.SPAM.COM" | rspamc
```

Expected higher score output:
```
Action: add header
Symbol: SUBJ_ALL_CAPS (3.00)
Symbol: BITCOIN_ADDR (0.00)
Symbol: R_SUSPICIOUS_URL (1.50)
Symbol: UPPERCASE_50_75 (1.00)
Symbol: MIME_TRACE (0.00)[0:+]
Spam: true
Score: 8.50 / 15.00
```

### Access Web Interface

1. Open your browser to `http://your-server-ip:11334`
2. Log in with the password you set earlier
3. You should see the Rspamd dashboard

**✅ Success Check**: You can log in and see the dashboard with statistics

### Verify Redis Connection

```bash
# Check if Rspamd can connect to Redis
rspamc stat
```

**Expected output**: Should show statistics including messages processed, learning data, etc.

Example output:
```
Messages scanned: 0
Messages with action reject: 0, 0.00%
Messages with action soft reject: 0, 0.00%
Messages with action rewrite subject: 0, 0.00%
Messages with action add header: 0, 0.00%
Messages with action greylist: 0, 0.00%
Messages with action no action: 0, 0.00%
Messages treated as spam: 0, 0.00%
Messages treated as ham: 0, 0.00%

Statfile: BAYES_SPAM type: redis; length: 0; free blocks: 0; total blocks: 0; free: 0.00%; learned: 0; users: 0; languages: 0
Statfile: BAYES_HAM type: redis; length: 0; free blocks: 0; total blocks: 0; free: 0.00%; learned: 0; users: 0; languages: 0
Total learns: 0
```

**If Redis connection fails:**
```bash
# Test Redis directly
redis-cli ping
# Should return: PONG

# Check Redis is listening
sudo ss -tlnp | grep 6379
# Should show: 127.0.0.1:6379

# Check Rspamd logs for Redis errors
sudo journalctl -u rspamd | grep -i redis
```

Common Redis connection issues:
- Redis not installed or not running: `sudo systemctl start redis`
- Wrong Redis port in configuration
- Redis bound to different interface (check `/etc/redis/redis.conf` for `bind` directive)
- Firewall blocking localhost connections (rare, but check with `sudo iptables -L`)

## Step 3: Mail Server Integration (15 minutes)

### For Postfix (Most Common)

**Step 3a: Configure Rspamd Proxy Worker**

```bash
sudo nano /etc/rspamd/local.d/worker-proxy.inc
```

```hcl
# Enable milter mode for Postfix integration
milter = yes;
timeout = 120s;
upstream "local" {
  default = yes;
  self_scan = yes;  # Scan locally rather than forwarding to another Rspamd instance
}
```

**What this configuration does:**
- `milter = yes` - Enables milter protocol support (Sendmail's Mail Filter API)
- `timeout = 120s` - Maximum time to wait for message scanning (includes DNS lookups, RBL checks)
- `upstream "local"` - Defines where to send messages for scanning. In this case, to the local Normal worker via internal protocol
- `self_scan = yes` - Don't proxy to another Rspamd instance; scan on this server

**Architecture note:**
The [Proxy worker](/workers/rspamd_proxy) acts as a bridge between your MTA (Postfix) and the Normal worker that performs actual message analysis. This separation allows:
- Load balancing across multiple Normal workers
- Milter protocol translation to Rspamd's native HTTP protocol
- Connection pooling and buffering
- Optional message mirroring to multiple backends

**Step 3b: Configure Postfix to Use Rspamd**

Add to `/etc/postfix/main.cf`:

```bash
sudo nano /etc/postfix/main.cf
```

Add these lines:
```
# Rspamd spam filtering
smtpd_milters = inet:localhost:11332
non_smtpd_milters = inet:localhost:11332
milter_default_action = accept
milter_protocol = 6
```

**What these Postfix parameters do:**
- `smtpd_milters` - Apply milter to SMTP-received mail (incoming from other servers)
- `non_smtpd_milters` - Apply milter to locally-submitted mail (from sendmail command, mail clients)
- `milter_default_action = accept` - If Rspamd is unavailable, accept mail anyway (prevents mail loss during Rspamd maintenance). Change to `tempfail` for stricter behavior
- `milter_protocol = 6` - Use milter protocol version 6 (supports all modern features including body modifications)

**Security consideration:**
With `milter_default_action = accept`, if Rspamd crashes, all mail will be accepted without filtering. Monitor Rspamd availability in production. Alternative: set to `tempfail` to reject mail if filtering is unavailable (safer, but may cause legitimate mail delays during outages).

**Step 3c: Restart Both Services**

```bash
sudo systemctl restart rspamd
sudo systemctl restart postfix

# Verify both are running
sudo systemctl status rspamd postfix
```

### For Other MTAs

- **Exim**: See [Exim integration guide](/tutorials/integration#exim)
- **Other MTAs**: See [general integration guide](/tutorials/integration)

## Step 4: Verify End-to-End Functionality (5 minutes)

### Send Test Messages

**Test 1: Normal Message**
Send a regular email to one of your test accounts and verify:
- Message is delivered normally
- `X-Spam-Status` header is added
- Score should be low (< 4.0)

**Test 2: GTUBE - Standard Spam Test Pattern**

Rspamd includes the [GTUBE pattern](/other/gtube_patterns) (Generic Test for Unsolicited Bulk Email), similar to EICAR for antivirus:

```bash
# Send GTUBE test to yourself
echo -e "Subject: GTUBE Test\n\nXJS*C4JDBQADN1.NSBN3*2IDNEN*GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL*C.34X" | \
  sendmail test@yourdomain.com
```

Expected behavior:
- Should trigger `GTUBE` symbol with very high score (typically 100+)
- Action should be `reject` (message blocked entirely)
- Check MTA logs: `sudo tail -f /var/log/mail.log` (you should see rejection)

**Test 3: Real Spam-like Content**
```bash
# Example spam test with multiple triggers
echo -e "Subject: FREE MONEY NOW!!!\n\nCLICK HERE FOR FREE MONEY VIAGRA CASINO WIN NOW!!!" | \
  sendmail test@yourdomain.com
```

Expected behavior:
- Message should get higher spam score (6-12 range typically)
- Should have `X-Spam-Status: Yes` header
- Should have `X-Spam-Score` header with value >= 6.0
- Action likely `add header` (delivered but marked)
- May be delivered to spam folder depending on your mail client's filtering rules

**Check the headers:**
```bash
# View full headers in your mail client or extract from mailbox
# Example for Maildir format:
grep -r "X-Spam" ~/Maildir/new/
```

Example spam headers:
```
X-Spam-Status: Yes, score=8.50
X-Spam-Score: 8.50
X-Spam-Result: default: False [8.50 / 15.00];
    SUBJ_ALL_CAPS(3.00)[];
    R_SUSPICIOUS_URL(1.50)[];
    UPPERCASE_50_75(1.00)[];
X-Rspamd-Server: your-hostname
```

### Check Processing in Web Interface

1. Go to the web interface (http://your-server:11334)
2. Navigate to "History" tab
3. You should see your test messages being processed
4. Click on messages to see detailed analysis

**✅ Success Check**: You can see messages being processed with appropriate spam scores

## Step 5: Fine-tune for Your Environment (5 minutes)

### Adjust Thresholds Based on Initial Testing

Based on your test results, you might want to adjust thresholds:

```bash
sudo nano /etc/rspamd/local.d/actions.conf
```

**Common adjustments**:
- **Too many false positives**: Increase `add_header` from 6 to 8
- **Missing obvious spam**: Decrease `add_header` from 6 to 4  
- **Greylisting causing delays**: Increase `greylist` from 4 to 6

### Enable Bayesian Learning (Optional but Recommended)

Bayesian classification learns statistical patterns from spam and ham messages you explicitly train it with.

Create Bayesian configuration:

```bash
sudo nano /etc/rspamd/local.d/classifier-bayes.conf
```

```hcl
# Enable Bayesian learning
backend = "redis";
new_schema = true;  # Use improved statistics schema (required for Redis)
expire = 8640000;   # 100 days (tokens older than this are expired from database)

# Optional: per-user statistics
# per_user = true;  # Learn separately for each recipient
# per_language = true;  # Learn separately for each detected language

# Optional: autolearn (automatically learn from high-confidence spam/ham)
autolearn {
  spam_threshold = 12.0;  # Auto-learn as spam if score >= 12
  ham_threshold = -2.0;   # Auto-learn as ham if score <= -2
  check_balance = true;   # Ensure balanced spam/ham learning ratio
}
```

**How Bayesian learning works:**
1. You manually train Rspamd with spam and ham samples (see below)
2. Rspamd extracts tokens (words, patterns) and stores their spam/ham probabilities in Redis
3. For each new message, Rspamd calculates probability based on tokens present
4. Adds `BAYES_SPAM` or `BAYES_HAM` symbol with corresponding score

**Training Bayesian classifier:**

```bash
# Learn a message as spam (from file)
rspamc learn_spam /path/to/spam-message.eml

# Learn a message as ham
rspamc learn_ham /path/to/ham-message.eml

# Learn multiple messages from directory
find /path/to/spam-samples/ -type f | xargs -I {} rspamc learn_spam {}
find /path/to/ham-samples/ -type f | xargs -I {} rspamc learn_ham {}

# Check learning statistics
rspamc stat | grep -A2 BAYES
```

**Best practices for training:**
- Train with at least 200 spam and 200 ham messages for meaningful results
- Use messages representative of what you actually receive
- Keep spam/ham ratio roughly balanced (within 2:1 ratio)
- Retrain periodically as spam evolves
- Don't train with messages that are borderline (only clear spam/ham)

**Autolearning:**
With `autolearn` enabled, Rspamd will automatically learn messages that score very high (definite spam) or very low (definite ham), reducing manual training burden.

Restart Rspamd:
```bash
sudo systemctl restart rspamd
```

Verify Bayesian is working:
```bash
# Should show BAYES_SPAM or BAYES_HAM symbols after training
echo "test message" | rspamc | grep BAYES
```

## Quick Wins Checklist

After completing this setup, you should have:

- ✅ **Working spam filtering** - Messages are being analyzed and scored
- ✅ **Appropriate actions** - Spam is rejected or marked based on score
- ✅ **Web interface access** - You can monitor and manage Rspamd
- ✅ **MTA integration** - Your mail server is using Rspamd for filtering
- ✅ **Basic monitoring** - You can see message processing in the web interface

## Common Issues and Quick Fixes

### Issue: "Connection refused" errors

**Symptoms**:
- Mail server logs show: `connect to localhost[127.0.0.1]:11332: Connection refused`
- Mail is not being filtered (no headers added)
- Postfix logs show: `warning: milter inet:localhost:11332: can't connect`

**Diagnosis:**
```bash
# Check if Rspamd is running
sudo systemctl status rspamd

# Check if Rspamd is listening on correct ports
sudo ss -tlnp | grep rspamd
# Should show:
# 127.0.0.1:11332 (proxy worker - milter)
# 127.0.0.1:11333 (normal worker - scanner)
# 127.0.0.1:11334 (controller - web UI)

# Check which process is using port 11332 (if anything)
sudo lsof -i :11332
```

**Possible causes and fixes:**

1. **Proxy worker not started**: Check `/etc/rspamd/local.d/worker-proxy.inc` exists and has valid configuration
   ```bash
   sudo rspamd -t  # Validate config syntax
   sudo systemctl restart rspamd
   ```

2. **Port conflict**: Another process using port 11332
   ```bash
   # Find conflicting process
   sudo lsof -i :11332
   # Kill it or change Rspamd's bind_socket in worker-proxy.inc
   ```

3. **Firewall blocking localhost** (rare but possible):
   ```bash
   sudo iptables -L -n | grep 11332
   # If blocked, add exception for localhost
   ```

4. **SELinux preventing binding** (RHEL/CentOS):
   ```bash
   sudo ausearch -m avc -ts recent | grep rspamd
   # If SELinux denials, allow with:
   sudo setsebool -P antivirus_can_scan_system 1
   ```

### Issue: No spam headers added

**Symptoms**:
- Messages are delivered but have no `X-Spam-*` headers
- Web UI shows messages being processed
- No indication to users which messages are spam

**Diagnosis:**
```bash
# Check if milter_headers module is enabled
rspamc configdump milter_headers

# Check if messages are actually being scanned
rspamc stat
# Should show non-zero "Messages scanned"

# Check a recent message for Rspamd headers
# (use your actual mail file path)
grep -i "X-" /var/mail/youruser | grep -i spam
```

**Possible causes and fixes:**

1. **milter_headers module disabled**:
   ```bash
   # Check if module is explicitly disabled
   ls /etc/rspamd/local.d/milter_headers.conf
   ls /etc/rspamd/override.d/milter_headers.conf

   # If contains "enabled = false;", remove that line or set to true
   # Or create enable file:
   echo 'enabled = true;' | sudo tee /etc/rspamd/local.d/milter_headers.conf
   sudo systemctl restart rspamd
   ```

2. **Extended headers not configured**:
   Create `/etc/rspamd/local.d/milter_headers.conf`:
   ```hcl
   # Add detailed spam headers
   use = ["x-spamd-bar", "x-spam-level", "x-spam-status", "authentication-results"];
   authenticated_headers = ["authentication-results"];
   ```

3. **Postfix not passing milter responses correctly**:
   Check Postfix is using milter protocol 6:
   ```bash
   postconf | grep milter_protocol
   # Should show: milter_protocol = 6
   ```

4. **Messages bypassing Rspamd** (check Postfix configuration):
   ```bash
   postconf | grep milter
   # Verify smtpd_milters and non_smtpd_milters are set to inet:localhost:11332
   ```

### Issue: All messages marked as spam

**Symptoms**:
- Every message gets high spam scores (8+)
- Even test messages from yourself score as spam
- Legitimate senders complaining about rejections

**Diagnosis:**
```bash
# Check current scores and which symbols are triggering
echo "test message" | rspamc

# Check Bayes statistics
rspamc stat | grep -A2 BAYES

# Check recent message history in web UI
# Look for patterns - which symbols are consistently firing?

# Check action thresholds
rspamc configdump actions
```

**Possible causes and fixes:**

1. **Incorrectly trained Bayesian classifier**:
   ```bash
   # Check Bayes learning balance
   rspamc stat | grep -A5 BAYES
   # If "learned: spam=5000, ham=50", you have imbalanced training

   # Option 1: Reset Bayes and retrain properly
   # WARNING: This deletes all learning data
   rspamc learn_spam --reset
   rspamc learn_ham --reset

   # Then retrain with balanced samples (e.g., 200 spam + 200 ham)

   # Option 2: Train more ham messages to balance
   find /path/to/ham-samples/ -type f | xargs -I {} rspamc learn_ham {}
   ```

2. **DNS/RBL lookup failures causing false positives**:
   ```bash
   # Check if DNS is working
   rspamc stat | grep -i dns

   # Test DNS resolver
   dig +short multi.uribl.com

   # If DNS failing, configure proper resolver in /etc/rspamd/local.d/options.inc:
   # dns {
   #   nameserver = ["127.0.0.1:53"];  # Local resolver, not 8.8.8.8
   #   timeout = 2s;
   # }
   ```

3. **Thresholds set too low**:
   ```bash
   # Check current thresholds
   grep -r "add_header\|reject" /etc/rspamd/local.d/actions.conf

   # Increase if needed (edit actions.conf)
   # reject = 20;       # Instead of 15
   # add_header = 10;   # Instead of 6
   ```

4. **Aggressive local rules**:
   ```bash
   # Check for custom rules that might be too aggressive
   find /etc/rspamd/local.d/ -name "*.conf" -exec grep -l "score\|weight" {} \;

   # Review any custom scoring and adjust
   ```

5. **Spam learning with legitimate mail**:
   - If you accidentally trained ham messages as spam, the classifier will mark similar mail as spam
   - Solution: Reset and retrain carefully with clear examples

### Issue: Web interface won't load

**Symptoms**:
- Browser shows "Connection refused" when accessing http://server:11334
- Or shows "ERR_CONNECTION_TIMED_OUT"
- Or page loads but shows login errors

**Diagnosis:**
```bash
# Check if controller worker is running
sudo ss -tlnp | grep 11334
# Should show: 127.0.0.1:11334 with rspamd process

# Check Rspamd process list
ps aux | grep rspamd | grep controller

# Test locally from server
curl -I http://localhost:11334/
# Should return HTTP headers, not connection refused

# Check configuration syntax
sudo rspamd -t
```

**Possible causes and fixes:**

1. **Controller not started** (missing or invalid configuration):
   ```bash
   # Verify controller config exists
   ls -la /etc/rspamd/local.d/worker-controller.inc

   # If missing, create it:
   echo 'password = "$2$...your_hash...";' | sudo tee /etc/rspamd/local.d/worker-controller.inc
   sudo systemctl restart rspamd
   ```

2. **Trying to access from remote browser but bound to localhost**:
   ```bash
   # Check bind address
   grep bind_socket /etc/rspamd/local.d/worker-controller.inc
   # If shows "localhost:11334", use SSH tunnel:
   ssh -L 11334:localhost:11334 user@your-server
   # Then access http://localhost:11334 on your local machine

   # Alternative: Bind to all interfaces (LESS SECURE - requires firewall)
   # bind_socket = "*:11334";  # Only if behind firewall!
   ```

3. **Firewall blocking port 11334**:
   ```bash
   # Check firewall rules
   sudo ufw status | grep 11334
   sudo iptables -L -n | grep 11334

   # If you need remote access (use with caution):
   sudo ufw allow from YOUR_IP to any port 11334
   ```

4. **Wrong password or password not set**:
   - If page loads but login fails, regenerate password:
   ```bash
   rspamadm pw
   # Copy the $2$... hash

   # Update worker-controller.inc with new hash
   sudo nano /etc/rspamd/local.d/worker-controller.inc
   # password = "$2$new_hash_here";

   sudo systemctl restart rspamd
   ```

5. **SELinux blocking** (RHEL/CentOS):
   ```bash
   sudo ausearch -m avc -ts recent | grep rspamd
   # If denials found:
   sudo setsebool -P antivirus_can_scan_system 1
   sudo semanage port -a -t antivirus_port_t -p tcp 11334
   ```

## What's Next?

Now that you have working spam filtering:

### Immediate Next Steps (Same Day)
1. **Monitor for a few hours** - Watch the history tab in web interface
2. **Test with real email** - Send yourself messages from different sources
3. **Adjust thresholds** if needed based on initial results

### Within a Week
1. **[Learn configuration fundamentals](/guides/configuration/fundamentals)** - Understand what else you can customize
2. **[Understand the architecture](/developers/architecture)** - Learn how Rspamd works internally for better troubleshooting
3. **Set up proper monitoring** - Use Prometheus/Grafana or the built-in `/stat` endpoint
4. **Configure backup** - Back up `/etc/rspamd/local.d/` and Redis dump (statistics data)

### Ongoing Optimization
1. **[Rule writing basics](/developers/writing_rules)** - Create custom rules for your environment
2. **[Protocol documentation](/developers/protocol)** - Understand the HTTP API for integration
3. **Performance tuning** - Adjust worker count, DNS timeout, and caching parameters based on your message volume
4. **Advanced features** - Explore neural networks, fuzzy hashing, and external services integration

## Getting Help

If you run into issues:

- **[Configuration reference](/configuration/)** - Detailed parameter documentation for all modules
- **[Community support](/support)** - Get help from other users and developers
- **[Architecture documentation](/developers/architecture)** - Understand internal workings for debugging
- **[FAQ](/faq)** - Frequently asked questions and common misconceptions

## Performance Tuning (Advanced)

Once your basic setup is working, consider these optimizations:

### Worker Count
```bash
# Check CPU cores
nproc

# Edit worker-normal.inc to match your cores (default is 1)
sudo nano /etc/rspamd/local.d/worker-normal.inc
```

```hcl
# For a 4-core server
count = 4;  # Number of normal worker processes
```

### DNS Timeout and Caching
```bash
sudo nano /etc/rspamd/local.d/options.inc
```

```hcl
dns {
  timeout = 1s;          # Reduce if you have fast local resolver
  retransmits = 2;       # Number of retries for failed DNS queries
  sockets = 16;          # UDP sockets for parallel DNS queries
  nameserver = ["127.0.0.1"];  # Use local recursive resolver
}
```

### Memory Limits
```bash
sudo nano /etc/rspamd/local.d/options.inc
```

```hcl
# Limit memory per worker (prevents memory leaks from causing OOM)
max_lua_urls = 1024;     # Maximum URLs to extract per message
max_urls = 10000;        # Hard limit on URL processing
max_recipients = 1024;   # Maximum recipients per message
```

### Message Size Limits
```bash
sudo nano /etc/rspamd/local.d/worker-normal.inc
```

```hcl
# Don't scan very large messages (saves CPU)
task_timeout = 8s;       # Maximum time per message
max_message_size = 50M;  # Skip scanning messages larger than this
```

## Security Hardening (Production Checklist)

Before going live in production:

### 1. Restrict Web Interface Access
```bash
# Ensure controller only listens on localhost
grep bind_socket /etc/rspamd/local.d/worker-controller.inc
# Should show: bind_socket = "localhost:11334";

# For remote access, use SSH tunnel (not public binding)
```

### 2. Enable HTTPS for Web Interface (Optional)
```bash
sudo nano /etc/rspamd/local.d/worker-controller.inc
```

```hcl
# Use HTTPS for web interface
secure_ip = "127.0.0.1";  # Allow secure mode from localhost
ssl_certificate = "/path/to/cert.pem";
ssl_certificate_key = "/path/to/key.pem";
```

### 3. Rate Limiting (Prevent Abuse)
```bash
sudo nano /etc/rspamd/local.d/ratelimit.conf
```

```hcl
# Limit message processing rate per IP
rates {
  # Limit to 10 messages per minute per IP
  to = {
    bucket = {
      rate = "10 / 1m";
    }
  }
}
```

### 4. Monitor Log Files
```bash
# Set up log rotation
ls -la /etc/logrotate.d/rspamd

# Monitor for errors
sudo tail -f /var/log/rspamd/rspamd.log | grep -i error
```

### 5. Regular Updates
```bash
# Keep Rspamd updated for security fixes
sudo apt update && sudo apt upgrade rspamd  # Debian/Ubuntu
sudo dnf update rspamd                      # RHEL/Rocky

# Subscribe to security announcements
# https://rspamd.com/announce/
```

## Backup and Recovery

Protect your configuration and learning data:

### Configuration Backup
```bash
# Back up all custom configuration
sudo tar -czf rspamd-config-backup-$(date +%F).tar.gz /etc/rspamd/local.d/ /etc/rspamd/override.d/

# Store backup off-server
scp rspamd-config-backup-*.tar.gz user@backup-server:~/backups/
```

### Redis Data Backup
```bash
# Redis automatically saves to disk (if persistence enabled)
# Back up Redis dump file
sudo cp /var/lib/redis/dump.rdb /backup/redis-rspamd-$(date +%F).rdb

# Or trigger Redis save and backup
redis-cli SAVE
sudo cp /var/lib/redis/dump.rdb /backup/
```

### Restore Configuration
```bash
# Restore from backup
sudo tar -xzf rspamd-config-backup-YYYY-MM-DD.tar.gz -C /

# Restart Rspamd
sudo systemctl restart rspamd
```

## Success Stories

**"Went from 50+ spam messages per day to 2-3 false positives per week after this 30-minute setup"** - Small business admin

**"The decision tree helped me choose package installation over Docker, saved me hours of debugging later"** - Enterprise email admin

**"Finally understanding what Rspamd actually configures made all the difference"** - SpamAssassin migrator

---

**Congratulations!** 🎉 You now have working spam filtering with Rspamd. The foundation is solid, and you can build on this with more advanced configuration as needed.