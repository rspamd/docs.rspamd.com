---
title: Scanning outbound mail
---

# Scanning outbound mail

## Why scan outbound mail

Sending outbound spam can have severe negative consequences on your system's email delivery capabilities. It is crucial to prevent the occurrence of spam and its associated issues. In the event of an outbreak of outbound spam, it may become necessary to initiate incident response measures, such as changing the passwords of affected accounts. Conducting human analysis to verify the authenticity of the spam may also be beneficial, but it is essential to consider privacy laws and company policies, as this analysis could potentially infringe upon them. To determine the appropriate actions for dealing with suspected outbound spam, it is advisable to seek advice from legal experts and involve relevant stakeholders. Please be aware that this document does not offer specific guidance on handling such emails, although it may be expanded in the future to include illustrative strategies.

## What Rspamd considers outbound

Rspamd classifies a message as **outbound** (or locally originated) when at least one of the following conditions is true:

- The message was sent by an **authenticated user** (i.e. SMTP AUTH was used and the MTA passed the user identity to Rspamd).
- The message was received from an IP address listed in **[local_addrs](/configuration/options)** (by default this includes RFC 1918 private ranges and loopback addresses).

These two conditions are checked independently by most modules. Some modules only check one of them (e.g. [Ratelimit](/modules/ratelimit) only tracks authenticated users, not `local_addrs`). Each module typically exposes `check_local` and `check_authed` options (both default to `false`) so you can override the default behaviour and force checks even for outbound mail.

## Module behaviour for outbound mail

With proper [integration](/tutorials/integration), Rspamd can identify the authenticated user and source IP of a message. The following modules automatically adjust their behaviour for outbound mail:

### Checks disabled for outbound

| Module | Behaviour | Override |
|--------|-----------|----------|
| [ASN](/modules/asn) | Disabled for local IPs | Set `check_local = true` |
| [DKIM checking](/modules/dkim) | Verification is disabled | Set `check_local = true` or `check_authed = true` |
| [DMARC](/modules/dmarc) | Disabled | Set `check_local = true` or `check_authed = true` |
| [Greylist](/modules/greylisting) | Disabled | Set `check_local = true` or `check_authed = true` |
| [MX Check](/modules/mx_check) | Disabled | No override (hardcoded) |
| [One Received header policy](/modules/once_received) | Disabled | Set `check_local = true` or `check_authed = true` |
| [SPF](/modules/spf) | Disabled | Set `check_local = true` or `check_authed = true` |
| [Whitelist](/modules/whitelist) | Disabled (DKIM/SPF/DMARC whitelisting is not applied) | Set `check_local = true` or `check_authed = true` |
| [p0f](/modules/p0f) | Disabled for local IPs (OS fingerprinting is meaningless) | No override |
| [Spamtrap](/modules/spamtrap) | Disabled | Set `check_local = true` or `check_authed = true` |

### Checks with modified behaviour for outbound

| Module | Behaviour |
|--------|-----------|
| [DKIM signing](/modules/dkim_signing) | Signing is **enabled** when the appropriate key and rule are found |
| [ARC signing](/modules/arc) | ARC signing is **enabled** similarly to DKIM signing |
| [HFilter](/modules/hfilter) | Only URL-checks are applied; header and received checks are skipped |
| [Ratelimit](/modules/ratelimit) | Only the `user` bucket is applied (to authenticated users only; does not use `local_addrs`) |
| [RBL](/modules/rbl) | Individual RBL rules are disabled according to their `exclude_users` and `exclude_local` settings (URL-based lists are typically checked for all directions) |
| [Replies](/modules/replies) | Reply tracking works for outbound messages (stores message IDs from authenticated/local senders) but the forced action is **not** applied to outbound messages |
| [Milter Headers](/modules/milter_headers) | Headers are **not** added by default for local or authenticated connections (`skip_local = true`, `skip_authenticated = true`); you can control which headers are still added via `local_headers` and `authenticated_headers` |
| [Reputation](/modules/reputation) | Supports separate `outbound` and `inbound` selectors per rule, allowing different reputation tracking for each direction |

### Modules unaffected by direction

Most other modules (e.g. [Antivirus](/modules/antivirus), [Fuzzy check](/modules/fuzzy_check), [Multimap](/modules/multimap), [Neural](/modules/neural), [Phishing](/modules/phishing), [MIME types](/modules/mime_types), [External services](/modules/external_services)) run for all messages regardless of direction. You can use the [Settings module](/configuration/settings) to selectively enable or disable any of these for outbound mail.

