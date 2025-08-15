---
title: Hfilter module
---


# Hfilter module

The hfilter module is a collection of lightweight checks targeting common problems and bad patterns in SMTP `HELO`, reverse DNS/hostname, `From`, recipients, message-id, and message content (URLs). It is used to add small, explainable signals that often correlate with spammy infrastructure or message formatting issues.

## How it works

- **HELO checks**: detects bare IPs, reserved/internal IPs, and suspicious tokens (e.g. `dynamic`, `pppoe`, `dhcp`). Also validates FQDN and basic DNS presence for the `HELO` name. Inserts:
  - `HFILTER_HELO_BAREIP`, `HFILTER_HELO_BADIP`
  - `HFILTER_HELO_1..5` (severity buckets)
  - `HFILTER_HELO_NOT_FQDN`, `HFILTER_HELO_NORES_A_OR_MX`, `HFILTER_HELO_NORESOLVE_MX`, `HFILTER_HELO_IP_A`

- **Hostname (reverse DNS) checks**: similar heuristics applied to the connecting host’s name. Inserts:
  - `HFILTER_HOSTNAME_1..5`, `HFILTER_HOSTNAME_UNKNOWN`

- **URL density checks**: flags messages that consist almost entirely of URLs and/or a single line of content. Inserts:
  - `HFILTER_URL_ONLY`, `HFILTER_URL_ONELINE`

- **From domain checks**: validates the sender domain (FQDN/DNS presence) and bounces. Inserts:
  - `HFILTER_FROMHOST_NOT_FQDN`, `HFILTER_FROMHOST_NORES_A_OR_MX`, `HFILTER_FROMHOST_NORESOLVE_MX`, `HFILTER_FROM_BOUNCE`

- **Recipients checks**: when bouncing, flags multiple recipients. Inserts:
  - `HFILTER_RCPT_BOUNCEMOREONE`

- **Message-ID checks**: validates domain part in the `Message-Id`. Inserts:
  - `HFILTER_MID_NOT_FQDN`, `HFILTER_MID_NORES_A_OR_MX`, `HFILTER_MID_NORESOLVE_MX`

By default, checks are skipped for authenticated senders and local IPs.

## Configuration

Enable or disable groups of checks in `local.d/hfilter.conf`:

~~~hcl
# /etc/rspamd/local.d/hfilter.conf
hfilter {
  helo_enabled = true;      # HELO patterns and DNS/FQDN checks
  hostname_enabled = true;  # reverse DNS/hostname patterns
  url_enabled = true;       # URL-only / one-line content
  from_enabled = true;      # MAIL FROM domain checks and bounce
  rcpt_enabled = true;      # recipient sanity (e.g. bounces to many rcpts)
  mid_enabled = false;      # Message-Id domain checks
}
~~~

Assign weights in your metrics as desired. Typical setup uses small positive weights for the granular symbols and relies on the aggregate effect:

~~~hcl
# /etc/rspamd/local.d/metrics.conf
symbol "HFILTER_URL_ONLY" { weight = 0.5; group = "hfilter"; }
symbol "HFILTER_HELO_5"   { weight = 1.0; group = "hfilter"; }
symbol "HFILTER_HOSTNAME_5" { weight = 1.0; group = "hfilter"; }
~~~

## Symbols

- HELO: `HFILTER_HELO_BAREIP`, `HFILTER_HELO_BADIP`, `HFILTER_HELO_1..5`, `HFILTER_HELO_NOT_FQDN`, `HFILTER_HELO_NORES_A_OR_MX`, `HFILTER_HELO_NORESOLVE_MX`, `HFILTER_HELO_IP_A`
- Hostname: `HFILTER_HOSTNAME_1..5`, `HFILTER_HOSTNAME_UNKNOWN`
- URL: `HFILTER_URL_ONLY`, `HFILTER_URL_ONELINE`
- From: `HFILTER_FROMHOST_NOT_FQDN`, `HFILTER_FROMHOST_NORES_A_OR_MX`, `HFILTER_FROMHOST_NORESOLVE_MX`, `HFILTER_FROM_BOUNCE`
- RCPT: `HFILTER_RCPT_BOUNCEMOREONE`
- Message-Id: `HFILTER_MID_NOT_FQDN`, `HFILTER_MID_NORES_A_OR_MX`, `HFILTER_MID_NORESOLVE_MX`

## Notes

- HELO/hostname/From/MID checks perform DNS lookups; timeouts are bounded and tuned internally.
- Authenticated users and local networks are ignored by default for these checks.
- Symbols are placed in the `hfilter` group in metrics; adjust weights to fit your policy.
