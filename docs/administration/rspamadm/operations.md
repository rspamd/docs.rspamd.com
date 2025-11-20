---
title: Operations & Monitoring
---

# Operations & Monitoring

These commands provide operational capabilities for monitoring, log analysis, and managing running Rspamd instances.

## grep

Search and collate Rspamd logs by pattern.

### Purpose

Search logs for specific patterns and display complete related log entries. Unlike regular grep, this understands Rspamd's log format and groups entries by task ID.

### Common Scenarios

#### Search by String

```bash
# Case-insensitive string search
rspamadm grep -s "DMARC_POLICY_REJECT" /var/log/rspamd/rspamd.log

# Case-sensitive search
rspamadm grep -s "DMARC_POLICY_REJECT" -S /var/log/rspamd/rspamd.log

# Search across multiple log files
rspamadm grep -s "spf fail" -i /var/log/rspamd/rspamd.log -i /var/log/rspamd/rspamd.log.1
```

#### Search by Regular Expression

```bash
# Regex pattern search
rspamadm grep -p "BAYES_[HS]" /var/log/rspamd/rspamd.log

# Find failed authentications
rspamadm grep -p "authentication.*failed" /var/log/rspamd/rspamd.log

# Find high-scored messages
rspamadm grep -p "score=\d{2,}" /var/log/rspamd/rspamd.log
```

#### Lua Patterns

```bash
# Use Lua pattern matching
rspamadm grep -l -s "score=[%d]+%." /var/log/rspamd/rspamd.log
```

#### Read from stdin

```bash
# Pipe logs to grep
zcat /var/log/rspamd/rspamd.log.gz | rspamadm grep -s "quarantine"

# Search recent logs
journalctl -u rspamd -n 1000 | rspamadm grep -s "VIRUS_FOUND"
```

#### Include Orphaned Logs

```bash
# Show logs without task ID
rspamadm grep -s "error" -o /var/log/rspamd/rspamd.log

# Show partial log groups
rspamadm grep -s "timeout" -P /var/log/rspamd/rspamd.log
```

### Options

```
-s, --string <str>          Plain string search (case-insensitive)
-l, --lua                   Use Lua patterns in string search
-p, --pattern <regex>       Regular expression pattern
-i, --input <file>          Input file (can be specified multiple times)
-S, --sensitive             Enable case-sensitivity
-o, --orphans               Print orphaned logs (no task ID)
-P, --partial               Print partial log groups
```

### Important Note

The `log_re_cache` option must be set to `true` (default) in logging configuration for `grep` to work correctly.

### Use Cases

#### Debug Specific Message

```bash
# Find by Message-ID
rspamadm grep -s "Message-ID: <specific-id@example.com>" \
  /var/log/rspamd/rspamd.log
```

Output shows all log lines related to that message processing.

#### Find False Positives

```bash
# Find legitimate mail marked as spam
rspamadm grep -p "score=[2-9]\d\." /var/log/rspamd/rspamd.log | \
  grep -A5 "from=<known-sender@"
```

#### Monitor Specific Domain

```bash
# Track all mail from domain
rspamadm grep -s "@example.com" /var/log/rspamd/rspamd.log.* | less
```

#### Track Symbol Occurrences

```bash
# Find when specific symbol triggered
rspamadm grep -s "SUSPICIOUS_SYMBOL" /var/log/rspamd/rspamd.log | \
  grep -o "score=[0-9.]*" | sort | uniq -c
```

---

## control

Send control commands to running Rspamd instance.

### Purpose

Communicate with Rspamd's control socket to query statistics, trigger reloads, and manage runtime operations.

### Prerequisites

- Must run as root or rspamd user
- Control worker must be enabled in configuration

### Common Scenarios

#### View Statistics

```bash
# Get worker statistics
rspamadm control stat

# JSON output
rspamadm control stat -j

# Compact JSON
rspamadm control stat -j -c
```

Shows:
- Messages scanned
- Messages learned
- Connections
- Control connections
- Uptime

#### Fuzzy Storage Statistics

```bash
# Show fuzzy hashes statistics
rspamadm control fuzzystat

# Detailed output
rspamadm control fuzzystat -j | jq '.'
```

