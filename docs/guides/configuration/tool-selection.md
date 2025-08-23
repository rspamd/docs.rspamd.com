---
title: Tool Selection Guide
sidebar_position: 2
---

# Tool Selection Guide

This guide helps you choose the right Rspamd tools and approaches for your specific situation. Rather than overwhelming you with options, we'll guide you through a simple decision process.

![Rspamd Tool Selection Diagram](/img/rspamd-diagram.png)

## Rule Selection Priority

Use the simplest tool that solves the problem. Prefer this order:

1. Prefer regexp rules (with conditions)
2. If multiple independent matches are required, prefer multimaps
3. If you need asynchronous calls, create custom Lua rules
4. If you need configuration and multi-symbol logic, write a plugin
5. Combine different symbols using composites

---

## 1) Prefer regexp rules (with conditions)

Best starting point for: single-pattern detections, cheap text checks, header/body conditions.

- Fast and efficient
- Can be gated with `re_conditions` to validate matches precisely
- Keep logic minimal; offload heavy checks to later stages

Example with conditions (inspired by `rules/bitcoin.lua`):

```lua
config.regexp['BITCOIN_ADDR'] = {
  re = string.format('(%s) + (%s) > 0', normal_wallet_re, btc_bleach_re),
  expression_flags = { 'noopt' },
  re_conditions = {
    [normal_wallet_re] = function(task, txt, s, e)
      local word = lua_util.str_trim(txt:sub(s + 1, e))
      local valid = is_traditional_btc_address(word)
      if valid then
        task:insert_result('BITCOIN_ADDR', 1.0, word)
        return true
      end
      return false
    end,
    [btc_bleach_re] = function(task, txt, s, e)
      local word = tostring(lua_util.str_trim(txt:sub(s + 1, e)))
      local valid = is_segwit_bech32_address(task, word)
      if valid then
        task:insert_result('BITCOIN_ADDR', 1.0, word)
        return true
      end
      return false
    end,
  },
}
```

Tips:
- Keep regexps strict and bounded to avoid overmatching
- Use `re_conditions` to confirm complex formats (checksums, structure)

---

## 2) If multiple matches are required, prefer multimaps

Use when you need many independent lookups: domains, IPs, keywords, MIME types, URLs, etc.

Benefits:
- Clean separation of data (maps) and logic
- Efficient, built-in caching, easy to maintain lists

Example:

```hcl
# /etc/rspamd/local.d/multimap.conf

# Block specific senders/domains
BLOCKED_SENDERS {
  type = "from";
  map = "/etc/rspamd/maps/blocked_domains.list";
  score = 8.0;
}

# Flag messages containing risky keywords
RISKY_KEYWORDS {
  type = "content";
  map = "/etc/rspamd/maps/risky_keywords.list";
  score = 3.0;
}
```

When to choose: many patterns, externalized and frequently updated.

---

## 3) If you need async calls — create custom Lua rules

Use when you must perform asynchronous checks: HTTP queries, DNS, Redis/ClickHouse, external services.

Example skeleton:

```lua
local rspamd_http = require "rspamd_http"

rspamd_config:register_symbol({
  name = 'MY_ASYNC_CHECK',
  callback = function(task)
    local url = 'https://example.com/check?id=' .. task:get_message_id()
    rspamd_http.request({
      url = url,
      task = task,
      timeout = 1.5,
      callback = function(err, code, body)
        if not err and code == 200 and body == 'bad' then
          task:insert_result('MY_ASYNC_CHECK', 1.0)
        end
      end,
    })
    return false
  end,
  flags = 'empty',
})
```

Notes:
- Return quickly; set results in the async callback
- Respect timeouts; avoid blocking work

---

## 4) If you need configuration and multi-symbol logic — write a plugin

Use a plugin when you need:
- Multiple symbols working together
- Structured configuration under `local.d/<plugin>.conf`
- Reuse across deployments

Minimal plugin shape:

```lua
local lua_util = require "lua_util"

local M = 'my_plugin'

local function check_one(task)
  -- lightweight logic here
  if task:get_header('X-Flag') == 'on' then
    task:insert_result('MY_PLUGIN_SYMBOL', 1.0)
  end
end

rspamd_config:register_symbol({
  name = 'MY_PLUGIN_SYMBOL',
  callback = check_one,
  score = 0.0,
  group = 'policies',
})

return {
  name = M,
}
```

Configuration example:

```hcl
# /etc/rspamd/local.d/my_plugin.conf
enabled = true;
threshold = 5;
```

---

## 5) Combine different symbols using composites

Use composites to express higher-level logic without duplicating work.

Example:

```hcl
# /etc/rspamd/local.d/composites.conf

SUSPICIOUS_OUTBOUND {
  expression = "(MY_ASYNC_CHECK & RISKY_KEYWORDS) | (BLOCKED_SENDERS & /DMARC_.*//)";
  score = 6.0;
  policy = "leave"; # keep original symbols as well
}
```

Guidelines:
- Compose existing symbols first; avoid re-implementing logic
- Use composites to define actions/policies at a higher level

---

## Quick Reference

- Prefer **regexp rules** with `re_conditions` for single-pattern checks
- Use **multimaps** for many independent lookups
- Write **Lua rules** for async operations
- Create a **plugin** for configurable, multi-symbol logic
- Use **composites** to combine symbols into richer signals