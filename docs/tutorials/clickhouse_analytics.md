---
title: ClickHouse Analytics Platform
---

# ClickHouse Analytics: Building a Mail Intelligence Platform

**ClickHouse integration** with Rspamd allows you to build a powerful analytics platform for mail traffic analysis, threat intelligence, and compliance reporting. This tutorial guides you through setting up a complete analytical infrastructure.

## What is ClickHouse?

ClickHouse is a high-performance columnar database management system designed for analytics:
- **Fast analytics**: Optimized for real-time analytical queries
- **Scalable**: Handles billions of rows with excellent performance
- **SQL interface**: Standard SQL with analytics extensions
- **Compression**: Efficient storage with advanced compression

With Rspamd integration, you can:
- Analyze mail patterns and trends
- Build threat intelligence dashboards
- Generate compliance reports
- Monitor spam detection effectiveness
- Create custom analytics workflows

## Basic Setup

### Step 1: Install ClickHouse

Install ClickHouse server:

```bash
# Add ClickHouse repository (Ubuntu/Debian)
sudo apt-get install -y apt-transport-https ca-certificates dirmngr
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 8919F6BD2B48D754

echo "deb https://packages.clickhouse.com/deb stable main" | sudo tee \
    /etc/apt/sources.list.d/clickhouse.list

# Install ClickHouse
sudo apt-get update
sudo apt-get install -y clickhouse-server clickhouse-client

# Start ClickHouse
sudo systemctl start clickhouse-server
sudo systemctl enable clickhouse-server
```

### Step 2: Configure Rspamd ClickHouse Module

Create the ClickHouse configuration:

```hcl
# /etc/rspamd/local.d/clickhouse.conf

# Enable ClickHouse logging
enabled = true;

# ClickHouse connection settings
server = "http://localhost:8123/";
database = "rspamd";
table = "rspamd";

# What to log
data_retention {
  enable = true;
  # Keep data for 90 days
  period = "90d";
}

# Additional fields using both built-in and custom selectors
extra_columns = {
  # Built-in selectors
  "message_size" = "size";
  "recipient_count" = "rcpts:count";
  "from_domain" = "from:domain";
  "mime_type" = "header('Content-Type')";
  "user_agent" = "header('User-Agent')";

  # Custom selectors (must be registered in lua.local.d/ first!)
  "attachment_count" = "attachment_count()";
  "has_executable" = "has_dangerous_attachment()";
  "attachment_extensions" = "attachment_types()";
  "suspicious_url_count" = "suspicious_domains_count()";
  "text_html_ratio" = "text_to_html_ratio()";
  "language_detection" = "detected_languages()";
  "symbol_groups_summary" = "symbol_groups_stats()";
}
```

### Step 3: Test the Integration

**Note**: Rspamd's ClickHouse module automatically creates the database and tables when it starts. You don't need to create them manually.

First, let's start Rspamd and verify the integration:

```bash
# Restart Rspamd to load ClickHouse config
sudo systemctl restart rspamd

# Send test message
echo "Test message for ClickHouse" | rspamc

# Check ClickHouse logs
tail -f /var/log/clickhouse-server/clickhouse-server.log

# Check if database and table were created
clickhouse-client --query="SHOW DATABASES"
clickhouse-client --query="SHOW TABLES FROM rspamd"

# Query data to verify logging works
clickhouse-client --database=rspamd --query="SELECT count() FROM rspamd WHERE Date = today()"

# Check table structure (including custom columns)
clickhouse-client --database=rspamd --query="DESCRIBE TABLE rspamd"
```

### Step 4: Create Materialized Views (Optional)

After Rspamd creates the main table, you can create materialized views for faster analytics:

