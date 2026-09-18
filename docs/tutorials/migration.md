---
title: Upgrading
---

# Updating Rspamd

This document outlines the modifications to Rspamd in recent versions, including any incompatible changes, and provides instructions for updating your rules and configuration accordingly.



## Efficient Rspamd Cluster Upgrade Guide

Discover a reliable step-by-step process for upgrading your Rspamd cluster while maintaining stability and minimizing downtime. This guide emphasizes a cautious approach with extensive testing to ensure a seamless transition between versions.

1. Ensure that you have a backup of the current stable configuration files, as well as any custom rules, maps, or other settings specific to your cluster.

2. Use stable packages on a stable cluster. Always use the latest stable release of Rspamd in your production environment.

3. Add a node or multiple nodes to an experimental cluster using the experimental repository. This will allow you to test the new version in a controlled environment without affecting the stable cluster.

4. Mirror traffic from the stable cluster to the experimental cluster using the `rspamd_proxy` module. This will help you identify any potential issues or differences between the two versions of Rspamd.

5. Monitor the experimental cluster for any discrepancies, crashes, or other issues. Address these problems as they arise.

6. When a new release is cut, update the experimental cluster to the stable version.

7. Repeat steps 4-5 one more time to ensure that any previously identified issues have been resolved.

8. Once you are confident that the new version is stable and compatible with your environment, update the stable cluster to the next version.

9. Continue to monitor the stable cluster to ensure smooth operation and resolve any issues that may arise after the upgrade.

10. Repeat the entire process starting from `step 1` for future updates. This approach ensures a smooth and controlled upgrade process that minimizes potential downtime and issues in your production environment.

## Migration to Rspamd 4.0.0

### 1. Bayes Per-User Resharding (Required for sharded Redis deployments)