## Using settings to control outbound scanning

The [settings module](/configuration/settings) provides a powerful way to customise Rspamd behaviour per direction. Settings can match on `authenticated`, `local`, `user`, `ip`, and other conditions, then apply custom scores, enable/disable specific symbols or groups, and override actions.

### Separating inbound and outbound flows

The simplest approach is to use `authenticated = yes` or `local = yes` matchers:

~~~hcl
# local.d/settings.conf

outbound {
  priority = high;
  authenticated = yes;
  apply {
    groups_disabled = ["rbl", "spf", "dmarc"];
    actions {
      greylist = null;
    }
  }
}
~~~

### Using Settings-ID from MTA

For more precise control, you can pass a `Settings-ID` header from your MTA to split inbound and outbound flows explicitly. This is the most performant approach since Rspamd can skip condition evaluation entirely:

~~~hcl
# local.d/settings.conf

outbound_scan {
  id = "outbound";
  apply {
    groups_enabled = ["dkim", "ratelimit", "fuzzy", "neural"];
    actions {
      reject = 15.0;
      "add header" = 6.0;
    }
  }
}
~~~

Then in your MTA, set the header for outbound submissions:

~~~
# Postfix example (submission service in master.cf)
-o smtpd_milter_maps=cdb:/etc/postfix/milter_settings

# Or pass it directly
-o milter_header_checks=pcre:/etc/postfix/milter_header_checks
~~~

Or use `rspamc`:

~~~
rspamc --header="settings-id=outbound" message.eml
~~~

### Rescoring symbols for outbound

You can adjust symbol weights specifically for outbound mail:

~~~hcl
# local.d/settings.conf

outbound_rescoring {
  priority = high;
  authenticated = yes;
  apply {
    BAYES_SPAM = 8.0;   # Treat Bayes spam more seriously for outbound
    NEURAL_SPAM = 6.0;
    actions {
      reject = 12.0;    # Lower reject threshold for outbound
    }
  }
}
~~~

### Limiting checks for authenticated users

To run only specific checks for authenticated users (e.g. only fuzzy, neural, and ratelimit):

~~~hcl
# local.d/settings.conf

authenticated_minimal {
  priority = high;
  authenticated = yes;
  apply {
    groups_enabled = ["fuzzy", "neural", "ratelimit", "antivirus"];
  }
}
~~~

## MTA configuration

### MTA with milter support (e.g. Postfix or Sendmail)

To enable Rspamd to scan emails sent directly via `sendmail` or other local delivery agents, you can include the `non_smtpd_milters` setting in the configuration. This will direct the Rspamd proxy worker to perform the scanning. Here is an example configuration for Postfix MTA:

~~~
# postfix/main.cf
smtpd_milters=inet:127.0.0.1:11332 # For inbound scan or outbound scan via SMTP
non_smtpd_milters=inet:127.0.0.1:11332 # For invocation via LDA
~~~

### Exim

Here is an example configuration suitable for filtering outbound email.

~~~
# Global options
spamd_address = 127.0.0.1 11333 variant=rspamd
acl_smtp_data = acl_check_data

begin acl

acl_check_data:
  # Set default value for a variable
  warn
    set acl_m_outspam = 0
  # Always scan mail
  warn
    spam = nobody:true
  # Honor "reject" action for inbound mail...
  deny
    ! authenticated = *
    condition = ${if eq{$spam_action}{reject}}
    message = Discarded high-probability spam
  # If it's our user set acl_m_outspam = 1 instead
  warn
    authenticated = *
    condition = ${if eq{$spam_action}{reject}}
    set acl_m_outspam = 1
  accept

begin routers

# Apply special handling to messages with $acl_m_outspam==1
redirect_outbound_spam:
  driver = redirect
  condition = ${if eq{$acl_m_outspam}{1}}
  data = admin@example.com
# <rest of configuration>
~~~

See the [Exim specification](https://www.exim.org/exim-html-current/doc/html/spec_html/) for more information.

### Haraka

To enable scanning of outbound mail set the following in `config/rspamd.ini`:

~~~
[check]
authenticated=true
~~~

If you wish to honor `reject` action for authenticated users set the following:

~~~
[reject]
authenticated=true
~~~
