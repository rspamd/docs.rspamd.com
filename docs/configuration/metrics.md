---
title: Actions and scores
---

# Rspamd actions and scores

## Introduction

Rspamd produces a message score and a single resulting action. The action is a recommendation to your MTA about how to handle the message. You control when actions trigger via thresholds, and you control how symbols contribute to the score via weights.

Actions returned by Rspamd:

- `discard`: drop the email but return success to the sender (special cases only)
- `reject`: ultimately reject the message
- `rewrite subject`: rewrite the subject to indicate spam
- `add header`: add a header to indicate spam
- `no action`: allow the message
- `soft reject`: temporarily defer the message (used by greylisting/ratelimiting; no threshold)

From version 1.9, there are also some more actions:

- `quarantine`: push a message to quarantine (must be supported by MTA)
- `discard`: silently discard a message

Starting from version 1.9, you have the flexibility to define custom actions with their own thresholds in Rspamd. You can also utilize these custom actions in the `force_actions` module:

```hcl
actions {
  # Generic threshold
  my_action = {
    score = 9.0;
  },
  # Force action only
  phishing = {
    flags = ["no_threshold"],
  }
}
```

Only one action could be applied to a message. Hence, it is generally useless to define two actions with the same threshold.

## Actions vs thresholds (important)

- Thresholds are numeric score cutoffs defined in `local.d/actions.conf`.
- Actions are what Rspamd actually returns to the MTA.

Key points:

- `soft reject` has no threshold. It is emitted by modules (e.g. `greylist`, `ratelimit`) or by core logic (e.g. timeouts) via a pre-result.
- The `greylist` threshold triggers the `soft reject` action. For example, `greylist = 4;` means “at score ≥ 4, apply greylisting and return action soft reject”. This is expected by design.

Example:

```hcl
# /etc/rspamd/local.d/actions.conf
actions {
  reject = 15;      # final reject
  add_header = 6;   # mark spam
  greylist = 4;     # triggers soft reject (temporary deferral)

  # Custom action (referenced by force_actions), no own threshold
  phishing = {
    flags = ["no_threshold"];
  }
}
```

Notes:
- Modules can force an action regardless of thresholds (e.g. greylisting/ratelimit calling `task:set_pre_result('soft reject', ...)`). The most severe applicable action wins.
- Do not define two thresholds at the same score; only one action is returned.

## Configuring scores and actions

### Symbols

Symbols are defined by an object with the following properties:

* `weight` - the symbol weight as floating point number (negative or positive); by default the weight is `1.0`
* `group` - a group of symbols, for example `DNSBL symbols` (as shown in WebUI)
* `description` - optional symbolic description for WebUI
* `one_shot` - normally, Rspamd inserts a symbol as many times as the corresponding rule matches for the specific message; however, if `one_shot` is `true` then only the **maximum** weight is added to the metric. `grow_factor` is correspondingly not modified by a repeated triggering of `one_shot` rules.

A symbol definition can look like this:

~~~hcl
symbol "RWL_SPAMHAUS_WL_IND" {
    weight = -0.7;
    description = "Sender listed at Spamhaus whitelist";
}
~~~

Rspamd rules are typically organized into groups, with each symbol capable of belonging to multiple groups. For instance, the `DKIM_ALLOW` symbol is part of both the `dkim` group and the `policies` metagroup. You have the flexibility to group or not group your own rules. If you wish to adjust the scores of your symbols, you can do so by modifying the `local.d/groups.conf` file as shown below:

~~~hcl
# local.d/groups.conf

symbols {
  "SOME_SYMBOL" {
    weight = 1.0; # Define your weight
  }
}
~~~

Or, for grouped symbols: 

~~~hcl
group "mygroup" {
  max_score = 10.0;
  
  symbols {
    "MY_SYMBOL" {
      weight = 1.0; # Define your weight
    }
  }
}
~~~

To modify symbols for existing groups, it is advisable to utilize dedicated files in either the `local.d` or `override.d` directory. For instance, you can create a file named `local.d/rbl_group.conf` to incorporate your custom RBLs. To obtain a comprehensive list of these files, you can refer to the `groups.conf` file located in the primary Rspamd configuration directory (e.g., `/etc/rspamd/groups.conf`).

### Actions

Actions thresholds and configuration are defined in `local.d/actions.conf`:

```hcl
# local.d/actions.conf
actions {
  reject = 15;
  add_header = 6;
  greylist = 4; # will result in soft reject

  # Optional custom action used by force_actions
  phishing = {
    flags = ["no_threshold"];
  }
}
```

It is also possible to define some generic attributes for actions applications:

* `grow_factor` - the multiplier applied for the subsequent symbols inserting by the following rule:

$$
score = score + grow\_factor * symbol\_weight
$$

$$
	grow\_factor = grow\_factor * grow\_factor
$$

The default value for this setting is `1.0`, indicating no weight increase is applied. By raising this value, the score of messages with multiple matching `spam` rules is amplified. It's important to note that negative score values do not affect this value.

* `subject` - string value that replaces the message's subject if the `rewrite subject` action is applied. Original subject can be included with `%s`. Message score can be filled using `%d`.
* `unknown_weight` - weight for unknown rules. If set, all rules may add symbols to this metric. If a rule is not specified in the metric, its weight defaults to this value. Without this option, rules not registered in any metric are ignored.
