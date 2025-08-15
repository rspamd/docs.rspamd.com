---
title: Mailing lists module
---

# Mailing lists module

The mailing lists module detects messages delivered via common mailing list software. It is typically used to reduce or suppress scores from rules that would otherwise trigger on list mail (e.g. bulk-like traits, footer content, or subject munging).

## How it works

The module examines standard list-related headers and known vendor-specific markers:

- RFC 2919/2369 headers: `List-Id`, `List-Help`, `List-Post`, `List-Subscribe`, `List-Unsubscribe`, `List-Archive`, `List-Owner`
- Heuristic headers: `Precedence: list|bulk`, `X-Loop`
- Vendor markers when present, such as `X-Mailman-Version`, `X-BeenThere`, `X-Google-Loop`, `X-Google-Group-Id`, `X-Listserver: CommuniGate Pro LIST`

If evidence is strong (e.g. Mailman, ezmlm, Google Groups, CommuniGate Pro), the symbol is added with a specific result option. Otherwise, a generic option is added when enough list headers are present.

## Configuration

The module works out of the box. You can optionally override the symbol name in `local.d/maillist.conf`:

~~~hcl
# /etc/rspamd/local.d/maillist.conf
maillist {
  # Optional: change the symbol name
  #symbol = "MAILLIST";
}
~~~

Assign a weight to the symbol in your metrics as desired (commonly negative):

~~~hcl
# /etc/rspamd/local.d/metrics.conf
symbol "MAILLIST" {
  weight = -2.0;
  description = "Message sent via a mailing list";
}
~~~

## Symbols and result options

- `MAILLIST`: inserted when a message is detected as list mail
  - Result options may include:
    - `ezmlm`
    - `mailman`
    - `googlegroups`
    - `cgp` (CommuniGate Pro)
    - `generic` (sufficient list headers without a specific vendor)

## Supported detectors

- Ezmlm
- Mailman (v2 and v3)
- Google Groups
- CommuniGate Pro
- Generic RFC 2919/2369 list headers

## Notes

- Some Mailman installations (especially Mailman 3) can disable certain `List-*` headers, which may reduce detection reliability.
- The module is intended to adjust scoring for list messages rather than to accept or reject mail on its own.