```sql
-- Connect to ClickHouse
clickhouse-client --database=rspamd

-- Create materialized views for common queries
CREATE MATERIALIZED VIEW spam_stats_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(Date)
ORDER BY (Date, Action)
AS SELECT
    Date,
    Action,
    count() as Messages,
    avg(Score) as Avg_Score,
    avg(Scan_Time) as Avg_Scan_Time,
    avg(message_size) as Avg_Size
FROM rspamd
GROUP BY Date, Action;

-- IP reputation view with custom columns
CREATE MATERIALIZED VIEW ip_reputation
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(Date)
ORDER BY (Date, IP)
AS SELECT
    Date,
    IP,
    Action,
    count() as Messages,
    avg(Score) as Avg_Score,
    country_code,
    asn_number,
    countIf(has_executable = '1') as Executable_Count,
    countIf(toUInt32(url_count) > 0) as Messages_With_URLs
FROM rspamd
GROUP BY Date, IP, Action, country_code, asn_number;

-- Attachment analysis view
CREATE MATERIALIZED VIEW attachment_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(Date)
ORDER BY (Date, attachment_extensions)
AS SELECT
    Date,
    attachment_extensions,
    count() as Messages,
    avg(Score) as Avg_Score,
    countIf(Action = 'reject') as Rejected,
    countIf(has_executable = '1') as Has_Executable
FROM rspamd
WHERE toUInt32(attachment_count) > 0
GROUP BY Date, attachment_extensions;

-- Language detection view
CREATE MATERIALIZED VIEW language_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(Date)
ORDER BY (Date, language_detection)
AS SELECT
    Date,
    language_detection,
    count() as Messages,
    avg(Score) as Avg_Score,
    countIf(Action = 'reject') as Rejected
FROM rspamd
WHERE language_detection != ''
GROUP BY Date, language_detection;
```

## Advanced Column Configuration

### Selector Examples

Rspamd provides powerful selectors to extract data from messages. Here are additional examples:

```hcl
# /etc/rspamd/local.d/clickhouse.conf

extra_columns = {
  # Basic message properties
  "message_size" = "size";
  "recipient_count" = "rcpts:count";
  "mime_parts_count" = "parts:count";
  
  # Network and geographic information
  "client_hostname" = "hostname";
  "is_authenticated" = "user";
  
  # Header analysis
  "subject_length" = "header('Subject'):len";
  "from_domain" = "from:domain";
  "reply_to" = "header('Reply-To')";
  "message_id" = "header('Message-ID')";
  "content_type" = "header('Content-Type')";
  "x_mailer" = "header('X-Mailer')";
  "received_count" = "received:count";
  
  # URL analysis
  "url_count" = "urls:count";
  "unique_domains_count" = "urls:domains:count";
  
  # Time-based information
  "message_date" = "header('Date'):time('%Y-%m-%d')";
}
```

### Complete Custom Selector Integration

Here's how to integrate custom selectors with ClickHouse from start to finish:

#### Step 1: Register Custom Selectors

First, register your custom selectors in `/etc/rspamd/lua.local.d/`:

```lua
-- /etc/rspamd/lua.local.d/custom_selectors.lua
-- `custom_selectors` is arbitrary

local lua_selectors = require "lua_selectors"

-- Register custom extractors for ClickHouse analytics

-- Attachment count extractor
lua_selectors.register_extractor(rspamd_config, "attachment_count", {
  get_value = function(task, args)
    local parts = task:get_parts()
    local count = 0
    for _, part in ipairs(parts) do
      if part:get_filename() then
        count = count + 1
      end
    end
    return tostring(count), 'string'
  end,
  description = 'Get number of attachments'
})

-- Dangerous attachment detector
lua_selectors.register_extractor(rspamd_config, "has_dangerous_attachment", {
  get_value = function(task, args)
    local dangerous_exts = {exe=true, scr=true, bat=true, com=true, pif=true, vbs=true, js=true}
    local parts = task:get_parts()
    
    for _, part in ipairs(parts) do
      local filename = part:get_filename()
      if filename then
        local ext = filename:match("%.([^%.]+)$")
        if ext and dangerous_exts[ext:lower()] then
          return "1", 'string'
        end
      end
    end
    return "0", 'string'
  end,
  description = 'Check if message has dangerous attachments'
})

-- Attachment types collector
lua_selectors.register_extractor(rspamd_config, "attachment_types", {
  get_value = function(task, args)
    local parts = task:get_parts()
    local extensions = {}
    
    for _, part in ipairs(parts) do
      local filename = part:get_filename()
      if filename then
        local ext = filename:match("%.([^%.]+)$")
        if ext then
          table.insert(extensions, ext:lower())
        end
      end
    end
    return table.concat(extensions, ","), 'string'
  end,
  description = 'Get list of attachment file extensions'
})

-- Suspicious domains counter
lua_selectors.register_extractor(rspamd_config, "suspicious_domains_count", {
  get_value = function(task, args)
    local urls = task:get_urls()
    local suspicious_count = 0
    local suspicious_tlds = {tk=true, ml=true, ga=true, cf=true}
    
    for _, url in ipairs(urls) do
      local host = url:get_host()
      if host then
        local tld = host:match("%.([^%.]+)$")
        if tld and suspicious_tlds[tld:lower()] then
          suspicious_count = suspicious_count + 1
        end
      end
    end
    return tostring(suspicious_count), 'string'
  end,
  description = 'Count URLs with suspicious TLDs'
})

-- Text to HTML ratio calculator
lua_selectors.register_extractor(rspamd_config, "text_to_html_ratio", {
  get_value = function(task, args)
    local parts = task:get_parts()
    local text_parts = 0
    local html_parts = 0
    
    for _, part in ipairs(parts) do
      if part:is_text() then
        text_parts = text_parts + 1
      elseif part:is_html() then
        html_parts = html_parts + 1
      end
    end
    
    if html_parts > 0 then
      local ratio = text_parts / html_parts
      return string.format("%.2f", ratio), 'string'
    else
      return "0", 'string'
    end
  end,
  description = 'Calculate text to HTML parts ratio'
})

-- Language detection
lua_selectors.register_extractor(rspamd_config, "detected_languages", {
  get_value = function(task, args)
    local parts = task:get_parts()
    local languages = {}
    
    for _, part in ipairs(parts) do
      if part:is_text() then
        local lang = part:get_language()
        if lang then
          languages[lang] = true
        end
      end
    end
    
    local lang_list = {}
    for lang, _ in pairs(languages) do
      table.insert(lang_list, lang)
    end
    return table.concat(lang_list, ","), 'string'
  end,
  description = 'Get detected message languages'
})

-- Symbol groups statistics
lua_selectors.register_extractor(rspamd_config, "symbol_groups_stats", {
  get_value = function(task, args)
    local symbols = task:get_symbols_all()
    local groups = {}
    
    for name, symbol in pairs(symbols) do
      if symbol.score and symbol.score > 0 then
        local group = name:match("^([^_]+)")
        if group then
          groups[group] = (groups[group] or 0) + 1
        end
      end
    end
    
    local group_stats = {}
    for group, count in pairs(groups) do
      table.insert(group_stats, group .. ":" .. count)
    end
    return table.concat(group_stats, ","), 'string'
  end,
  description = 'Get symbol groups statistics'
})

-- Authentication results extractors

-- SPF result and domain
lua_selectors.register_extractor(rspamd_config, "spf_result", {
  get_value = function(task, args)
    if task:has_symbol('R_SPF_ALLOW') then
      return "pass", 'string'
    elseif task:has_symbol('R_SPF_FAIL') then
      return "fail", 'string'
    elseif task:has_symbol('R_SPF_SOFTFAIL') then
      return "softfail", 'string'
    elseif task:has_symbol('R_SPF_NEUTRAL') then
      return "neutral", 'string'
    elseif task:has_symbol('R_SPF_PERMFAIL') then
      return "permerror", 'string'
    else
      return "none", 'string'
    end
  end,
  description = 'Get SPF authentication result'
})

-- DKIM result and domain
lua_selectors.register_extractor(rspamd_config, "dkim_result", {
  get_value = function(task, args)
    if task:has_symbol('R_DKIM_ALLOW') then
      return "pass", 'string'
    elseif task:has_symbol('R_DKIM_REJECT') then
      return "fail", 'string'
    elseif task:has_symbol('R_DKIM_TEMPFAIL') then
      return "temperror", 'string'
    elseif task:has_symbol('R_DKIM_PERMFAIL') then
      return "permerror", 'string'
    else
      return "none", 'string'
    end
  end,
  description = 'Get DKIM authentication result'
})

-- DMARC result and policy
lua_selectors.register_extractor(rspamd_config, "dmarc_result", {
  get_value = function(task, args)
    if task:has_symbol('DMARC_POLICY_ALLOW') then
      return "pass", 'string'
    elseif task:has_symbol('DMARC_POLICY_REJECT') then
      return "reject", 'string'
    elseif task:has_symbol('DMARC_POLICY_QUARANTINE') then
      return "quarantine", 'string'
    elseif task:has_symbol('DMARC_POLICY_SOFTFAIL') then
      return "softfail", 'string'
    else
      return "none", 'string'
    end
  end,
  description = 'Get DMARC policy result'
})

-- Authentication alignment status
lua_selectors.register_extractor(rspamd_config, "auth_alignment", {
  get_value = function(task, args)
    local results = {}
    if task:has_symbol('R_SPF_ALLOW') then table.insert(results, "spf") end
    if task:has_symbol('R_DKIM_ALLOW') then table.insert(results, "dkim") end
    if task:has_symbol('DMARC_POLICY_ALLOW') then table.insert(results, "dmarc") end
    
    if #results > 0 then
      return table.concat(results, ","), 'string'
    else
      return "none", 'string'
    end
  end,
  description = 'Get authentication alignment summary'
})
```