#### Sync Fuzzy Database

```bash
# Force immediate sync to disk
rspamadm control fuzzysync
```

Use before backup or maintenance.

#### Reload Configuration

```bash
# Reload workers' dynamic data
rspamadm control reload
```

Reloads:
- Maps
- Dynamic configuration
- Statistics

Does NOT reload:
- Core configuration (requires restart)
- Lua modules

#### Recompile Hyperscan

```bash
# Recompile hyperscan regexes
rspamadm control recompile
```

Use after updating regex rules or on new CPU architecture.

#### Reresolve DNS

```bash
# Reresolve upstream servers
rspamadm control reresolve
```

Forces DNS resolution of upstream servers (Redis, Clickhouse, etc.).

### Options

```
-j, --json              JSON output
-c, --compact           Compact format
-u, --ucl               UCL output (default)
-s, --socket <path>     Control socket path
-t, --timeout <sec>     I/O timeout (default: 1s)
```

### Available Commands

| Command | Purpose |
|---------|---------|
| `stat` | Worker statistics |
| `fuzzystat` | Fuzzy storage statistics |
| `fuzzysync` | Sync fuzzy database to disk |
| `reload` | Reload dynamic data |
| `recompile` | Recompile hyperscan regexes |
| `reresolve` | Reresolve upstream DNS |

### Use Cases

#### Pre-Backup Routine

```bash
#!/bin/bash
# Ensure data is synced before backup

echo "Syncing fuzzy database..."
rspamadm control fuzzysync

echo "Waiting for sync..."
sleep 2

echo "Creating backup..."
tar czf rspamd-backup-$(date +%Y%m%d).tar.gz /var/lib/rspamd/
```

#### Health Check Script

```bash
#!/bin/bash
# Check Rspamd health

STATS=$(rspamadm control stat -j 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "ERROR: Cannot connect to Rspamd control socket"
  exit 1
fi

# Extract metrics
SCANNED=$(echo "$STATS" | jq '.scanned')
LEARNED=$(echo "$STATS" | jq '.learned')

echo "Messages scanned: $SCANNED"
echo "Messages learned: $LEARNED"

# Check if processing messages
if [ "$SCANNED" -eq 0 ]; then
  echo "WARNING: No messages processed"
fi
```

---

## fuzzy_ping

Test fuzzy storage connectivity.

### Purpose

Ping fuzzy storage servers to verify connectivity and measure latency.

### Common Scenarios

#### Basic Ping

```bash
# Ping default fuzzy storage
rspamadm fuzzy_ping

# Ping specific storage
rspamadm fuzzy_ping -r local-fuzzy
```

#### List Configured Storages

```bash
# List all configured fuzzy storages
rspamadm fuzzy_ping -l
```

#### Flood Test

```bash
# Stress test fuzzy storage
rspamadm fuzzy_ping -f -n 1000

# Silent mode (statistics only)
rspamadm fuzzy_ping -f -S -n 10000
```

#### Custom Server

```bash
# Ping specific server
rspamadm fuzzy_ping -s fuzzy.example.com:11335
```

### Options

```
-r, --rule <name>           Fuzzy rule name
-f, --flood                 Flood mode (no wait)
-S, --silent                Silent mode (stats only)
-t, --timeout <sec>         Request timeout
-s, --server <addr>         Override server address
-n, --number <N>           Number of pings
-l, --list                  List configured storages
```

### Use Cases

#### Verify Fuzzy Setup

```bash
# Test all configured storages
for storage in $(rspamadm fuzzy_ping -l); do
  echo "Testing $storage..."
  rspamadm fuzzy_ping -r "$storage"
done
```

#### Measure Latency

```bash
# Benchmark fuzzy storage
rspamadm fuzzy_ping -n 100 | tail -1
```

---

## ratelimit

Manage rate limit buckets.

### Purpose

Track, modify, and unblock rate limit buckets in Redis.

### Common Scenarios

#### Track Top Offenders

```bash
# Show last triggered limit
rspamadm ratelimit track

# Show top 10 limits
rspamadm ratelimit track -q 10
```

Output shows:
- Bucket prefix
- Last update time
- Current burst
- Rate limits
- Dynamic values

#### Upgrade Bucket Limits

