---
title: Statistics & Machine Learning
---

# Statistics & Machine Learning

These commands help manage statistical classifiers (Bayes) and machine learning models (neural networks), including backup, migration, and performance evaluation.

## statistics_dump

Backup and restore Bayes statistics.

### Purpose

Export and import Bayes statistics for backup, migration, or disaster recovery. Works with both Redis and SQLite backends.

### Common Scenarios

#### Dump Statistics

```bash
# Dump Bayes statistics
rspamadm statistics_dump dump

# Dump with custom config
rspamadm statistics_dump -c /path/to/rspamd.conf dump

# Dump with smaller batch size (less memory)
rspamadm statistics_dump -b 1000 dump
```

Output is in structured format (JSON-like) that includes:
- Token frequencies
- Spam/ham counters
- Metadata

#### Restore Statistics

```bash
# Restore from dump
rspamadm statistics_dump restore < backup.dump

# Restore with custom config
rspamadm statistics_dump -c /path/to/rspamd.conf restore < backup.dump
```

### Options

```
-c, --config <cfg>      Path to config file
-b, --batch-size <N>    Process N entries at once (default: 1000)

Subcommands:
dump, d                 Dump statistics
restore, r              Restore statistics
```

### Use Cases

#### Regular Backups

```bash
#!/bin/bash
# Daily Bayes backup

BACKUP_DIR="/var/backups/rspamd"
DATE=$(date +%Y%m%d)

mkdir -p "$BACKUP_DIR"

# Dump statistics
rspamadm statistics_dump dump | \
  gzip > "$BACKUP_DIR/bayes-$DATE.dump.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "bayes-*.dump.gz" -mtime +30 -delete

echo "Backup completed: bayes-$DATE.dump.gz"
```

#### Migration Between Servers

```bash
# On source server
rspamadm statistics_dump dump | gzip > bayes-export.dump.gz

# Transfer to destination
scp bayes-export.dump.gz new-server:/tmp/

# On destination server
zcat /tmp/bayes-export.dump.gz | rspamadm statistics_dump restore

# Restart Rspamd
systemctl restart rspamd
```

#### Disaster Recovery

```bash
# Restore from backup
zcat /var/backups/rspamd/bayes-20251120.dump.gz | \
  rspamadm statistics_dump restore

# Verify restoration
rspamadm control stat | grep -A5 "Bayes"
```

---

## statconvert

Convert statistics from SQLite to Redis.

### Purpose

Migrate Bayes statistics and learn cache from SQLite3 databases to Redis backend.

### Common Scenarios

#### Convert Bayes Databases

```bash
# Convert spam and ham databases
rspamadm statconvert \
  --spam-db /var/lib/rspamd/bayes.spam.sqlite \
  --ham-db /var/lib/rspamd/bayes.ham.sqlite \
  --symbol-spam BAYES_SPAM \
  --symbol-ham BAYES_HAM \
  -h localhost:6379

# With Redis authentication
rspamadm statconvert \
  --spam-db /var/lib/rspamd/bayes.spam.sqlite \
  --ham-db /var/lib/rspamd/bayes.ham.sqlite \
  -h localhost:6379 \
  -p redis-password \
  -d 0
```

#### Convert Learn Cache

```bash
# Convert learn cache
rspamadm statconvert \
  --cache /var/lib/rspamd/learn_cache.sqlite \
  -h localhost:6379
```

#### Reset Redis Before Import

```bash
# Reset existing data
rspamadm statconvert \
  --spam-db bayes.spam.sqlite \
  --ham-db bayes.ham.sqlite \
  -h localhost:6379 \
  --reset
```

#### Set Expiration Time

```bash
# Set 90-day expiration on tokens
rspamadm statconvert \
  --spam-db bayes.spam.sqlite \
  --ham-db bayes.ham.sqlite \
  -h localhost:6379 \
  --expire 7776000  # 90 days in seconds
```

### Options