#### Step 2: Use Custom Selectors in ClickHouse Configuration

After registering the selectors, use them in your ClickHouse configuration in `/etc/rspamd/local.d/clickhouse.conf`:

```hcl
extra_columns = {
  # Built-in selectors (available by default)
  "message_size" = "size";
  "from_domain" = "from:domain";
  
  # Your custom selectors (names must match what you registered!)
  "attachment_count" = "attachment_count()";          # Uses attachment_count selector
  "has_executable" = "has_dangerous_attachment()";    # Uses has_dangerous_attachment selector
  "attachment_extensions" = "attachment_types()";     # Uses attachment_types selector
  "suspicious_url_count" = "suspicious_domains_count()"; # Uses suspicious_domains_count selector
  "text_html_ratio" = "text_to_html_ratio()";        # Uses text_to_html_ratio selector
  "language_detection" = "detected_languages()";     # Uses detected_languages selector
  "symbol_groups_summary" = "symbol_groups_stats()"; # Uses symbol_groups_stats selector
  
  # Authentication results (custom selectors)
  "spf_result" = "spf_result()";                      # Uses spf_result selector
  "dkim_result" = "dkim_result()";                    # Uses dkim_result selector
  "dmarc_result" = "dmarc_result()";                  # Uses dmarc_result selector
  "auth_summary" = "auth_alignment()";                # Uses auth_alignment selector
}
```

#### Step 3: Restart and Verify

```bash
# Restart Rspamd to load new selectors
sudo systemctl restart rspamd

# Verify selectors are loaded
rspamadm configtest

# Test a custom selector directly
echo "test" | rspamc --header="Subject: Test" | grep -i attachment
```

#### Step 4: Check ClickHouse Table Structure

After Rspamd creates the table, verify your custom columns are included:

```bash
clickhouse-client --database=rspamd --query="DESCRIBE TABLE rspamd" | grep -E "(attachment|language|suspicious)"
```

You should see columns like:
- `attachment_count String`
- `has_executable String`
- `attachment_extensions String`
- `suspicious_url_count String`
- `text_html_ratio String`
- `language_detection String`
- `symbol_groups_summary String`

#### Step 5: Query Your Custom Data

Now you can use your custom columns in analytics queries:

```sql
-- Analyze attachment threats
SELECT 
    attachment_extensions,
    count() as Messages,
    countIf(has_executable = '1') as Dangerous_Count
FROM rspamd 
WHERE toUInt32(attachment_count) > 0
GROUP BY attachment_extensions
ORDER BY Dangerous_Count DESC;

-- Language-based spam analysis
SELECT 
    language_detection,
    count() as Messages,
    round(avg(Score), 2) as Avg_Score
FROM rspamd 
WHERE language_detection != ''
GROUP BY language_detection
ORDER BY Avg_Score DESC;

-- Authentication results analysis
SELECT 
    spf_result,
    dkim_result,
    dmarc_result,
    count() as Messages,
    round(avg(Score), 2) as Avg_Score,
    countIf(Action = 'reject') as Rejected
FROM rspamd 
WHERE Date >= today() - 7
GROUP BY spf_result, dkim_result, dmarc_result
ORDER BY Messages DESC;
```

**Key Points:**
- Selector names in `lua.local.d/custom_selectors.lua` must match those used in `clickhouse.conf`
- All custom selectors return string values to ClickHouse
- Restart Rspamd after adding new selectors
- Custom columns appear automatically in the ClickHouse table

