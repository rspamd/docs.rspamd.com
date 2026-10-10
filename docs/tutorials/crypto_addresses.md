---
title: Detecting crypto wallet addresses
---

# Detecting crypto wallet addresses

Rspamd detects cryptocurrency wallet addresses in messages. Scam and extortion mail usually quotes an address to collect payment, so a valid address together with other scam patterns is a strong signal.

Detection needs no configuration. The rules live in `rules/crypto.lua`, and the matching and validation are done by the `lua_crypto_addresses` library, which also provides the [`crypto_addresses` selector](/configuration/selectors).

## How it works

The subject and every text part of a message are scanned for address-shaped candidates. Each candidate is then validated, and only valid addresses are reported. For most currencies this includes a checksum, so a random string that happens to look like an address is rejected.

A message is scanned at most once, however many symbols, selectors or Lua code ask for its addresses, and it is not scanned at all if nothing asks.

Besides the addresses written normally, Rspamd also finds Base58 addresses that were split into groups with single spaces or tabs to avoid simple pattern matching (for example `1N42 K1P3 hMBy ...`). They are reported joined.

## Supported currencies

| Currency | Symbol | Validated address formats |
| :------- | :----- | :------------------------ |
| Bitcoin | `BITCOIN_ADDR` | Base58Check (`1...`, `3...`), SegWit and Taproot (`bc1...`), Bitcoin Cash `cashaddr` with or without the `bitcoincash:` prefix |
| Litecoin | `LITECOIN_ADDR` | Base58Check (`L...`, `M...`), SegWit (`ltc1...`) |
| Dogecoin | `DOGECOIN_ADDR` | Base58Check (`D...`, `A...`, `9...`) |
| Tron | `TRON_ADDR` | Base58Check (`T...`), including TRC-20 |
| XRP | `XRP_ADDR` | Base58Check with the XRP alphabet (`r...`) |
| Zcash | `ZCASH_ADDR` | Transparent addresses (`t1...`, `t3...`) |
| Cardano | `CARDANO_ADDR` | Mainnet Shelley addresses (`addr1...`) |
| Cosmos | `COSMOS_ADDR` | `cosmos1...` accounts, modules and contracts |
| Stellar | `STELLAR_ADDR` | `G...` account IDs (Base32 with CRC16) |
| TON | `TON_ADDR` | User-friendly addresses (Base64URL with CRC16) |
| Ethereum and EVM chains | `ETHEREUM_ADDR_MAYBE` | `0x` followed by 40 hex digits |
| Monero | `MONERO_ADDR_MAYBE` | 95 Base58 characters starting with `4` |

Beyond the checksum, Rspamd checks that the decoded data has the structure of a real address. For example, a SegWit address needs a valid witness version and program length, and a Cardano pointer address must hold well-formed pointer values. A string that carries a correct checksum but could not exist on the chain is rejected.

The two `_MAYBE` symbols have no checksum that Rspamd can verify (Ethereum's EIP-55 and Monero's checksums need Keccak-256), so they are matched by format only. Treat them as weak signals.

Uppercase bech32 and `cashaddr` addresses are accepted, but mixed case is not, as the specifications require.

## Symbols

`CRYPTO_ADDR_CHECK` is the parent symbol. It is inserted when the message has at least one valid address, and its options are `currency:address` pairs, for example `bitcoin:16L5yRNPTuciSgXGHqYwn9N6NeoKqopAu`.

The per-currency symbols listed in the table are inserted for the currencies found, with the matching addresses as options. All of them have a default score of `0`, so they do not change the result by themselves. They exist to be used in your own rules, composites and expressions.

The symbols belong to the `scams` group.

## Scam detection

The built-in `LEAKED_PASSWORD_SCAM` composite fires when a message has a wallet address of any supported currency together with a scam pattern (`LEAKED_PASSWORD_SCAM_RE`, `R_MIXED_CHARSET` or `R_EMPTY_IMAGE`). Earlier versions only considered Bitcoin addresses.

You can build your own composites from the same symbols. For example, to score mail that mentions a Monero or Litecoin address and has a suspicious subject:

~~~hcl
# local.d/composites.conf
CRYPTO_ADDR_SUBJECT_SCAM {
  expression = "(MONERO_ADDR_MAYBE | LITECOIN_ADDR) & SUBJ_ALL_CAPS";
  score = 4.0;
}
~~~

## Using addresses in other rules

The `crypto_addresses` selector returns the addresses found in a message:

| Selector | Result |
| :------- | :----- |
| `crypto_addresses()` | All addresses, bare |
| `crypto_addresses('monero')` | Only Monero addresses |
| `crypto_addresses('', 'typed')` | All addresses as `currency:address` strings |

The selector calculates the addresses itself, so it does not depend on `CRYPTO_ADDR_CHECK` and keeps working when that symbol is disabled, for instance by a settings profile.

For example, to look the addresses up in a map of known scam wallets:

~~~hcl
# local.d/multimap.conf
CRYPTO_ADDR_BLOCKLIST {
  type = "selector";
  selector = "crypto_addresses()";
  combinator = "array"; # match every address separately
  map = "${LOCAL_CONFDIR}/local.d/crypto_blocklist.map";
  score = 8.0;
  description = "Message contains a known scam wallet address";
}
~~~

The map holds one address per line. See [selectors](/configuration/selectors) and the [multimap module](/modules/multimap) for the details of selector maps.

## Limits

Scanning is bounded so that a hostile message cannot make it expensive. A single scan validates at most 512 distinct candidates (64 of them from split addresses) and stops after finding 64 valid addresses. Large texts are searched in slices of 64 KiB.

## For Lua developers

Rules and plugins can use the library directly:

~~~lua
local lua_crypto_addresses = require "lua_crypto_addresses"

-- table of currency -> { address, ... }
local found = lua_crypto_addresses.get_addresses(task)

-- flat list, optionally restricted to a currency; pass true to get "currency:address"
local flat = lua_crypto_addresses.get_addresses_flat(task, 'bitcoin', false)
~~~

`lua_crypto_addresses.add_from_string(task, str)` lets a `lua_content` handler contribute text that the message scan never sees, such as text recovered from an attachment or a QR code. Handlers run before the text parts of the message exist, so until `get_addresses` has run the string is only stored. Once it has run, a string is scanned immediately. Symbols that already ran do not see addresses added afterwards.

`lua_crypto_addresses.classify(task, word)` returns the currency name for a single candidate string, or `nil` if it is not a valid address.
