---
title: Composite symbols
---

# Rspamd Composite Symbols

Composites combine multiple rules into more complex conditions. When a composite matches, it can add its own symbol and optionally remove the triggering symbols and/or their weights.

## Quick Reference

| Feature | Syntax | Effect |
|---------|--------|--------|
| Default removal | `SYMBOL` | Remove symbol and weight |
| Keep weight | `~SYMBOL` | Remove symbol, keep weight |
| Keep both | `-SYMBOL` | Keep symbol and weight |
| Force remove | `^SYMBOL` | Force remove (overrides `-`) |
| Symbol options | `SYMBOL[opt1,opt2]` | Match only with specific options |
| Group match | `g:groupname` | Match any symbol from group |
| Positive group | `g+:groupname` | Match positive-scoring symbols |
| Negative group | `g-:groupname` | Match negative-scoring symbols |

## Configuration

Define composites in `local.d/composites.conf`:

```hcl
TEST_COMPOSITE {
    expression = "SYMBOL1 and SYMBOL2";
    score = 5.0;
}
```

When both `SYMBOL1` and `SYMBOL2` match, they are replaced by `TEST_COMPOSITE` with score 5.0.

### Composite Properties

| Property | Type | Description |
|----------|------|-------------|
| `expression` | string | Boolean expression defining when composite fires |
| `score` | number | Score assigned to the composite symbol |
| `group` | string | Symbol group for the composite |
| `policy` | string | Default removal policy for all atoms |
| `enabled` | boolean | Set to `false` to disable |

---

## Execution Architecture

Understanding how composites execute is essential for writing correct rules, especially when composites depend on each other or on symbols from different processing stages.

### Task Processing Stages

Rspamd processes messages through ordered stages. Composites execute at two specific points:

```
PREFILTERS → FILTERS → CLASSIFIERS → COMPOSITES → POST_FILTERS → COMPOSITES_POST → IDEMPOTENT
                                          ↑                              ↑
                                     First pass                    Second pass
```

| Stage | Description |
|-------|-------------|
| FILTERS | Regular filter rules execute |
| CLASSIFIERS | Bayes classifier runs |
| **COMPOSITES** | First-pass composites evaluate |
| POST_FILTERS | Post-filter rules execute |
| **COMPOSITES_POST** | Second-pass composites evaluate |
| IDEMPOTENT | Final processing (logging, history) |

### Two-Pass Evaluation

Rspamd automatically analyzes composite dependencies and assigns each composite to the appropriate pass:

**First pass** (COMPOSITES stage):
- Composites that only depend on symbols from FILTERS, PREFILTERS, or CLASSIFIERS
- The majority of composites execute here

**Second pass** (COMPOSITES_POST stage):
- Composites that depend on POST_FILTER symbols
- Composites that depend on other second-pass composites

Note: Composites cannot depend on IDEMPOTENT stage symbols because that stage is read-only and doesn't insert symbols into scan results.

```hcl
# First pass - only depends on filter symbols
FIRST_PASS_EXAMPLE {
    expression = "DKIM_SIGNED & SPF_ALLOW";
}

# Second pass - depends on post-filter symbol
SECOND_PASS_EXAMPLE {
    expression = "FIRST_PASS_EXAMPLE & SOME_POSTFILTER_SYMBOL";
}
```

Rspamd determines pass assignment by analyzing:
1. Direct dependencies (symbols in the expression)
2. Transitive dependencies (if atom A depends on composite B, and B is second-pass, then A becomes second-pass)

### Symbol Removal Timing

Symbol removal happens **after** all composites in a pass are evaluated, not during evaluation. This has important implications:

```hcl
COMP_A {
    expression = "SYMBOL1 & SYMBOL2";
    # Removes SYMBOL1 and SYMBOL2
}

COMP_B {
    expression = "SYMBOL1 & SYMBOL3";
    # Also sees SYMBOL1 during evaluation (not yet removed)
}
```

Both composites evaluate against the original symbol set. Removal decisions are collected and applied afterward.

### Inverted Index Optimization

Rspamd builds an inverted index mapping symbols to composites that use them. When a symbol fires:
1. Rspamd looks up which composites contain that symbol
2. Only those composites are evaluated

Composites with only negated atoms (like `!SYMBOL1 & !SYMBOL2`) are always evaluated since they don't appear in the inverted index.

---

## Expression Syntax

### Boolean Operators