```bash
# Increase rate for specific bucket
rspamadm ratelimit upgrade "user:john@example.com" \
  --rate 100 --burst 200

# Set symbol
rspamadm ratelimit upgrade "ip:192.0.2.50" \
  --symbol "RATELIMIT_UPDATE"
```

#### Unblock Buckets

```bash
# Unblock specific sender
rspamadm ratelimit unblock "user:sender@example.com"

# Unblock top N rate-limited buckets
rspamadm ratelimit unblock 5
```

### Options

```
-c, --config <cfg>          Config file
-q, --quantity <N>         Number of limits to show/unblock

upgrade options:
-b, --burst <N>            Set burst
-r, --rate <N>             Set rate
-s, --symbol <name>        Set symbol
-B, --dynamic_burst <N>    Set dynamic burst
-R, --dynamic_rate <N>     Set dynamic rate
```

### Use Cases

#### Whitelist Legitimate Sender

```bash
# Give high limits to known sender
rspamadm ratelimit upgrade "user:newsletter@example.com" \
  --rate 1000 \
  --burst 2000 \
  --dynamic_rate 500
```

#### Emergency Unblock

```bash
#!/bin/bash
# Unblock all rate-limited senders

COUNT=$(rspamadm ratelimit track -q 100 | wc -l)

echo "Unblocking $COUNT rate-limited senders..."
rspamadm ratelimit unblock "$COUNT"
```

---

## dmarc_report

Send DMARC aggregate reports.

### Purpose

Process DMARC data and send aggregate reports to domain owners.

### Common Scenarios

#### Send Today's Reports

```bash
# Process and send reports for today
rspamadm dmarc_report
```

#### Send Reports for Specific Date

```bash
# Send reports for specific date (YYYYMMDD format)
rspamadm dmarc_report 20251120

# Send for yesterday
rspamadm dmarc_report $(date -d yesterday +%Y%m%d)
```

#### Dry Run (No Sending)

```bash
# Process but don't send or clear data
rspamadm dmarc_report -n
```

#### Batch Processing

```bash
# Send reports in larger batches
rspamadm dmarc_report -b 50
```

#### Verbose Logging

```bash
# Enable detailed DMARC logging
rspamadm dmarc_report -v
```

### Options

```
-c, --config <cfg>          Config file
-v, --verbose               Verbose logging
-n, --no-opt                Don't reset data or send
-b, --batch-size <N>       Batch size (default: 10)
date                        Date to process (YYYYMMDD)
```

### Use Cases

#### Daily Cron Job

```bash
#!/bin/bash
# /etc/cron.daily/rspamd-dmarc-reports

# Send yesterday's reports
DATE=$(date -d yesterday +%Y%m%d)

rspamadm dmarc_report "$DATE" -v 2>&1 | \
  logger -t rspamd-dmarc

# Check for errors
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "DMARC report sending failed" | \
    mail -s "DMARC Report Error" admin@example.com
fi
```

#### Manual Report Review

```bash
# Review what would be sent (dry run)
rspamadm dmarc_report -n -v > dmarc-review.txt

# Review and approve
less dmarc-review.txt

# Send for real
rspamadm dmarc_report
```

---

## fuzzyconvert

Convert fuzzy hashes from SQLite to Redis.

### Purpose

Migrate fuzzy hash database from SQLite3 to Redis backend.

### Common Scenarios

#### Basic Conversion

```bash
# Convert fuzzy database
rspamadm fuzzyconvert \
  -d /var/lib/rspamd/fuzzy.db \
  -h 127.0.0.1:6379 \
  -e 7776000  # 90 day expiry
```

#### With Redis Authentication

```bash
# Convert with Redis password
rspamadm fuzzyconvert \
  -d /var/lib/rspamd/fuzzy.db \
  -h 127.0.0.1:6379 \
  -p redis-password \
  -D 2  # Redis database 2
  -e 2592000  # 30 day expiry
```

### Options

```
-d, --database <file>       Input SQLite database
-e, --expiry <seconds>      Expiration time
-h, --host <addr>          Redis host (ip:port)
-D, --dbname <num>         Redis database number
-p, --password <pw>        Redis password
```

### Use Cases

