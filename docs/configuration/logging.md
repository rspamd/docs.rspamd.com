---
title: Logging settings
---


# Rspamd logging settings




## Introduction

Rspamd offers various logging options. Firstly, there are three supported types of log output: `console` logging, which outputs log messages to the console; `file` logging, which directs log messages to a file; and logging via the `syslog` daemon. Additionally, it is possible to limit logging to a specific level:

| Level          | Description                       |
| :-------------- | :-------------------------------- |
| `error` | log only critical errors
| `warning` | log errors and warnings
| `notice` | log only important notices + scan messages results
| `info` | log all non-debug messages
| `silent` | log at `info` level on start and then reduce to `notice` level when forking worker processes
| `debug` | log all including debug messages (huge amount of logging)

You have the option to enable debug messages for specific IP addresses, which can be beneficial for testing purposes. Each logging type has specific mandatory parameters: log facility for syslog (refer to the `syslog(3)` man page for facility details), and log file for file logging. File logging can also be buffered for improved performance. In order to reduce logging noise, Rspamd detects consecutive matching log messages and replaces them with the total number of repeated occurrences.

	#81123(fuzzy): May 11 19:41:54 rspamd file_log_function: Last message repeated 155 times
	#81123(fuzzy): May 11 19:41:54 rspamd process_write_command: fuzzy hash was successfully added

## Unique ID

Starting from version 1.0, Rspamd logs include a unique ID for each logging message, enabling efficient search for relevant messages. Additionally, there is now a `module` definition that specifies the module associated with the log message, such as `task` or `cfg` modules. Here is a brief example to illustrate how it works: let's consider an incoming task for a specific message. In the logs, you would observe something similar to the following entry:

    2015-09-02 16:41:59 #45015(normal) <ed2abb>; task; accept_socket: accepted connection from ::1 port 52895
    2015-09-02 16:41:59 #45015(normal) <ed2abb>; task; rspamd_message_parse: loaded message; id: <F66099EE-BCAB-4D4F-A4FC-7C15A6686397@FreeBSD.org>; queue-id: <undef>

In this case, the tag `ed2abb` is assigned to the task, and all subsequent processing related to that task will bear the same tag. This tagging feature is not limited to the `task` module alone; it is also enabled in other modules like `spf` or `lua`. For certain modules like `cfg`, the tag is generated statically using a specific characteristic, such as the checksum of the configuration file.

## Configuration parameters

Here is a summary of the logging parameters, each of which can be redefined or defined in the `local.d/logging.inc` file:

| Parameter          | Description                       |
| :-------------- | :-------------------------------- |
| `type` | Defines logging type (file, console or syslog). For some types mandatory attributes may be required.
| `filename` | Path to log file for file logging (required for **file** type)
| `facility` | Logging facility for **syslog** type (required if this type is used)
| `level` | Defines logging level (error, warning, notice, info, silent, or debug).
| `log_buffered` | Flag that controls whether logging is buffered.
| `log_buf_size` | For file and console logging defines buffer size that will be used for logging output.
| `log_urls` | Flag that defines whether all URLs in message should be logged. Useful for testing. Default: `false`.
| `log_re_cache` | Output regular expressions statistics after each message. Default: `true`.
| `debug_ip` | List that contains IP addresses for which debugging should be turned on. Can be specified as a map.
| `color` | Turn on coloring for log messages (console logging only). Default: `false`.
| `systemd` | If `true` timestamps aren't prepended to log messages. Default: `false`.
| `debug_modules` | A list of modules that are enabled for debugging.
| `log_usec` | Log microseconds (e.g. `11:43:16.68071`). Default: `false`.
| `log_severity` (2.8+) | Log severity explicitly (e.g. `[info]` or `[error]`). Default: `false`.
| `log_json` (3.8+) | If `true` logs are emitted in JSON format (implies `log_severity=true` and `systemd=false`). Default: `false`. Works with all log types including syslog.
| `encryption_key` | Public key used to encrypt sensitive information in logs. Uses NaCl cryptobox encryption.
| `error_elts` | Size of circular buffer for storing last errors. Default: `10`.
| `error_maxlen` | Maximum size of each element in error log buffer. Default: `1000`.
| `task_max_elts` | Maximum number of elements in task logging output. Default: `7`.
| `max_tag_len` (3.10+) | Maximum length of log tag displayed in log messages. Can be 1-32. Default: `6`.
| `tag_strip_policy` (3.10+) | Policy for stripping long log tags: `right` (cut right part), `left` (keep last characters), `middle` (keep start and end). Default: `right`.


### JSON logging format

When `log_json` is enabled (version 3.8+), log messages are emitted in JSON format. This works with all logging types including file, console, and syslog. Each log entry contains the following fields:

```json
{
  "ts": 1699123456.789,
  "pid": 12345,
  "severity": "info",
  "worker_type": "normal",
  "id": "abc123",
  "module": "task",
  "function": "process_message",
  "message": "Message processed successfully"
}
```