```
-c, --config <file>         Config file
-r, --reset                 Reset existing data
-e, --expire <seconds>      Set expiration time
--symbol-spam <symbol>      Spam symbol (default: BAYES_SPAM)
--symbol-ham <symbol>       Ham symbol (default: BAYES_HAM)
--spam-db <file>           Spam SQLite database
--ham-db <file>            Ham SQLite database
--cache <file>             Learn cache SQLite database
-h, --redis-host <addr>    Redis address (ip:port)
-p, --redis-password <pw>  Redis password
-d, --redis-db <num>       Redis database number
```

### Complete Migration Example

```bash
#!/bin/bash
# Migrate from SQLite to Redis

SQLITE_DIR="/var/lib/rspamd"
REDIS_HOST="localhost:6379"
REDIS_DB="0"

echo "=== Starting migration ==="

# 1. Stop Rspamd
systemctl stop rspamd

# 2. Backup SQLite databases
tar czf rspamd-sqlite-backup-$(date +%Y%m%d).tar.gz \
  "$SQLITE_DIR"/*.sqlite

# 3. Convert Bayes data
echo "Converting Bayes databases..."
rspamadm statconvert \
  --spam-db "$SQLITE_DIR/bayes.spam.sqlite" \
  --ham-db "$SQLITE_DIR/bayes.ham.sqlite" \
  --symbol-spam BAYES_SPAM \
  --symbol-ham BAYES_HAM \
  -h "$REDIS_HOST" \
  -d "$REDIS_DB" \
  --expire 7776000

# 4. Convert learn cache
echo "Converting learn cache..."
rspamadm statconvert \
  --cache "$SQLITE_DIR/learn_cache.sqlite" \
  -h "$REDIS_HOST" \
  -d "$REDIS_DB"

# 5. Update configuration to use Redis
cat > /etc/rspamd/local.d/classifier-bayes.conf << EOF
backend = "redis";
servers = "$REDIS_HOST";
database = $REDIS_DB;
EOF

# 6. Start Rspamd
systemctl start rspamd

# 7. Verify
rspamadm control stat | grep -A10 "Bayes"

echo "=== Migration complete ==="
```

---

## classifiertest

Evaluate Bayes classifier performance.

### Purpose

Train and test Bayes classifier using labeled ham and spam corpuses, measuring accuracy through cross-validation.

### Common Scenarios

#### Basic Performance Test

```bash
# Test classifier with ham and spam directories
rspamadm classifiertest \
  -H /path/to/ham-corpus \
  -S /path/to/spam-corpus
```

This:
1. Splits corpus (70% training, 30% testing by default)
2. Learns from training set
3. Tests against test set
4. Reports accuracy, false positives, false negatives

#### Custom Cross-Validation Split

```bash
# Use 80% for training, 20% for testing
rspamadm classifiertest \
  -H /path/to/ham \
  -S /path/to/spam \
  --cv-fraction 0.8
```

#### Test Without Learning

```bash
# Test against existing classifier (no new learning)
rspamadm classifiertest \
  -H /path/to/ham \
  -S /path/to/spam \
  --no-learning
```

#### Connect to Remote Rspamd

```bash
# Test against remote instance
rspamadm classifiertest \
  -H /path/to/ham \
  -S /path/to/spam \
  -c rspamd.example.com:11333
```

### Options

```
-H, --ham <dir>             Ham messages directory
-S, --spam <dir>            Spam messages directory
-n, --no-learning           Don't learn, only test
--nconns <N>                Parallel connections (default: 10)
-t, --timeout <sec>         Connection timeout
-c, --connect <host>        Rspamd host (default: localhost:11334)
-r, --rspamc <path>         Path to rspamc
--cv-fraction <fraction>    Cross-validation split (default: 0.7)
--spam-symbol <symbol>      Spam symbol (default: BAYES_SPAM)
--ham-symbol <symbol>       Ham symbol (default: BAYES_HAM)
```

### Example Output

```
Learning phase: 1000 spam, 1000 ham messages
Testing phase: 300 spam, 300 ham messages

Results:
  True Positives:  295 (98.3%)
  False Positives: 8 (2.7%)
  True Negatives:  292 (97.3%)
  False Negatives: 5 (1.7%)
  
  Accuracy: 97.8%
  Precision: 97.4%
  Recall: 98.3%
```