## Advanced Analytics Queries

### Mail Volume Analysis

```sql
-- Daily mail volume by action
SELECT 
    Date,
    Action,
    count() as Messages,
    round(avg(Score), 2) as Avg_Score
FROM rspamd 
WHERE Date >= today() - 30
GROUP BY Date, Action
ORDER BY Date DESC, Action;

-- Hourly patterns
SELECT 
    toHour(DateTime) as Hour,
    Action,
    count() as Messages
FROM rspamd 
WHERE Date >= today() - 7
GROUP BY Hour, Action
ORDER BY Hour, Action;

-- Top sender domains
SELECT 
    domain(Sender) as Domain,
    count() as Messages,
    round(avg(Score), 2) as Avg_Score,
    countIf(Action = 'reject') as Rejected
FROM rspamd 
WHERE Date >= today() - 7
GROUP BY Domain
HAVING Messages > 100
ORDER BY Messages DESC
LIMIT 20;
```

### Spam Detection Effectiveness

```sql
-- Spam detection rates by score ranges
SELECT 
    multiIf(
        Score < 0, 'Ham (< 0)',
        Score < 5, 'Suspicious (0-5)',
        Score < 15, 'Likely Spam (5-15)',
        'Spam (> 15)'
    ) as Score_Range,
    count() as Messages,
    round(avg(Score), 2) as Avg_Score,
    round(count() / (SELECT count() FROM rspamd WHERE Date >= today() - 7) * 100, 2) as Percentage
FROM rspamd 
WHERE Date >= today() - 7
GROUP BY Score_Range
ORDER BY Avg_Score;

-- Symbol effectiveness analysis
SELECT 
    Symbol,
    count() as Triggered,
    round(avg(Score), 2) as Avg_Score,
    round(avg(arrayFirst(x -> x, Symbols_Scores)), 2) as Symbol_Score
FROM rspamd 
ARRAY JOIN Symbols as Symbol, Symbols_Scores
WHERE Date >= today() - 30 AND Action IN ('reject', 'add header')
GROUP BY Symbol
HAVING Triggered > 1000
ORDER BY Triggered DESC
LIMIT 30;
```

### Threat Intelligence

```sql
-- Suspicious IP analysis
SELECT 
    IP,
    count() as Messages,
    round(avg(Score), 2) as Avg_Score,
    countIf(Action = 'reject') as Rejected,
    countIf(Action = 'accept') as Accepted,
    round(countIf(Action = 'reject') / count() * 100, 2) as Reject_Rate
FROM rspamd 
WHERE Date >= today() - 30
GROUP BY IP
HAVING Messages > 50 AND Reject_Rate > 80
ORDER BY Messages DESC
LIMIT 50;

-- Phishing and malware detection
SELECT 
    Date,
    countIf(has(Symbols, 'PHISHING')) as Phishing,
    countIf(has(Symbols, 'MALWARE')) as Malware,
    countIf(has(Symbols, 'DMARC_POLICY_REJECT')) as DMARC_Fails
FROM rspamd 
WHERE Date >= today() - 30
GROUP BY Date
ORDER BY Date DESC;

-- Authentication failures by domain
SELECT 
    domain(Sender) as Domain,
    count() as Total_Messages,
    countIf(spf_result = 'fail') as SPF_Failures,
    countIf(dkim_result = 'fail') as DKIM_Failures,
    countIf(dmarc_result = 'reject') as DMARC_Rejections,
    round(countIf(spf_result = 'fail') / count() * 100, 2) as SPF_Fail_Rate,
    round(countIf(dmarc_result = 'reject') / count() * 100, 2) as DMARC_Reject_Rate
FROM rspamd 
WHERE Date >= today() - 30
GROUP BY Domain
HAVING Total_Messages > 50
ORDER BY DMARC_Reject_Rate DESC, SPF_Fail_Rate DESC
LIMIT 50;

-- Authentication success rates
SELECT 
    Date,
    countIf(auth_summary LIKE '%spf%') as SPF_Pass,
    countIf(auth_summary LIKE '%dkim%') as DKIM_Pass,
    countIf(auth_summary LIKE '%dmarc%') as DMARC_Pass,
    countIf(auth_summary = 'none') as No_Auth,
    count() as Total_Messages
FROM rspamd 
WHERE Date >= today() - 30
GROUP BY Date
ORDER BY Date DESC;

-- Geographic threat analysis (if GeoIP enabled)
SELECT 
    extractAll(arrayStringConcat(Symbols), 'COUNTRY_([A-Z]{2})')[1] as Country,
    count() as Messages,
    round(avg(Score), 2) as Avg_Score,
    countIf(Action = 'reject') as Rejected
FROM rspamd 
WHERE Date >= today() - 7 AND Country != ''
GROUP BY Country
HAVING Messages > 100
ORDER BY Rejected DESC
LIMIT 20;

-- Custom selector analysis - Attachment threats
SELECT 
    Date,
    attachment_extensions,
    count() as Messages,
    countIf(has_executable = '1') as Dangerous_Attachments,
    countIf(Action = 'reject') as Rejected,
    round(avg(Score), 2) as Avg_Score
FROM rspamd 
WHERE Date >= today() - 7 AND attachment_count != '0'
GROUP BY Date, attachment_extensions
HAVING Messages > 10
ORDER BY Dangerous_Attachments DESC, Rejected DESC
LIMIT 30;

-- Language detection and spam correlation
SELECT 
    language_detection,
    count() as Messages,
    round(avg(Score), 2) as Avg_Score,
    countIf(Action = 'reject') as Rejected,
    round(countIf(Action = 'reject') / count() * 100, 2) as Reject_Rate
FROM rspamd 
WHERE Date >= today() - 30 AND language_detection != ''
GROUP BY language_detection
HAVING Messages > 100
ORDER BY Reject_Rate DESC
LIMIT 20;
```

