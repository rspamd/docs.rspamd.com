---
title: Log Analysis
---

# Log Analysis

These commands parse rspamd log files to provide operational insight: rule effectiveness
(`logstats`), multimap coverage (`mapstats`), and Bayes autolearn activity (`autolearnstats`).
All three support rotated and compressed log files, time-window filtering, and reading from stdin.
See [Common Log File Interface](#common-log-file-interface) for shared options.

## logstats

Analyze Rspamd rules by parsing log files.

### Purpose

Parse rspamd log files and produce per-symbol statistics: hit rates, spam/ham/junk breakdown,
and score impact — how many messages would have had a different classification without the
symbol. Optionally compute symbol correlations.

### Common Scenarios

#### Analyze All Symbols

```bash
# Analyze a single log file
rspamadm logstats /var/log/rspamd/rspamd.log

# Analyze all log files in a directory (including rotated and compressed)
rspamadm logstats /var/log/rspamd/
```

#### Filter by Symbol

```bash
# Analyze a specific symbol
rspamadm logstats -s BAYES_SPAM /var/log/rspamd/rspamd.log

# Use a regexp to analyze a group of symbols
rspamadm logstats -s "DMARC.*" /var/log/rspamd/rspamd.log

# Exclude test messages (GTUBE)
rspamadm logstats -X GTUBE /var/log/rspamd/rspamd.log
```

#### Bidirectional Symbols

Use `--symbol-bidir` for symbols whose positive score indicates spam and negative score
indicates ham (e.g. `BAYES`). The symbol is split into `SYMBOL_SPAM` and `SYMBOL_HAM` entries:

```bash
rspamadm logstats -S BAYES /var/log/rspamd/rspamd.log
```

#### Symbol Correlations

```bash
# Show which symbols co-occur most often
rspamadm logstats -c /var/log/rspamd/rspamd.log

# Limit to top 5 related symbols per entry
rspamadm logstats -c --nrelated 5 /var/log/rspamd/rspamd.log
```

#### Time Range and Log Rotation

```bash
# Last 3 rotated log files
rspamadm logstats -n 3 /var/log/rspamd/

# Skip the most recent file (currently being written)
rspamadm logstats -x 1 -n 7 /var/log/rspamd/

# Specific time window
rspamadm logstats \
  --start "2026-01-15 00:00:00" \
  --end "2026-01-15 23:59:59" \
  /var/log/rspamd/rspamd.log
```

#### JSON Output

```bash
# Machine-readable output for further processing
rspamadm logstats --json /var/log/rspamd/rspamd.log | jq '.symbols.BAYES_SPAM'
```

### Options

```text
<log>                           Log file or directory (stdin if omitted)
-r, --reject-score <score>      Reject threshold (default: 15.0)
-j, --junk-score <score>        Junk score threshold (default: 6.0)
-s, --symbol <sym>              Symbol or regexp to analyze (default: '.*', repeatable)
-S, --symbol-bidir <sym>        Bidirectional symbol: splits into SYM_SPAM/SYM_HAM (repeatable)
-X, --exclude <sym>             Exclude log lines if symbol fires (repeatable)
    --ignore <sym>              Ignore symbol in correlations (repeatable)
-g, --group <syms>              Group comma-separated symbols under one entry (repeatable)
    --mult <sym=num>            Multiply symbol score by factor (repeatable)
-a, --alpha-score <score>       Minimum |score| to include (default: 0.1)
-c, --correlations              Enable correlations report
    --nrelated <n>              Number of related symbols to show (default: 10)
    --search-pattern <pattern>  Skip log lines until pattern is found
    --start <time>              Start of time window (YYYY-MM-DD HH:MM:SS, truncatable)
    --end <time>                End of time window (same format)
-n, --num-logs <n>              Number of recent logfiles to analyze
-x, --exclude-logs <n>          Number of latest logs to exclude (default: 0)
    --json                      Print JSON output
```

### Output Format

Each symbol is shown with a statistics block:

```text
BAYES_SPAM   avg. weight 3.763, hits 381985 (26.827%):
  Ham   48.315%, 184557/1095487 ( 16.847%)
  Spam   3.962%,  15134/  16688 ( 90.688%)
  Junk  47.723%, 182294/ 311699 ( 58.484%)

Spam changes (ham/junk -> spam): 7026/381985 (  1.839%)
Spam  changes / total spam hits: 7026/  16688 ( 42.102%)
Junk changes      (ham -> junk): 95192/381985 ( 24.920%)
Junk  changes / total junk hits: 95192/311699 ( 30.540%)
```

Fields:

- **avg. weight** — average score contribution across all hits
- **hits** — total hit count and percentage of all scanned messages
- **Ham / Spam / Junk** — per-class: symbol's hit percentage within the class, absolute hit count / total class count, and percentage of the class covered by this symbol
- **Spam / Junk changes** — messages that would have switched classification without this symbol

The summary at the end shows total message count, per-action breakdown with percentages, and
scan time min/avg/max.

### Use Cases

#### Evaluate Rule Effectiveness

```bash
# Analyze BAYES symbols over the last week
rspamadm logstats \
  -s "BAYES.*" -n 7 \
  /var/log/rspamd/ \
  --json > weekly-bayes-report.json
```

#### Investigate Symbol Correlations

```bash
# Which symbols co-occur most often with PHISHING?
rspamadm logstats -s PHISHING -c /var/log/rspamd/rspamd.log
```

---

## mapstats

Count Rspamd multimap matches by parsing log files.

### Purpose

Read the multimap module configuration, load the referenced map files, parse log files, and
count how many times each map entry was matched. Identifies unused entries, heavily-triggered
entries, and values that fired a symbol but were not found in any map entry.

Only file-based maps are analyzed. HTTP/HTTPS map URLs are skipped.

### Common Scenarios

#### Basic Usage

```bash
# Analyze with the default config path
rspamadm mapstats /var/log/rspamd/rspamd.log

# Specify config path explicitly
rspamadm mapstats -c /etc/rspamd/rspamd.conf /var/log/rspamd/rspamd.log

# Analyze multiple rotated log files
rspamadm mapstats -n 7 /var/log/rspamd/
```

#### Time Range

```bash
rspamadm mapstats \
  --start "2026-01-01 00:00:00" \
  --end "2026-01-07 23:59:59" \
  /var/log/rspamd/
```

### Options

```text
<log>                           Log file or directory (stdin if omitted)
-c, --config <file>             Path to config file (default: /etc/rspamd/rspamd.conf)
    --start <time>              Start of time window (YYYY-MM-DD HH:MM:SS, truncatable)
    --end <time>                End of time window (same format)
-n, --num-logs <n>              Number of recent logfiles to analyze
-x, --exclude-logs <n>          Number of latest logs to exclude (default: 0)
```

### Output Format

During startup, each map symbol is validated and its entry count printed:

```text
WHITELIST_IP: /etc/rspamd/local.d/maps.d/whitelist_ip.map [OK] - 5 entries
BLACKLIST_SENDER: /etc/rspamd/local.d/maps.d/blacklist.map [OK] - 42 entries
REMOTE_BOUNCE: https://maps.rspamd.com/rspamd/bounces.inc.zst [SKIPPED]
====== maps added =====
```

After processing logs, match counts are displayed per entry:

```text
WHITELIST_IP:
    type=ip

Map: /etc/rspamd/local.d/maps.d/whitelist_ip.map
Pattern                 Matches         Comment
--------------------------------------------------------------------------------
192.168.1.0/24          42              # Internal network
10.0.0.0/8              15              # VPN range
172.16.0.0/12           -
================================================================================
```

If the log contains symbol hits with values that do not match any map entry, an unmatched
report is printed at the end:

```text
Symbols with unmatched values:
--------------------------------------------------------------------------------

BLACKLIST_SENDER: 3 unmatched value(s)
  5x: BLACKLIST_SENDER(0.0){unknown@disposable.example;}
  2x: BLACKLIST_SENDER(0.0){noreply@temp-mail.org;}
  1x: BLACKLIST_SENDER(0.0){info@suspicious.net;}
```

### Use Cases

#### Audit Map Coverage

```bash
# Find entries never matched in the last 30 days
rspamadm mapstats -n 30 /var/log/rspamd/ | grep -E '\s+-\s*($|#)'
```

---

## autolearnstats

Report Bayes autolearn events from rspamd log.

### Purpose

Parse rspamd log files for Bayes autolearn events and display them in a tabular format.
For each autolearn candidate, shows whether Bayes learning was confirmed, the verdict,
score, timestamp, task ID, sender IP, sender address, and recipients.

Useful for monitoring whether Bayes autolearning is working correctly and for identifying
suspicious training data.

### Common Scenarios

#### Basic Usage

```bash
# Analyze a single log file
rspamadm autolearnstats /var/log/rspamd/rspamd.log

# Analyze all log files in a directory (including rotated and compressed)
rspamadm autolearnstats /var/log/rspamd/
```

#### Time Window

```bash
# Yesterday's events
rspamadm autolearnstats \
  --start "2026-01-14 00:00:00" \
  --end "2026-01-14 23:59:59" \
  /var/log/rspamd/

# Events since midnight today (time only, date defaults to today)
rspamadm autolearnstats --start "00:00" /var/log/rspamd/rspamd.log
```

#### Daily Report via Cron

Use `-x 1 -n 1` to analyze only the previous day's rotated log file. Add `2>/dev/null`
to suppress progress messages. **This assumes daily log rotation:**

```bash
# In crontab: send a daily autolearn report at 00:15
15 0 * * * /usr/local/bin/rspamadm autolearnstats -x 1 -n 1 /var/log/rspamd/ 2>/dev/null | mail -s "Rspamd Bayes autolearn events" root
```

**How it works**: The `-x 1` flag skips the current day's log file (to ensure you report on
complete 24-hour periods), and `-n 1` analyzes only one file (the previous day's rotated log).
This works correctly only if your log rotation frequency matches the report frequency (daily).

### Options

```text
<log>                           Log file or directory (stdin if omitted)
    --start <time>              Start of time window (YYYY-MM-DD HH:MM:SS, truncatable)
    --end <time>                End of time window (same format)
-n, --num-logs <n>              Number of recent logfiles to analyze
-x, --exclude-logs <n>          Number of latest logs to exclude (default: 0)
```

### Output Format

```text
    Verd  Score           Timestamp            Task              IP           From                    Recipients
--------------------------------------------------------------------------------------------------------------
[L] spam  43.64>=20.0    2026-01-15 10:23:41  abc123def456789   1.2.3.4      sender@example.com      recipient@domain.com
    ham   -20.88<=-20.0  2026-01-15 10:24:12  fedcba987654321   5.6.7.8      other@example.org       user@company.com

Total autolearn candidates: 42  Learned: 15
  ham   28 candidates  /  12 learned
  spam  14 candidates  /   3 learned
```

Columns:

- **[L]** — present (in green) if Bayes learning was confirmed for this message; absent otherwise
- **Verd** — autolearn verdict: `spam` (red), `junk` (yellow), or `ham` (green)
- **Score** — message score and the threshold that triggered the verdict (format: `score op threshold`, e.g., `43.64>=20.0`)
- **Timestamp** — time of the autolearn candidate event
- **Task** — task ID from the rspamd log; use it to find all related log entries with `rspamadm grep`
- **IP** — sender IP address
- **From** — envelope sender address
- **Recipients** — MIME recipients

Column widths adjust dynamically to the longest value in the dataset.

### Use Cases

#### Monitor Autolearn Activity

```bash
# Show only confirmed learned events
rspamadm autolearnstats /var/log/rspamd/ | grep '^\[L\]'
```

#### Investigate Candidates That Were Not Learned

```bash
# Candidates where learning was not confirmed
rspamadm autolearnstats /var/log/rspamd/rspamd.log | grep -v '^\[L\]'
```

#### Find All Log Entries for a Specific Event

Use the task ID from the output to retrieve all log lines for that message with `rspamadm grep`:

```bash
rspamadm grep -P -s abf663 /var/log/rspamd/rspamd.log
```

---

## Common Log File Interface

All three commands share the same log file handling:

| Option | Description |
|--------|-------------|
| `<log>` | Log file, directory, or `-` for stdin. If omitted, reads from stdin. |
| `--start <time>` | Process only entries at or after this time. Format: `YYYY-MM-DD HH:MM:SS`. Can be truncated to any accuracy (e.g., `2026-01-15` or `10:30`). If only a time is given, the date defaults to today. |
| `--end <time>` | Process only entries at or before this time. Same format as `--start`. |
| `-n, --num-logs <n>` | When `<log>` is a directory, analyze only the `n` most recent log files. |
| `-x, --exclude-logs <n>` | Skip the `n` most recent log files (default: 0). Useful to exclude the currently active log file. |

When a directory is specified, log files are sorted by their rotation index. Files without a
numeric suffix (typically `rspamd.log`) are considered most recent; lower numeric suffixes are
newer. Compressed files (`.gz`, `.bz2`, `.xz`, `.zst`) are decompressed automatically. Both
rspamd native log format and syslog format are supported.