### Use Cases

#### Validate Bayes Effectiveness

```bash
#!/bin/bash
# Test classifier before production deployment

HAM_DIR="/data/corpus/ham"
SPAM_DIR="/data/corpus/spam"

echo "Testing Bayes classifier..."
rspamadm classifiertest -H "$HAM_DIR" -S "$SPAM_DIR" > test-results.txt

# Check if accuracy is acceptable
ACCURACY=$(grep "Accuracy:" test-results.txt | awk '{print $2}' | tr -d '%')

if (( $(echo "$ACCURACY > 95" | bc -l) )); then
  echo "Classifier performs well ($ACCURACY%)"
  exit 0
else
  echo "Classifier needs more training ($ACCURACY%)"
  exit 1
fi
```

---

## neuraltest

Test neural network performance with labeled datasets.

### Purpose

Evaluate neural network module performance using spam/ham corpus.

### Common Scenarios

#### Test Neural Network

```bash
# Test with ham and spam directories
rspamadm neuraltest \
  -H /path/to/ham \
  -S /path/to/spam

# Test specific neural rule
rspamadm neuraltest \
  -H /path/to/ham \
  -S /path/to/spam \
  --rule NEURAL_SPAM
```

### Options

```
-c, --config <cfg>          Config file
-H, --hamdir <dir>          Ham directory
-S, --spamdir <dir>         Spam directory
-t, --timeout <sec>         Timeout
-n, --conns <N>            Parallel connections
-c, --connect <host>        Rspamd host
-r, --rspamc <path>         rspamc path
--rule <rule>               Specific neural rule to test
```

### Use Cases

```bash
# Test neural network after training
rspamadm neuraltest \
  -H /data/ham-2024 \
  -S /data/spam-2024 \
  --rule NEURAL_SPAM_SHORT
```

---

## clickhouse neural_profile

Generate symbol profiles for neural network training.

### Purpose

Analyze Clickhouse data to create optimal symbol sets for neural networks.

### Common Scenarios

#### Generate Profile

```bash
# Generate 7-day profile
rspamadm clickhouse neural_profile

# Custom time period
rspamadm clickhouse neural_profile --days 30

# Limit results per day
rspamadm clickhouse neural_profile --days 7 --limit 10000

# JSON output
rspamadm clickhouse neural_profile --days 7 -j
```

#### Filter by Settings ID

```bash
# Profile for specific settings
rspamadm clickhouse neural_profile \
  --settings-id inbound \
  --days 14
```

#### Custom SQL Conditions

```bash
# Add WHERE clause
rspamadm clickhouse neural_profile \
  -w "Score > 10" \
  --days 7
```

### Options

```
-h, --help                  Show help
-c, --config <cfg>         Config file
-d, --database <db>        Clickhouse database
-s, --server <addr>        Clickhouse server
-u, --user <user>          Username
-p, --password <pw>        Password
-a, --ask-password         Ask password interactively
--use-https                Use HTTPS
--use-gzip                 Use Gzip compression
--no-ssl-verify            Disable SSL verification

neural_profile options:
-w, --where <clause>       SQL WHERE clause
-j, --json                 JSON output
--days <N>                 Days to analyze (default: 7)
--limit <N>               Max rows per day
--settings-id <id>        Settings ID filter
```

### Use Cases

```bash
#!/bin/bash
# Monthly neural network optimization

# Generate fresh profile
rspamadm clickhouse neural_profile \
  --days 30 \
  -j > neural-profile.json

# Analyze results
jq '.symbols | length' neural-profile.json
echo "Generated profile with $(jq '.symbols | length' neural-profile.json) symbols"

# Apply to neural configuration (manual step)
```

---

## Practical Examples

### Complete Backup and Migration Workflow