### Performance Monitoring

```sql
-- Scan time analysis
SELECT 
    multiIf(
        Scan_Time < 0.1, '< 100ms',
        Scan_Time < 0.5, '100-500ms',
        Scan_Time < 1.0, '500ms-1s',
        Scan_Time < 2.0, '1-2s',
        '> 2s'
    ) as Scan_Time_Range,
    count() as Messages,
    round(avg(Scan_Time), 3) as Avg_Scan_Time
FROM rspamd 
WHERE Date >= today() - 7
GROUP BY Scan_Time_Range
ORDER BY Avg_Scan_Time;

-- Message size vs scan time correlation
SELECT 
    multiIf(
        Size < 10240, '< 10KB',
        Size < 102400, '10-100KB',
        Size < 1048576, '100KB-1MB',
        Size < 10485760, '1-10MB',
        '> 10MB'
    ) as Size_Range,
    count() as Messages,
    round(avg(Scan_Time), 3) as Avg_Scan_Time,
    round(avg(Size / 1024), 2) as Avg_Size_KB
FROM rspamd 
WHERE Date >= today() - 7
GROUP BY Size_Range
ORDER BY Avg_Size_KB;
```

## Building Dashboards

### Grafana Integration

Install and configure Grafana with ClickHouse:

```bash
# Install Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana

# Start Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server

# Install ClickHouse plugin
sudo grafana-cli plugins install grafana-clickhouse-datasource
sudo systemctl restart grafana-server
```

### Dashboard Configuration

Create Grafana dashboard panels:

```json
{
  "dashboard": {
    "title": "Rspamd Mail Analytics",
    "panels": [
      {
        "title": "Daily Mail Volume",
        "type": "graph",
        "targets": [
          {
            "rawSql": "SELECT Date, Action, count() as Messages FROM rspamd WHERE Date >= today() - 30 GROUP BY Date, Action ORDER BY Date",
            "format": "time_series"
          }
        ]
      },
      {
        "title": "Top Rejected IPs",
        "type": "table",
        "targets": [
          {
            "rawSql": "SELECT IP, count() as Messages, round(avg(Score), 2) as Avg_Score FROM rspamd WHERE Date >= today() - 7 AND Action = 'reject' GROUP BY IP ORDER BY Messages DESC LIMIT 20"
          }
        ]
      },
      {
        "title": "Spam Score Distribution",
        "type": "histogram",
        "targets": [
          {
            "rawSql": "SELECT Score FROM rspamd WHERE Date >= today() - 7"
          }
        ]
      }
    ]
  }
}
```

### Real-time Monitoring