| Operator | Alternatives | Description |
|----------|--------------|-------------|
| `AND` | `&`, `and` | Both operands must be true |
| `OR` | `\|`, `or` | Either operand must be true |
| `NOT` | `!`, `not` | Operand must be false |

Use parentheses to control precedence. Without them, operators evaluate left-to-right:

```hcl
EXAMPLE {
    expression = "SYMBOL1 and SYMBOL2 and (not SYMBOL3 | not SYMBOL4)";
    score = 10.0;
}
```

### Composites Referencing Composites

Composites can include other composites. Definition order doesn't matter:

```hcl
PARENT {
    expression = "SYMBOL1 AND CHILD";
}
CHILD {
    expression = "SYMBOL2 OR NOT SYMBOL3";
}
```

When a composite references another composite:
- If the referenced composite is second-pass, the referencing composite becomes second-pass too
- Rspamd detects and prevents recursive definitions

---

## Symbol Removal Policies

When a composite matches, it can remove the triggering symbols, their weights, or both. This is controlled through prefix modifiers or the `policy` setting.

### Prefix Modifiers

| Prefix | Symbol | Weight | Use Case |
|--------|--------|--------|----------|
| (none) | Removed | Removed | Replace symbols with composite |
| `~` | Removed | **Kept** | Hide symbol but count its weight |
| `-` | **Kept** | **Kept** | Additive scoring |
| `^` | Removed | Removed | Force removal (overrides `-`) |

### How Removal Works

1. Each composite collects removal decisions for its atoms
2. After all composites in a pass evaluate, Rspamd processes the collected decisions
3. For each symbol, all removal requests are combined using bitwise OR

The removal decision for each symbol tracks three flags:
- **Remove symbol**: Hide the symbol name from output
- **Remove weight**: Subtract the symbol's weight from total score
- **Forced**: Override any "keep" requests

### Conflict Resolution

When multiple composites reference the same symbol with different modifiers:

| Scenario | Result | Reason |
|----------|--------|--------|
| One uses default, another uses `-` | Symbol kept | `-` sets no removal flags, nothing to OR |
| One uses `~`, another uses `-` | Symbol kept, weight kept | `-` prevents symbol removal |
| One uses `^`, another uses `-` | Symbol removed | `^` sets forced flag, overrides everything |
| Multiple use default | Symbol removed | Flags combine identically |

**Example:**

```hcl
# Assume SPAM_INDICATOR exists in scan results

COMPOSITE_A {
    expression = "SPAM_INDICATOR & OTHER_SYM";
    # Default: requests remove_symbol + remove_weight
}

COMPOSITE_B {
    expression = "-SPAM_INDICATOR & DIFFERENT_SYM";
    # The `-` sets no removal flags for SPAM_INDICATOR
}
```

Result: `SPAM_INDICATOR` is **kept**. COMPOSITE_A's removal flags (remove_symbol | remove_weight) are ORed with COMPOSITE_B's flags (none). But since COMPOSITE_B explicitly requests "leave", Rspamd interprets this as "at least one composite wants it kept" and preserves the symbol.

**Force removal overrides:**

```hcl
COMPOSITE_C {
    expression = "^SPAM_INDICATOR & FORCE_CLEANUP";
    # The `^` sets forced flag
}
```

Now `SPAM_INDICATOR` is **removed** despite COMPOSITE_B wanting to keep it, because the forced flag overrides the keep request.

**Key insight**: The `-` modifier doesn't just "not remove" — it actively protects the symbol from removal by other composites. Use `^` when you need to guarantee removal regardless of other composites.

### Policy Setting

Set a default policy for all atoms in an expression:

```hcl
ADDITIVE_COMPOSITE {
    expression = "SYMBOL1 and SYMBOL2";
    policy = "leave";  # Both symbols and weights preserved
}
```

| Policy | Effect |
|--------|--------|
| `default` | Remove symbol and weight |
| `remove_weight` | Remove weight only, keep symbol |
| `remove_symbol` | Remove symbol only, keep weight |
| `leave` | Keep both symbol and weight |

Prefix modifiers override the policy for individual symbols.

### Weight Calculation Examples

Given: `SYMBOL_A` (weight 2.0), `SYMBOL_B` (weight 3.0), composite score 5.0

