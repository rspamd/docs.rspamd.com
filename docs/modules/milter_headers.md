---
title: Milter headers module
---


# Milter headers module


The `milter headers` module (formerly known as `rmilter_headers`) has been added in Rspamd 1.5 to provide a relatively simple way to configure adding/removing of headers (the alternative being to use the [API](/lua/rspamd_task#m70081) directly). The module puts these changes into the `milter` block of the scan reply: the [proxy worker](/workers/rspamd_proxy#milter-support) applies them through the milter protocol, and clients of the [HTTP protocol](/developers/protocol#milter-headers) read them from the reply. Despite its name, it is not tied to the `milter` protocol and also works with supported mailservers that use the HTTP interface such as Haraka and OpenSMTPD, as well as with Exim via the RSPAMC protocol (since Rspamd 4.0, header operations are serialised into `$spam_report`, see [MTA integration](/tutorials/integration#milter-headers-in-exim-rspamd-40)).



## Principles of operation

The `milter headers` module offers several routines for adding/removing common headers, which can be selectively enabled and configured according to specific needs. Additionally, users have the flexibility to add their own custom routines to the configuration or add them directly from [Lua](/lua/rspamd_task#m70081).

## Configuration

~~~hcl
# local.d/milter_headers.conf:

# Options

# Add "extended Rspamd headers" (default false) (enables x-spamd-result, x-rspamd-server, x-rspamd-queue-id & x-rspamd-action routines)
# extended_spam_headers = true;

# List of routines to enable for authenticated users (default empty); see also `skip_authenticated`
# authenticated_headers = ["authentication-results"];

# Set false to enable all used routines for authenticated users (default true)
# skip_authenticated = true;

# List of routines to enable for local IPs (default empty); see also `skip_local`
# local_headers = ["x-spamd-bar"];

# Set false to enable all used routines for local IPs (default true)
# skip_local = true;

# Routines to use- this is the only required setting (may be omitted if using extended_spam_headers)
use = ["x-spamd-bar", "authentication-results"];

# this is where we may configure our selected routines
routines {
  # settings for x-spamd-bar routine
  x-spamd-bar {
    # effectively disables negative spambar
    negative = "";
  }
  # other routines...
}
custom {
  # user-defined routines: more on these later
}
~~~

## Options

### extended_spam_headers

Add "extended Rspamd headers" to messages [NOT originated from authenticated users or `our_networks`](#scan-results-exposure-prevention) (default `false`). Enables the following routines: `x-spamd-result`, `x-rspamd-server`, `x-rspamd-queue-id` and `x-rspamd-action`.

~~~hcl
extended_spam_headers = true;
~~~

### authenticated_headers (1.6.1+)

List of routines to be enabled for authenticated users (default `empty`). See also `skip_authenticated`.

~~~hcl
authenticated_headers = ["authentication-results"];
~~~

### remove_upstream_spam_flag (1.7.1+)

Set `false` to keep pre-existing spam flag added by an upstream spam filter (default `true`). This will enable the `remove-spam-flag` option.

~~~hcl
remove_upstream_spam_flag = true;
~~~

### local_headers (1.6.1+)

List of routines to enable for local IPs (default `empty`). See also `skip_local`.

~~~hcl
local_headers = ["x-spamd-bar"];
~~~

### skip_local (1.6.0+)

Set false to always add headers for local IPs (default `true`).

~~~hcl
skip_local = true;
~~~

### skip_all (3.0+)
    
Do not run routines for any messages (except those matching `extended_headers_rcpt`) (default `false`). Custom routines and the `remove-spam-flag` and `fuzzy-hashes` routines are not affected.

~~~hcl
skip_all = true;
~~~

### skip_authenticated (1.6.0+)
    
Set false to always add headers for authenticated users (default `true`)

~~~hcl
skip_authenticated = true;
~~~

### extended_headers_rcpt (1.6.2+)

List of recipients (default `empty`).

When [`extended_spam_headers`](#extended_spam_headers) is enabled, also add extended Rspamd headers to messages if **at least one** envelope recipient matches this list (e.g. a list of domains mail server responsible for). An entry can be a full address, a user name, or a domain written as `@domain`; a map can be used instead of a list.

~~~hcl
extended_headers_rcpt = ["user1", "@example1.com", "user2@example2.com"];
~~~

`extended_headers_rcpt` has higher precedence than `skip_local`, `skip_authenticated` and `skip_all`.  
`extended_headers_rcpt` paired with `skip_all = true` can be used to only add extended headers to a map of specific recipients. 

### use

Routines to use- this is the only required setting (may be omitted if using `extended_spam_headers`)

~~~hcl
use = ["x-spamd-bar", "authentication-results"];
~~~

### headers_modify_mode (3.4+)

Mode for modifying headers. Default is `compat` for compatibility with older versions. Set to `override` to replace headers completely.

~~~hcl
headers_modify_mode = "compat";
~~~

### default_headers_order

Default order for header insertion. Set to a number to insert at a specific position (e.g., `1` to insert after the first Received header). Default is `nil` (insert at the end).

~~~hcl
default_headers_order = 1;
~~~

## Removing headers

Configuration dealing with removing headers commonly sets a numeric parameter which is typically set to `0`.

`0` means all headers with a given name should be removed.
`1` means remove the first header with a given name, and so on
`-1` means remove the last header with a given name, and so on

From version 3.9.0, this can be set to `null` to indicate that foreign headers should not be removed.

## Functions

Available routines and their settings are as below, default values are as indicated:

### add-headers

Adds headers with fixed values (`headers` MUST be specified). Existing headers with the same names are removed according to `remove`.

~~~hcl
# local.d/milter_headers.conf
use = ["add-headers"];

routines {
  add-headers {
    headers {
      "X-Scanned-By" = "Rspamd";
    }
    remove = 0;
  }
}
~~~

### authentication-results

Add an [authentication-results](https://tools.ietf.org/html/rfc7001) header.

~~~hcl
# local.d/milter_headers.conf
use = ["authentication-results"];
#authenticated_headers = ["authentication-results"]; # to add this header for authenticated users

routines {
  authentication-results {
    # Name of header
    header = "Authentication-Results";
    # Remove existing headers (default 0 — remove all)
    remove = 0;
    # Allows selective removal of Authentication-Results headers by hostname (3.14.2+)
    # Supports single hostname, array of hostnames, domain patterns (`.example.com`), or map files
    # remove_ar_from = ["example.com", ".example.net"];
    # Set this false not to add SMTP usernames in authentication-results
    add_smtp_user = true;
    # SPF/DKIM/DMARC/ARC symbols in case these are redefined
    spf_symbols {
      pass = "R_SPF_ALLOW";
      fail = "R_SPF_FAIL";
      softfail = "R_SPF_SOFTFAIL";
      neutral = "R_SPF_NEUTRAL";
      temperror = "R_SPF_DNSFAIL";
      none = "R_SPF_NA";
      permerror = "R_SPF_PERMFAIL";
    }
    # Other DKIM results are taken from the DKIM check results, not from symbols
    dkim_symbols {
      none = "R_DKIM_NA";
    }
    dmarc_symbols {
      pass = "DMARC_POLICY_ALLOW";
      permerror = "DMARC_BAD_POLICY";
      temperror = "DMARC_DNSFAIL";
      none = "DMARC_NA";
      reject = "DMARC_POLICY_REJECT";
      softfail = "DMARC_POLICY_SOFTFAIL";
      quarantine = "DMARC_POLICY_QUARANTINE";
    }
    arc_symbols {
      pass = "ARC_ALLOW";
      permerror = "ARC_INVALID";
      temperror = "ARC_DNSFAIL";
      none = "ARC_NA";
      reject = "ARC_REJECT";
    }
  }
}
~~~

### fuzzy-hashes (1.7.5+)

Adds the matched fuzzy hashes to a header. Since Rspamd 4.1.3 each hash is annotated with the fuzzy rule, flag and probability, the queried hash for non-exact matches and, when known, the time the hash was added. With the default `headers_modify_mode = "compat"` all hashes go into one header separated by commas; with `override` each hash gets its own header. This routine does not remove existing headers.

~~~hcl
# local.d/milter_headers.conf
use = ["fuzzy-hashes"];

routines {
  fuzzy-hashes {
    header = "X-Rspamd-Fuzzy";
  }
}
~~~

### remove-header (1.6.2+)

Removes a header with the specified name (`header` MUST be specified):

~~~hcl
use = ["remove-header"];

routines {
  remove-header {
    header = "Remove-This";
    remove = 0; # 0 means remove all, 1 means remove the first one , -1 remove the last and so on
  }
}
~~~

### remove-headers (1.6.3+)

Removes multiple headers (`headers` MUST be specified):

~~~hcl
use = ["remove-headers"];

routines {
  remove-headers {
    headers {
      "Remove-This" = 0;
      "This-Too" = 0;
    }
  }
}
~~~

### remove-spam-flag (1.7.1+)

Removes pre-existing spam flag added by an upstream spam filter.

~~~hcl
use = ["remove-spam-flag"];

routines {
  remove-spam-flag {
    header = "X-Spam";
  }
}
~~~

Default name of the header to be removed is `X-Spam` which can be manipulated using the `header` setting.

### spam-header

Adds a predefined header to mail identified as spam.

~~~hcl
use = ["spam-header"];

routines {
  spam-header {
    header = "Deliver-To";
    value = "Junk";
    remove = 0;
  }
}
~~~

Default name/value of the added header is `Deliver-To`/`Junk` which can be manipulated using the `header` and `value` settings.

### stat-signature (1.6.3+)

Attaches the stat signature to the message.

~~~hcl
use = ["stat-signature"];

routines {
  stat-signature {
    header = 'X-Stat-Signature';
    remove = 0;
  }
}
~~~

### x-rspamd-queue-id (1.5.8+)

Adds a header containing the Rspamd queue id of the message [if it is NOT originated from authenticated users or `our_networks`](#scan-results-exposure-prevention).

~~~hcl
use = ["x-rspamd-queue-id"];

routines {
  x-rspamd-queue-id {
    header = 'X-Rspamd-Queue-Id';
    remove = 0;
  }
}
~~~

### x-rspamd-action

Adds a header containing the action Rspamd has assigned to the message (e.g. `no action`, `add header`, `reject`). Subject to the same [scan results exposure prevention](#scan-results-exposure-prevention) checks as the other extended headers.

~~~hcl
use = ["x-rspamd-action"];

routines {
  x-rspamd-action {
    header = 'X-Rspamd-Action';
    remove = 0;
  }
}
~~~

### x-rspamd-pre-result

Adds a header describing any pre-result override that was applied to the message (e.g. by the `force_actions` module). The header includes the overriding action, the module that set it, and the human-readable message. The header is only written when a pre-result is actually present; no header is added for ordinary messages.

This header is written by the [`x-spamd-result`](#x-spamd-result-158) routine, so it is added whenever `x-spamd-result` is active (for example, with `extended_spam_headers = true`). There is no separate `x-rspamd-pre-result` routine: listing it in `use` does not add the header on its own and makes the module log an error for every message.

~~~hcl
# local.d/milter_headers.conf
use = ["x-spamd-result"]; # also adds X-Rspamd-Pre-Result when a pre-result is set
~~~

### x-spamd-result (1.5.8+)

Adds a header containing the scan results [if the message is NOT originated from authenticated users or `our_networks`](#scan-results-exposure-prevention).

~~~hcl
use = ["x-spamd-result"];

routines {
  x-spamd-result {
    header = 'X-Spamd-Result';
    remove = 0;
    sort_by = 'score'; # or 'name' to sort symbols alphabetically
    stop_chars = ' '; # character(s) used as fold points when wrapping the header value (default ' ')
  }
}
~~~

### x-rspamd-server (1.5.8+)

Adds a header containing the local computer host name of the Rspamd server that checked out the message [if it is NOT originated from authenticated users or `our_networks`](#scan-results-exposure-prevention). Since Rspamd 2.4 the host name can be replaced with a user-defined string specified in the `hostname` setting.

~~~hcl
use = ["x-rspamd-server"];

routines {
  x-rspamd-server {
    header = 'X-Rspamd-Server';
    remove = 0;
    #hostname = "foo.com"; -- Local computer host name if unspecified (2.4+)
  }
}
~~~

### x-spamd-bar

Adds a visual indicator of spam/ham level.

~~~hcl
use = ["x-spamd-bar"];

routines {
  x-spamd-bar {
    header = "X-Spamd-Bar";
    positive = "+";
    negative = "-";
    neutral = "/";
    remove = 0;
  }
}
~~~

### x-spam-level

Another visual indicator of spam level- SpamAssassin style.

~~~hcl
use = ["x-spam-level"];

routines {
  x-spam-level {
    header = "X-Spam-Level";
    char = "*";
    remove = 0;
  }
}
~~~

### x-spam-status

SpamAssassin-style X-Spam-Status header indicating spam status.

~~~hcl
use = ["x-spam-status"];

routines {
  x-spam-status {
    header = "X-Spam-Status";
    remove = 0;
  }
}
~~~

### x-virus

~~~hcl
use = ["x-virus"];

routines {
  x-virus {
    header = "X-Virus";
    remove = 0;
    # The following setting is an empty list by default and required to be set
    # These are user-defined symbols added by the antivirus module
    symbols = ["CLAM_VIRUS", "FPROT_VIRUS"];
  }
}
~~~

If the [Antivirus module](/modules/antivirus) detects any viruses in an email, the module adds a header that contains the names of the viruses detected by the configured scanners.

### x-os-fingerprint

Adds a header with the operating system of the sending host as detected by the [P0f module](/modules/p0f), in the form `OS, (up: N min), (distance N, link: TYPE)`. Nothing is added when there is no p0f result for the message.

~~~hcl
# local.d/milter_headers.conf
use = ["x-os-fingerprint"];

routines {
  x-os-fingerprint {
    header = "X-OS-Fingerprint";
    remove = 0;
  }
}
~~~

## Custom routines

User-defined routines can be defined in configuration in the `custom` section, for example:

~~~hcl
use = ["my_routine"];

custom {
  my_routine = <<EOD
  return function(task, common_meta)
    -- parameters are task and metadata from previous functions
    return nil, -- no error
    {['X-Foo'] = 'Bar'}, -- add header: X-Foo: Bar
    {['X-Foo'] = 0 }, -- remove foreign X-Foo headers
    {} -- metadata to return to other functions
  end
EOD;
}
~~~

You can reference the key `my_routine` in the `use` setting, just like you would with other routines.

Here's a more complex example: If a specific symbol is added, the module will add an additional header:

~~~hcl
use = ["my_routine"];

custom {
  my_routine = <<EOD
  return function(task, common_meta)
    -- parameters are task and metadata from previous functions

    if task:has_symbol('SYMBOL') then
      return nil, -- no error
      {['X-Foo'] = 'Bar'}, -- set extra header
      {['X-Foo'] = 0}, -- remove foreign X-Foo headers
      {} -- metadata to return to other functions
    end

    return nil, -- no error
    {}, -- need to fill the parameter
    {['X-Foo'] = 0}, -- remove foreign X-Foo headers
    {} -- metadata to return to other functions

  end
EOD;
}
~~~

## Scan results exposure prevention

To avoid exposing scan results in outbound email, the extended Rspamd headers routines (`x-spamd-result`, `x-rspamd-server`, `x-rspamd-queue-id` and `x-rspamd-action`) only add headers if the message is **NOT** originated from authenticated users or `our_networks`.

If desired, the [`extended_headers_rcpt`](#extended_headers_rcpt-162) option can be used to include the extended Rspamd headers in messages sent to specific recipients or domains, such as a list of domains the mail server is responsible for.

### Disabling DSN

Delivery status notification (DSN) reports for *successful* email deliveries can include the original message headers, including Rspamd headers. The only way to prevent this is to stop offering DSN to foreign servers.

Additionally, disabling DSN can prevent the generation of backscatter.

### Postfix example

The following configuration example restricts DSN requests to local subnets and authenticated users only. Note that the `smtpd_discard_ehlo_keyword_address_maps` setting is applied to the `smtp` service only, and not to `smtps` or `submission`.

Make sure to modify the example below to match your subnet(s) accordingly.

esmtp_access:
```conf
# Allow DSN requests from local subnets only
192.168.0.0/16  silent-discard
10.10.0.0/16    silent-discard
0.0.0.0/0       silent-discard, dsn
::/0            silent-discard, dsn
```

master.cf:

```conf
# ==========================================================================
# service type  private unpriv  chroot  wakeup  maxproc command + args
#               (yes)   (yes)   (no)    (never) (100)
# ==========================================================================
smtp      inet  n       -       n       -       1       postscreen
  -o smtpd_discard_ehlo_keyword_address_maps=cidr:$config_directory/esmtp_access
```
or globally
main.cf:

```conf
smtpd_discard_ehlo_keyword_address_maps = 
        cidr:$config_directory/esmtp_access
```

DSN can also be disabled for everyone with a shorter configuration change:
main.cf:
```conf
# $config_directory/main.cf:
    smtpd_discard_ehlo_keywords = silent-discard, dsn
```