Create real-time monitoring queries:

```sql
-- Real-time spam detection (last hour)
SELECT 
    toStartOfMinute(DateTime) as Time,
    count() as Messages,
    countIf(Action = 'reject') as Rejected
FROM rspamd 
WHERE DateTime >= now() - INTERVAL 1 HOUR
GROUP BY Time
ORDER BY Time;

-- Active threats (last 15 minutes)
SELECT 
    IP,
    count() as Messages,
    round(avg(Score), 2) as Avg_Score
FROM rspamd 
WHERE DateTime >= now() - INTERVAL 15 MINUTE AND Score > 10
GROUP BY IP
HAVING Messages > 5
ORDER BY Messages DESC;
```

## Advanced Features

### Custom Analytics Functions

Create custom analytics functions:

```sql
-- User-defined function for spam probability
CREATE FUNCTION spam_probability AS (score) -> 
    multiIf(
        score < 0, 0,
        score > 15, 1,
        score / 15
    );

-- Use in queries
SELECT 
    Date,
    round(avg(spam_probability(Score)), 3) as Avg_Spam_Probability
FROM rspamd 
WHERE Date >= today() - 30
GROUP BY Date
ORDER BY Date;

-- Threat score calculation
CREATE FUNCTION threat_score AS (ip_messages, avg_score, reject_rate) ->
    (ip_messages / 1000) * avg_score * (reject_rate / 100);

SELECT 
    IP,
    threat_score(count(), avg(Score), countIf(Action = 'reject') / count() * 100) as Threat_Score
FROM rspamd 
WHERE Date >= today() - 7
GROUP BY IP
HAVING count() > 10
ORDER BY Threat_Score DESC
LIMIT 20;
```

### Machine Learning Integration

Integrate with ML platforms:

```sql
-- Export data for ML training
SELECT 
    Symbols,
    Symbols_Scores,
    Size,
    multiIf(Score < 5, 0, Score > 15, 1, 0.5) as Label
FROM rspamd 
WHERE Date >= today() - 90
FORMAT CSV;

-- Feature engineering for spam detection
SELECT 
    -- Basic features
    Size,
    length(Subject) as Subject_Length,
    Recipient_Count,
    
    -- Symbol features
    has(Symbols, 'SPF_FAIL') as Has_SPF_Fail,
    has(Symbols, 'DKIM_INVALID') as Has_DKIM_Invalid,
    has(Symbols, 'BAYES_SPAM') as Has_Bayes_Spam,
    
    -- Aggregated features
    length(Symbols) as Symbol_Count,
    arraySum(Symbols_Scores) as Total_Symbol_Score,
    
    -- Target
    multiIf(Action = 'reject', 1, Action = 'accept', 0, 0.5) as Label
    
FROM rspamd 
WHERE Date >= today() - 30
ORDER BY DateTime DESC;
```

### Alerting and Monitoring

Set up automated alerts:

```sql
-- Detect spam waves
SELECT 
    'Spam Wave Detected' as Alert_Type,
    count() as Messages,
    any(DateTime) as First_Seen
FROM rspamd 
WHERE DateTime >= now() - INTERVAL 10 MINUTE 
    AND Action = 'reject'
HAVING Messages > 100;

-- Detect unusual sender patterns
WITH sender_stats AS (
    SELECT 
        domain(Sender) as Domain,
        count() as Messages,
        avg(Score) as Avg_Score
    FROM rspamd 
    WHERE DateTime >= now() - INTERVAL 1 HOUR
    GROUP BY Domain
    HAVING Messages > 50
)
SELECT 
    'Suspicious Sender Domain' as Alert_Type,
    Domain,
    Messages,
    round(Avg_Score, 2) as Score
FROM sender_stats 
WHERE Avg_Score > 10
ORDER BY Messages DESC;

-- Performance degradation detection
SELECT 
    'Performance Issue' as Alert_Type,
    round(avg(Scan_Time), 3) as Avg_Scan_Time,
    count() as Messages
FROM rspamd 
WHERE DateTime >= now() - INTERVAL 5 MINUTE
HAVING Avg_Scan_Time > 2.0;
```

## Production Considerations

### Performance Optimization

Optimize ClickHouse for production:

```sql
-- Optimize table structure
OPTIMIZE TABLE rspamd FINAL;

-- Create additional indexes for common queries
ALTER TABLE rspamd ADD INDEX idx_score Score TYPE minmax GRANULARITY 8192;
ALTER TABLE rspamd ADD INDEX idx_symbols Symbols TYPE bloom_filter GRANULARITY 8192;

-- Partition management
SELECT 
    partition,
    count() as rows,
    formatReadableSize(sum(bytes_on_disk)) as size
FROM system.parts 
WHERE table = 'rspamd' AND active
GROUP BY partition
ORDER BY partition DESC;
```

### Data Retention Policies

Implement data lifecycle management:

```sql
-- Create tiered storage (if using ClickHouse Cloud)
ALTER TABLE rspamd MODIFY TTL 
    Date + INTERVAL 7 DAY TO DISK 'hot',
    Date + INTERVAL 30 DAY TO DISK 'cold',
    Date + INTERVAL 90 DAY DELETE;

-- Archive old data
CREATE TABLE rspamd_archive AS rspamd 
ENGINE = MergeTree()
ORDER BY Date;

-- Move old data to archive
INSERT INTO rspamd_archive 
SELECT * FROM rspamd 
WHERE Date < today() - 365;

-- Delete archived data from main table
ALTER TABLE rspamd DELETE 
WHERE Date < today() - 365;
```

### Backup and Recovery

Set up backup procedures:

```bash
#!/bin/bash
# clickhouse_backup.sh

BACKUP_DIR="/backup/clickhouse"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Backup schema
clickhouse-client --query="SHOW CREATE TABLE rspamd.rspamd" > "$BACKUP_DIR/$DATE/schema.sql"

# Backup data (last 30 days)
clickhouse-client --query="SELECT * FROM rspamd.rspamd WHERE Date >= today() - 30 FORMAT Native" > "$BACKUP_DIR/$DATE/data.native"

# Compress backup
tar -czf "$BACKUP_DIR/rspamd_backup_$DATE.tar.gz" -C "$BACKUP_DIR" "$DATE"
rm -rf "$BACKUP_DIR/$DATE"

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "rspamd_backup_*.tar.gz" -mtime +30 -delete
```

### Security Considerations

Secure your ClickHouse installation:

```xml
<!-- /etc/clickhouse-server/config.d/network.xml -->
<yandex>
    <listen_host>127.0.0.1</listen_host>
    <!-- Only allow local connections for security -->
    
    <!-- If you need remote access, use proper authentication -->
    <!-- <listen_host>0.0.0.0</listen_host> -->
</yandex>
```

For production environments with remote access:

```xml
<!-- /etc/clickhouse-server/users.d/rspamd.xml -->
<yandex>
    <users>
        <rspamd_user>
            <password_sha256_hex>your_secure_password_hash</password_sha256_hex>
            <networks>
                <ip>127.0.0.1</ip>
                <ip>10.0.0.0/8</ip>
                <!-- Add your network ranges -->
            </networks>
            <profile>default</profile>
            <quota>default</quota>
            <databases>
                <database>rspamd</database>
            </databases>
        </rspamd_user>
    </users>
</yandex>
```

## Troubleshooting

### Common Issues

1. **Connection problems**:
   ```bash
   # Check ClickHouse status
   sudo systemctl status clickhouse-server
   
   # Test connection
   clickhouse-client --query="SELECT 1"
   
   # Check Rspamd logs
   grep -i clickhouse /var/log/rspamd/rspamd.log
   ```

2. **Performance issues**:
   ```sql
   -- Check query performance
   SELECT query, elapsed FROM system.query_log 
   WHERE type = 'QueryFinish' 
   ORDER BY elapsed DESC 
   LIMIT 10;
   
   -- Monitor resource usage
   SELECT * FROM system.metrics 
   WHERE metric LIKE '%Memory%' OR metric LIKE '%CPU%';
   ```

3. **Data consistency**:
   ```sql
   -- Check for missing data
   SELECT Date, count() as Messages 
   FROM rspamd 
   WHERE Date >= today() - 7 
   GROUP BY Date 
   ORDER BY Date;
   
   -- Verify table integrity
   CHECK TABLE rspamd;
   ```

This comprehensive guide provides everything needed to build a powerful mail analytics platform using ClickHouse with Rspamd. 