| Expression | Symbols Shown | Total Score |
|------------|---------------|-------------|
| `SYMBOL_A & SYMBOL_B` | Composite only | 5.0 |
| `~SYMBOL_A & SYMBOL_B` | Composite only | 7.0 (2.0 + 5.0) |
| `-SYMBOL_A & SYMBOL_B` | SYMBOL_A + Composite | 7.0 (2.0 + 5.0) |
| `-SYMBOL_A & -SYMBOL_B` | Both + Composite | 10.0 (2.0 + 3.0 + 5.0) |

---

## Symbol Groups

Match any symbol from a defined group:

| Syntax | Matches |
|--------|---------|
| `g:groupname` | Any symbol from the group |
| `g+:groupname` | Symbols with positive score |
| `g-:groupname` | Symbols with negative score |

```hcl
FUZZY_AND_DKIM_FAIL {
    expression = "g+:fuzzy & !g:dkim";
    # Matches if any positive fuzzy symbol AND no DKIM symbols
}
```

Removal policies apply only to the matched symbol, not the entire group.

---

## Symbol Options

Match symbols only when they have specific options (added in 2.0):

```hcl
SPECIFIC_DMARC {
    expression = "DMARC_POLICY_REJECT[sp]";
    # Only matches if DMARC_POLICY_REJECT has "sp" option
}
```

### Option Matching

| Syntax | Requirement |
|--------|-------------|
| `[opt1]` | Must have `opt1` |
| `[opt1,opt2]` | Must have both `opt1` AND `opt2` |
| `[/regex/i]` | Must have option matching regex |
| `[/regex/,opt1]` | Must match regex AND have `opt1` |

All specified options must be present (AND logic):

```hcl
COMBINED_OPTIONS {
    expression = "SYMBOL[/user@.*/i, authenticated]";
    # Must have an option matching the regex AND "authenticated"
}
```

---

## Whitelist Composites

Composites with negative scores act as whitelists. Rspamd handles these specially:

```hcl
WHITELIST_SENDER {
    expression = "GOOD_SENDER & DKIM_VALID";
    score = -10.0;  # Negative score = whitelist
}
```

When a composite has negative score, Rspamd marks its atoms as "FINE" symbols. This prevents the spam filtering logic from short-circuiting before these symbols are evaluated, ensuring whitelist composites have a chance to match.

---

## Disabling Composites

Disable a stock composite in `local.d/composites.conf`:

```hcl
DKIM_MIXED {
    enabled = false;
}
```

You can also disable composites via [user settings](/configuration/settings).

---

## Common Patterns

### Combine Related Signals

```hcl
PHISHING_COMBO {
    expression = "PHISHING & (SUSPICIOUS_URL | REDIRECTOR_URL)";
    score = 8.0;
}
```

### Whitelist Exception

```hcl
TRUSTED_FORWARDER {
    expression = "-FORGED_SENDER & KNOWN_FORWARDER & DKIM_VALID";
    score = -5.0;
    # Keeps FORGED_SENDER visible but reduces overall score
}
```

### Escalate When Multiple Signals

```hcl
HIGH_CONFIDENCE_SPAM {
    expression = "g+:fuzzy & BAYES_SPAM & (RBL_SPAMHAUS | RBL_BARRACUDA)";
    score = 15.0;
}
```

### Remove Noise, Keep Score

```hcl
CONSOLIDATED_RBL {
    expression = "~RBL_A & ~RBL_B & ~RBL_C";
    score = 0;  # Weight from individual RBLs is preserved
    # Hides individual RBL symbols, shows only this composite
}
```

---

## Troubleshooting

### Composite Not Firing

1. **Check symbol availability**: Use `rspamc symbols` to see available symbols
2. **Verify execution stage**: If the composite depends on post-filter symbols, it runs in the second pass
3. **Check for typos**: Symbol names are case-sensitive
4. **Test expression logic**: Simplify the expression to isolate the issue

### Unexpected Symbol Removal

1. **Check all composites**: Search for the symbol across all composite definitions
2. **Look for `^` prefix**: Force removal overrides keep (`-`) requests
3. **Consider pass ordering**: Second-pass composites see results of first-pass removals

### Debugging

Use `rspamc` to test composites:

```bash
# Check which composites matched
rspamc -v < test_message.eml | grep -i composite

# See all symbols including removed ones (pass all symbols through)
rspamc -p < test_message.eml
```

The `-p` flag (or HTTP header `Pass: all`) shows all symbols including those that were removed by composites, which helps trace removal decisions.