The JSON output is useful for log aggregation systems like Elasticsearch, Loki, or Splunk. Special characters in messages are properly escaped.

### Defined debug modules

Here is a list of C debug modules defined in Rspamd:

| Module          | Description                       |
| :-------------- | :-------------------------------- |
| `archive` | messages from archive processing
| `bayes` | messages from Bayes classifier
| `chartable` | messages from chartable plugin
| `composites` | debug composite symbols
| `config` | configuration messages
| `control` | control interface messages
| `controller` | controller worker messages
| `css` | CSS parsing messages
| `dkim` | messages from DKIM module
| `events` | async events/session messages
| `expression` | expression parsing and evaluation
| `fuzzy_check` | fuzzy check plugin messages
| `fuzzy_redis` | fuzzy Redis backend messages
| `fuzzy_sqlite` | fuzzy SQLite backend messages
| `fuzzy_storage` | fuzzy storage worker messages
| `html` | HTML parsing messages
| `http_context` | HTTP context messages
| `hyperscan` | Hyperscan/Vectorscan engine messages
| `images` | image processing messages
| `langdet` | language detector messages
| `lua_redis` | Lua Redis module messages
| `lua_tcp` | Lua TCP module messages
| `lua_threads` | Lua thread pool messages
| `lua_udp` | Lua UDP module messages
| `luacl` | Lua classifier messages
| `map` | messages from maps in Rspamd
| `metric` | scan result/metric messages
| `milter` | milter interface messages
| `mime` | MIME parsing messages
| `monitored` | monitored objects messages
| `protocol` | protocol processing messages
| `proxy` | proxy worker messages
| `radix` | radix tree messages
| `re_cache` | regular expressions cache messages
| `redis_pool` | Redis connection pool messages
| `rrd` | RRD (round-robin database) messages
| `spf` | SPF module messages
| `ssl` | SSL/TLS messages
| `stat_http` | HTTP statistics backend messages
| `stat_redis` | Redis statistics backend messages
| `symcache` | symbols cache messages
| `task` | task processing messages
| `tokenizer` | tokenizer messages
| `upstream` | upstream selection messages
| `xmlrpc` | XML-RPC messages
 
Any Lua module can also be added to `debug_modules` as they use similar naming semantics. For example, you can use `dkim_signing`, `multimap`, `rbl`, `arc`, or `spf` to debug the corresponding Lua modules.

### Log tag configuration

Starting from version 3.10, Rspamd allows customization of log tag display. The log tag is the unique identifier shown in angle brackets (e.g., `<abc123>`) that helps trace related log messages for a specific task or operation.

By default, log tags are truncated to 6 characters. You can increase this up to 32 characters using `max_tag_len`. When a tag exceeds the maximum length, it is stripped according to `tag_strip_policy`:

- `right` (default): Keeps the beginning of the tag (e.g., `abcdef...` → `abcdef`)
- `left`: Keeps the end of the tag (e.g., `...uvwxyz` → `uvwxyz`)
- `middle`: Keeps both start and end (e.g., `abc...xyz`)

### Log tag propagation in proxy mode

