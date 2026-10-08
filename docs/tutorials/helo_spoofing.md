---
title: Protecting Against HELO Hostname Spoofing
---

# Protecting Against HELO Hostname Spoofing

Some spammers connect to your MX server and present **your own server's
hostname** in the SMTP `EHLO`/`HELO` argument. The hostname is trivially
discoverable from public MX records, and presenting it sometimes helps spam
bypass naive HELO checks or simply looks more "legitimate" to poorly
configured filters. Since no legitimate remote sender ever identifies itself
as your own MX, this is a strong and very specific spam signal.

This guide shows how to penalize such messages with a small
[multimap](/modules/multimap) rule.

## Why there is no built-in check

Rspamd cannot reliably know which hostnames "belong" to your server, so it
cannot ship a default test for this case. In the most common deployment the
mail server sits behind NAT:

```
mx.example.com                (public DNS name; there may be several)
  → 203.0.113.10              (public IP on the border router/firewall)
    → destination NAT
      → 192.168.0.10          (the server's actual address)
        → mx.corp.internal    (the server's own name, internal domain)
```

The mapping between public names and the server exists only in the NAT
configuration and in DNS zones — none of it is observable from the server
itself:

- `gethostname()` returns a single internal-domain name, missing every public
  alias;
- enumerating network interfaces yields only private addresses;
- the spoofed HELO name resolves to the *public* addresses, which match no
  interface.

Mail servers face the same problem elsewhere and solve it with explicit
configuration (Postfix's `proxy_interfaces` exists precisely because an MTA
behind NAT cannot see its own public address). An explicit list of your own
hostnames is exactly what a multimap rule takes — so the check belongs in
configuration, not in the code.

## Existing partial coverage

Two generic mechanisms already react to a spoofed HELO, but neither is
specific:

- The [hfilter module](/modules/hfilter) emits `HFILTER_HELO_IP_A` when the
  HELO hostname resolves (A/AAAA) to addresses that do not include the
  connecting client's IP. A spammer presenting your MX hostname triggers it,
  since your hostname resolves to your address, not theirs. However, this is
  a generic forward-confirmed mismatch test with a low default weight.
- SPF does not help: Rspamd evaluates the HELO identity only for null senders
  (`postmaster@HELO`), so ordinary spam with a regular envelope sender is not
  checked against the HELO name at all.

A map-based rule adds an exact, heavyweight signal on top.

## Define the rule

```hcl
# $LOCAL_CONFDIR/local.d/multimap.conf

LOCAL_HELO_OWN_HOSTNAME {
  type = "helo";
  regexp = true;
  map = "$LOCAL_CONFDIR/local.d/multimap.d/helo_own_hostname.map";
  score = 4.0;
  description = "EHLO/HELO spoofs one of our own hostnames";
}
```

```bash
# $LOCAL_CONFDIR/local.d/multimap.d/helo_own_hostname.map
# All public hostnames that resolve (directly or via NAT) to this server:
# names from MX records of the served domains plus any mail/smtp aliases.

/^mx\.example\.com\.?$/i
/^mail\.example\.com\.?$/i
```

Notes on the choices:

- **`regexp = true` with the `i` flag** — the HELO argument is stored and
  looked up verbatim, so plain (hash) map entries are case-sensitive and
  would miss `MX.Example.COM`. Expressions anchored with `^...$` avoid
  substring matches, and `\.?` additionally accepts a legal trailing dot
  (`mx.example.com.`).
- **`score` in the rule** — multimap registers the symbol and its score
  directly; no separate `metric` changes are needed. Pick the value relative
  to your action thresholds: a spoofed own hostname is close to a conclusive
  signal, so a value in the 3–5 range works well — it pushes the message over
  the greylisting and junk thresholds together with other spam symbols.
- **What belongs in the map** — every public name of this server: MX
  hostnames of all the domains you accept mail for, plus any mail/smtp
  aliases.

:::note Internal senders
External false positives are practically impossible: no legitimate remote
sender presents *your* hostname. The only realistic source is your own
infrastructure — monitoring probes or misconfigured internal relays
sometimes identify themselves with the target server's name. If you add
internal (local-domain) names to the map, watch the History for such senders
first.
:::
