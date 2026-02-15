---
title: Clickhouse module
---

# Clickhouse module

The Clickhouse module pushes message-related metadata to [ClickHouse](https://clickhouse.com/), an open-source column-oriented database management system optimized for real-time analytics. Collected data includes sender/recipient information, scores, and metadata such as DKIM/DMARC/SPF/Bayes/Fuzzy status, URLs, and attachments.

This module enables you to build analytical dashboards using tools like [Redash](https://redash.io) or [Grafana](https://grafana.com/).

## Configuration

Settings go in `/etc/rspamd/local.d/clickhouse.conf`.

### Basic configuration

~~~hcl
# local.d/clickhouse.conf

# ClickHouse server address (required)
server = "localhost:8123";

# Connection timeout in seconds
timeout = 5;

# Periodic check timeout
check_timeout = 10.0;

# Database name
database = "default";

# Authentication (optional)
# user = "default";
# password = "secret";

# Use HTTPS
use_https = false;

# Disable SSL certificate verification
no_ssl_verify = false;

# Enable gzip compression for data transfer (enabled by default)
use_gzip = true;
~~~

### Data collection limits

Controls when accumulated data is sent to ClickHouse:

~~~hcl
# local.d/clickhouse.conf

limits {
  # Send when this many rows accumulated (0 to disable)
  max_rows = 1000;
  
  # Send when memory usage exceeds this limit
  max_memory = 50mb;
  
  # Maximum time between sends
  max_interval = 60s;
}

# Perform garbage collection after sending data
collect_garbage = false;
~~~

**Note:** The legacy `limit` option is deprecated; use `limits.max_rows` instead.

### IP masking

~~~hcl
# local.d/clickhouse.conf

# Bits to mask for IPv4 addresses (default: 19)
ipmask = 19;

# Bits to mask for IPv6 addresses (default: 48)
ipmask6 = 48;
~~~

### Content options

~~~hcl
# local.d/clickhouse.conf

# Store full URL paths (default: false, stores only hosts)
full_urls = false;

# Store message digest/hash
enable_digest = false;

# Store symbols data (Names, Scores, Options, Groups)
enable_symbols = false;

# Store data for local/controller scans
allow_local = false;
~~~

### Subject storage

~~~hcl
# local.d/clickhouse.conf

# Store email subject (default: false)
insert_subject = false;

# Obfuscate subject with hash
subject_privacy = false;

# Hash algorithm for obfuscation
subject_privacy_alg = "blake2";

# Prefix for obfuscated subjects
subject_privacy_prefix = "obf";

# Length of hash to use
subject_privacy_length = 16;
~~~

### Symbol mapping

Configure which symbols map to the Is* columns:

~~~hcl
# local.d/clickhouse.conf

# Bayes classification
bayes_spam_symbols = ["BAYES_SPAM"];
bayes_ham_symbols = ["BAYES_HAM"];

# Neural network classification
ann_symbols_spam = ["NEURAL_SPAM"];
ann_symbols_ham = ["NEURAL_HAM"];

# Fuzzy check
fuzzy_symbols = ["FUZZY_DENIED"];

# Whitelist (affects IsWhitelist column)
whitelist_symbols = ["WHITELIST_DKIM", "WHITELIST_SPF_DKIM", "WHITELIST_DMARC"];

# DKIM status
dkim_allow_symbols = ["R_DKIM_ALLOW"];
dkim_reject_symbols = ["R_DKIM_REJECT"];
dkim_dnsfail_symbols = ["R_DKIM_TEMPFAIL", "R_DKIM_PERMFAIL"];
dkim_na_symbols = ["R_DKIM_NA"];

# DMARC status
dmarc_allow_symbols = ["DMARC_POLICY_ALLOW"];
dmarc_reject_symbols = ["DMARC_POLICY_REJECT"];
dmarc_quarantine_symbols = ["DMARC_POLICY_QUARANTINE"];
dmarc_softfail_symbols = ["DMARC_POLICY_SOFTFAIL"];
dmarc_na_symbols = ["DMARC_NA"];

# SPF status
spf_allow_symbols = ["R_SPF_ALLOW"];
spf_reject_symbols = ["R_SPF_FAIL"];
spf_dnsfail_symbols = ["R_SPF_DNSFAIL", "R_SPF_PERMFAIL"];
spf_neutral_symbols = ["R_SPF_NEUTRAL", "R_SPF_SOFTFAIL"];
spf_na_symbols = ["R_SPF_NA"];
~~~

### Filtering

~~~hcl
# local.d/clickhouse.conf

# Symbols that prevent ClickHouse logging when present
stop_symbols = [];

# Map expressions to skip certain messages
# exceptions = {
#   symbol_options = {
#     selector = "check_symbol_options";
#     map = "/etc/rspamd/clickhouse_exceptions.map";
#   };
# };
~~~

### Retention policy

Automatic cleanup of old data for GDPR compliance:

~~~hcl
# local.d/clickhouse.conf

retention {
  # Enable retention (default: false)
  enable = true;
  
  # Method: "drop" or "detach"
  # See: https://clickhouse.com/docs/en/sql-reference/statements/alter/partition
  method = "drop";
  
  # Keep data for this many months
  period_months = 3;
  
  # How often to run cleanup
  run_every = 7d;
}
~~~

### Extra columns

Add custom columns using selectors (Rspamd 2.4+, ClickHouse 19.3+):

~~~hcl
# local.d/clickhouse.conf

extra_columns = {
  Mime_From = {
    selector = "from('mime'):addr";
    type = "String";
    default_value = "";
    comment = "MIME From address";
  };
  Mime_Rcpt = {
    selector = "rcpts('mime'):addr";
    type = "Array(String)";
  };
};
~~~

Or as an array for strict ordering:

~~~hcl
extra_columns = [
  {
    name = "Mime_From";
    selector = "from('mime'):addr";
    type = "String";
  },
  {
    name = "Mime_Rcpt";
    selector = "rcpts('mime'):addr";
    type = "Array(String)";
  }
];
~~~

### Schema additions

Add custom SQL statements executed during schema setup:

~~~hcl
# local.d/clickhouse.conf

schema_additions = [
  "CREATE TABLE IF NOT EXISTS rspamd_custom (...) ENGINE = MergeTree() ...",
];
~~~

### Custom rules

Define custom tables with their own schemas:

~~~hcl
# local.d/clickhouse.conf

custom_rules {
  my_rule {
    schema = "CREATE TABLE IF NOT EXISTS my_table ...";
    first_row = "return function() return 'INSERT INTO my_table ...' end";
    get_row = "return function(task) return {...} end";
  };
};
~~~

## Dynamic extra tables API

*Available since version 3.14.3*

The Clickhouse module exposes a Lua API that allows other plugins to register custom tables at runtime. This enables plugins to store their own data in ClickHouse without modifying the core clickhouse configuration.

### API functions

Access via `rspamd_plugins['clickhouse']`:

| Function | Description |
|----------|-------------|
| `register_extra_table(opts)` | Register a new table with schema, insert query, and row callback |
| `unregister_extra_table(name)` | Remove a registered table |
| `get_extra_tables()` | List all registered tables |
| `is_enabled()` | Check if clickhouse plugin is active |

### Features

- **Lazy schema upload**: Table schema is created on first data flush, not at registration time
- **Multi-row support**: `get_row` callback can return a single row `{...}` or an array of rows `{{...}, {...}}`
- **Per-table retention**: Each registered table can have independent retention period and method (drop/detach)
- **Error resilience**: Callbacks are wrapped in pcall; errors are logged but don't affect other tables

### Example usage

~~~lua
rspamd_config:add_on_load(function(cfg, ev_base, worker)
  if worker:is_scanner() and rspamd_plugins['clickhouse'] and 
     rspamd_plugins['clickhouse'].is_enabled() then
    rspamd_plugins['clickhouse'].register_extra_table({
      name = 'my_plugin_stats',
      table_name = 'rspamd_my_plugin',
      schema = [[CREATE TABLE IF NOT EXISTS rspamd_my_plugin (
        Date Date, TS DateTime, MessageId String, CustomData String
      ) ENGINE = MergeTree() PARTITION BY toMonday(Date) ORDER BY TS]],
      insert_query = function() 
        return 'INSERT INTO rspamd_my_plugin (Date, TS, MessageId, CustomData)' 
      end,
      get_row = function(task)
        local ts = task:get_date({format = 'connect', gmt = true})
        return { os.date('!%Y-%m-%d', ts), ts, task:get_message_id() or '', 'data' }
      end,
      retention = { enable = true, period_months = 3, method = 'detach' }
    })
  end
end)
~~~

### Registration options

| Option | Type | Description |
|--------|------|-------------|
| `name` | String | Unique identifier for the registration |
| `table_name` | String | ClickHouse table name |
| `schema` | String | CREATE TABLE statement |
| `insert_query` | Function | Returns INSERT statement string |
| `get_row` | Function | Returns row data for a task (single row or array) |
| `retention` | Table | Optional retention settings: `enable`, `period_months`, `method` |

### Task UUID (3.15+)

*Available since version 3.15*

The module can store a native UUID v7 (RFC 9562) for each task, enabling efficient cross-system correlation and time-based queries:

~~~hcl
# local.d/clickhouse.conf

# Enable UUID column (default: true)
enable_uuid = true;
~~~

UUID v7 uses a 48-bit millisecond timestamp prefix, which works efficiently with ClickHouse's `Delta` codec for compression. The UUID is generated at task creation time and remains consistent across all plugins that use it.

## Database schema

The module creates a `rspamd` table with the following columns:

| Column | Type | Description |
|--------|------|-------------|
| `Date` | Date | Date (used for partitioning) |
| `TS` | DateTime | Timestamp (UTC) |
| `TaskUUID` | UUID | Native UUID v7 for task identification (3.15+, Delta+LZ4 codec) |
| `From` | String | Envelope sender domain |
| `MimeFrom` | String | MIME From domain |
| `IP` | String | Sender IP (masked) |
| `Helo` | String | SMTP HELO hostname |
| `Score` | Float32 | Message score |
| `NRcpt` | UInt8 | Number of recipients |
| `Size` | UInt32 | Message size (bytes) |
| `IsWhitelist` | Enum8 | Whitelist status |
| `IsBayes` | Enum8 | Bayes classification |
| `IsFuzzy` | Enum8 | Fuzzy check result |
| `IsFann` | Enum8 | Neural network result |
| `IsDkim` | Enum8 | DKIM status |
| `IsDmarc` | Enum8 | DMARC status |
| `IsSpf` | Enum8 | SPF status |
| `NUrls` | Int32 | Number of URLs |
| `Action` | Enum8 | Rspamd action |
| `CustomAction` | String | Custom action name |
| `SMTPRecipients` | Array(String) | Envelope recipients |
| `MimeRecipients` | Array(String) | MIME recipients |
| `MessageId` | String | Message-ID |
| `ListId` | String | List-Id header |
| `Subject` | String | Subject (if enabled) |
| `Attachments.*` | Arrays | Attachment info |
| `Urls.*` | Arrays | URL info |
| `Emails` | Array(String) | Extracted emails |
| `ASN` | UInt32 | AS number |
| `Country` | FixedString(2) | Country code |
| `Symbols.*` | Arrays | Symbol info (if enabled) |
| `Groups.*` | Arrays | Group scores (if enabled) |
| `ScanTimeReal` | UInt32 | Scan time (ms) |
| `AuthUser` | String | Authenticated user |
| `SettingsId` | String | Settings profile |

## Query examples

### Top spam sender domains

~~~sql
SELECT From, count() AS c
FROM rspamd
WHERE Date = today() 
  AND Action IN ('reject', 'add header')
GROUP BY From
ORDER BY c DESC
LIMIT 10
~~~

### Failed DKIM by domain and IP

~~~sql
SELECT From, IP, count() AS c
FROM rspamd
WHERE Date = today() AND IsDkim = 'reject'
GROUP BY From, IP
ORDER BY c DESC
LIMIT 10
~~~

### Top attachment types in spam

~~~sql
SELECT count() AS c, d
FROM rspamd
ARRAY JOIN Attachments.ContentType AS d
WHERE Date = today() 
  AND Action IN ('reject', 'add header')
GROUP BY d
ORDER BY c DESC
LIMIT 5
~~~

### Mailing list statistics

~~~sql
SELECT ListId, IP, count() AS c
FROM rspamd
WHERE Date = today() AND ListId != ''
GROUP BY ListId, IP
ORDER BY c DESC
LIMIT 10
~~~

## URL flags

Since version 2.8, URLs are stored with flags indicating their source. Use bit operations to filter:

| Bit | Flag | Description |
|-----|------|-------------|
| 0 | PHISHED | URL is phished |
| 1 | NUMERIC | URL has numeric IP |
| 4 | HTML_DISPLAYED | From HTML display text |
| 5 | TEXT | From text part |
| 6 | SUBJECT | From subject |
| 13 | HAS_PORT | URL has explicit port |
| 15 | NO_SCHEMA | URL had no schema |
| 18 | DISPLAY_URL | Display URL |
| 19 | IMAGE | From img src |
| 20 | QUERY | Extracted from query string |
| 21 | CONTENT | From content (PDF) |
| 22 | NO_TLD | URL has no TLD |

### Filter out image and PDF URLs

~~~sql
SELECT
  MessageId,
  arrayMap(x -> x.1, 
    arrayFilter(x -> NOT bitTestAny(x.2, 19, 21), 
      arrayZip(Urls.Url, Urls.Flags))) AS regular_urls
FROM rspamd
WHERE Date = today()
~~~

### Select only image URLs

~~~sql
SELECT Urls.Url
FROM rspamd
ARRAY JOIN Urls
WHERE Date = today() AND bitTest(Urls.Flags, 19)
~~~