```bash
#!/bin/bash
# Backup SQLite, migrate to Redis, verify

SOURCE="/var/lib/rspamd"
BACKUP="/var/backups/rspamd/$(date +%Y%m%d)"
REDIS="localhost:6379"

mkdir -p "$BACKUP"

# 1. Dump current statistics
echo "Backing up current statistics..."
rspamadm statistics_dump dump | gzip > "$BACKUP/statistics.dump.gz"

# 2. Backup SQLite files
echo "Backing up SQLite databases..."
cp "$SOURCE"/*.sqlite "$BACKUP/"

# 3. Test Bayes classifier before migration
echo "Testing classifier performance..."
rspamadm classifiertest -H /data/ham -S /data/spam > "$BACKUP/pre-migration-test.txt"

# 4. Migrate to Redis
echo "Migrating to Redis..."
systemctl stop rspamd

rspamadm statconvert \
  --spam-db "$SOURCE/bayes.spam.sqlite" \
  --ham-db "$SOURCE/bayes.ham.sqlite" \
  --cache "$SOURCE/learn_cache.sqlite" \
  -h "$REDIS" \
  --expire 7776000

# 5. Update config for Redis
cat > /etc/rspamd/local.d/classifier-bayes.conf << EOF
backend = "redis";
servers = "$REDIS";
EOF

systemctl start rspamd
sleep 5

# 6. Test after migration
echo "Testing after migration..."
rspamadm classifiertest -H /data/ham -S /data/spam -n > "$BACKUP/post-migration-test.txt"

# 7. Compare results
echo "=== Results ==="
echo "Before migration:"
grep "Accuracy:" "$BACKUP/pre-migration-test.txt"
echo "After migration:"
grep "Accuracy:" "$BACKUP/post-migration-test.txt"
```

### Automated Classifier Performance Monitoring

```bash
#!/bin/bash
# Weekly classifier performance check

CORPUS_HAM="/data/corpus/ham"
CORPUS_SPAM="/data/corpus/spam"
REPORT_DIR="/var/log/rspamd/classifier-reports"
WEEK=$(date +%Y-W%V)

mkdir -p "$REPORT_DIR"

# Run test
echo "Testing classifier for week $WEEK..."
rspamadm classifiertest \
  -H "$CORPUS_HAM" \
  -S "$CORPUS_SPAM" \
  > "$REPORT_DIR/classifier-$WEEK.txt"

# Extract metrics
ACCURACY=$(grep "Accuracy:" "$REPORT_DIR/classifier-$WEEK.txt" | \
  awk '{print $2}' | tr -d '%')
FP_RATE=$(grep "False Positives:" "$REPORT_DIR/classifier-$WEEK.txt" | \
  awk '{print $4}' | tr -d '%' | tr -d '()')

# Alert if performance degrades
if (( $(echo "$ACCURACY < 95" | bc -l) )); then
  echo "WARNING: Classifier accuracy dropped to $ACCURACY%" | \
    mail -s "Rspamd Classifier Alert" admin@example.com
fi

if (( $(echo "$FP_RATE > 5" | bc -l) )); then
  echo "WARNING: False positive rate increased to $FP_RATE%" | \
    mail -s "Rspamd False Positive Alert" admin@example.com
fi
```

## Tips and Best Practices

### Statistics Management

1. **Regular backups** - Daily dumps of Bayes data
2. **Test before migration** - Verify classifier performance
3. **Monitor after migration** - Check accuracy didn't degrade
4. **Set expiration** - Use `--expire` to prevent unbounded growth
5. **Incremental backups** - Keep multiple backup versions

### Performance Testing

1. **Representative corpus** - Use real-world emails for testing
2. **Large datasets** - At least 1000 of each (spam/ham)
3. **Recent data** - Test with current spam tactics
4. **Balanced corpus** - Equal amounts of spam and ham
5. **Regular testing** - Monthly performance checks

### Neural Networks

1. **Generate profiles regularly** - Monthly or quarterly
2. **Sufficient data** - At least 30 days of Clickhouse data
3. **Monitor training** - Check neural network logs
4. **Validate results** - Test with neuraltest command
5. **Incremental updates** - Don't retrain too frequently

## Related Documentation

- [Email Analysis](email-analysis.md) - Extract statistical data from messages
- [Operations](operations.md) - Control statistics operations
- [Configuration](configuration.md) - Configure Bayes and neural modules
