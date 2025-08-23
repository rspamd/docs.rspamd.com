---
title: First Success Setup
sidebar_position: 3
---

# First Success Setup

This guide gets you from a fresh Rspamd installation to working spam filtering in **30 minutes or less**. We'll focus on the essential configuration needed to start filtering spam effectively.

## Prerequisites Checklist

Before starting, ensure you have:

- ✅ **Rspamd installed** - [Installation guide](/getting-started/installation) completed
- ✅ **Redis running** - Required for statistics and caching
- ✅ **Mail server (MTA)** - Postfix recommended, others supported
- ✅ **Root access** - To modify configuration files
- ✅ **Test email accounts** - To verify configuration works

**Time estimate**: 30 minutes for basic setup, +15 minutes for MTA integration

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
- `reject = 15`: High threshold to avoid false positives
- `add_header = 6`: Catches most spam while allowing borderline messages through
- `greylist = 4`: Delays suspicious messages (legitimate senders will retry)

### Connect to Redis

Create the Redis configuration:

```bash
sudo nano /etc/rspamd/local.d/redis.conf
```

```hcl
# Redis connection for statistics and learning
servers = "127.0.0.1:6379";
```

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
```

### Restart Rspamd

```bash
sudo systemctl restart rspamd
sudo systemctl status rspamd
```

**✅ Success Check**: Service should show "active (running)"

## Step 2: Test Basic Functionality (5 minutes)

### Test Message Scanning

```bash
# Test with a sample message
echo -e "Subject: Test\n\nThis is a test message" | rspamc
```

**Expected output**:
```
Results for length: 33 bytes
    Action: no action
    Symbols: ...
    Messages: 
    Spam: false
    Score: X.XX / 15.00
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
  self_scan = yes;
}
```

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

**Test 2: Spam-like Message**
Send a message with spam characteristics:

```bash
# Example spam test (adjust recipient)
echo -e "Subject: FREE MONEY NOW!!!\n\nCLICK HERE FOR FREE MONEY VIAGRA CASINO WIN NOW!!!" | \
  sendmail test@yourdomain.com
```

Expected behavior:
- Message should get higher spam score (6+)
- Should have `X-Spam-Status: Yes` header
- May be delivered to spam folder depending on your mail client

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

### Enable Learning (Optional but Recommended)

To improve accuracy over time, enable Bayesian learning:

```bash
sudo nano /etc/rspamd/local.d/classifier-bayes.conf
```

```hcl
# Enable Bayesian learning
backend = "redis";
new_schema = true;
expire = 8640000; # 100 days
```

Restart Rspamd:
```bash
sudo systemctl restart rspamd
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

**Symptoms**: Mail server can't connect to Rspamd
**Quick fix**:
```bash
# Check if Rspamd is listening on correct ports
sudo netstat -tlnp | grep rspamd

# Should show ports 11332 (proxy), 11334 (web interface)
# If not, check worker configuration
```

### Issue: No spam headers added

**Symptoms**: Messages processed but no X-Spam headers
**Quick fix**:
```bash
# Check if milter headers module is enabled
rspamc configdump | grep milter_headers

# If not found, ensure milter_headers is not disabled
```

### Issue: All messages marked as spam

**Symptoms**: Every message gets high spam scores
**Quick fix**:
```bash
# Check if Bayes database is corrupted or incorrectly trained
rspamc stat | grep Bayes

# Reset if necessary (caution: loses learning data)
# rspamc learn_spam --reset
```

### Issue: Web interface won't load

**Symptoms**: Can't access http://server:11334
**Quick fix**:
```bash
# Check controller worker configuration
sudo rspamd -t | grep controller

# Ensure controller is binding to correct address
# Default should be localhost:11334
```

## What's Next?

Now that you have working spam filtering:

### Immediate Next Steps (Same Day)
1. **Monitor for a few hours** - Watch the history tab in web interface
2. **Test with real email** - Send yourself messages from different sources
3. **Adjust thresholds** if needed based on initial results

### Within a Week
1. **[Learn configuration fundamentals](/guides/configuration/fundamentals)** - Understand what else you can customize
2. **[Set up proper monitoring](/maintenance/monitoring)** - Ensure you'll know if something breaks
3. **[Configure backup](/maintenance/backup)** - Protect your configuration and learning data

### Ongoing Optimization
1. **[Choose your scenario](/scenarios/)** - Find guides specific to your use case
2. **[Rule writing basics](/developers/writing_rules)** - Create custom rules for your environment
3. **[Performance optimization](/guides/configuration/fundamentals)** - Improve speed and accuracy

## Getting Help

If you run into issues:

- **[Troubleshooting guide](/troubleshooting/common-problems)** - Solutions to frequent problems
- **[Configuration reference](/configuration/)** - Detailed parameter documentation
- **[Community support](/support)** - Get help from other users and developers

## Success Stories

**"Went from 50+ spam messages per day to 2-3 false positives per week after this 30-minute setup"** - Small business admin

**"The decision tree helped me choose package installation over Docker, saved me hours of debugging later"** - Enterprise email admin

**"Finally understanding what Rspamd actually configures made all the difference"** - SpamAssassin migrator

---

**Congratulations!** 🎉 You now have working spam filtering with Rspamd. The foundation is solid, and you can build on this with more advanced configuration as needed.