When running Rspamd in proxy mode (especially with milter protocol), the log tag can be propagated from the MTA through the entire processing chain. This enables correlation of log messages across different components using the same identifier (typically the MTA's Queue-ID).

The `rspamd_proxy` worker supports the `log_tag_type` option that controls how log tags are passed to backend workers:

| Value | Description |
| :---- | :---------- |
| `session` | Use proxy session's internal tag (default) |
| `queue_id` | Use Queue-ID from the client (MTA) if available |
| `none` | Don't pass log tag to backend |

Here's an ASCII diagram showing log tag flow in milter proxy mode:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              POSTFIX MTA                                    │
│                         Queue-ID: ABC123DEF                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ milter protocol
                                    │ sends {i} macro = "ABC123DEF"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RSPAMD PROXY                                      │
│                         (milter = true)                                     │
│                                                                             │
│  1. Receives Queue-ID via milter macro {i}                                  │
│  2. Creates HTTP request to backend                                         │
│  3. Adds header based on log_tag_type:                                      │
│     - session:  Log-Tag: <proxy_session_uid>                                │
│     - queue_id: Log-Tag: ABC123DEF         ◄── uses MTA's Queue-ID          │
│     - none:     (no Log-Tag header)                                         │
│                                                                             │
│  Proxy logs: <xyz789>  (own session tag)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP protocol
                                    │ Queue-ID: ABC123DEF
                                    │ Log-Tag: ABC123DEF (if log_tag_type = queue_id)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RSPAMD WORKER                                      │
│                                                                             │
│  Receives Log-Tag header → uses as task log tag                             │
│  Worker logs: <ABC123D> (truncated to max_tag_len)                          │
│                                                                             │
│  Now MTA logs and Rspamd logs share the same identifier!                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

Configuration example for proxy worker:

```
worker "rspamd_proxy" {
    bind_socket = "localhost:11332";
    milter = true;
    
    upstream "local" {
        self_scan = true;
        # Use MTA's Queue-ID for log correlation
        log_tag_type = "queue_id";
    }
}
```

With this configuration, you can correlate Postfix mail.log entries with Rspamd log entries using the same Queue-ID:

```
# Postfix mail.log
Nov 25 10:15:30 mail postfix/smtpd[1234]: ABC123DEF: client=example.com[1.2.3.4]
Nov 25 10:15:31 mail postfix/cleanup[1235]: ABC123DEF: message-id=<msg@example.com>

# Rspamd log (with max_tag_len = 8)
Nov 25 10:15:31 #5678(normal) <ABC123DE>; task; ... message processed
```

### Error log buffer

Rspamd maintains a circular buffer of recent error messages that can be accessed via the controller's `/errors` endpoint. This is useful for monitoring and debugging without parsing log files. Configure it with:

- `error_elts`: Number of error entries to keep (default: 10)
- `error_maxlen`: Maximum length of each error message (default: 1000)

### Configuration example

Here is a comprehensive example of logging configuration:

```
logging {
    type = "file";
    filename = "/var/log/rspamd/rspamd.log";
    level = "info";
    
    # Enable severity and microseconds for detailed logging
    log_severity = true;
    log_usec = true;
    
    # Buffer settings for performance
    log_buffered = true;
    log_buf_size = 32768;
    
    # Error buffer for /errors endpoint
    error_elts = 100;
    error_maxlen = 2000;
    
    # Extended log tag (useful for high-volume environments)
    max_tag_len = 12;
    tag_strip_policy = "middle";
    
    # Debug specific modules
    debug_modules = ["dkim", "spf", "dkim_signing"];
    
    # Debug only for specific IPs
    debug_ip = "192.168.1.0/24";
}
```

For JSON logging to a log aggregation system:

```
logging {
    type = "file";
    filename = "/var/log/rspamd/rspamd.json";
    level = "info";
    log_json = true;
}
```

## Log format

Rspamd supports a custom log format for writing message information to the log. This feature has been supported since version 1.1. The format string for the custom log format is as follows:

	log_format =<<EOD
	id: <$mid>,$if_qid{ qid: <$>,}$if_ip{ ip: $,}$if_user{ user: $,}$if_smtp_from{ from: <$>,}
	(default: $is_spam ($action): [$scores] [$symbols]),
	len: $len, time: $time_real real,
	$time_virtual virtual, dns req: $dns_req
	EOD

Newlines are replaced with spaces in the custom log format. The log format line can include both text and variables. Each variable can have an optional `if_` prefix, which will log the variable only if it is triggered. Additionally, each variable can have an optional body value where `$` is replaced with the variable's value. The `$` placeholder can be repeated multiple times in the body. For example, `$if_var{$$$$}` will be replaced with the variable's name repeated four times.

### Log variables

Rspamd supports the following log variables:

| Variable          | Description                       |
| :-------------- | :-------------------------------- |
| `action` | default metric action
| `digest` | cryptographic digest of a message's content (stripped to 16 bytes or 32 hex symbols)
| `dns_req` | number of DNS requests
| `filename` (from 1.8.0) | name of file if HTTP agent (e.g. rspamc) passes it
| `forced_action` (from 1.8.2) | forced action if form `<action> "<message>"; score=<score> (set by <module>)`
| `groups` (from 2.0) | symbols groups list for a task
| `ip` | from IP
| `is_spam` | a one-letter rating of spammyness: `T` for spam, `F` for ham and `S` for skipped messages
| `len` | length of message
| `lua` | custom Lua script (see below)
| `mid` | message ID
| `mime_from` | MIME from
| `mime_rcpt` | MIME rcpt - the first recipient
| `mime_rcpts` | MIME rcpts - all recipients
| `public_groups` (from 2.0) | public groups only (similar to groups but more restricted)
| `qid` | queue ID
| `scores` | summary of scores
| `settings_id` (from 2.0) | settings id for a message
| `smtp_from` | envelope from (or MIME from if SMTP from is absent)
| `smtp_rcpt` | envelope rcpt (or MIME from if SMTP from is absent) - the first recipient
| `smtp_rcpts` | envelope rcpts - all recipients
| `symbols_params` | list of all symbols and their options
| `symbols_scores_params` | list of all symbols, their scores and options
| `symbols_scores` | list of all symbols and their scores
| `symbols` | list of all symbols
| `time_real` | real time of task processing
| `time_virtual` (till 2.0) | CPU time of task processing
| `user` | authenticated user

Custom logging scripts could look like the following:

~~~lua
$lua{
  return function(task) 
    return 'text parts: ' .. tostring(#task:get_text_parts()) 
  end
}
~~~

this script will log number of text part in messages.
