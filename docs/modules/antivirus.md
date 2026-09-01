---
title: Antivirus module
---

# Antivirus module

The Antivirus module, available from Rspamd version 1.4, integrates with various virus scanners. Currently, the following scanners are supported:

* [Avast Antivirus](https://www.avast.com/business/products/antivirus-for-linux) (via socket protocol)
* [Avira](https://oem.avira.com/en/solutions/anti-malware#SAV) (via SAVAPI)
* [ClamAV](https://www.clamav.net)
* F-Prot (End-of-Life as of 31-July-2021)
* [Kaspersky antivirus](https://www.kaspersky.com/small-to-medium-business-security/linux-mail-server) (from 1.8.3)
* [Kaspersky Scan Engine](https://www.kaspersky.com/scan-engine) (from 2.0)
* [MetaDefender Cloud](https://metadefender.opswat.com/) (hash-based lookups)
* [Sophos](https://www.sophos.com/) (via SAVDI)
* [VirusTotal](https://www.virustotal.com/) (hash-based lookups)

## Configuration

The configuration for an antivirus setup is accomplished by defining rules. If the antivirus reports one or more viruses, the configured symbol (e.g. `CLAM_VIRUS`) will be set, with the virus name as the description. If set, the configured action will be triggered.

In case of errors during the connection or if the antivirus reports failures, the fail symbol (e.g. `CLAM_VIRUS_FAIL`) will be set, with the error message as the description. The [force_actions](/modules/force_actions) module can be used to perform a `soft reject` if the antivirus has failed to scan the email, such as during a database reloading.

In addition to the `SYMBOLNAME` and `SYMBOLNAME_FAIL` symbols, there are two special symbols indicating that the scanner has reported encrypted parts or parts with Office macros: `SYMBOLNAME_ENCRYPTED` and `SYMBOLNAME_MACRO`.

Settings should be added to `/etc/rspamd/local.d/antivirus.conf`.

### Common configuration options

All scanner types support these common options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | (required) | Scanner type: `clamav`, `fprot`, `sophos`, `savapi`, `kaspersky`, `kaspersky_se`, `avast`, `virustotal`, `metadefender` |
| `symbol` | string | (auto) | Symbol to set when virus is found |
| `symbol_fail` | string | `{SYMBOL}_FAIL` | Symbol to set on scan failure |
| `symbol_encrypted` | string | `{SYMBOL}_ENCRYPTED` | Symbol to set for encrypted content |
| `symbol_macro` | string | `{SYMBOL}_MACRO` | Symbol to set for Office macros |
| `symbol_ignore` | string | `{SYMBOL}_IGNORE` | Symbol set instead of the main symbol when a detected threat name matches the `whitelist` map |
| `servers` | string | (required) | Server address(es), can be TCP (`host:port`) or Unix socket path |
| `timeout` | number | (varies) | Connection timeout in seconds |
| `retransmits` | number | (varies) | Number of retry attempts on failure |
| `max_size` | number | (none) | Skip scanning for messages larger than this (bytes) |
| `min_size` | number | (none) | Skip scanning for messages smaller than this (bytes) |
| `scan_mime_parts` | boolean | `true` | Scan attachments separately instead of whole message |
| `attachments_only` | boolean | (none) | **Deprecated.** Alias for `scan_mime_parts`; emits a warning and maps to `scan_mime_parts`. Use `scan_mime_parts` instead. |
| `scan_text_mime` | boolean | `false` | Include text parts when scanning mime parts |
| `scan_image_mime` | boolean | `false` | Include image parts when scanning mime parts |
| `log_clean` | boolean | `false` | Log messages when content is clean |
| `action` | string | (none) | Force this action when virus found (e.g., `reject`) |
| `message` | string | (varies) | Custom rejection message, supports `${SCANNER}` and `${VIRUS}` variables |
| `whitelist` | string | (none) | Path to map of virus names/signatures to ignore. When a detected threat name matches this map, `symbol_ignore` is set instead of the main symbol |
| `patterns` | table | (none) | Regex patterns to map virus names to custom symbols |
| `patterns_fail` | table | (none) | Regex patterns to map error messages to custom symbols |
| `prefix` | string | (auto) | Redis cache key prefix |
| `cache_expire` | number | 3600 (7200 for virustotal, metadefender, kaspersky_se) | Redis cache expiration time in seconds |
| `no_cache` | boolean | `false` | Disable Redis caching |
| `dynamic_scan` | boolean | `false` | Skip scanning if message already exceeds 2x reject threshold |
| `text_part_min_words` | number | (none) | Minimum words required in text parts to scan |
| `show_attachments` | boolean | `false` | Include attachment filename in symbol options |
| `symbol_type` | string | `normal` | Set to `postfilter` to run after other filters |
| `score` | number | (none) | Score to assign to the symbol |
| `description` | string | (none) | Description for the symbol |
| `group` | string | `antivirus` | Symbol group |

### Pattern matching

For virus, encrypted, and macro symbols, patterns can be used to set a dedicated symbol based on the virus name or error message. For failure symbols, use `patterns_fail`:

~~~hcl
patterns {
  # symbol_name = "regex_pattern";
  JUST_EICAR = '^Eicar-Test-Signature$';
  SANE_MAL = 'Sanesecurity\.Malware\.*';
  CLAM_UNOFFICIAL = 'UNOFFICIAL$';
}
patterns_fail {
  # symbol_name = "regex_pattern";
  CLAM_LIMITS_EXCEEDED = '^Heuristics\.Limits\.Exceeded$';
}
~~~

### MIME part filtering

From version 3.5, you can filter which mime parts are sent to the scanner using regex patterns or file extensions:

~~~hcl
# Match content-type or filename with regex
mime_parts_filter_regex {
  FILE1 = "^invoice\.xls$";
  DOC1 = "application\/msword";
  DOC2 = "application\/vnd\.ms-word.*";
  GEN2 = "application\/vnd\.openxmlformats-officedocument.*";
}
# Match filename extension (no regex)
mime_parts_filter_ext {
  doc = "doc";
  docx = "docx";
}
~~~

The matching `_exclude` filters remove a part from scanning even if it also matches an include filter above:

~~~hcl
mime_parts_filter_regex_exclude {
  SIGNATURE = "^smime\.p7s$";
}
mime_parts_filter_ext_exclude {
  p7s = "p7s";
}
~~~

The `mime_parts_filter_regex` option matches the content-type detected by Rspamd, mime part headers, or the declared filename of an attachment. This also works for files within archives. The `mime_parts_filter_ext` option matches the extension of the declared filename or files within archives. `mime_parts_filter_regex_exclude` and `mime_parts_filter_ext_exclude` follow the same matching rules, but remove a part from scanning instead of adding it.

**How include and exclude filters interact:**

| Include filters set? | Exclude filters set? | Result |
|---|---|---|
| no | no | every attachment is scanned |
| yes | no | only parts matching an include filter are scanned |
| no | yes | every attachment is scanned **except** those matching an exclude filter |
| yes | yes | only parts matching an include filter **and not** matching an exclude filter are scanned |

An exclude match always takes precedence over an include match on the same part. Exclude-only configuration switches to "scan everything except" mode; it does not make exclude filters open up scanning to parts that fail to match an include filter when one is configured.

Files listed inside archives are matched against these filters as well by default. Set `mime_parts_match_archive = false;` to only match the archive part itself (filename/content-type) and skip checking the files it contains. Since an archive is scanned as a single part, an exclude filter only suppresses the whole archive when **every** file it contains matches an exclude filter; if even one file doesn't match, the archive is still scanned.

### Redis caching

By default, if [Redis](/configuration/redis) is configured globally and the `antivirus` option is not explicitly disabled in the Redis configuration, scan results are cached using message checksums. Configure `cache_expire` to control the TTL.

## ClamAV

ClamAV is the most commonly used open-source antivirus scanner. It communicates via the `INSTREAM` protocol.

**Scanner-specific defaults:**
- `default_port`: 3310
- `timeout`: 5.0 seconds
- `retransmits`: 2
- `cache_expire`: 3600 seconds

~~~hcl
# local.d/antivirus.conf

clamav {
  # If set, force this action when any virus is found
  # action = "reject";
  # message = '${SCANNER}: virus found: "${VIRUS}"';
  
  # Scan attachments separately (recommended)
  scan_mime_parts = true;
  
  # Include text/image parts (useful for Sanesecurity databases)
  # scan_text_mime = false;
  # scan_image_mime = false;
  
  # Skip messages larger than this size
  # max_size = 20000000;
  
  symbol = "CLAM_VIRUS";
  type = "clamav";
  
  # Log clean results
  # log_clean = false;
  
  # Server address (TCP or Unix socket)
  servers = "127.0.0.1:3310";
  
  # Pattern-based symbol mapping
  patterns {
    JUST_EICAR = '^Eicar-Test-Signature$';
  }
  
  # Whitelist virus names/signatures to ignore
  # whitelist = "/etc/rspamd/antivirus.wl";
  
  # Replace this exact string with EICAR for testing
  # eicar_fake_pattern = 'testpatterneicar';
}
~~~

## Sophos SAVDI

Sophos SAVDI is a daemon that extends Sophos Anti-Virus for Linux to be reachable via TCP sockets using the SSSP protocol. Both Sophos Anti-Virus for Linux and the Sophos SAVDI daemon must be installed.

**Scanner-specific defaults:**
- `default_port`: 4010
- `timeout`: 15.0 seconds
- `retransmits`: 2

A sample SAVDI configuration is available at [this gist](https://gist.github.com/c-rosenberg/671b0a5d8b1b5a937e3e161f8515c666).

~~~hcl
# local.d/antivirus.conf

sophos {
  symbol = "SOPHOS_VIRUS";
  type = "sophos";
  servers = "127.0.0.1:4010";
  scan_mime_parts = true;
}
~~~

SAVDI automatically reports encrypted files (`FAIL 0212`) and oversized files (`REJ 4`) which Rspamd handles appropriately.

## Avira SAVAPI

SAVAPI is Avira's scanning interface. By default, it uses a Unix socket, but TCP is recommended for better reliability. Set `ListenAddress` in savapi.conf to configure TCP mode.

**Scanner-specific defaults:**
- `default_port`: 4444
- `timeout`: 15.0 seconds
- `tmpdir`: `/tmp` (temporary files are written here before scanning)

**Important:** You must set `product_id` to match your HBEDV.key file ID.

~~~hcl
# local.d/antivirus.conf

savapi {
  symbol = "SAVAPI_VIRUS";
  type = "savapi";
  servers = "127.0.0.1:4444";
  product_id = 12345;  # Required - must match your license key
  scan_mime_parts = true;
}
~~~

## Kaspersky

Kaspersky Anti-Virus for Linux Mail Server uses a Unix socket for local scans. Rspamd must have write access to the socket (add the rspamd user to `klusers` group).

**Important:** Rspamd writes data to temporary files in `tmpdir` (default `/tmp`). This directory must be readable by the `klusers` user/group.

~~~hcl
# local.d/antivirus.conf

kaspersky {
  symbol = "KAS_VIRUS";
  type = "kaspersky";
  servers = "/var/run/klms/rds_av";
  max_size = 2048000;
  scan_mime_parts = true;
  tmpdir = "/tmp";  # Must be accessible to both rspamd and klusers
}
~~~

To grant access:
```bash
usermod -G klusers _rspamd
```

## Kaspersky Scan Engine

Kaspersky Scan Engine uses HTTP REST API version 1.0 ([documentation](https://help.kaspersky.com/ScanEngine/1.0/en-US/181038.htm)). It supports both TCP stream and file modes.

**Scanner-specific defaults:**
- `default_port`: 9999
- `timeout`: 5.0 seconds
- `retransmits`: 1
- `cache_expire`: 7200 seconds
- `tmpdir`: `/tmp` (used only when `use_files = true`)
- `keepalive`: `true`

**Scanner-specific options:**
- `use_files`: Set to `true` to use file mode (only recommended with fast tmpfs storage). When enabled, Rspamd writes content to `tmpdir` before scanning.
- `use_https`: Set to `true` to enable SSL
- `auth_string`: Optional HTTP `Authorization` header value sent with every scan request (e.g. for token-based authentication)
- `keepalive`: Whether to use HTTP keep-alive connections (default: `true`)

~~~hcl
# local.d/antivirus.conf

kaspersky_se {
  symbol = "KAS_SE_VIRUS";
  type = "kaspersky_se";
  servers = "127.0.0.1:9999";  # Required, Unix sockets not supported
  max_size = 2048000;
  timeout = 5.0;
  scan_mime_parts = true;
  use_files = false;  # Use TCP stream mode (recommended)
  use_https = false;  # Enable for SSL
  # auth_string = "Bearer mytoken";  # Optional authorization header
}
~~~

## Avast

Avast for Linux uses a socket-based protocol. The scanner saves content to temporary files before scanning.

**Scanner-specific defaults:**
- `timeout`: 4.0 seconds
- `retransmits`: 1
- `tmpdir`: `/tmp`

~~~hcl
# local.d/antivirus.conf

avast {
  symbol = "AVAST_VIRUS";
  type = "avast";
  servers = "/var/run/avast/scan.sock";  # Unix socket path
  scan_mime_parts = true;
}
~~~

## VirusTotal

VirusTotal integration performs hash-based lookups against their database. **An API key is required.**

**Scanner-specific options:**
- `apikey`: Your VirusTotal API key (required)
- `url`: API endpoint (default: `https://www.virustotal.com/vtapi/v2/file`)
- `minimum_engines`: Minimum detections required to trigger (default: 3)
- `low_category`: Threshold for low threat category (default: 5)
- `medium_category`: Threshold for medium threat category (default: 10)
- `symbols`: Category-based symbol configuration

This scanner uses hash lookups (MD5), so it only detects known threats. It produces category-based symbols instead of a single virus symbol:

- `VIRUSTOTAL_CLEAN`: No detections (negative score)
- `VIRUSTOTAL_LOW`: Few detections (minimum_engines to low_category-1)
- `VIRUSTOTAL_MEDIUM`: Moderate detections (low_category to medium_category-1)
- `VIRUSTOTAL_HIGH`: Many detections (medium_category and above)

~~~hcl
# local.d/antivirus.conf

virustotal {
  type = "virustotal";
  apikey = "your-api-key-here";  # Required
  
  scan_mime_parts = true;
  
  # Minimum detections to consider as threat
  minimum_engines = 3;
  
  # Category thresholds
  low_category = 5;
  medium_category = 10;
  
  # Custom symbols and scores
  symbols = {
    clean = {
      symbol = "VIRUSTOTAL_CLEAN";
      score = -0.5;
      description = "VirusTotal: attachment is clean";
    };
    low = {
      symbol = "VIRUSTOTAL_LOW";
      score = 2.0;
      description = "VirusTotal: low threat level";
    };
    medium = {
      symbol = "VIRUSTOTAL_MEDIUM";
      score = 5.0;
      description = "VirusTotal: medium threat level";
    };
    high = {
      symbol = "VIRUSTOTAL_HIGH";
      score = 8.0;
      description = "VirusTotal: high threat level";
    };
  };
}
~~~

**Note:** VirusTotal has rate limits on their API. The default `cache_expire` for this scanner is 7200 seconds (2 hours) to help reduce API calls.

## MetaDefender Cloud

MetaDefender Cloud by OPSWAT performs hash-based lookups (SHA256) against multiple antivirus engines. **An API key is required.**

**Scanner-specific defaults:**
- `cache_expire`: 7200 seconds

**Scanner-specific options:**
- `apikey`: Your MetaDefender API key (required)
- `url`: API endpoint (default: `https://api.metadefender.com/v4/hash`)
- `minimum_engines`: Minimum detections required to trigger (default: 3)
- `low_category`: Threshold for low threat category (default: 5)
- `medium_category`: Threshold for medium threat category (default: 10)
- `symbols`: Category-based symbol configuration

Like VirusTotal, this scanner uses hash lookups and produces category-based symbols:

- `METADEFENDER_CLEAN`: No detections (negative score)
- `METADEFENDER_LOW`: Few detections (minimum_engines to low_category-1)
- `METADEFENDER_MEDIUM`: Moderate detections (low_category to medium_category-1)
- `METADEFENDER_HIGH`: Many detections (medium_category and above)

~~~hcl
# local.d/antivirus.conf

metadefender {
  type = "metadefender";
  apikey = "your-api-key-here";  # Required
  
  scan_mime_parts = true;
  
  minimum_engines = 3;
  low_category = 5;
  medium_category = 10;
  
  # Custom symbols and scores
  symbols = {
    clean = {
      symbol = "METADEFENDER_CLEAN";
      score = -0.5;
      description = "MetaDefender: attachment is clean";
    };
    low = {
      symbol = "METADEFENDER_LOW";
      score = 2.0;
      description = "MetaDefender: low threat level";
    };
    medium = {
      symbol = "METADEFENDER_MEDIUM";
      score = 5.0;
      description = "MetaDefender: medium threat level";
    };
    high = {
      symbol = "METADEFENDER_HIGH";
      score = 8.0;
      description = "MetaDefender: high threat level";
    };
  };
}
~~~

## ICAP Protocol

Generic antivirus support via ICAP protocol is available through the [external_services](/modules/external_services#icap-protocol-specific-details) module.

The following products have been tested with Rspamd via ICAP:

* Checkpoint Sandblast
* ClamAV (using c-icap server and squidclamav)
* ESET Server Security for Linux 9.0
* F-Secure Internet Gatekeeper
* Kaspersky Scan Engine 2.0
* Kaspersky Web Traffic Security 6.0
* McAfee Web Gateway 9/10/11
* Metadefender ICAP
* Sophos (via SAVDI)
* Symantec Protection Engine for Cloud Services
* Trend Micro InterScan Web Security Virtual Appliance (IWSVA)
* Trend Micro Web Gateway