```bash
#!/bin/bash
# Complete fuzzy migration

SQLITE_DB="/var/lib/rspamd/fuzzy.db"
REDIS_HOST="localhost:6379"
EXPIRY=7776000  # 90 days

# Stop fuzzy worker
systemctl stop rspamd-fuzzy

# Backup SQLite
cp "$SQLITE_DB" "$SQLITE_DB.backup"

# Convert to Redis
rspamadm fuzzyconvert \
  -d "$SQLITE_DB" \
  -h "$REDIS_HOST" \
  -e "$EXPIRY"

# Update config for Redis
cat > /etc/rspamd/local.d/worker-fuzzy.inc << EOF
backend = "redis";
servers = "$REDIS_HOST";
EOF

# Start fuzzy worker
systemctl start rspamd-fuzzy
```

---

## Practical Examples

### Complete Monitoring Script

```bash
#!/bin/bash
# Comprehensive Rspamd monitoring

LOG_FILE="/var/log/rspamd/rspamd.log"
ALERT_EMAIL="admin@example.com"

# Check if Rspamd is responding
if ! rspamadm control stat -j >/dev/null 2>&1; then
  echo "Rspamd not responding" | mail -s "Rspamd Down" "$ALERT_EMAIL"
  exit 1
fi

# Get statistics
STATS=$(rspamadm control stat -j)
SCANNED=$(echo "$STATS" | jq '.scanned')

# Check for errors in logs
ERRORS=$(rspamadm grep -s "error" -i "$LOG_FILE" | tail -20)
if [ -n "$ERRORS" ]; then
  echo "$ERRORS" | mail -s "Rspamd Errors Detected" "$ALERT_EMAIL"
fi

# Check rate limits
RATELIMITED=$(rspamadm ratelimit track -q 10)
if [ -n "$RATELIMITED" ]; then
  echo "Top rate-limited senders:" > /tmp/ratelimit-report.txt
  echo "$RATELIMITED" >> /tmp/ratelimit-report.txt
  mail -s "Rspamd Rate Limits" "$ALERT_EMAIL" < /tmp/ratelimit-report.txt
fi

# Test fuzzy storage
if ! rspamadm fuzzy_ping -S 2>/dev/null; then
  echo "Fuzzy storage unreachable" | mail -s "Fuzzy Storage Alert" "$ALERT_EMAIL"
fi

echo "Monitoring complete: $SCANNED messages processed"
```

### Log Analysis Report

```bash
#!/bin/bash
# Generate daily log analysis

DATE=$(date +%Y-%m-%d)
LOG="/var/log/rspamd/rspamd.log"
REPORT="/var/log/rspamd/daily-report-$DATE.txt"

{
  echo "Rspamd Daily Report - $DATE"
  echo "================================"
  echo
  
  echo "Top Symbols:"
  rspamadm grep -p "symbol.*=" "$LOG" | \
    grep -o 'symbol=[A-Z_]*' | sort | uniq -c | sort -rn | head -20
  echo
  
  echo "Top Senders:"
  rspamadm grep -p "from=<" "$LOG" | \
    grep -o 'from=<[^>]*>' | sort | uniq -c | sort -rn | head -20
  echo
  
  echo "Rejected Messages:"
  rspamadm grep -s "reject" "$LOG" | wc -l
  echo
  
  echo "Greylisted:"
  rspamadm grep -s "greylist" "$LOG" | wc -l
  echo
  
} > "$REPORT"

mail -s "Rspamd Daily Report" admin@example.com < "$REPORT"
```

## Tips and Best Practices

1. **Use grep for debugging** - Much better than regular grep for Rspamd logs
2. **Regular control stat** - Monitor message processing rates
3. **Automate DMARC reports** - Set up daily cron job
4. **Monitor fuzzy storage** - Check connectivity regularly
5. **Track rate limits** - Review top offenders daily
6. **Backup before conversions** - Always backup before fuzzyconvert/statconvert
7. **Test commands first** - Use `-n` or dry-run modes when available

## Related Documentation

- [Configuration](configuration.md) - Configure workers and modules
- [Statistics & ML](statistics-ml.md) - Manage statistical data
- [Email Analysis](email-analysis.md) - Analyze message content