Rspamd 4.0 replaces Jump Hash with Ring Hash (Ketama) for consistent upstream selection in Redis-sharded Bayes deployments ([4ea7504](https://github.com/rspamd/rspamd/commit/4ea750466)). After upgrade, per-user Bayes keys will be looked up on different shards than where they were written.

**Who is affected:** Only users with multiple `write_servers` configured for Bayes Redis backends. Single-server deployments are not affected.

**Migration procedure:**

1. Back up all Redis Bayes databases before proceeding.
2. While still running the old version, dump the statistics:
```bash
rspamadm statistics_dump dump -o /path/to/bayes-backup.bin
```
3. Upgrade Rspamd to 4.0.
4. Run the migration tool to redistribute keys to the correct shards under Ring Hash:
```bash
rspamadm statistics_dump migrate
```
5. Verify with `rspamc stat` that token counts look reasonable.

If you skip the migration, existing Bayes data will not be lost — it will simply be on the wrong shard and accuracy will degrade until messages are re-learned naturally. ([36325c5](https://github.com/rspamd/rspamd/commit/36325c5c5))

### 2. Content URLs Included by Default

`include_content_urls` now defaults to `true`, meaning `task:get_urls()` returns URLs extracted from PDF and other computed parts ([840e74d](https://github.com/rspamd/rspamd/commit/840e74db4)). This may trigger new RBL or URL reputation hits on messages with PDF attachments.

To restore the previous behavior, add to `local.d/options.inc`:

~~~hcl
include_content_urls = false;
~~~

### 3. SSL Worker Option Removed

The `ssl = true` option in worker configuration blocks has been removed ([4674408](https://github.com/rspamd/rspamd/commit/4674408f6)). SSL is now auto-detected from bind socket flags.

**Before:**
~~~hcl
worker "controller" {
  bind_socket = "localhost:11334";
  ssl = true;
  ssl_cert = "/path/to/cert.pem";
  ssl_key = "/path/to/key.pem";
}
~~~

**After:**
~~~hcl
worker "controller" {
  bind_socket = "localhost:11334 ssl";
  ssl_cert = "/path/to/cert.pem";
  ssl_key = "/path/to/key.pem";
}
~~~

Remove `ssl = true` from all worker sections and append the `ssl` suffix to the relevant `bind_socket` lines. `rspamadm configtest` will flag any remaining `ssl = true` occurrences.

### 4. Proxy Load Balancing Default Changed

Token bucket load balancing is now the default algorithm for proxy upstreams ([728f19f](https://github.com/rspamd/rspamd/commit/728f19f20)), replacing simple round-robin. The change is generally transparent but alters request distribution under burst conditions.

To restore round-robin, remove the `token_bucket` block from your proxy upstream configuration in `local.d/rspamd_proxy.inc`:

~~~hcl
upstream "scan" {
  # remove token_bucket { ... } block if present
  hosts = "backend1:11333,backend2:11333";
}
~~~

### 5. SenderScore RBLs Disabled

`senderscore_reputation` is disabled by default because it requires a MyValidity account registration and was returning blocked results for all unregistered IPs ([ce71021](https://github.com/rspamd/rspamd/commit/ce71021ae)).

Users with a registered MyValidity account who wish to keep using SenderScore should explicitly re-enable it in `local.d/reputation.conf`:

~~~hcl
senderscore_reputation {
  enabled = true;
}
~~~

### 6. DKIM Unknown Key Handling

Unknown and broken DKIM keys are now handled strictly per RFC ([e9e6bac](https://github.com/rspamd/rspamd/commit/e9e6bac43)). Messages with malformed DKIM keys may receive different DKIM result symbols than before. No configuration change is required; review DKIM scores if you notice unexpected changes in classification.

### 7. Suspicious TLDs Now Map-Based

The hardcoded suspicious TLD list has been replaced with a map file at `conf/maps.d/suspicious_tlds.inc` ([614e68c](https://github.com/rspamd/rspamd/commit/614e68c8b)).

- To **override** the list entirely, create `local.d/maps.d/suspicious_tlds.inc` with your own entries.
- To **extend** the default list, create `local.d/maps.d/suspicious_tlds.inc.local` and add extra TLDs there.

Any TLDs previously maintained via hardcoded patches to the source or custom rules should be migrated to the map file.

### 8. Neural Module Autolearn Option Renames

Autolearn-related options in the neural module have been renamed to align with RBL module naming conventions ([71dac51](https://github.com/rspamd/rspamd/commit/71dac5167)).

If you have custom neural configuration in `local.d/neural.conf` or `override.d/neural.conf`, review the [neural module documentation](/modules/neural) for the updated option names and update accordingly. Run `rspamadm configtest` to surface any unknown options.

### 9. libfasttext Dependency Removed (Packagers)

The external libfasttext C++ shared library is no longer required or used ([d96ee36](https://github.com/rspamd/rspamd/commit/d96ee3610)). The `ENABLE_FASTTEXT` cmake option has been removed — Fasttext support is always compiled in via the built-in shim.

- **Packagers**: Remove libfasttext from build dependencies and runtime dependencies.
- **Users**: No action required. Existing `.bin` and `.ftz` model files continue to work without modification.

## Migration to Rspamd 3.13.0

### Multi-class Bayes

Rspamd 3.13 adds multi-class Bayes classification, allowing categories beyond spam/ham (e.g. newsletters, transactional, phishing). The recommended production setup is to keep the classic spam/ham classifier separate and add a second classifier for non-binary classes.

#### Incompatibilities

- In a multi-class classifier you must use `class = "<name>"` in each `statfile` and you must not use `spam = true/false` there.
- Do not mix binary and multi-class statfiles within the same classifier block.
- A multi-class classifier requires at least two classes.
- `min_learns` applies per class; insufficiently trained classes are ignored during classification.

#### Keeping existing spam/ham database intact

- Preserve your current binary classifier as-is (same symbols `BAYES_SPAM`/`BAYES_HAM`, same backend). It will continue to use your existing Redis data; no relearning is required.
- Add a new classifier for multi-class categories. It will build its own dataset independently.

Example:

~~~hcl
# Keep binary classifier (uses existing DB)
classifier "bayes" {
  name = "bayes_binary";
  tokenizer { name = "osb"; }
  backend = "redis";
  min_tokens = 11;
  min_learns = 200;
  statfile { symbol = "BAYES_HAM"; spam = false; }
  statfile { symbol = "BAYES_SPAM"; spam = true; }
  learn_condition = 'return require("lua_bayes_learn").can_learn';
}

# Add new multi-class classifier
classifier "bayes" {
  name = "bayes_multi";
  tokenizer { name = "osb"; }
  backend = "redis";
  min_tokens = 11;
  min_learns = 200;
  statfile { symbol = "BAYES_NEWSLETTER"; class = "newsletter"; }
  statfile { symbol = "BAYES_TRANSACTIONAL"; class = "transactional"; }
  statfile { symbol = "BAYES_PHISHING"; class = "phishing"; }
  learn_condition = 'return require("lua_bayes_learn").can_learn';
}
~~~

#### Learning commands

- Binary (unchanged):

```bash
rspamc learn_spam msg.eml
rspamc learn_ham msg.eml
```

- Multi-class (new):

```bash
rspamc learn_class:newsletter newsletter1.eml
rspamc learn_class:transactional order_confirmation.eml
```

#### Upgrade checklist

1. Keep your existing binary classifier unchanged to reuse data.
2. Add a new multi-class classifier with `class = "..."` statfiles.
3. Do not mix `spam = true/false` with `class = "..."` in one classifier.
4. Start learning new classes using `learn_class:<name>`.
5. Validate with `rspamd -t` and monitor results.

## Migration to Rspamd 3.9.0

* The `ratelimit` module now operates in non-dynamic mode by default. This change does not affect any existing buckets, as dynamic rates and dynamic bursts will simply be unused in this mode. To retain the old behaviour, please either set the `dynamic_rate_limit` option to `true` (globally for all ratelimit rules) or configure the `ham_factor_rate`/`spam_factor_rate` and/or `ham_factor_burst`/`spam_factor_burst` multipliers for individual rules as needed.

* Bayes statistics now use a reduced window size (2 words), which has proven to be faster and more space-efficient in our tests. Existing statistics can be used without any modifications or relearning. To restore the old behaviour, one can set the following to `local.d/classifier-bayes.conf`:

~~~
tokenizer {
  name = "osb";
  window = 5;
}
~~~

However, it is recommended to use the default settings.

## Migration to Rspamd 3.7.4

The `exclude_private_ips` setting in RBL module no longer exists in this release (and was broken in previous releases), it can be removed from configuration. This setting is equivalent to `exclude_local`.

## Migration to Rspamd 3.7.2

This release introduces [returncodes matchers](/modules/rbl#returncodes-matchers) in RBL module. Previously returncodes were always treated as Lua patterns, now this behaviour is enabled by setting `matcher = "luapattern"` on the rule. For backwards-compatibility this matcher may be enabled implicitly where Lua patterns are detected but they may not be correctly detected in all cases. If you use custom RBL module configuration that makes use of Lua patterns please review it and explicitly set matcher where necessary.

## Migration to Rspamd 3.3

When migrating to Rspamd 3.3, exercise caution if you are utilizing custom passthrough rules, particularly those defined by plugins that utilize `action` rather than `least action`). In versions prior to 3.3, these rules would still allow for processing of additional rules. However, in Rspamd 3.3 and beyond, passthrough denotes a final action and skips directly to the idempotent stage.

Users of the `neural` plugin may experience a significant Redis storage leak in version 3.2. This issue is resolved in version 3.3 with [the following commit](https://github.com/rspamd/rspamd/commit/f9cfbba2c84e01f18e65618587e6854681843ff1), however, this fix will not remove any existing stale keys. These keys also do not have an expiration set. One solution to clean up the database is to remove all keys starting with the `rn_` prefix. There are various options available to accomplish this, such as exploring the [following conversation](https://stackoverflow.com/questions/4006324/how-to-atomically-delete-keys-matching-a-pattern-using-redis) on Stackoverflow.

Starting from this version, building Rspamd requires a **C++20** compatible compiler and toolchain. For Ubuntu Bionic users, this means adding the LLVM repository for the compatible C++20 standard library runtime. The necessary steps are outlined on the [downloads page](/downloads).

## Migration to Rspamd 3.0

The functionality for DMARC reporting is no longer included in the DMARC module. To send DMARC reports, you must now run the `rspamadm dmarc_report` command on a regular basis, such as through a cron job. Additionally, the configuration for reporting has undergone incompatible changes, so please refer to the [module documentation](/modules/dmarc) for further information.


## Migration to Rspamd 2.6

To ensure proper functionality of the GUI after upgrading to 2.6, it is necessary to clear the browser cache and restart the browser.

Additionally, the `Neural networks` plugin's training data will be lost as the internal structure of the NN has been redesigned in an incompatible manner. However, training can continue as normal.

If you encounter complaints about `SENDER_REP_HAM` and `SENDER_REP_SPAM` symbols in Rspamd logs, you may need to define scores for these symbols. Refer to the [reputation module documentation](/modules/reputation). This issue will be fixed in future Rspamd releases.


## Migration to Rspamd 2.0

The RBL module has replaced both the `emails` and `surbl` modules, consolidating all Runtime Black Lists checks in a single location. The existing rules are typically automatically converted to the`rbl` syntax, including those defined in `local.d`. However, `override.d` rules will only act as overrides for `local.d` and not for RBL module. If you need to use overrides, consider converting them to `override.d/rbl.conf` rules.

Note that `emails` rules utilizing maps instead of DNS RBLs are **NO LONGER SUPPORTED**. Instead, use `multimap` with selectors.

In version 2.0, the default Bayes backend has been changed to Redis. The Sqlite backend is now considered deprecated and is not recommended for use. Therefore, if you were previously using the `sqlite` backend as default, you will need to specify its type manually or convert it to Redis (or even, start again and relearn Redis backend).

The `ip_score` module has been replaced by the `reputation` module, and the existing rules should be automatically converted to the new syntax. The symbol name has also been changed to two symbols: `SENDER_REP_SPAM` and `SENDER_REP_HAM`, and the scores for `IP_SCORE` should be automatically applied to these new symbols. However, it should be noted that any data collected by the `ip_score` plugin will be **IRRECOVERABLY LOST**. This change was necessary due to a significant flaw in the old plugin that caused the reputation to never expire.

The `neural` module has undergone a significant update. While no config incompatibilities have been identified, it should be noted that any existing network data will be **IRRECOVERABLY LOST**.

When building Rspamd from source, a **C++11** capable compiler is now required as there are bundled dependencies written in C++ (specifically, the replxx library). Additionally, the `libsodium` is also necessary. Rspamd now only supports the `clang` and `gcc` compilers. Other compilers may still work, but it is no longer guaranteed.

Additionally, Bayes expiry now always works in `lazy` mode and the default mode has been changed to `lazy` only.

Furthermore, the Log helper worker has been removed, although it is unlikely that it was being used by anyone.

## Migration to Rspamd 1.9.1



From version 1.9.1, Rspamd supports [Jinja2 templates](https://jinja.palletsprojects.com) provided by [Lupa Lua library](https://foicica.com/lupa/). You can learn more about the basic syntax and capabilities of these templating engines by following the links provided. Rspamd uses a specific syntax for variable tags: `{=` and `=}` instead of the traditional `` as these tags could represent, for example, a table within a table in Lua.

Therefore, in version 1.9.1 and above, your config files must be Jinja safe, meaning that there should be no special sequences such as `

## Migration to Rspamd 1.9.0

This version should not generally be incompatible with the previous one aside of the case if you build Rspamd from the sources or use a custom package. From the version 1.9, Rspamd has changed some of the default installation paths:

- There is a new `${LIBDIR}/rspamd/librspamd-server.so` library that contains common functions for `rspamd`, `rspamadm` and `rspamc` binaries
- `${PLUGINSDIR}` is now set to a specific path for Lua plugins and is **no longer** in the Lua path; it is suggested to use `${LUALIBDIR}` for all shared Lua code
- Here are default values for the paths used by Rspamd:
  * `CONFDIR` = `${PREFIX}/etc/rspamd` - main path for the configuration
  * `LOCAL_CONFDIR` = `${PREFIX}/etc/rspamd` - path for the user's defined configuration
  * `RUNDIR` = OS specific (`/var/run/rspamd` on Linux) - used to store volatile runtime data (e.g. PIDs)
  * `DBDIR` = OS specific (`/var/lib/rspamd` on Linux) - used to store static runtime data (e.g. databases or cached files)
  * `SHAREDIR` = `${PREFIX}/share/rspamd` - used to store shared files
  * `LOGDIR` = OS specific (`/var/log/rspamd` on Linux) - used to store Rspamd logs in file logging mode
  * `LUALIBDIR` = `${SHAREDIR}/lualib` - used to store shared Lua files (included in Lua path)
  * `PLUGINSDIR` = `${SHAREDIR}/plugins` - used to place Lua plugins
  * `RULESDIR` = `${SHAREDIR}/rules` - used to place Lua rules
  * `LIBDIR` = `${PREFIX}/lib/rspamd` - used to place shared libraries (included in RPATH and Lua CPATH)
  * `WWWDIR` = `${SHAREDIR}/www` - used to store static WebUI files

For those who are using the default packages, there should be no changes. Even in the case if you are using old `${PLUGINSDIR}` to store your custom plugins, Rspamd will still check the old location as a fallback during the plugin loading process.

Additionally, an incompatible change has been introduced for users of the **`coroutines based`** Rspamd Lua API. Starting from this version, symbols utilizing coroutines must be registered with the `coro` lag to function properly, otherwise, they will cause Rspamd to crash. More information is available in the following [issue](https://github.com/rspamd/rspamd/issues/2789).

## Migration to Rspamd 1.8.1

This version introduces several incompatibilities that may affect your setup.

### General configuration change

[Libucl](https://github.com/vstakhov/libucl) the library used to parse Rspamd's configuration files, has been modified in a way that prevents loading incomplete chunks of data. This means that each include file **MUST** be a valid configuration snippet on its own. For example, consider the following artificial example:

~~~hcl
.include "top.conf"
var = "bar";
.include "bottom.conf"
~~~

Where top/bottom could have something like:

~~~
# top.conf
{
~~~


~~~
# bottom.conf
}
~~~

The following will no longer be valid: libucl now requires that all braces are properly matched.

However, it still allows implicit braces on the top-level object. So the following file will still be **valid**:

~~~hcl
# Some include

section "foo" {
  key = value;
}

param = "value";
~~~

or this:

~~~hcl
# Implicit object
param = "value";
~~~

`rspamadm configtest` will show you if your local changes to the configuration files are incompatible with the new restrictions applied.

### Fuzzy and bayes misses for large text messages

Due to a bug introduced in version 1.8.0, the algorithm used to deterministically skip words in large text parts was not functioning as intended, resulting in different words pipelines produced by different Rspamd instances. This could affect the accuracy of classification if the `words_limit` was reached (default: `words_decay = 200` words). For large text parts, it was possible to miss both fuzzy and Bayes classifications. While missing Bayes classification is not significant, missing fuzzy classification could be severe, potentially breaking fuzzy detection for large text parts.

In version 1.8.1, we have fixed this issue. Since we have already broken compatibility with version 1.7.9, we have decided to increase `words_decay`  to 600. Please ensure that you do not override this parameter in any local or override files, such as `local.d/options.inc` or `override.d/options.inc`, or else compatibility with Rspamd's fuzzy storage will be lost for messages with more than `words_decay` threshold words.

### Different `CONFDIR` and `LOCAL_CONFDIR` case

In an extremely unlikely scenario, if your custom build uses different values for the `CONFDIR` and `LOCAL_CONFDIR` build/startup variables, you may experience missing custom Lua rules that were previously loaded from `$CONFDIR/rspamd.local.lua`, as they are now loaded from `$LOCAL_CONFDIR/rspamd.local.lua`. To the best of our knowledge, this does not affect any official packages or officially supported operating systems, such as FreeBSD or OpenBSD.

## Migration to Rspamd 1.8.0

There are several changes that may impact your setup, particularly if you use any of the following:

- **Clickhouse** module
- **User settings**

### Clickhouse changes

Starting from version 1.8, Rspamd has stopped using multiple tables and now uses a single table, `rspamd`, with all columns. This improves performance and eliminates the need for inefficient joins in Clickhouse. If you have used the Clickhouse module prior to version 1.8, your **schemas** will be automatically converted. However, **the existing data** will **NOT** be converted and will remain in the old tables. It may be necessary to use a command to enforce the new schema:

```
OPTIMIZE rspamd FINAL
```

Please note that this command may take a significant amount of time to complete if you have stored a large amount of historical data.

Additionally, you need to update your **queries** that use the additional Rspamd tables, such as `rspamd_urls`, `rspamd_asn`, `rspamd_attachments`, `rspamd_symbols`, and others. All corresponding fields are now located in the `rspamd` table. At this time, it is not possible to migrate old data from these tables.

### Settings changes

Rspamd now includes a `settings.conf` file, which incorporates `local.d/settings.conf` and `override.d/settings.conf`. If you have used these files to store settings, please ensure that they do not conflict with the new configuration layout.

## Migration to Rspamd 1.7.4

The only potential issue is that Rspamd now listens on **localhost only** by default. This could affect configurations that rely on the previous behavior of listening on all IP addresses (e.g. `*`).

However, we believe that it is important to keep the default settings as restrictive as possible to avoid potential security issues, which have occurred in other projects with 'open to all' defaults.

## Migration to Rspamd 1.7.0

It is recommended to run `rspamadm configwizard` to ensure that your configuration is compatible with version 1.7. This version no longer supports the `metrics` concept, which was never officially supported in the past. However, you may have come across instances of `metric "default"` in various parts of the Rspamd configuration and settings.

In version 1.7, we will continue to support the old `metric` keyword and scores defined under this section, such as in `rspamd.conf.local`. However, it is now recommended to define symbol scores in group settings (`local.d/group_*.conf`), which can be found in the `etc/rspamd/scores.d` folder.

There is no need to undertake any action if you have your custom scores defined in the legacy files. Rspamd will continue support of definitions in these files.

## Migrating to Rspamd 1.6.5

As a result of several important fixes made to tokenization algorithms, it is possible that the statistics and fuzzy modules may lose some precision. In these cases, you may want to consider re-learning your databases to improve the accuracy of filtering.

## Migrating to Rspamd 1.6.0

In this version, due to the implementation of the new milter interface, there is an important incompatible change that you may need to address if you use the `rmilter_headers` module. This module has been renamed to `milter_headers` and the corresponding protocol section is now named `milter` instead of `rmilter`. If you have configured this module inside `local.d/rmilter_headers.conf` or in `override.d/rmilter_headers.conf`, then no action is required, as these files will still be loaded by the renamed module. Otherwise, you will need to change the section name from `rmilter_headers` to `milter_headers`.

The `milter_headers` module now skips adding headers for local networks and authenticated users by default. This behavior can be re-enabled by setting `skip_local = false` and/or `skip_authenticated = false` in the module configuration. Alternatively, you can set `authenticated_headers` and/or `local_headers` to a list of headers that should not be skipped.

Additionally, a [proxy worker](/workers/rspamd_proxy) has been added to the default configuration and listens on all interfaces on TCP port 11332. If you do not need it, you can set `enabled = false` in `local.d/worker-proxy.inc`.

This release also eliminates the configuration split for systemd/sysv platforms. To ensure proper functionality, custom init scripts should utilize `rspamd.conf` instead of `rspamd.sysvinit.conf`. For those utilizing systemd and prefer logging to the systemd journal, the following should be added to `local.d/logging.inc`:

~~~hcl
systemd = true;
type = "console";
~~~

A significant overhaul of the Lua libraries has occurred in Rspamd 1.6. Some custom scripts may fail if they are loaded prior to `rspamd.lua` or if manual modifications have been made to `rspamd.lua`should be loaded before all custom scripts. This is the default behavior, however, in highly customized setups it may cause issues. In general, it is crucial to ensure that the following line is present in your code (found at the very beginning of `rspamd.lua`):

~~~lua
require "global_functions" ()
~~~

The Rmilter tool is now deprecated in favor of milter protocol support in the [rspamd proxy](/workers/rspamd_proxy). Examples of some specific features previously implemented in Rmilter can be found in the [milter headers module](/modules/milter_headers). It is recommended to migrate from Rmilter as soon as possible, as Rspamd 1.6 will be the last version to support the Rmilter tool. In future major releases (starting from 1.7), there will be **no guarantees** of compatibility with Rmilter.

For example, if you need the old behaviour for `extended_spam_headers` in Rmilter is desired, the following snippet can be added to `local.d/milter_headers.conf`:

~~~hcl
# local.d/milter_headers.conf
extended_spam_headers = true;
~~~

## Migrating to Rspamd 1.5.3

The rspamd_update module has been disabled by default; if you need it please set `enabled = true` in `local.d/rspamd_update.conf`.

## Migrating to Rspamd 1.5.2

New configuration files have been added for the following modules which previously missed them; if you have previously configured one of these modules in `rspamd.conf.local` please move your configuration to `rspamd.conf.override` to ensure that it is preserved verbatim or rework your configuration to use `local.d/[module_name].conf` instead.

- antivirus
- dkim_signing
- mx_check (set `enabled = true` if you use `local.d`)
- replies
- spamassassin
- trie

## Migrating to Rspamd 1.5

New configuration files have been added for the following modules which previously lacked them: `greylist`, `metadata_exporter` and `metric_exporter.` If you have previously configured one of these modules in `rspamd.conf.local`, it is recommended to move your configuration to `rspamd.conf.override` to ensure that it is preserved verbatim, or to rework your configuration to use `local.d/[module_name].conf` instead.

Additionally, if composites have been defined in `local.d/composites.conf` or `override.d/composites.conf`, these should be moved to `rspamd.conf.local` or reworked to the new format. An example can be found in `/etc/rspamd/composites.conf`.

You are also suggested to disable outdated and no longer supported features of Rmilter and switch them to Rspamd:

- Greylisting - provided by [greylisting module](/modules/greylisting)
- Ratelimit - is done by [ratelimit module](/modules/ratelimit)
- Replies whitelisting - is implemented in [replies module](/modules/replies)
- Antivirus filtering - provided now by [antivirus module](/modules/antivirus)
- DCC checks - are now done in [dcc module](/modules/dcc)
- Dkim signing - can be done now by using of [dkim module](/modules/dkim#dkim-signatures) and also by a more simple [dkim signing module](/modules/dkim_signing)

All duplicate features are still present in Rmilter for compatibility purposes. However, it is unlikely that any further development or bug fixes will be applied to them.

From version `1.9.1` it is possible to specify `enable` option in `greylisting` and `ratelimit` sections. It is also possible for `dkim` section since `1.9.2`. These options are `true` by default. Here is an example of configuration where greylisting and ratelimit are disabled:

~~~hcl
# /etc/rmilter.conf.local
limits {
    enable = false;
}
greylisting {
    enable = false;
}
dkim {
    enable = false;
}
~~~

These options are enabled by default solely for compatibility reasons. In future Rmilter releases, they will be **DISABLED** by default.

## Migrating to Rmilter 1.10.0 and Rspamd 1.4.0

TThe default passwords, specifically `q1` and `q2`, are no longer permitted for remote authentication. This change is a result of the widespread misuse of these **example** passwords and the potential security risks posed by some Rspamd users.

## Migrating to Rmilter 1.9.1 and Rspamd 1.3.1

In these releases, systemd socket activation has been removed. Note that upon upgrading on Debian platforms, Rmilter may not restart correctly. To resolve this, please run `systemctl restart rmilter` after installing the package. On the other hand, Rspamd is expected to restart correctly upon upgrade. Additionally, both Rspamd and Rmilter should be configured to automatically run on reboot post-upgrade.

## Migrating from Rmilter 1.8 to Rmilter 1.9

Please note that there are a few changes to the supported features in this release:

* beanstalk support has been removed from Rmilter in honor of Redis [pub/sub](https://redis.io/docs/interact/pubsub/), you must remove the whole `beanstalk` section from the configuration file
* auto whitelist for greylisting is no longer supported as it has been broken from the very beginning, you must remove all `awl` options from the greylisting section

If you have been using Beanstalk for certain purposes, you can transition to using Redis [pub/sub](https://redis.io/docs/interact/pubsub/). The `redis` section includes settings such as `spam_servers` and `spam_channel` for sending spam, and `copy_servers`, `copy_prob`, and `copy_channel` for sending message copies, which can help you reproduce Beanstalk functions using Redis.

Rmilter now provides additional options for configuring your local settings. You can now use `rmilter.conf.local` and `rmilter.conf.d/*.conf` files to override the default configuration.

Additionally, Rmilter no longer includes several SpamAssassin-compatible headers such as `X-Spam-Status`, `X-Spam-Level`, and `X-Spamd-Bar`. Instead, Rmilter now supports adding and removing custom headers as instructed by Rspamd (version 1.3.0 or higher). To restore the removed headers, you can use the example script provided below, which should be added to `/etc/rspamd/rspamd.local.lua`:

~~~lua
rspamd_config:register_symbol({
  name = 'RMILTER_HEADERS',
  type = 'postfilter',
  priority = 10,
  callback = function(task)
    local metric_score = task:get_metric_score('default')
    local score = metric_score[1]
    local required_score = metric_score[2]
    -- X-Spamd-Bar & X-Spam-Level
    local spambar
    local spamlevel = ''
    if score <= -1 then
      spambar = string.rep('-', score*-1)
    elseif score >= 1 then
      spambar = string.rep('+', score)
      spamlevel = string.rep('*', score)
    else
      spambar = '/'
    end
    -- X-Spam-Status
    local is_spam
    local spamstatus
    local action = task:get_metric_action('default')
    if action ~= 'no action' and action ~= 'greylist' then
      is_spam = 'Yes'
    else
      is_spam = 'No'
    end
    spamstatus = is_spam .. ', score=' .. string.format('%.2f', score)
    -- Add headers
    task:set_rmilter_reply({
      add_headers = {
        ['X-Spamd-Bar'] = spambar,
        ['X-Spam-Level'] = spamlevel,
        ['X-Spam-Status'] = spamstatus
      },
      remove_headers = {
        ['X-Spamd-Bar'] = 1,
        ['X-Spam-Level'] = 1,
        ['X-Spam-Status'] = 1
      }
    })
  end
})
~~~

## Migrating from Rspamd 1.2 to Rspamd 1.3

Rspamd version 1.3 does not introduce any incompatible changes

## Migrating from Rspamd 1.1 to Rspamd 1.2

Rspamd version 1.2 does not introduce any incompatible changes

## Migrating from Rspamd 1.0 to Rspamd 1.1

Please note that there is an incompatible change in the per-user statistics behavior for users with per-user statistics enabled.

Both `redis` and `sqlite3` now follow a consistent approach for per-user statistics:

* If per-user statistics is enabled check per-user tokens **ONLY**
* If per-user statistics is not enabled then check common tokens **ONLY**

If the previous behavior is desired, a separate classifier for per-user statistics must be implemented, for example:

~~~hcl
    classifier {
        tokenizer {
            name = "osb";
        }
        name = "bayes_user";
        min_tokens = 11;
        backend = "sqlite3";
        per_language = true;
        per_user = true;
        statfile {
            path = "/tmp/bayes.spam.sqlite";
            symbol = "BAYES_SPAM_USER";
        }
        statfile {
            path = "/tmp/bayes.ham.sqlite";
            symbol = "BAYES_HAM_USER";
        }
    }
    classifier {
        tokenizer {
            name = "osb";
        }
        name = "bayes";
        min_tokens = 11;
        backend = "sqlite3";
        per_language = true;
        statfile {
            path = "/tmp/bayes.spam.sqlite";
            symbol = "BAYES_SPAM";
        }
        statfile {
            path = "/tmp/bayes.ham.sqlite";
            symbol = "BAYES_HAM";
        }
    }
~~~

## Migrating from Rspamd 0.9 to Rspamd 1.0

Rspamd 1.0 has introduced changes to the default settings for statistics tokenization. The new default setting is `modern`, which generates tokens from normalized words and includes various improvements. However, these changes are not compatible with the statistics model used in pre-1.0 versions. To use these new features you should either **relearn** your statistics or continue using your old statistics **without** new features by adding a `compat` parameter:

~~~hcl
classifier {
...
    tokenizer {
        compat = true;
    }
...
}
~~~

The recommended way to store statistics now is the `sqlite3` backend (which is incompatible with the old mmap backend):

~~~hcl
classifier {
    type = "bayes";
    tokenizer {
        name = "osb";
    }
    cache {
        path = "${DBDIR}/learn_cache.sqlite";
    }
    min_tokens = 11;
    backend = "sqlite3";
    languages_enabled = true;
    statfile {
        symbol = "BAYES_HAM";
        path = "${DBDIR}/bayes.ham.sqlite";
        spam = false;
    }
    statfile {
        symbol = "BAYES_SPAM";
        path = "${DBDIR}/bayes.spam.sqlite";
        spam = true;
    }
}
~~~

## Migrating from Rspamd 0.6 to Rspamd 0.7

### WebUI changes

The Rspamd web interface is now a part of the Rspamd distribution. Additionally, Rspamd itself now serves all static files, eliminating the need for a separate web server. As a result, the WebUI worker has been removed, and the controller now acts as both a web browser and the rspamc client. However, it is still recommended to set up a full-featured HTTP server in front of Rspamd for added security features such as TLS and access controls.

Furthermore, there are now two levels of password protection for Rspamd: `password` for read-only commands and `enable_password` for commands that change data. If `enable_password` is not specified, `password` is used for both types of commands.

Here is an example of the full configuration of the Rspamd controller worker to serve the WebUI:

~~~hcl
worker {
	type = "controller";
	bind_socket = "localhost:11334";
	count = 1;
	password = "q1";
	enable_password = "q2";
	secure_ip = "127.0.0.1"; # Allows to use *all* commands from this IP
	static_dir = "${WWWDIR}";
}
~~~

### Settings changes

The settings system in Rspamd has undergone a complete overhaul. It is now implemented as a Lua plugin that registers pre-filters and assigns settings based on dynamic maps or a static configuration. To use the new settings system, please refer to the updated [documentation](/configuration/settings). The previous settings system has been entirely removed from Rspamd.

### Lua changes

Please be aware that there have been significant changes to the Lua API in this release, some of which may result in compatibility issues.

* many superglobals are removed: now Rspamd modules need to be loaded explicitly,
the only global remaining is `rspamd_config`. This affects the following modules:
	- `rspamd_logger`
	- `rspamd_ip`
	- `rspamd_http`
	- `rspamd_cdb`
	- `rspamd_regexp`
	- `rspamd_trie`

~~~lua
local rspamd_logger = require "rspamd_logger"
local rspamd_trie = require "rspamd_trie"
local rspamd_cdb = require "rspamd_cdb"
local rspamd_ip = require "rspamd_ip"
local rspamd_regexp = require "rspamd_regexp"
~~~

* new system of symbols registration: now symbols can be registered by adding new indices to `rspamd_config` object. Old version:

~~~lua
local reconf = config['regexp']
reconf['SYMBOL'] = function(task)
...
end
~~~

new one:

~~~lua
rspamd_config.SYMBOL = function(task)
...
end
~~~

`rspamd_message` has been **removed** completely. Instead, task methods should be used to access message data. This includes methods such as:

* `get_date` - this method now returns a date for the task and message based on the provided arguments:

~~~lua
local dm = task:get_date{format = 'message'} -- MIME message date
local dt = task:get_date{format = 'connect'} -- check date
~~~

* `get_header` - this function has undergone significant changes. The new version of `get_header` returns a decoded string, `get_header_raw` returns an undecoded string, and `get_header_full` returns a full list of tables. For more information, please refer to the updated [documentation](/lua/rspamd_task). You may need to update your existing code that uses the `task:get_header` method.
Old version:

~~~lua
function kmail_msgid (task)
	local msg = task:get_message()
	local header_msgid = msg:get_header('Message-Id')
	if header_msgid then
		-- header_from and header_msgid are tables
		for _,header_from in ipairs(msg:get_header('From')) do
	    	...
		end
	end
	return false
end
~~~

new one:

~~~lua
function kmail_msgid (task)
	local header_msgid = task:get_header('Message-Id')
	if header_msgid then
		local header_from = task:get_header('From')
		-- header_from and header_msgid are strings
	end
	return false
end
~~~

or with the full version:

~~~lua
rspamd_config.FORGED_GENERIC_RECEIVED5 = function (task)
	local headers_recv = task:get_header_full('Received')
	if headers_recv then
		-- headers_recv is now the list of tables
		for _,header_r in ipairs(headers_recv) do
			if re:match(header_r['value']) then
				return true
			end
		end
	end
    return false
end
~~~

* `get_from` and `get_recipients` now accept optional numeric arguments that determine where to retrieve the sender and recipients for a message. By default, this argument is set to `0`, which means that data is initially checked in the SMTP envelope (i.e., `MAIL FROM` and `RCPT TO` SMTP commands) and if the envelope data is not available, it is then obtained from MIME headers. A value of `1` means that data is checked in the envelope only, while `2` switches the mode to MIME headers. Here is an example from the `forged_recipients` module:

~~~lua
-- Check sender
local smtp_from = task:get_from(1)
if smtp_from then
	local mime_from = task:get_from(2)
	if not mime_from or
			not (string.lower(mime_from[1]['addr']) ==
			string.lower(smtp_from[1]['addr'])) then
		task:insert_result(symbol_sender, 1)
	end
end
~~~

### Protocol changes

Rspamd now exclusively uses the HTTP protocol for all operations, making the use of additional client libraries unnecessary. Additionally, the fallback to the older `spamc` protocol has been implemented to ensure automatic compatibility with software such as `rmilter` and other programs that use the `rspamc` protocol.

## Migration to Rspamd 4.1.0

### 1. Default `rspamd.com` Fuzzy Rule Now Discovered via SRV

The bundled default fuzzy rule no longer carries a hardcoded round-robin host list. It now uses `service=fuzzy+rspamd.com`, which makes the upstream parser resolve the `_fuzzy._tcp.rspamd.com` SRV record and manage backends and ports entirely in DNS ([b912c67a3](https://github.com/rspamd/rspamd/commit/b912c67a3)).

**Who is affected:** All installs that rely on the shipped `rspamd.com` fuzzy rule. Most deployments need **no action** — the resolver handles SRV transparently, the legacy `fuzzy1`/`fuzzy2` hostnames still resolve to every live backend, and installs that already pinned an explicit server string are unchanged. You only need to act if your resolver cannot serve SRV records (split-horizon DNS, a restrictive forwarder, or a firewall that drops SRV).

> An earlier regression made `rspamadm configtest` reject an SRV-only rule with `no servers defined for fuzzy rule with name: rspamd.com`; that is fixed in [64e1a6b5e](https://github.com/rspamd/rspamd/commit/64e1a6b5e). A resolver that silently fails to return SRV records will still leave the rule with no usable backends at runtime.

Verify SRV resolution works in your environment:

```bash
dig SRV _fuzzy._tcp.rspamd.com +short
```

If SRV cannot be resolved, pin explicit servers back in `local.d/fuzzy_check.conf` (the legacy hostnames remain valid):

~~~hcl
rule "rspamd.com" {
  # restore the pre-4.1.0 hostname-based selection
  servers = "fuzzy1.rspamd.com:11335,fuzzy2.rspamd.com:11335";
}
~~~

### 2. `mx_check` Module Reworked: Symbols Renamed, Options Deprecated

The `mx_check` module was rewritten with a three-layer Redis cache, finer-grained outcomes, and IP-class classification ([219fd9818](https://github.com/rspamd/rspamd/commit/219fd9818), [f70285614](https://github.com/rspamd/rspamd/commit/f70285614), [0eb4c443e](https://github.com/rspamd/rspamd/commit/0eb4c443e)). The symbol surface and several option names changed.

**Who is affected:** Only deployments that explicitly enabled and configured `mx_check`. The module is not active in a stock configuration.

**a) Renamed symbols.** `MX_NXDOMAIN` and `MX_MISSING` no longer exist — both collapse into `MX_NONE`. A large set of new symbols was added (`MX_GOOD`, `MX_INVALID`, `MX_A_*`, `MX_LOCAL_ONLY`/`MX_LOCAL_MIX`, `MX_BOGON_ONLY`/`MX_BOGON_MIX`, `MX_NULL`, `MX_BAD`, `MX_IP_BAD`, `MX_INFLIGHT`, `MX_TIMEOUT_*`, `MX_REFUSED`, `MX_ERROR`, `MX_REDIS_ERROR`, …). Update any custom scores, composites, `force_actions`, or rules that referenced `MX_NXDOMAIN` / `MX_MISSING`. Scores are now exposed through a dedicated `mx` group; tune them in `local.d/mx_group.conf` or `override.d/mx_group.conf` instead of hardcoding per-symbol overrides:

~~~hcl
# local.d/mx_group.conf
symbols {
  "MX_NONE"   { score = 0.5; }
  "MX_INVALID" { score = 2.0; }
}
~~~

**b) Renamed options.** `timeout` → `connect_timeout`, and `wait_for_greeting` → `verify_greeting`. The legacy names are still accepted but log a deprecation warning, and the module warns if a legacy key and its replacement are both set ([37027b0ee](https://github.com/rspamd/rspamd/commit/37027b0ee)). Update `local.d/mx_check.conf`:

~~~hcl
# before:
#   timeout = 5s;
#   wait_for_greeting = true;
# after:
connect_timeout = 5s;
verify_greeting  = true;
~~~

**c) Removed option.** `reject_nxdomain_mx` was removed. Null-MX rejection is now handled by `reject_null_mx` (gated by `reject_authorized` / `reject_local`).

**d) Redis cache layout.** The single domain-keyed cache is replaced by three namespaces (`<key_prefix>:d:`, `:m:`, `:i:`). Old single-layer entries are treated as a cache miss and overwritten in place — no manual flush is required, but expect a cold cache (extra DNS/TCP work) for a while after the upgrade.

### 3. Neural ANN Digest Changes Under `disable_symbols_input`

When `disable_symbols_input = true`, the profile digest that forms part of the trained ANN's Redis key (`rn_<rule>_<settings>_<digest>_<v>`) is now derived from the providers configuration instead of the symbol list ([1323fc5fb](https://github.com/rspamd/rspamd/commit/1323fc5fb), [ed97ec8a7](https://github.com/rspamd/rspamd/commit/ed97ec8a7)). This makes the digest stable across unrelated symbol changes (a new RBL, multimap, or SA-style rule), but it rotates **once** on the first start after upgrading.

**Who is affected:** Only neural deployments running with `disable_symbols_input = true` **and** an already-trained ANN stored in Redis. On first 4.1.0 start the existing ANN is orphaned under its old key, and inference drops to zero until a new model trains (potentially weeks under realistic class imbalance).

You have two options:

- **Let it retrain** — accept reduced neural coverage until enough samples accumulate.
- **Migrate the trained model once.** Locate the orphaned key and copy it to the new digest. After this one migration the digest stays stable across future config changes:

```bash
# inspect existing neural keys to find the old/new digest pair
redis-cli --scan --pattern 'rn_*'

# copy the trained model from the old digest to the new one
redis-cli COPY rn_<rule>_<settings>_<old>_<v> rn_<rule>_<settings>_<new>_<v>
```

### 4. `mailto:` URLs Stored in Canonical Slash-less Form

Bare email addresses and explicit `mailto:` URLs are now canonicalised to the same slash-less `mailto:user@host` string, per RFC 6068 ([a4ae51536](https://github.com/rspamd/rspamd/commit/a4ae51536), [6512946b2](https://github.com/rspamd/rspamd/commit/6512946b2)). Previously a bare email was injected as a literal `mailto://user@host` prefix, so the two forms landed in different dedup buckets and the same address could appear twice.

**Who is affected:** Only custom rules, multimaps, or selectors that string-match the literal `mailto://` form of an email URL returned by `task:get_urls()`. Those patterns now need to match `mailto:` (no `//`). As a side effect, a message containing both a bare address and the same explicit `mailto:` link now yields a single deduplicated URL rather than two, which can change URL counts in custom logic.

Update any such patterns, for example:

~~~hcl
# before:  /^mailto:\/\//
# after:
mailto_url = "mailto:";
~~~

## Migration to Rspamd 4.1.1

### 1. `/checkv3` Reply Format Is Now Content-Negotiated

Before 4.1.1 the `/checkv3` endpoint ignored the `Accept` header (beyond a JSON-vs-msgpack toggle) and always returned a hard-coded `multipart/mixed` body. As of 4.1.1 the reply representation is negotiated from `Accept`, and compression from `Accept-Encoding` ([6fa991b5f](https://github.com/rspamd/rspamd/commit/6fa991b5f), PR [#6083](https://github.com/rspamd/rspamd/pull/6083)). The **default reply format has changed**, so existing clients that assumed the old fixed `multipart/mixed` output will receive a different body.

New negotiation rules:

| `Accept` request header | Reply |
|---|---|
| absent / `*/*` | `multipart/form-data` (**new default**) |
| `message/rfc822` | `multipart/mixed` (the previous format) |
| `application/json` / `application/msgpack` | single-body v2-style reply |
| `multipart/form-data` | `multipart/form-data` |
| only unsupported types (e.g. `application/xml`) | `406 Not Acceptable` |

`Accept-Encoding: zstd` is honoured and defaults to `identity`; `Vary: Accept, Accept-Encoding` is always advertised.

**Who is affected:** Operators with custom HTTP clients that POST to `/checkv3` and parse the reply. `rspamc` itself is already updated and needs no action. Clients that only use `/check` or `/checkv2` are not affected.

**Migration:** Add the appropriate `Accept` header to your existing `/checkv3` request (the request body itself is unchanged; `request.v3` below is a placeholder for your current v3 multipart body):

```bash
# Restore the previous multipart/mixed reply by requesting it explicitly:
curl -H 'Accept: message/rfc822' --data-binary @request.v3 http://localhost:11333/checkv3

# Or ask for a plain single-body JSON result instead:
curl -H 'Accept: application/json' --data-binary @request.v3 http://localhost:11333/checkv3
```

Do not send an `Accept` header listing only unsupported media types, or the request will be rejected with `406 Not Acceptable`.

Note: `/checkv3` is now also routed on the controller (port `11334`), so `rspamc --protocol-v3` against localhost works without targeting a scan worker directly ([2de2ea9f0](https://github.com/rspamd/rspamd/commit/2de2ea9f0)).

### 2. `mx_check`: Loopback-only MX Reclassified as Local

A domain whose MX resolves only to loopback (`127.0.0.0/8` or `::1/128`) is now treated as a self-hosted/local MX and emits `MX_LOCAL_ONLY` (score `3.0`) instead of `MX_BOGON_ONLY` (score `8.0`) ([e7a8f3002](https://github.com/rspamd/rspamd/commit/e7a8f3002), closes [#6101](https://github.com/rspamd/rspamd/issues/6101)). This stops fully DMARC-aligned self-hosted mail from being hit with the strong `MX_BOGON_ONLY` penalty.

**Who is affected:** Hosts where the scanning machine's own MX maps to loopback (e.g. the host FQDN pointed at `127.0.0.1` in `/etc/hosts`), and anyone with composites, score overrides, or `force_actions` keyed on `MX_BOGON_ONLY` for that scenario.

**Migration:** Repoint any configuration that referenced `MX_BOGON_ONLY` for the loopback-only case to `MX_LOCAL_ONLY`. To adjust the new symbol's weight, override it in `local.d/groups.conf`:

~~~hcl
symbols {
  "MX_LOCAL_ONLY" {
    score = 0.0;
  }
}
~~~

## Migration to Rspamd 4.1.2

### 1. Invalid selectors now fail configuration load

The selector grammar is now anchored to the end of the input ([5eb40ae](https://github.com/rspamd/rspamd/commit/5eb40ae63), [#6127](https://github.com/rspamd/rspamd/pull/6127)). Previously the parser silently accepted the longest valid prefix and dropped the rest: `from("smtp"):domain:lower` (a second `:` cannot parse) was accepted and evaluated as `from("smtp"):domain`, and any trailing garbage after a selector or a `;` list element was ignored. Such selectors now fail configuration load with an error pointing at the offending token.

**Who is affected:** any configuration using selectors — multimap, rbl, ratelimit, settings, reputation, or selectors checked through the WebUI — that contains a selector with a syntax error after a valid prefix. These selectors were never evaluating as written, so the config was already not doing what it said.

**Migration steps:**

1. Validate the configuration with the new version before restarting the service:
```bash
rspamadm configtest
```
2. Fix each rejected selector at the reported position. The most common mistake is using method syntax (`:`) where transform syntax (`.`) was intended:
```
from("smtp"):domain:lower    # rejected in 4.1.2
from("smtp"):domain.lower    # correct
```
3. Review the affected rules after fixing: since the full chain now actually evaluates (instead of the silently truncated prefix), the rule's matching behaviour may change.

### 2. Glob map entries now match the whole subject

Glob map patterns are compiled anchored (`^(?:...)$`) at map load time ([06cf98f](https://github.com/rspamd/rspamd/commit/06cf98f2f), [#6125](https://github.com/rspamd/rspamd/issues/6125)). Previously glob entries were matched with substring semantics, so a `t.co` entry matched `walmart.com` and `*.bit.ly` matched `foo.bit.ly.evil.com`. Now bare names match exactly and wildcards match only what they say.

**Who is affected:** all glob-based maps: multimap `glob`/`glob_multi` types, url_redirector `redirector_hosts_map`, dkim_signing and arc `signing_table`/`key_table`, mx_check exclusions and rbl glob `returncodes` matchers. Entries that relied on the accidental substring behaviour stop matching after the upgrade.

**Migration steps:** review your glob maps and add explicit wildcards where substring matching was intended:

~~~
# Before 4.1.2 this single entry matched bit.ly anywhere in the subject:
bit.ly

# In 4.1.2 a bare entry matches exactly; list the subdomain wildcard explicitly:
bit.ly
*.bit.ly
~~~

A pattern that must match anywhere inside the subject needs wildcards on both sides (`*fragment*`). Note that the stricter matching is also the point of the fix: `*.bit.ly` no longer matching `foo.bit.ly.evil.com` closes an evasion vector, so do not blindly restore the old reach.

### 3. Symbols flagged explicit_enable are strictly gated under settings

Symbols carrying the `explicit_enable` flag now actually require explicit enabling ([011794c](https://github.com/rspamd/rspamd/commit/011794c9f), [#6144](https://github.com/rspamd/rspamd/pull/6144)). Previously such symbols were executed whenever *any* settings were applied to a task, regardless of content. Now they run only when listed in `symbols_enabled` of the applied settings (or force-enabled via `task:enable_symbol()`), including settings delivered via the `Settings` header.

**Who is affected:** deployments that apply settings (settings ids, the `Settings`/`Settings-ID` headers, or map-driven settings) and expect symbols registered with the `explicit_enable` flag to keep running under those settings.

**Migration steps:**

1. Find which symbols carry the flag — configdump now shows a per-symbol `flags` array ([05a7c92](https://github.com/rspamd/rspamd/commit/05a7c92c9)):
```bash
rspamadm configdump --symbol-details | grep -B 4 explicit_enable
```
2. Add the required symbols to `symbols_enabled` of the relevant settings entries. With the default policy this switches the entry to whitelist mode (only listed symbols run); to keep all symbols enabled while merely unlocking the listed ones, use the new `policy` option:
~~~hcl
# local.d/settings.conf
my_entry {
  # ... match conditions ...
  apply {
    policy = "implicit_allow";
    symbols_enabled = ["MY_EXPLICIT_SYM"]; # additive: unlocks, does not whitelist
    symbols_disabled = ["UNWANTED_SYM"];   # subtractive
  }
}
~~~

### 4. Alias resolution no longer rewrites From domains

The aliases module now refuses any rewrite that would change the domain of the From address, since SPF, DKIM and DMARC all key on it ([9fe6cb2](https://github.com/rspamd/rspamd/commit/9fe6cb2aa), [#6137](https://github.com/rspamd/rspamd/issues/6137), [#6141](https://github.com/rspamd/rspamd/pull/6141)). In particular, `googlemail.com` senders are no longer rewritten to `gmail.com` — only the gmail-style user-part canonicalization (dots and plus tags) is kept ([1b0cdd7](https://github.com/rspamd/rspamd/commit/1b0cdd779)). DMARC, SPF and forged-recipients checks now evaluate the sender addresses as they were transmitted.

**Who is affected:**

- Maps, rules or statistics keyed on the rewritten `gmail.com` From domain will now see `googlemail.com`. Add `googlemail.com` alongside `gmail.com` in from-domain maps. Email *hash* lookups (RBL email checks) still dedup via `lua_util.remove_email_aliases`, so they are unaffected.
- Configurations with cross-domain virtual aliases applied to the From address: those rewrites are silently discarded now (recipient rewriting is unchanged).
- Lua rules using the `orig` address flavour: `task:get_from({'mime', 'orig'})` now returns *only* the wire addresses when a rewrite preserved originals, instead of the originals plus the rewritten entries ([a7cbff9](https://github.com/rspamd/rspamd/commit/a7cbff984)). Code that relied on the combined list must query both flavours separately.
- DMARC/SPF verdicts change for mail whose sender was rewritten by aliases — this is the fix itself (alignment is checked against the wire From), and no action is needed.

### 5. lua_cryptobox secretbox: ciphertexts produced with short nonces

Secretbox encrypt and decrypt used to pass the caller's short nonce pointer to libsodium instead of the zero-padded 24-byte buffer, reading up to 23 bytes out of bounds and producing ciphertexts that depended on adjacent memory contents ([efb4d5c](https://github.com/rspamd/rspamd/commit/efb4d5cd5), [#6121](https://github.com/rspamd/rspamd/issues/6121)). Short nonces are now correctly zero-padded, so a short nonce and its explicitly padded 24-byte form produce identical, stable ciphertexts.

**Who is affected:** only custom Lua code using `rspamd_cryptobox` secretbox with nonces shorter than 24 bytes. Ciphertexts persisted by earlier versions under short nonces were never reliable and will most likely fail to decrypt after the upgrade.

**Migration steps:** after upgrading, re-encrypt any persisted secretbox data, and prefer generating full 24-byte nonces going forward.

## Migration to Rspamd 4.1.3

Rspamd 4.1.3 tightens several resource limits that were previously unbounded, corrects a number of limits that were configured but never actually enforced, and changes how fuzzy matches are scored and reported. Most deployments are affected by at least one of the items below.

### 1. Fuzzy Non-Exact Match Scoring Curve Changed

The score multiplier for non-exact (shingle) fuzzy matches was `sqrt(prob)`, a curve anchored at zero ([c45ab97](https://github.com/rspamd/rspamd/commit/c45ab97a4)). Since the storage never returns a probability below the shingle match threshold of `0.5`, the entire reachable range collapsed into roughly `0.73 .. 1.0`: a marginal 17/32 shingle overlap scored almost as high as an exact match, which combined with high-weight deny lists turned weak matches into instant rejects.

The multiplier is now `((prob - prob_bias) / (1 - prob_bias)) ^ prob_power`, anchored at the match threshold:

| Shingle overlap | Old multiplier | New multiplier |
|---|---|---|
| 19/32 | ~0.77 | 0.19 |
| 24/32 | ~0.87 | 0.50 |
| 28/32 | ~0.94 | 0.75 |

**Who is affected:** Every deployment using fuzzy rules that match on text or HTML hashes. Small image hashes keep their existing normalized curve, and exact matches are unchanged.

Weak matches now contribute much less score, so messages previously rejected on a marginal fuzzy hit may now pass. Review the weights of your fuzzy symbols before assuming the rule stopped working. The old curve is not preserved and cannot be restored; it was simply broken.

Two per-rule knobs are available in `local.d/fuzzy_check.conf`:

~~~hcl
rule "local" {
  # anchor of the curve, defaults to the 0.5 match threshold
  prob_bias = 0.5;
  # 1.0 by default; raise it to discount weak matches more harshly
  prob_power = 2.0;
}
~~~

### 2. SPF DNS Limits Are Now Enforced and Yield permerror

Three SPF limit bugs are fixed at once, and all three change verification results:

* `max_dns_nesting` was checked but the nesting counter was never incremented, so the limit had no effect at all and include/redirect chains were bounded only by the DNS request counter. Nesting depth is now tracked per resolved element and enforced when an include or redirect is about to be followed ([b80fd076](https://github.com/rspamd/rspamd/commit/b80fd076d)).
* The DNS request counter was compared with `>` while being incremented after the check, so a limit of 30 evaluated 31 elements. The comparison is now `>=`, so exactly `max_dns_requests` elements are evaluated: one fewer than before.
* Exceeding `max_dns_requests` or `max_dns_nesting` used to leave only the offending element unparsed, and the record was still evaluated with whatever fitted in the budget, usually ending as a definitive fail via its trailing `-all`. RFC 7208 4.6.4 requires `permerror` instead, and that is what Rspamd now returns ([66cdc8bf](https://github.com/rspamd/rspamd/commit/66cdc8bfa)).
* Names returned by `mx` and `ptr` were expanded into A/AAAA requests against a counter that never changed, and SPF uses the forced resolver API that bypasses `dns_max_requests`, so a single large RRset produced an unbounded number of queries. Both the RFC limit of 10 address lookups per `mx`/`ptr` element and a new per-record expansion budget are now enforced ([ea20c2f5](https://github.com/rspamd/rspamd/commit/ea20c2f59)).

**Who is affected:** Anyone acting on `R_SPF_FAIL` (rejection policies, DMARC alignment, `settings` conditioned on SPF symbols). Senders with large or deeply nested SPF records will flip from `R_SPF_FAIL` to `R_SPF_PERMFAIL`, which usually carries a very different weight in your policy.

Records carrying any flag are not cached in the LRU, so a domain that trips a limit is re-resolved on every message. Watch your resolver load after the upgrade for domains that now permerror.

Review the limits and the new `max_dns_expansions` option in `local.d/spf.conf`:

~~~hcl
# maximum SPF elements requiring a DNS lookup, per RFC 7208
max_dns_requests = 30;
# include/redirect nesting depth, enforced for the first time in 4.1.3
max_dns_nesting = 10;
# new in 4.1.3: per-record budget for A/AAAA lookups spawned by mx/ptr
max_dns_expansions = 100;
~~~

Setting a limit to zero disables it, but flattening a record still recurses over the same chain and remains bounded by the hard nesting cap compiled into Rspamd.

Check for newly appearing permerrors before and after the upgrade:

```bash
rspamc stat | grep -i spf
grep -c R_SPF_PERMFAIL /var/log/rspamd/rspamd.log
```

### 3. DKIM Signature Limit and Key Bounds

**`max_sigs` now counts every signature header examined** ([d560f9e8](https://github.com/rspamd/rspamd/commit/d560f9e8e)). Previously the check sat at the bottom of the loop, incremented before comparing with `>`, and three `continue` paths (parse failure, `trusted_only` skip, failed key request) jumped over the increment entirely. Consequences:

* The default of `5` used to permit six signatures; it now permits exactly five.
* Malformed or skipped signatures now count against the limit. Five junk `DKIM-Signature` headers ahead of a valid one will push the valid one out, and `R_DKIM_ALLOW` will not be inserted.

**Who is affected:** Deployments that see messages with many DKIM signatures, in particular mailing lists and forwarders that re-sign, and anyone whose policy depends on `R_DKIM_ALLOW` for such traffic.

If the "stopped after N signatures" line starts appearing in your logs for legitimate mail, raise the limit in `local.d/dkim_check.conf` (and `local.d/arc.conf` if you tune ARC separately):

~~~hcl
max_sigs = 8;
~~~

**Oversized public keys are now rejected** ([871dc8a1](https://github.com/rspamd/rspamd/commit/871dc8a12)). The `p=` tag is capped at 4096 base64 characters before any allocation, and parsed keys wider than 8192 bits are refused. Real keys are far below both bounds: 44 characters for ed25519, 736 for a 4096 bit RSA key. Signers using a modulus above 8192 bits now produce `R_DKIM_PERMFAIL` instead of a verification result. RFC 8301 requires verifiers to handle 1024 to 4096 bits, so this leaves twice the required headroom. Only verification is affected; signing keys are loaded through a different path.

**The `h=` header list is capped at 1000 items** for both signing and verification ([318d3183](https://github.com/rspamd/rspamd/commit/318d31837)). The shipped `default_sign_headers` list has 27 entries, so no realistic signing policy is affected.

**Ed25519 verification now works on more builds** ([89b9d5a0](https://github.com/rspamd/rspamd/commit/89b9d5a08)). All Ed25519 DKIM crypto is libsodium, which is a mandatory dependency, but it was gated behind a probe for OpenSSL's `EVP_PKEY_ED25519`. On an OpenSSL build lacking that NID, ed25519 signatures were previously not verified at all and will now produce `R_DKIM_ALLOW` or `R_DKIM_REJECT`. If you build Rspamd yourself, expect new DKIM (and therefore DMARC) results on ed25519-signed mail.

### 4. url_redirector Blocks Local Destinations by Default

`rspamd_http.request()` connected to whatever a URL or its DNS resolution yielded, including loopback, link-local and RFC1918 addresses. A new `forbid_local` option is enforced at the connection chokepoint, and it is enabled by default in `url_redirector` ([e57fb647](https://github.com/rspamd/rspamd/commit/e57fb6472)). Message URLs and their redirect targets are attacker controlled, and hop limits alone do not stop a crafted redirect from probing cloud metadata endpoints or internal services.

**Who is affected:** Operators who resolve redirects through an internal service, or whose `local_addrs` radix covers the hosts that `url_redirector` needs to reach. Those lookups will now fail.

To restore the previous behaviour, add to `local.d/url_redirector.conf`:

~~~hcl
forbid_local = false;
~~~

The same option is available to any Lua plugin calling `rspamd_http.request()` and is off by default there. It uses the address class check plus your configurable `local_addrs`, so review `local_addrs` in `local.d/options.inc` if the result is not what you expect.

### 5. New Size Ceilings on HTTP, Maps and Decompression

Several paths that were entirely unbounded now enforce a limit. Each of these can reject input that Rspamd previously accepted.

**Controller, proxy and control sockets now cap request bodies at `max_message`** ([1ae11c4d](https://github.com/rspamd/rspamd/commit/1ae11c4db)). Only the normal worker did so before, while the controller router, the proxy client connection and the main control socket accepted a declared `Content-Length` of any size, causing an unbounded preallocation before routing or authentication. Oversized requests are now rejected with `413` by the controller and by closing the connection in the proxy.

**Who is affected:** Anyone scanning messages larger than `max_message` (50Mb by default) through `rspamd_proxy` or the controller `/checkv2` endpoint. These used to be accepted; they now fail.

~~~hcl
# local.d/options.inc
max_message = 100Mb;
~~~

**Remote HTTP maps are bounded by `max_map_size`, 256Mb by default** ([95d51df4](https://github.com/rspamd/rspamd/commit/95d51df4a)). Map client connections never set a body limit, so a map server could feed an arbitrarily large body that is fully retained in shared memory, and the zstd path allocated its output buffer straight from the frame-advertised decompressed size and then doubled it without limit. Frames advertising more than the ceiling are now rejected upfront. The same limit bounds the map shm-cache and static map paths.

**Who is affected:** Sites serving very large maps (large hash or domain lists). Set a global ceiling, or override it per map:

~~~hcl
# local.d/options.inc
max_map_size = 512Mb;
~~~

~~~hcl
maps {
  "https://example.com/huge.map" {
    max_size = 1Gb;
    timeout = 30s;
  }
}
~~~

Setting `max_map_size = 0` disables the limit.

**Lua HTTP responses are bounded by `max_lua_http_response`, 256Mb by default** ([9fe7ae5f](https://github.com/rspamd/rspamd/commit/9fe7ae5f5)). It applies whenever a request does not pass an explicit `max_size`; an explicit `max_size = 0` still disables the limit for that request. A negative `max_size` used to be converted straight to an unsigned value, silently producing an effectively unlimited cap, and is now rejected with a logged error. Third-party plugins passing a negative value will start logging errors and must be fixed.

**zstd decompression is bounded everywhere** ([aaa53f54](https://github.com/rspamd/rspamd/commit/aaa53f54f), [bd1c9a27](https://github.com/rspamd/rspamd/commit/bd1c9a277)). The streaming loop was copy-pasted in seven places with inconsistent bounding: the proxy had no output ceiling at all, and the task and protocol v3 paths could overshoot `max_message` up to twofold. All sites now share one helper bounded by `max_message` (task, protocol v3, proxy) or `max_map_size` (map cache and static paths). Compressed traffic that previously decompressed to more than `max_message` is now refused.

**Shared memory protocol semantics changed** ([898c21aa](https://github.com/rspamd/rspamd/commit/898c21aa1)). `Shm-Offset` and `Shm-Length` were each validated on their own but never together, so an offset near the end combined with a full length produced a body running past the mapping. Both protocol versions now share one validated helper, and `Shm-Offset` without `Shm-Length` means "up to the end of the segment" rather than "the whole segment". Segment names must now refer to a regular, non-empty object, and payloads are capped at `max_message`.

**Who is affected:** Third-party clients or milters that talk the Rspamd HTTP protocol using shared memory bodies. Clients sending an offset without a length, or a segment that is not a regular object, need to be updated.

### 6. MIME and URL Parser Limits Are Now Actually Enforced

A series of parser hardening changes bounds resources that a single message could previously amplify. These affect scan results, not just memory:

* **`max_urls` is enforced at every insertion point** ([898b5e56](https://github.com/rspamd/rspamd/commit/898b5e56c)). Previously only plain-text callbacks respected it; HTML links, query URLs, images, displayed URLs, subject URLs and Lua-injected URLs were unbounded. The text pre-check also moved from `>` to `>=`, so the cap is now exact. Messages with very many URLs will have fewer of them available to RBL, reputation and multimap rules than before. Raise `max_urls` in `local.d/options.inc` if you rely on exhaustive extraction.
* **Content-Type and Content-Disposition parameters are capped at 1024 per header** ([4ecae17a](https://github.com/rspamd/rspamd/commit/4ecae17a7)). Content-Type flags the truncation as broken; Content-Disposition simply stops. The RFC 2231 continuation ordering fix in the same commit can change how a split parameter value is reconstructed.
* **Per-part newline metadata is capped at 100k positions** ([1ad069fa](https://github.com/rspamd/rspamd/commit/1ad069fa8)), exposed as `newlines_truncated` in `textpart:get_stats()`. Text normalization and line counters are unaffected.
* **HTML attributes are bounded per tag and per task** ([b6111378](https://github.com/rspamd/rspamd/commit/b6111378f)), synthetic tags are capped ([68eb633b](https://github.com/rspamd/rspamd/commit/68eb633b5)), and DOM traversal no longer recurses on the native stack ([86e1b7787](https://github.com/rspamd/rspamd/commit/86e1b7787)).
* **Alternative-part linking now shares a single visit budget per task** ([285d201d](https://github.com/rspamd/rspamd/commit/285d201df)). When it is exhausted, the remaining parts are left unlinked and a warning is logged. Fasttext language detection now skips overlong words and caps the total tokens fed to the model, which can change the detected language on pathological bodies.
* **Archive metadata, 7zip folder counts and MIME header parsing are bounded** ([adcb8600](https://github.com/rspamd/rspamd/commit/adcb86001), [bc409ba3](https://github.com/rspamd/rspamd/commit/bc409ba39), [c653253b](https://github.com/rspamd/rspamd/commit/c653253b3), [6d5f4fcb](https://github.com/rspamd/rspamd/commit/6d5f4fcbf)). Deeply pathological archives that used to be fully parsed are now reported as truncated or broken.
* **Nested comment depth in the Content-Disposition and SMTP date grammars is capped at 8** ([e36060c3](https://github.com/rspamd/rspamd/commit/e36060c3f)). Headers nesting comments deeper than that now fail to parse instead of consuming memory proportional to their own length.

**Who is affected:** Everyone, but visibly only for messages that were previously exercising these unbounded paths. If you have custom rules that count URLs, headers or archive entries, re-validate them against your corpus.

Two parser fixes in the same release change extraction results for ordinary mail: PDF `Td`/`TD` operators now emit newlines, so consecutive text lines are no longer concatenated into false URLs such as `http://2026.you` ([ddcfc4b0](https://github.com/rspamd/rspamd/commit/ddcfc4b08)), and HTML image style dimensions are parsed correctly instead of being read from an uninitialized variable ([800aaf45](https://github.com/rspamd/rspamd/commit/800aaf45f)). Rules keyed on image dimensions may fire differently.

### 7. Fuzzy Match Reporting Format Changed

Fuzzy results are now structured throughout ([a4bc4de0](https://github.com/rspamd/rspamd/commit/a4bc4de00), [f00d108a](https://github.com/rspamd/rspamd/commit/f00d108ad), PR [#6150](https://github.com/rspamd/rspamd/pull/6150)), and two externally visible formats changed with it:

* **Symbol options for non-exact matches** now carry both hash prefixes: `flag:found:prob:type:queried`. Previously only one hash was present.
* **The `X-Rspamd-Fuzzy` header** produced by `milter_headers` now annotates every matched hash with the rule, flag, probability, the queried hash for non-exact matches and the storage timestamp. It falls back to the legacy `fuzzy_hashes` pool variable only when no structured results exist.

**Who is affected:** Log scrapers, history exporters, downstream MTA rules and any Lua code matching on fuzzy symbol options or parsing `X-Rspamd-Fuzzy`. Update the parsers before upgrading, or pin the consumers until they are updated.

New interfaces are available instead of string parsing:

* `task:get_fuzzy_results()` returns the structured records (rule, symbol, upstream, stored and queried digests, type, probability, score, flag, value, hash timestamp) from the `fuzzy_matches` mempool variable; all queried hashes including misses are in `fuzzy_checked`.
* `fuzzy_check.check(task, cb, rule, timeout[, hashes][, server])` queries a storage directly.
* `rspamadm fuzzy_hash` computes the hashes of a message per configured rule, checks them against the storage with `-C` and queries explicit hex digests with `-H` ([90b27228](https://github.com/rspamd/rspamd/commit/90b27228e)).

A storage running 4.1.3 sets a flag bit in the first reserved byte of the reply when the digest field holds the digest actually resolved by the backend; the client exposes this as the `confirmed` field. Against a legacy storage the field is absent rather than guessed.

### 8. ClickHouse Schema Version 11

The ClickHouse module adds `Fuzzy.Hash`, `Fuzzy.Queried`, `Fuzzy.Rule`, `Fuzzy.Prob` and `Fuzzy.Flag` nested columns, filled from the structured fuzzy results ([cae30bbf](https://github.com/rspamd/rspamd/commit/cae30bbf6)).

**Who is affected:** Every deployment with the `clickhouse` module enabled.

The module applies the schema upgrade itself on the first connection after the upgrade, so the ClickHouse user configured in `local.d/clickhouse.conf` must be allowed to run `ALTER TABLE`. Verify after starting:

```bash
clickhouse-client --query "SELECT * FROM rspamd_version"
clickhouse-client --query "DESCRIBE TABLE rspamd" | grep -i fuzzy
```

If you feed the same tables from several Rspamd nodes, upgrade them together or expect the pre-4.1.3 nodes to keep writing rows with the new columns empty. Roll the schema change out during a maintenance window if your table is large.

### 9. Fuzzy Storage: Admission Control, Rate Limits and Statistics

Fuzzy storage now performs admission checks before parsing a datagram ([d2cf061b](https://github.com/rspamd/rspamd/commit/d2cf061b1)). Previously every datagram was parsed, and decrypted when encrypted, before any check ran: the blocklist and the rate limit were only consulted well after a session allocation, an ECDH, a MAC verification and the Lua pre-handlers. Four behaviour changes follow:

* **Blocklisted peers get no reply on UDP.** The blocklist is checked in the read loop, before a session is allocated, and building a reply would require exactly the parse being avoided. `accept_tcp_socket` already dropped blocked peers without replying, so both transports now behave alike. Anything that expected a `403` from a blocked source will now see a timeout.
* **`PING` and `STAT` are rate limited.** Both are answered unauthenticated and were previously unmetered. A rate-limited `PING` or `STAT` is dropped rather than answered with `403`, since the reply is the entire cost of those commands. This stays inert unless `ratelimit_rate` and `ratelimit_burst` are set, and the existing whitelist and local address exemptions still apply.
* **Key lookup and MAC verification failures are logged at debug level**, not error. Both are reachable by anyone who can send a datagram, before any rate limit applies, so an error line per packet turned a spoofed source flood into a log volume attack. Alerting keyed on those log lines will stop firing.
* **The rate limit bucket is no longer allocated when `rate` or `burst` are unset**, so unconfigured storages stop accumulating an LRU entry per masked source.

**Who is affected:** Operators of fuzzy storage with `ratelimit_rate` and `ratelimit_burst` configured, and anyone monitoring storage health with `PING` or `STAT` probes.

Monitoring probes now share the same per-source budget as scan traffic. Exempt them explicitly in the fuzzy worker configuration:

~~~hcl
worker "fuzzy" {
  ratelimit_whitelist = "/etc/rspamd/fuzzy_ratelimit_whitelist.map";
}
~~~

**`fuzzystat` output gained new fields.** `blocked_requests`, `decrypt_errors` and `ratelimited_requests` are reported so that the now-silent drops stay observable, and clients without a key (for example those permitted by `allow_update`) are tracked under a dedicated `unkeyed` pseudo-key with the same aggregate and per-IP counters as a real key ([56157dc6](https://github.com/rspamd/rspamd/commit/56157dc6b)). Monitoring code that iterates the key list must tolerate `unkeyed`; anything keying on a fixed set of keys will need updating.

```bash
rspamadm control fuzzystat
```

Note that `errors_ips` remains telemetry only. It is incremented when parsing failed, which takes no key and no handshake, so on UDP the recorded address is forgeable and must never be used as a ban source.

### 10. Fuzzy Redis Storage Persists Shingle Sets

The Redis backend now stores the shingle key suffixes as the `S` field of the digest hash on every `ADD` ([cb8de0c3](https://github.com/rspamd/rspamd/commit/cb8de0c34), PR [#6151](https://github.com/rspamd/rspamd/pull/6151)). This fixes two long-standing blind spots: `DEL` on a digest-only deletion (a periodic deletion by hash list, for instance) can now reconstruct and remove the orphaned shingle slots, and `REFRESH` refreshes the slots the digest still owns instead of the slots of whichever message happened to trigger it.

**Who is affected:** Operators of Redis-backed fuzzy storage. The sqlite backend needs no changes, since its shingles table cascades on delete.

Two operational consequences:

* **Redis memory grows.** Each digest now carries its shingle set. Check your `maxmemory` headroom before upgrading a large storage.
* **Only hashes added or refreshed by 4.1.3 carry the field.** Existing digests remain without it until they are re-added, so the `DEL` and `REFRESH` fixes apply gradually. In a mixed-version cluster writing to the same Redis, hashes added by older nodes still produce orphaned slots; upgrade all writers to get the full effect.

Per-hash introspection is available once the storage is upgraded ([f94ecd1d](https://github.com/rspamd/rspamd/commit/f94ecd1de)). It reports flag slots and values, creation time, remaining TTL and shingle slot ownership, which answers directly whether a hash can still produce fuzzy matches or whether its shingle anchor has decayed:

```bash
rspamadm control fuzzyhash <128 hex digest>
```

### 11. Lua API Changes

**`rspamd_http.request()` error delivery in coroutine mode** ([0eddd23d](https://github.com/rspamd/rspamd/commit/0eddd23dd)). Synchronous failures (unparseable URL, blocked session, immediate connection or DNS-send failure) returned a bare `false`, which coroutine callers read as `err = false, response = nil`, crashing on `response.code` in every caller written as `if not err then ... end`. They now return `(err, nil)` like the connection error path. DNS-stage failures (resolve error, no records, connection refused) went through the callback-only path and were silently swallowed for coroutine requests, leaving the yielded thread suspended forever; the thread is now resumed with `(err, nil)`.

**Who is affected:** Third-party plugins using the coroutine form of `rspamd_http.request()`. Code that special-cased the old bare `false`, or that relied on a request never returning, must be updated. Code written the documented way (`local err, response = rspamd_http.request(...)`) now behaves correctly for the first time on these paths.

**Plain text parts are linked to their HTML alternative** ([212e419a](https://github.com/rspamd/rspamd/commit/212e419a9)). The alternative-part search compared the raw `IS_TEXT_PART_HTML` flag value (0 or 4) against a boolean argument (0 or 1), so only the html-to-plain direction of `alt_text_part` was ever populated. Both directions now work. Lua rules that skip a text part when it has an alternative will now also skip plain parts that have an HTML sibling, which previously always fell through to full processing. Re-check any custom rule that tests for an alternative part.

**`url_suspect` dropped the `length_thresholds.suspicious` setting** ([b1d5cbec](https://github.com/rspamd/rspamd/commit/b1d5cbec6)). Both arms of the branch inserted the same `URL_USER_PASSWORD` finding, so the threshold never affected anything; it is removed together with the dead branch. `mailto` URLs are now explicitly excluded from the user-field check, since every email address carries a local part. Remove the setting from your configuration if you set it.

### 12. WebUI Rewritten Without jQuery or Font Awesome

jQuery is no longer loaded by the WebUI and the vendored `jquery-3.7.1.min.js` is deleted ([9ab0ed6a](https://github.com/rspamd/rspamd/commit/9ab0ed6a8), PR [#6124](https://github.com/rspamd/rspamd/pull/6124)). All modules were migrated to native DOM, `XMLHttpRequest` and the Bootstrap 5 vanilla constructor API. The Font Awesome "SVG with JS" framework is gone as well, replaced by a local subset sprite (`img/icons.svg`, 35 glyphs) rendered by `app/icons.js`, removing about 900 KB of JavaScript ([123b72ea](https://github.com/rspamd/rspamd/commit/123b72eaf), PR [#6145](https://github.com/rspamd/rspamd/pull/6145)).

**Who is affected:** Anyone shipping custom WebUI modules, local patches, or a theme that relies on `$`, on `$.ajax`, on the Font Awesome CSS classes, or on the `[data-fa-i2svg]` selectors.

Concretely:

* Custom modules must be ported off jQuery. The shared helpers `common.el`, `common.delegate` and `common.data` cover the common construction, delegation and metadata patterns.
* Icons come from the sprite. Adding a glyph means listing it in `icons-manifest.txt` and regenerating with `icons-build.mjs`; CI runs `npm run check:icons`, which fails on any stale generated file or Font Awesome version drift.
* The `modalDialog` attribute was renamed from the Bootstrap 4 `data-backdrop` to the Bootstrap 5 `data-bs-backdrop`, so the static-backdrop behaviour is applied for the first time.
* The WebUI now treats only 200-299 as success. The dead `|| xhr.status === 304` branch was removed, since the controller sends `Cache-Control: no-store` on every response and never emits `Last-Modified` or `ETag` (issue [#3330](https://github.com/rspamd/rspamd/issues/3330)) ([29d76e4a](https://github.com/rspamd/rspamd/commit/29d76e4a2)). A 2xx `/stat` response with a non-JSON body (a truncated proxy response, a captive portal page) now routes to the login dialog instead of loading a half-initialized UI ([f116cf0a](https://github.com/rspamd/rspamd/commit/f116cf0a8)). If a reverse proxy in front of the controller rewrites or caches WebUI responses, verify it before upgrading.

Force a hard reload in the browser after upgrading, as stale cached module files will not match the new `main.js` shim.

### 13. Duplicated Module Sections Now Warn

`rspamd_config_get_module_opt()` returns the `rule` or option object from the first section only when a C module section is duplicated at the top level, for example by a stray file in `modules.d`. The remaining sections were silently ignored and their rules never loaded. Rspamd now emits an explicit warning per configured C module so that `configtest` and the startup log surface the problem ([399b7461](https://github.com/rspamd/rspamd/commit/399b7461a)). Lua modules were never affected, as `get_all_opt()` flattens the whole duplicate chain.

**Who is affected:** Anyone whose configuration defines the same C module section more than once. Nothing changes functionally, but you may discover that rules you believed were active have never been loaded.

```bash
rspamadm configtest -s
```

Fix any warning by merging the duplicate sections into a single block, then re-run `configtest` and expect the affected rules to start loading. Verify with `rspamc stat` or a test message that the newly loaded rules do not change your scores unexpectedly.

## Migration to Rspamd 4.1.4

Rspamd 4.1.4 is primarily a bug-fix release, but several fixes intentionally change observable behaviour. Review the items below before upgrading.

### 1. Controller Authentication Now Fails Closed on Malformed Password Hashes

Previously, if the `password` or `enable_password` configured for the controller worker was a *malformed* encrypted hash (for example a truncated `$1$` with the salt or key component missing), the verification code skipped the comparison entirely and accepted **any** supplied password. This fail-open behaviour has been fixed: a malformed hash now rejects every authentication attempt, and the malformed hash is reported in the logs. Rspamd also validates the complete encoded hash (salt and key lengths against the KDF specified by the hash id) at startup instead of only checking the `$<id>` prefix ([da43397](https://github.com/rspamd/rspamd/commit/da433972a)).

**Who is affected:** Only setups where the configured controller password hash is incomplete or corrupted (e.g. a bad copy-paste). A tell-tale sign is that logging in to the WebUI currently works with *any* password — that means your hash is malformed and your controller has been effectively unauthenticated. Valid hashes are unaffected.

**Migration procedure:**

1. Verify your configured hashes have all three components: `$<id>$<salt>$<key>`.
2. If in doubt, regenerate the password hash:
```bash
rspamadm pw
```
3. Put the new hash into `local.d/worker-controller.inc`:
~~~hcl
password = "$2$<salt>$<key>";
enable_password = "$2$<salt>$<key>";
~~~
4. Restart Rspamd and check the startup log: malformed password hashes are now reported explicitly. If you skip this and your hash is malformed, you will be locked out of the controller/WebUI after the upgrade (which is still strictly better than the previous behaviour of letting everyone in).

### 2. Building with jemalloc Requires the Shared Library

The build system previously preferred the static `libjemalloc_pic.a` and embedded a private copy of the allocator into each of Rspamd's shared objects, which caused a startup segfault in jemalloc-enabled builds ([#6153](https://github.com/rspamd/rspamd/issues/6153)). CMake now searches for the shared jemalloc library only and **fails at configure time** when just a static archive is available, unless `ENABLE_STATIC` is used. jemalloc is linked as a single shared instance per process, and `libjemalloc-dev` is now declared as a Debian build dependency ([a2b649e](https://github.com/rspamd/rspamd/commit/a2b649e9e), [12d999a](https://github.com/rspamd/rspamd/commit/12d999a45), [#6155](https://github.com/rspamd/rspamd/pull/6155)).

**Who is affected:** Only users building from source with `-DENABLE_JEMALLOC=ON` (including custom package rebuilds) on systems where only the static jemalloc library is installed. Users of the official packages need no action.

**What to do** — install the shared jemalloc development package before building:

```bash
# Debian/Ubuntu
apt install libjemalloc-dev

# Fedora/RHEL
dnf install jemalloc-devel
```

Alternatively, configure with `-DENABLE_JEMALLOC=OFF`, or use `-DENABLE_STATIC=ON` for fully static builds, which remain allowed to use the static archive.

### 3. The Regexp Input Size Limit Now Applies to Named Scopes

The `regexp.max_size` limit (1 MiB by default) was only applied to the default regexp scope, so regexps registered in *named* scopes — most notably multimap `regexp_rules`, as well as scopes registered by Lua plugins — were matched against unbounded input. Named scopes now inherit the default scope's limit, and changing the limit updates every registered scope ([5c6644a](https://github.com/rspamd/rspamd/commit/5c6644a67)).

**Who is affected:** Deployments with multimap `regexp_rules` (or custom plugins using named regexp scopes) that relied on matching content beyond 1 MiB. Such rules will silently stop hitting on data past the limit after the upgrade.

**What to do:** If you legitimately need to match larger inputs, raise the limit in the `regexp` section of your configuration:

~~~hcl
# local.d/options.inc
regexp {
  max_size = 5242880; # 5 MiB; the default is 1 MiB
}
~~~

### 4. Word Retention Is Now Bounded for Very Large Messages

The UTF tokenizer now drops decayed words instead of retaining them, matching the long-standing behaviour of the raw tokenizer, and a message-wide budget (100k words, 1 MiB of text, shared by all text parts and the meta words) has been introduced. Parts that hit the budget are flagged as truncated and the message is logged once ([03a38dc](https://github.com/rspamd/rspamd/commit/03a38dc84)).

**Who is affected:** Deployments processing messages with very large text parts. Word-class regexps and part similarity (fuzzy shingle) hashes no longer see the decayed words of large UTF text parts, so fuzzy hashes learned from such texts before 4.1.4 may stop matching, and Bayes token sets for those messages change. Ordinary-sized mail is unaffected — the decay only kicks in for parts of roughly a thousand words and more.

**What to do:** No configuration change is required or available. If you operate a fuzzy storage and have hashes learned from very large text parts, expect a one-time drift and re-learn the affected patterns after the upgrade.

### 5. WebUI Read-Only Password Grants Access to Errors History and Selectors

This is an access-control relaxation rather than a breakage, but it changes what the read-only (`password`) credential grants. Read-only users can now view the Errors history tab (`/errors`: Rspamd's internal operational error log — timestamps, pids, modules, messages) and use the Selectors tab catalogs (`list_extractors`, `list_transforms`, `check_selector`). `check_message` remains restricted to the privileged `enable_password` ([#6156](https://github.com/rspamd/rspamd/pull/6156), [#6157](https://github.com/rspamd/rspamd/pull/6157), [3edd7d7](https://github.com/rspamd/rspamd/commit/3edd7d7d5), [d6b6769](https://github.com/rspamd/rspamd/commit/d6b6769f0)).

**Who is affected:** Deployments that share the read-only password with semi-trusted users and assumed these endpoints stayed hidden behind the privileged password.

**What to do:** There is no option to restore the previous gating. Audit who holds the read-only password and rotate it if this additional visibility is not acceptable for those users.

## Migration to Rspamd 4.1.5

### 1. Upgrade Self-Hosted Fuzzy Storages Before Scanners

Rspamd 4.1.5 scanners attach a new sender-facts extension to fuzzy commands on every rule that shares extensions, i.e. a rule with encryption configured and without `no_share = true` ([856fa42](https://github.com/rspamd/rspamd/commit/856fa4290), [#6179](https://github.com/rspamd/rspamd/pull/6179)). The extensions wire format was not forward compatible before this release: a storage older than 4.1.5 cannot skip an unknown extension type and rejects the whole command, so the client receives no fuzzy reply at all ([4ab21b1](https://github.com/rspamd/rspamd/commit/4ab21b113)).

**Who is affected:** Deployments running their own fuzzy storage that scanners reach over encrypted rules. Users of the public rspamd.com storage do not need to do anything.

**Migration procedure:**

1. Upgrade all fuzzy storage nodes to 4.1.5 first. The storage-side parser change is backward compatible, so an upgraded storage keeps serving older clients.
2. Upgrade the scanners.
3. If a storage cannot be upgraded first, temporarily disable extension sharing on the scanners for that rule:

~~~hcl
# local.d/fuzzy_check.conf, inside the affected rule
no_share = true;
~~~

Note also that scanners no longer send extensions for authenticated senders, for senders in `local_addrs`, or on rules that talk to the storage in plain text ([2d7db91](https://github.com/rspamd/rspamd/commit/2d7db917c)). If your storage consumed the sender IP extension over an unencrypted transport, it stops arriving; enable encryption on the rule to get it back.

### 2. Fuzzy Storage: Per-Key `forbidden_ids` Replaces the Global List Again

Since [6d15756](https://github.com/rspamd/rspamd/commit/6d15756b1), the global `forbidden_ids` worker option was applied even to clients whose key carries its own `forbidden_ids` ACL, so a key with an explicitly empty ACL (meaning "nothing is forbidden for this key") still had the globally listed flags suppressed. 4.1.5 restores the original semantics: a key that defines `forbidden_ids` — even an empty list — is governed by that list alone, and the worker-level option is only a default for keys without an ACL of their own ([e0e92d6](https://github.com/rspamd/rspamd/commit/e0e92d6f5)). The same rule now also applies to delayed replies to older protocol clients ([a47a858](https://github.com/rspamd/rspamd/commit/a47a85801)).

**Who is affected:** Fuzzy storage operators using per-key `forbidden_ids` together with the worker-level `forbidden_ids` who relied on the (unintended) additive behaviour of recent releases.

If a key must still be denied the globally forbidden flags, add those flag IDs to that key's own `forbidden_ids` list explicitly.

### 3. Fuzzy Storage: `encrypted_only` No Longer Exempts "Local" Peers

The `encrypted_only` option used to skip the encryption requirement for peers with a "local" source address. That test also matched IPv6 link-local and site-local addresses, so any host on the same segment could send plaintext commands; the exemption is removed, and unencrypted requests are now refused regardless of the source address ([5c52b37](https://github.com/rspamd/rspamd/commit/5c52b376e)).

**Who is affected:** Fuzzy storages running with `encrypted_only = true` that have clients — including ones on localhost — talking to them without encryption.

Configure the storage's public key (`encryption_key`) in the `fuzzy_check` rule of every such client, or remove `encrypted_only` from `local.d/worker-fuzzy.inc`.

### 4. GPT Plugin: `condition` Callback Returns Only a Verdict

The custom `condition` callback of the `gpt` module previously had to return both the decision and the content submitted to the LLM. It now returns only a boolean plus an optional reason string, and the request content is generated inside the module itself ([c5ee174](https://github.com/rspamd/rspamd/commit/c5ee17495), [#6159](https://github.com/rspamd/rspamd/pull/6159), see [#5857](https://github.com/rspamd/rspamd/issues/5857)). A callback still returning content will have that content ignored.

**Who is affected:** Anyone with a custom `condition` in `local.d/gpt.conf`.

Rewrite the callback to return just the decision:

~~~hcl
condition = <<EOD
return function(task)
  local result = task:get_metric_result()
  if result then
    local score = result.score
    if score < 2.0 or score > 8.0 then
      return false, 'score outside the checked range'
    end
  end
  return true
end
EOD
~~~

### 5. Elastic Module: New Document Schema for Fuzzy Results

The flat `fuzzy_hashes` field is replaced by structured per-match objects taken from `task:get_fuzzy_results()`, carrying `rule`, `symbol`, `found`, `queried`, `type`, `prob`, `flag` and `exact`; the new `fuzzy_nested` module option switches that field to the Elasticsearch `nested` type. Message `size` is now exported with an explicit mapping as well ([2fbbb4d](https://github.com/rspamd/rspamd/commit/2fbbb4daa), [#6154](https://github.com/rspamd/rspamd/pull/6154), [#6136](https://github.com/rspamd/rspamd/issues/6136), [#6147](https://github.com/rspamd/rspamd/issues/6147)).

**Who is affected:** Users of the `elastic` module with saved searches, dashboards or ingest pipelines referencing `fuzzy_hashes`.

**Migration procedure:**

1. Update queries and visualisations to the new structured field.
2. The updated mapping applies to indices created after the upgrade; documents in pre-upgrade indices keep the old shape, so anything spanning the upgrade date must handle both.
3. Set `fuzzy_nested = true` in `local.d/elastic.conf` if you need to query several attributes of a single match together.

### 6. File and Shared-Memory Message Inputs Are Now Gated

The `File`/`Path`/`Shm`/`Shm-Offset`/`Shm-Length` headers, their v3 metadata equivalents and the proxy's `File` query argument make rspamd open a path or map a shared-memory object named by the client. A new per-worker boolean `allow_file_and_shm_inputs` on the normal, controller and proxy workers now gates them: connections accepted on a unix socket always keep the capability, while TCP connections have it only while the option is enabled ([5c52b37](https://github.com/rspamd/rspamd/commit/5c52b376e)).

For 4.1.5 the shipped default is `true`, so nothing changes out of the box, but every TCP listener logs a startup warning while the option is enabled, and **the default becomes `false` in the next major release** ([d1adb29](https://github.com/rspamd/rspamd/commit/d1adb29ac)). Independently of the option, the proxy now strips client-supplied `Shm*` headers and the `File`/`Path`/`Shm` query arguments, so scanning local files *through* `rspamd_proxy` no longer works — such clients must talk to a scanner listener directly.

**Who is affected:** Setups where clients pass file paths or shared memory instead of the message body over TCP. Typical MTA integrations, which send the message body, are not affected.

If no client of a worker uses these inputs, opt in to the future default now and silence the warning:

~~~hcl
# local.d/worker-normal.inc (likewise worker-controller.inc, worker-proxy.inc)
allow_file_and_shm_inputs = false;
~~~

Otherwise move such clients to a unix socket, or keep the option enabled only on listeners not exposed to untrusted networks — passwords, `secure_ip` and connection encryption deliberately do not unlock this capability.

The same change set adds `max_connections` and `max_connections_per_source` limits to the controller and proxy, and the scanner's `max_tasks` now counts accepted connections that are still sending their body, so saturated scanners may hit the limit earlier than before.

### 7. Controller Rate-Limits Failed Authentications

The controller now throttles password failures per source: after 10 failed attempts within 60 seconds, further requests from that source get HTTP 429 until the window drains. A successful login clears the counter, and trusted sources (`secure_ip` matches and unix-socket clients) are never throttled ([18fc619](https://github.com/rspamd/rspamd/commit/18fc61992)).

**Who is affected:** Deployments with monitoring or scripts that poll the controller with a wrong password, and setups behind a reverse proxy, where all clients share the proxy's source address and therefore one bucket.

Fix misconfigured clients, or tune the limits:

~~~hcl
# local.d/worker-controller.inc
max_auth_failures = 10;    # 0 disables throttling
auth_failure_window = 60s;
~~~

### 8. Previously Broken Checks Now Fire and Can Change Scores

Two long-standing bugs are fixed in ways that change symbol hit rates:

- `url:get_urls_filtered()` called without an include list — and therefore `rspamadm mime urls` and the `URI_COUNT_ODD` rule — no longer drops URLs that carry no flags, which is exactly what URLs extracted from HTML parts are. `URI_COUNT_ODD` was running its parity check on an undercount for the multipart/alternative messages it targets ([81256c9](https://github.com/rspamd/rspamd/commit/81256c96a), [#5891](https://github.com/rspamd/rspamd/issues/5891), [#6182](https://github.com/rspamd/rspamd/pull/6182)).
- `HFILTER_HELO_IP_A` now fires when the HELO hostname resolves to addresses that do not include the connecting IP, as documented. Previously it fired only when the HELO resolved to no addresses at all, a condition already covered by `HFILTER_HELO_NORES_A_OR_MX` ([5f5c176](https://github.com/rspamd/rspamd/commit/5f5c176d6), [#6176](https://github.com/rspamd/rspamd/pull/6176), [#6165](https://github.com/rspamd/rspamd/issues/6165)).

No configuration change is required, but review local score overrides and composites involving these symbols after the upgrade if your scoring depends on them.

## Migration to Rspamd 4.2.0

### 1. Multimap `top` Filter Returns the Full Public Suffix

The `top` filter of multimap used to return the last label of the eSLD, which conflates the `uk` and `co.uk` namespaces. It now returns the actual public suffix from the suffix lookup, falling back to the old derivation only when no suffix list is loaded or nothing matches ([8f7e6dc2d](https://github.com/rspamd/rspamd/commit/8f7e6dc2d)).

**Who is affected:** Anyone with a multimap rule using `filter = "top"` whose map lists bare labels of multi-label suffixes (`au`, `uk`, `br`, `jp`, …).

**Migration procedure:**

1. Find the maps used by `top`-filtered rules:
```bash
grep -rn 'filter *= *"top"' /etc/rspamd/local.d/ /etc/rspamd/override.d/
```
2. In each of those maps, replace bare labels with the full suffixes you mean:
```bash
grep -nE '^(au|uk|nz|br|jp|za|il)$' /path/to/your/map
```
`au` must become `com.au`, `net.au`, … and `uk` must become `co.uk`, `org.uk`, … Single-label suffixes (`com`, `org`, `de`) are unchanged.
3. Reload and verify with a message whose sender domain is under the affected suffix.

### 2. Public Suffix Resolution Reworked

TLD resolution no longer scans hosts with a multipattern; it probes label suffixes against a flat hash map with full public suffix list semantics ([5d181935e](https://github.com/rspamd/rspamd/commit/5d181935e), [ac05136e3](https://github.com/rspamd/rspamd/commit/ac05136e3)). Two behaviours change:

* `!` exception rules of the public suffix list are honoured now — they were silently skipped before.
* A host that is itself a public suffix resolves to the whole host instead of being attributed to a shorter suffix.

**Who is affected:** Maps, selectors, RBL composition rules and reputation rules keyed on eSLD (`get_tld`, `url:get_tld`, `rbl` composition maps). The RBL URL composition maps also moved from per-TLD regex buckets to the same suffix rule set ([ddd3fbe23](https://github.com/rspamd/rspamd/commit/ddd3fbe23)): exceptions keep the default eSLD, wildcard rules keep the whole host, and the bare parent is added alongside each wildcard rule.

**Migration procedure:**

1. After the upgrade, re-check any domain allowlist or blocklist entry that sits on or under an exception rule of the PSL, since the key it is matched by may have changed.
2. Verify a sample of your rules against real URLs:
```bash
rspamadm lua -e 'print(require("rspamd_util").get_tld("www.city.kobe.jp"))'
```

Also new in this release and available for rules that need exact semantics: `url:get_public_suffix()` ([8d9e06df3](https://github.com/rspamd/rspamd/commit/8d9e06df3)), the `get_public_suffix` selector transform ([6c354b1ab](https://github.com/rspamd/rspamd/commit/6c354b1ab)) and the `rspamd_tld_lookup` Lua module ([7318989ea](https://github.com/rspamd/rspamd/commit/7318989ea)).

### 3. SPF: Multiple Records Now Produce a Permerror

A domain publishing more than one `v=spf1` record used to be evaluated using whichever record the resolver happened to answer first. RFC 7208 4.5 requires a permerror, and that is what Rspamd returns now ([ffe728811](https://github.com/rspamd/rspamd/commit/ffe728811)). The version literal is also matched as the RFC defines it: case-insensitively and terminated by a space or the end of the record, so `V=SPF1` now counts as a duplicate while `v=spf10` no longer counts as an SPF record at all ([0e1aec738](https://github.com/rspamd/rspamd/commit/0e1aec738)).

**Who is affected:** Anyone whose own domains, or whose customers' domains, publish two SPF records. Such mail moves from a pass/fail verdict to `R_SPF_PERMFAIL`, which also changes the DMARC outcome.

**Migration procedure:**

1. Audit the domains you are responsible for before upgrading:
```bash
dig +short TXT example.com | grep -ci 'v=spf1'
```
Anything above `1` must be merged into a single record.
2. Domains publishing one SPF record next to unrelated TXT records (vendor verification tokens) are unaffected.

### 4. DKIM Alignment Is a Symbol, and `R_DKIM_ALLOW` Is Worth Half

Whether a signature authorises the author is now decided in the DKIM module and reported as the new `R_DKIM_ALIGNED` symbol, with the option `strict` for an exact domain match and `relaxed` when only the organisational domains agree ([f30ef2071](https://github.com/rspamd/rspamd/commit/f30ef2071), [#6197](https://github.com/rspamd/rspamd/pull/6197)). DMARC consumes those facts and drops its own comparison; no DMARC verdict moves.

The credit a passing signature earns is split between the two symbols instead of being added to: **`R_DKIM_ALLOW` goes from -0.2 to -0.1**, and `R_DKIM_ALIGNED` takes the other -0.1. A signature aligned with the author is worth what a passing signature used to be worth on its own; one that merely verifies for an unrelated domain now earns half of that.

Alignment is only reported when the message has a single author: with several mailboxes in `From`, no `R_DKIM_ALIGNED` and no mempool verdict is produced ([e704b8445](https://github.com/rspamd/rspamd/commit/e704b8445)).

**Who is affected:** Anyone who overrides the `R_DKIM_ALLOW` score, or whose thresholds were tuned around it.

To keep the old total for aligned mail while neutralising the new symbol, add to `local.d/groups.conf`:

~~~hcl
group "dkim" {
  symbols {
    "R_DKIM_ALLOW" {
      score = -0.2;
    }
    "R_DKIM_ALIGNED" {
      score = 0.0;
    }
  }
}
~~~

### 5. Symbols Cache: One Scheduler, Stricter Dependency Rules

The per-class schedulers (priority-serialised pre/postfilters, topologically ordered filters) are replaced by a single execution plan computed at init: every item gets a stage and a level within that stage, and a dependency inherits the earliest (stage, level) among its dependents ([d144e0df0](https://github.com/rspamd/rspamd/commit/d144e0df0), [#6225](https://github.com/rspamd/rspamd/pull/6225)). Three consequences are user-visible:

* **Invalid dependency edges are now rejected at configuration time.** A connfilter or prefilter depending on a filter used to pull that filter into the wrong stage by accident; such an edge is reported with the stages of both symbols and dropped ([cc9038fc9](https://github.com/rspamd/rspamd/commit/cc9038fc9)). Dependency cycles are likewise broken right after resolution, with an error naming both symbols ([59c5f9c2e](https://github.com/rspamd/rspamd/commit/59c5f9c2e)).
* **Prefilters may now legitimately depend on filters**, which hoists the filter and its own dependencies to the prefilter stage. Hoists are logged at info level, so a ratelimit keyed by `symbol(DKIM_CHECK)` or by a selector now costs visibly ([57128714b](https://github.com/rspamd/rspamd/commit/57128714b)). Ratelimit, multimap, rbl and reputation rules register the dependencies of their selectors automatically ([d6419aae2](https://github.com/rspamd/rspamd/commit/d6419aae2)).
* **`ignore_passthrough` filters now actually run after a pre-result.** `task:set_pre_result()` no longer marks the classifier stages as processed, so the filters stage is no longer jumped over ([fec387488](https://github.com/rspamd/rspamd/commit/fec387488)).

**Who is affected:** Anyone with custom Lua rules using `rspamd_config:register_dependency()`, and anyone whose prefilters set a pre-result while other symbols are flagged `ignore_passthrough`.

**Migration procedure:**

1. Before restarting the daemon, validate the configuration — rejected edges and broken cycles are reported here:
```bash
rspamadm configtest
```
2. Inspect the computed execution order and any hoists:
```bash
rspamadm configdump -e
```
3. Fix any rejected edge by moving the symbol to a compatible stage rather than relying on the old accidental execution.

### 6. Fuzzy Storage: Hash Count Comes From a Periodic SCAN

The Redis backend used to maintain `<prefix>_count` inside the update script: incremented on every add including a re-learn, decremented on every delete including a missing digest, and never decremented on expiry. The reported number only grew, and a negative value turned into a huge one. Updates no longer touch the counter; instead the first fuzzy worker walks the keyspace with a paced SCAN and publishes the result ([252d3e378](https://github.com/rspamd/rspamd/commit/252d3e378), [#6259](https://github.com/rspamd/rspamd/pull/6259)).

Defaults: a pass at most every 4 hours, `SCAN COUNT` 1000, a 10% duty cycle, all configurable in the `count_scan` section of the fuzzy worker. The scan is pinned to one read server (a replica when configured), progress is checkpointed so a restarted worker resumes, and the lock lives in Redis so storages sharing a Redis run one pass per interval.

**Who is affected:** Operators of fuzzy storage, and anyone alerting on the fuzzy hash count.

**Migration procedure:**

1. Expect the count to read `0` right after the upgrade: negative counters left by older versions are reported as 0 until the first pass completes, which may take up to the configured interval.
2. If your Redis uses ACLs, make sure the fuzzy storage user may run `SCAN` on the read server it is pinned to.
3. Re-baseline any monitoring threshold on the fuzzy hash count — the new number is the real one and is usually *lower* than what the old counter reported.
4. Optional: sampled storage statistics (weights per flag, shingles, creation age buckets) are collected during the same scan and published under `<prefix>_stats`, exposed as the `storage` object of `/fuzzystat` and printed by `rspamadm fuzzystat` ([274ed527a](https://github.com/rspamd/rspamd/commit/274ed527a), [#6260](https://github.com/rspamd/rspamd/pull/6260)). To restore the plain SCAN, in `local.d/worker-fuzzy.inc`:

~~~hcl
count_scan {
  stats_sample = 0;
}
~~~

The wire STAT reply still carries only the count, so fuzzy clients see nothing new.

### 7. Fuzzy Storage: Key Policy Precedence and Per-Source Statistics

Two changes to fuzzy storage key handling need attention.

**Source policy is applied after decryption** ([5d054b248](https://github.com/rspamd/rspamd/commit/5d054b248), [#6255](https://github.com/rspamd/rspamd/pull/6255)). A request carrying a valid customer key is no longer dropped by a static or dynamic IP ban; IP restrictions are kept for the shared default key, and per-key limits, expiry and permissions are retained. Telemetry for blocked requests is preserved before they are dropped.

**Who is affected:** Storage operators who used IP bans to cut off a client that still holds a valid key. Such a client is now served. Revoke or expire the key itself instead of banning the address.

Key expiry parsing was also repaired: `strptime` left the time-of-day and DST fields untouched when parsing `DD-MM-YYYY`, so an expired key could inherit a far-future expiry from stack contents, and failed date parses are now rejected ([f24fc15f5](https://github.com/rspamd/rspamd/commit/f24fc15f5)). Re-check any key you believed to be expired.

**Per-source statistics are now lazy, and off by default for the default key** ([5c92924a9](https://github.com/rspamd/rspamd/commit/5c92924a9), [#6248](https://github.com/rspamd/rspamd/pull/6248)). Tables are created on the first request that uses a key, starting at four buckets. The default key tracks nothing unless given an explicit cap, since it is the one key whose source set a bounded table cannot represent — `rspamadm fuzzystat` says so rather than printing nothing.

To restore per-IP tracking, set the worker default or a per-key override in `local.d/worker-fuzzy.inc`:

~~~hcl
max_ips_per_key = 1024;
~~~

and give the default key an explicit `max_ips` extension in the keys file (`0` disables tracking for that key). The statistics output gains `ips_inserted` and `ips_overflow`; a table whose evictions exceed eight times its cap within an hour is dropped and the key is flagged for the rest of its life.

### 8. UCL Parsing of Untrusted Input Is Bounded

Request bodies were parsed without a structural budget, so a body well within `max_message` could describe a tree orders of magnitude larger than its wire size. Untrusted parsing now applies a depth of 64, a million elements, 1KB keys, 16MB strings and `min(96 * inlen + 256KB, 64MB)` of tree ([8c269facc](https://github.com/rspamd/rspamd/commit/8c269facc), [#6207](https://github.com/rspamd/rspamd/pull/6207)). This covers checkv3 metadata in both JSON and msgpack form, both controller body parsers and both proxy parsers. Container nesting is bounded for every parse type at the libucl default of 1024 ([d2c0d372a](https://github.com/rspamd/rspamd/commit/d2c0d372a)).

**Who is affected:** Anyone submitting very large or deeply nested scan metadata through checkv3, the controller or the proxy. Such a request is now rejected instead of being parsed.

**Migration procedure:**

1. If you pass generated metadata (large recipient lists, nested JSON blobs) with scan requests, check that no single string exceeds 16MB and that nesting stays under 64.
2. Lua modules parsing replies from outside the local configuration now use `ucl.untrusted_parser()` ([a7c1d5d54](https://github.com/rspamd/rspamd/commit/a7c1d5d54), [0b730fb15](https://github.com/rspamd/rspamd/commit/0b730fb15)) — HTTP request headers, the LLM providers, the `lua_scanners` backends, bimi, contextal, the updates and openphish feeds, the external neural service. A custom module parsing network replies should do the same, overriding individual caps where the data legitimately needs it:

~~~lua
local parser = ucl.untrusted_parser({max_string_length = 64 * 1024 * 1024})
~~~

Clickhouse, elastic, `lua_cache`, `history_redis`, the neural model paths and everything in config or `rspamadm` mode keep the ordinary parser on purpose.

### 9. ClickHouse Schema 12

Migration 11 → 12 adds bloom-filter data-skipping indexes (granularity 4) on `MessageId`, `From`, `MimeFrom`, `IP`, `Urls.Tld` and `Attachments.Digest`, plus a bloom filter on `Subject` ([b9275cfa6](https://github.com/rspamd/rspamd/commit/b9275cfa6), [b1ddb79cb](https://github.com/rspamd/rspamd/commit/b1ddb79cb), [#6241](https://github.com/rspamd/rspamd/pull/6241)). On a 20M messages/day install, a single Message-ID lookup over 30 days read 303M rows and 15.5 GB before this change.

**Who is affected:** All ClickHouse module users. The migration runs automatically and is metadata-only, so it is fast and safe — but new parts carry the index while older parts only pick it up as they merge or expire.

**Migration procedure (optional, operator's choice):**

1. Let Rspamd apply the migration by restarting normally, then confirm:
```bash
clickhouse-client -q "SELECT name, type_full FROM system.data_skipping_indices WHERE table = 'rspamd'"
```
2. To make the indexes effective on existing parts immediately, materialise them by name. This is deliberately left to you because it rereads the column as a background mutation:
```bash
clickhouse-client -q "ALTER TABLE rspamd MATERIALIZE INDEX <index_name>"
```
3. Watch the mutation until it drains before starting the next one:
```bash
clickhouse-client -q "SELECT * FROM system.mutations WHERE table = 'rspamd' AND NOT is_done"
```

### 10. New Attachment and Hidden-Text Scoring

Two groups of changes move scores on messages that previously scored differently. Re-check your thresholds and any per-symbol overrides against a ham corpus before rolling this to production.

**SVG attachments are parsed** and produce `SVG_CONTENT`, `SVG_SUSPICIOUS`, `SVG_SCRIPT`, `SVG_FOREIGN_OBJECT`, `SVG_DATA_URI`, `SVG_EXTERNAL_LINKS`, `SVG_EXTERNAL_RESOURCES`, `SVG_FORM` and `SVG_REDIRECT`, with **small non-zero default weights on the scripting and embedding indicators** ([c7deefa9a](https://github.com/rspamd/rspamd/commit/c7deefa9a), [#6240](https://github.com/rspamd/rspamd/pull/6240)). HTML smuggled inside an SVG is injected back into the scan as an HTML part, so its URLs reach the RBL and reputation pipeline ([e05302399](https://github.com/rspamd/rspamd/commit/e05302399), [960b17959](https://github.com/rspamd/rspamd/commit/960b17959)). Configure or disable under `lua_content`:

~~~hcl
lua_content {
  svg {
    enabled = false;
  }
}
~~~

XLSX and PPTX join DOCX in the OOXML pipeline, adding `XLSX_CONTENT`, `XLSX_EXTERNAL_LINKS`, `XLSX_SUSPICIOUS`, `PPTX_CONTENT`, `PPTX_EXTERNAL_LINKS`, `PPTX_SUSPICIOUS`, `OOXML_MACROS`, `OOXML_OLE_OBJECT`, `OOXML_REMOTE_TEMPLATE` and `OOXML_EXTERNAL_DATA` — all with **zero weight by default** ([fe26f2923](https://github.com/rspamd/rspamd/commit/fe26f2923), [#6238](https://github.com/rspamd/rspamd/pull/6238)). They are safe to leave alone until you decide to score them.

**CSS handling changed substantially, in both directions.** Compound selectors and combinators (`div.mainbox`, `div p`, `div > p`, `h1 + p`, `h1 ~ p`) are evaluated now, so hidden text behind the rules mail templates actually use is detected ([e6162390a](https://github.com/rspamd/rspamd/commit/e6162390a), [#6252](https://github.com/rspamd/rspamd/pull/6252)), and `R_WHITE_ON_WHITE` fires on white-on-white text whether or not the message also contains hidden text ([307fa376f](https://github.com/rspamd/rspamd/commit/307fa376f), fixes [#6262](https://github.com/rspamd/rspamd/issues/6262)). At the same time several severe false positives are gone: a grouped selector that could not be evaluated used to register a rule for a bare tag and move whole message bodies to the invisible buffer ([d89aa4a8c](https://github.com/rspamd/rspamd/commit/d89aa4a8c)), and the `font` shorthand, the `vw`/`vh` units and percent sizes were all mishandled so that ordinary webmail replies compiled as invisible ([e7d85786c](https://github.com/rspamd/rspamd/commit/e7d85786c), [#6245](https://github.com/rspamd/rspamd/pull/6245)). Expect `HIDDEN_TEXT` to stop firing on legitimate mail and to start firing on the templates it was meant for.

### 11. `url_redirector`: `redirectors_only` Is Now Enforced

`map:get_key()` returns `false`, not `nil`, on a miss for glob, regexp and set maps, so the `redirectors_only` gate written as `get_key(...) ~= nil` was always true and **every** redirect target was followed regardless of `redirector_hosts_map`. The gate now uses truthiness and is applied at all three sites that can issue an HTTP request for a hop ([a16e47594](https://github.com/rspamd/rspamd/commit/a16e47594), [#6198](https://github.com/rspamd/rspamd/pull/6198)).

A related map cache bug is fixed alongside: a map given as a *list* of URLs was keyed by the digest of the list alone, ignoring the requested type, so whichever module registered first decided the type for everyone. `url_redirector` asked for a glob map of `redirector_hosts_map` while a multimap `redirector` rule asked for a hash map of the same URLs, and no glob pattern in that feed could ever match ([19bad32bb](https://github.com/rspamd/rspamd/commit/19bad32bb), [53acca685](https://github.com/rspamd/rspamd/commit/53acca685), [#6226](https://github.com/rspamd/rspamd/pull/6226)).

**Who is affected:** Anyone running `url_redirector` with `redirectors_only = true`, and anyone sharing one URL list between modules that ask for different map types.

**Migration procedure:**

1. Expect noticeably fewer outbound HTTP requests and fewer resolved redirect targets after the upgrade — that is the documented behaviour finally taking effect.
2. If you relied on full redirect following, set `redirectors_only = false` explicitly in `local.d/url_redirector.conf` rather than depending on the old bug.
3. Confirm which hops are actually fetched using the debug line added before every request:
```bash
rspamadm configtest -L url_redirector
```

### 12. `forged_recipients` Compares by Mailbox Identity and Fetches a New Map

Envelope and header addresses were compared as raw strings, so `johndoe@googlemail.com` with `RCPT TO johndoe@gmail.com`, or `From: j.o.h.n@gmail.com` with `MAIL FROM john@gmail.com`, were reported as `FORGED_RECIPIENTS` / `FORGED_SENDER` although both sides name one mailbox. Both sides now match by `lua_aliases.mailbox_identity`: equivalent domains are folded, gmail dots and plus tags are stripped ([7bb2c77a0](https://github.com/rspamd/rspamd/commit/7bb2c77a0), [8b36f110e](https://github.com/rspamd/rspamd/commit/8b36f110e), issue [#6227](https://github.com/rspamd/rspamd/issues/6227)).

**Who is affected:** Everyone — the equivalence classes come from a **new map fetched from `maps.rspamd.com`**.

**Migration procedure:**

1. If your workers reach `maps.rspamd.com` through a firewall or proxy, allow `rspamd/equivalent_domains.inc` alongside the other Rspamd maps. A fallback snapshot ships in `conf/maps.d`, so a blocked fetch degrades to the builtin Google class rather than failing.
2. To point the option at your own list, override it in `local.d/forged_recipients.conf`:

~~~hcl
equivalent_domains = "/etc/rspamd/maps.d/equivalent_domains.inc";
~~~
3. Expect fewer `FORGED_RECIPIENTS` and `FORGED_SENDER` hits. The symbol options still show the wire addresses, and the addresses on the task are not modified — the identity is used for comparison only, never written back, since the domains stay distinct for SPF, DKIM and DMARC.
