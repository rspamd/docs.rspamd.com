---
title: Force Actions module
---


# Force Actions module

The purpose of this module is to force an action to be applied if particular symbols are found/not found and optionally return a specified SMTP message. It is available in version 1.5.0 and greater.

## Configuration

Configuration should be added to `/etc/rspamd/local.d/force_actions.conf`

The following elements are valid in the rules of this module:

 - `action`: action to force if the rule matches
 - `expression`: a symbol or combination of symbols to match on
 - `honor_action`: actions in this list should not be overridden
 - `message`: SMTP message to be used by MTA
 - `require_action`: override action only if metric action in this list
 - `subject`: subject to set in metric for `rewrite subject` action
 - `limit`: the action is applied only if the expression result is greater than this value (default: 0)
 - `least`: if true, the forced action is a minimum: Rspamd applies it unless the score-based action is stronger, and the remaining checks still run
 - `process_all`: if true, Rspamd still runs the remaining checks after the rule sets the action (by default they are skipped)
 - `priority`: passthrough priority used to arbitrate between multiple matching rules (since 4.2.3; default: `normal`, or `low` for a `least` rule); accepts `low`, `normal`, `high`, `critical`, or the equivalent numeric values `0`-`3`

Only one of `honor_action` or `require_action` should be set on a given rule.

[Composite expressions](/configuration/composites#expression-syntax) can be used for `expression`.

[Selectors](/configuration/selectors) can be used to generate dynamic `message`. The selector expression must be enclosed in `${}`.

### Symbol names

Each rule named `MY_RULE` produces a registered symbol called `FORCE_ACTION_MY_RULE` (the rule name is used as is, without changing its case). These symbol names can be used when setting up dependencies or checking debug output.

### Execution Order

If neither `require_action` nor `honor_action` is specified and `expression` does not reference a [composite](/configuration/composites#expression-syntax), the respective force action symbol is registered as a normal filter with a dependency on all symbols referenced in `expression`.
If at least one of `require_action` or `honor_action` is specified, or `expression` references a composite, the respective force action symbol is registered as a post filter.
For example, this is important if you want to revert an action that is decided upon the total score, as the action is only updated once all normal filters are completed.

Composites are only resolved after normal filters have run, so a rule cannot depend on one directly; since 4.2.3 it is auto-promoted to a postfilter instead. Such a rule runs right after the composites: before the other postfilters, such as greylisting, and before the rules with `require_action` or `honor_action`, which see its result. It is still skipped if an earlier rule already set a pre-result without `process_all`, since that stops composite evaluation entirely. A filter-stage rule with a lower priority than another rule gets `process_all` implied for this reason (see below); otherwise, set `process_all = true` on whichever rule fires first.

Only composites defined in the configuration when this module starts are detected, so a rule on a composite added later (e.g. from a dynamic map or by another plugin) stays a normal filter and never fires. A composite whose expression uses a postfilter symbol is resolved after all postfilters, too late for any rule.

### Priority

When more than one rule matches for the same message, `priority` decides which one wins: the highest-priority match is applied regardless of registration order. Available priorities, from lowest to highest, are `low` (`0`), `normal` (`1`), `high` (`2`) and `critical` (`3`). Rules without an explicit `priority` default to `normal`.

An invalid priority is logged as a warning and ignored, so the rule uses the default priority. A fractional value is rounded down and a value outside `0`-`3` is clamped to the nearest bound, both with a warning. Setting `priority` together with `least` also logs a warning, since a `least` rule can never outrank a non-`least` result — `priority` then only affects ordering among other `least` rules.

When a rule with an explicit `priority` fires, its `FORCE_ACTION_*` symbol carries a `priority:N` option (alongside the forced action name) so the value is visible in the scan output rather than only in the passthrough result.

By default, a rule is skipped when the action it forces is already the current action and it sets neither `message` nor `subject`, since it would change nothing. Recording it would also make the result a passthrough one, which turns off Bayes autolearning, neural training and the reputation, ratelimit and greylisting updates for that message. A skipped rule still counts at its priority: while that action stays selected, a lower-priority rule that matches later cannot replace it (a `least` rule can still raise it, as before).

A rule with its own `priority` records its result even when its action is already selected, so that it outranks the results set after it, including those of other modules; it then behaves as if `process_all` were set, and the result is a passthrough one. Without its own `message`, it keeps the SMTP reply of the result for the same action recorded before it. The rules with `require_action` or `honor_action` run last, in the order of their priorities, so they keep the shortcut whatever their priority. The legacy `actions {}` format has no `priority` and always keeps the shortcut.

A rule on the filter stage that matches without `process_all` stops the checks that have not run yet, so a higher-priority rule whose symbols are not known yet could never match. Such a rule therefore behaves as if `process_all` were set whenever another rule, other than a `least` one, has a higher priority. Setting a high priority on one rule thus keeps the scan running for every lower-priority rule on the filter stage.

A rule without `priority` records its result at `normal`, the default of most other modules (e.g. antivirus or multimap). Between two results with the same priority, the one recorded first wins. Before 4.2.3, these results were recorded at `low`. A `least` rule without `priority` still uses `low`, so it stays below the `least` results of other modules, such as DMARC.

### Legacy configuration

Older configurations used a flat `actions {}` block with action names as keys mapping to lists of expressions, and an optional `messages {}` block mapping expressions to SMTP messages:

~~~hcl
# Legacy format — avoid for new deployments
actions {
  reject = ["SYMBOL_A", "SYMBOL_B"];
}
messages {
  SYMBOL_A = "Rejected by policy";
}
~~~

When Rspamd detects this layout (`opts.actions` present) it logs "Processing legacy config" and registers symbols automatically. Symbol names in legacy mode are derived from a hash of the expression (`FORCE_ACTION_` followed by 12 hex characters) rather than a human-readable rule name. Migrate to the `rules {}` format to get stable, human-readable symbol names and the `priority` option, which is not available in legacy mode.

### Examples

~~~hcl
# Rules are defined in the rules {} block
rules {

  # For each condition we want to force an action on we define a rule

  # Rule is given a descriptive name
  MY_WHITELIST {
    # This is the action we want to force
    action = "no action";
    # If the following combination of symbols is present:
    expression = "IS_IN_WHITELIST & !CLAM_VIRUS & !FPROT_VIRUS";
  }

  WHITELIST_EXCEPTION {
    action = "reject";
    expression = "IS_IN_WHITELIST & (CLAM_VIRUS | FPROT_VIRUS)";
    # message setting sets SMTP message returned by mailer
    message = "Rejected due to suspicion of virus";
  }

  REJECT_MIME_BAD { 
    action = "reject";
    expression = "MIME_BAD";
    # message can contain selector expressions enclosed in ${}
    message = "(support-id: ${queueid}) Your mail was rejected because it contains BANNED ATTACHMENTS. Please check https://www.example.com/${languages.first}/allowed-attachments.html for further details!"
  } 

  DCC_BULK {
    action = "rewrite subject";
    # Here expression is just one symbol
    expression = "DCC_BULK";
    # subject setting sets metric subject for rewrite subject action
    subject = "[BULK] %s";
    # honor_action setting define actions we don't want to override
    honor_action = ["reject", "soft reject", "add header"];
  }

  BAYES_SPAM_UPGRADE {
    action = "add header";
    expression = "BAYES_SPAM";
    # require_action setting defines actions that will be overridden
    require_action = ["no action", "greylist"];
  }

}
~~~
