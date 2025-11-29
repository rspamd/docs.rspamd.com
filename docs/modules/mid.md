---
title: MID module
---


# MID module

The purpose of the MID module is to suppress the `INVALID_MSGID` (malformed Message-ID header) and `MISSING_MID` (missing Message-ID) rules for messages which are DKIM-signed by some particular domains.

## Configuration

The module requires a `source` parameter pointing to a map file.

### Configuration options

| Option | Default | Description |
|--------|---------|-------------|
| `source` | required | Map of domains and optional Message-ID patterns |
| `symbol_known_mid` | `KNOWN_MID` | Symbol for known Message-ID pattern match |
| `symbol_known_no_mid` | `KNOWN_NO_MID` | Symbol for known missing Message-ID |
| `symbol_invalid_msgid` | `INVALID_MSGID` | Symbol to suppress for invalid Message-ID |
| `symbol_missing_mid` | `MISSING_MID` | Symbol to suppress for missing Message-ID |
| `symbol_dkim_allow` | `R_DKIM_ALLOW` | DKIM allow symbol to check |
| `csymbol_invalid_msgid_allowed` | `INVALID_MSGID_ALLOWED` | Composite symbol for allowed invalid Message-ID |
| `csymbol_missing_mid_allowed` | `MISSING_MID_ALLOWED` | Composite symbol for allowed missing Message-ID |

### Example configuration

~~~hcl
mid = {
  source = "${CONFDIR}/mid.inc";
}
~~~

The `source` setting points to a map to check DKIM signatures (& optionally message-ids) against, formatted as follows:

~~~
example.com /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}-0$/
example.net
~~~

With this configuration scoring for `INVALID_MSGID` and `MISSING_MID` symbols is removed if the domain is DKIM-signed `example.net` or the domain is signed `example.com` and the message-id matches the specified regex.
