---
title: Migrating from SpamAssassin
---

# Migrating from SpamAssassin to Rspamd

This guide explains how to migrate an existing SpamAssassin (SA) setup to Rspamd. It focuses on practical steps, key differences, and safe rollout.

## At a glance

- Performance: Rspamd is typically much faster and more resource‑efficient than SA.
- Rules: Many SA checks exist natively in Rspamd. Optional SA rules import is available via the `spamassassin` module.
- Actions vs. score: Rspamd recommends actions (`no action` → `greylist` → `add header` → `rewrite subject` → `reject`) that your MTA applies.
- Stats: SA Bayes data cannot be reused; you must retrain Rspamd statistics.

## Migration checklist

1) Install Rspamd using official packages (`/downloads`).
2) Integrate with your MTA: see [MTA integration](/tutorials/integration) for Postfix, Exim, Sendmail and HTTP options.
3) Configure Redis and statistics: see [Statistics settings](/configuration/statistic). Keep defaults unless you know what to change.
4) Decide on SA rules migration:
   - Prefer native Rspamd modules and rules out‑of‑the‑box.
   - If you rely on custom SA rules, use the [SpamAssassin rules module](/modules/spamassassin).
5) Train statistics with your corpora (ham/spam) and/or enable autolearn.
6) Stage rollout: mirror traffic, test thresholds, then switch production.

## Key differences from SpamAssassin

- Engine: Rspamd is modular (Lua/C) with asynchronous I/O and Redis; SA is Perl‑based.
- Verdict: Rspamd provides actions for the MTA; SA typically marks as spam/ham.
- Policy: Rspamd combines multiple modules (DKIM, DMARC, SURBLs, fuzzy, Bayes, etc.) by default.
- Config: HCL‑style files and Lua; native WebUI for monitoring and control.

## Integrating Rspamd

Use the guide at [MTA integration](/tutorials/integration). Recommended patterns:

- Postfix/Sendmail: milter mode via Rspamd proxy worker.
- Exim and HTTP‑capable MTAs: HTTP JSON integration.
- LDA mode: deliver via `rspamc --mime --exec` to add headers and operate per‑user statistics.

## Migrating rules (optional)

If you need SA rules compatibility, enable the `spamassassin` module. Prefer native Rspamd features where possible for performance and quality.

Example minimal configuration (see full options at [/modules/spamassassin](/modules/spamassassin)):

~~~hcl
spamassassin {
	# One or more SA rules files or globs
	ruleset = "/path/to/rules/*.cf";
	# Optionally include baseline SA rules
	base_ruleset = "/var/db/spamassassin/*/*.cf";
	# Optional tuning
	match_limit = 100k; # limit regex search window
}
~~~

Notes:
- Rspamd optimizes SA rules; some plugins/functions are not supported. See the module doc for limits and performance notes.
- Prefer keeping only the custom rules you truly need.

## Statistics and training

Rspamd uses a different statistical algorithm and storage; SA Bayes cannot be imported. Configure and train as follows:

1) Ensure Redis is available and reachable by Rspamd.
2) Use the default Bayes classifier in `$CONFDIR/statistic.conf` (or `classifier-bayes.conf`). See [Statistics settings](/configuration/statistic).
3) Initial training from corpora (Maildir‑like directories):

```
rspamc learn_ham /path/to/ham
rspamc learn_spam /path/to/spam
```

4) Optionally enable autolearn in `classifier-bayes.conf`:

~~~hcl
autolearn {
	spam_threshold = 6.0;
	ham_threshold = -0.5;
	check_balance = true;
}
~~~

5) Maintain statistics expiry with the [`bayes_expiry` module](/modules/bayes_expiry).

### Learning by email (optional)

You can expose aliases to feed samples to `rspamc`:

```
learn-spam-<secret>: "| rspamc learn_spam"
learn-ham-<secret>:  "| rspamc learn_ham"
```

Use unpredictable aliases to prevent abuse and pollution.

## Mapping SA concepts to Rspamd

- SA “spam” ≈ Rspamd “add header” by default. Consider your users’ workflows when choosing action thresholds.
- SA network plugins like Razor/Pyzor/DCC are not used by Rspamd; similar functionality exists via native RBLs, fuzzy checks, reputation and URL checks.
- Meta rules are supported; some SA plugins are unsupported—see module docs.

## Rollout strategy

1) Shadow run: run Rspamd alongside SA and compare headers/reports.
2) Tune actions: adjust thresholds to meet your FP/FN targets.
3) Cutover: switch the MTA content filter to Rspamd, keep SA disabled but available for fallback.
4) Monitor: use WebUI, logs and metrics; review BAYES_* rates and autolearn balance.

## Troubleshooting and pitfalls

- Incompatible Bayes: do not attempt to import SA Bayes; retrain.
- Excess SA rule load: importing the entire SA ruleset can slow Rspamd—migrate only necessary custom rules.
- Missing Redis: statistics and some features rely on Redis; ensure connectivity and authentication.
- Multi‑recipient mail with per‑user stats: prefer LDA mode to avoid attributing to the wrong user.

## See also

- [MTA integration](/tutorials/integration)
- [Statistics settings](/configuration/statistic)
- [Bayes expiry module](/modules/bayes_expiry)
- [SpamAssassin rules module](/modules/spamassassin)
