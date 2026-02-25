---
title: Frequently Asked Questions
---

# Frequently Asked Questions

This FAQ covers common questions about Rspamd installation, configuration, and operation. For detailed guides, see the [documentation index](/).

## Quick Navigation

| Topic | Questions |
|-------|-----------|
| [Getting Help](#getting-help) | Support channels, bug reports |
| [Installation](#installation) | Versions, packages, builds |
| [Initial Setup](#initial-setup) | DNS resolver, first configuration |
| [Configuration](#configuration) | File structure, changing settings, paths |
| [Scores & Actions](#scores-and-actions) | How scoring works, actions, thresholds |
| [Modules](#modules) | Enabling/disabling, whitelisting, DNSBL |
| [Statistics & Learning](#statistics-and-learning) | Bayes, fuzzy hashes |
| [Troubleshooting](#troubleshooting) | Crashes, debugging, core dumps |
| [Administration](#administration) | Logs, Redis, backups |
| [Web Interface](#web-interface) | Passwords, proxy setup, cluster |
| [MTA Integration](#mta-integration) | Inbound vs outbound, milter |
| [Lua Development](#lua-development) | Writing rules, API usage |

---

## Getting Help

### Where can I get help with Rspamd?

The primary support channels are:

- **[Mailing list](https://lists.rspamd.com/)** — For detailed questions and discussions
- **[Telegram group](https://t.me/rspamd)** — Real-time chat support
- **[GitHub Issues](https://github.com/rspamd/rspamd/issues)** — Bug reports and feature requests

See the [support page](/support) for all available resources.

### How do I report bugs?

For **crashes**: Obtain a core file and ASAN log (see [Troubleshooting](#troubleshooting)) before reporting.

For **rule issues**: Include a **message sample** that triggers the problem. You may redact irrelevant headers and content, but:
- For SPF issues: Include SMTP From (or HELO) and sender IP
- For DKIM/ARC/statistics: Preserve all headers and content

Bug reports without message samples will not be considered unless the bug is trivial or includes a patch.

**Where to report:**
- Rspamd core issues: [rspamd/rspamd](https://github.com/rspamd/rspamd/issues)
- Documentation issues: [rspamd/rspamd.com](https://github.com/rspamd/rspamd.com/issues)

We prefer patches/pull requests over plain bug reports.

### How is "Rspamd" spelled?

"Rspamd" as a project is capitalized. The process/binary name `rspamd` is lowercase.

---

## Installation

### What versions are supported?

Rspamd maintains two branches:
- **Stable branch** (`rspamd-<version>`) — Recommended for production
- **Development branch** (`master`) — Latest features, may have regressions

When a new major release becomes stable, support for the previous stable branch ends. We do not support old releases.

### Should I use experimental packages?

Experimental packages are built from `master` and lack detailed changelogs. They include a git hash for tracking changes:

```bash
git log <old_hash>..<new_hash>
```

**Consider experimental packages when:**
- You have a significant bug that's fixed in `master`
- You're running a small system where you can manually downgrade if needed
- You can test using [proxy mirroring](/workers/rspamd_proxy) without affecting production

### How are official packages built?

Official packages from rspamd.com include these optimizations:

| Feature | Benefit |
|---------|---------|
| Link Time Optimization (LTO) | Better performance |
| Bundled LuaJIT 2.1 beta | Up to 30% faster than stable LuaJIT |
| jemalloc | Optimized memory allocation |
| Hyperscan/Vectorscan | Fast regex matching |

Debug symbols are available in separate packages (`rspamd-dbg` for DEB, `rspamd-debuginfo` for RPM).

For package installation, see the [Downloads page](/downloads).

---

## Initial Setup

### How do I configure DNS resolution?

**This is critical.** DNS is essential for spam filtering (RBLs, DKIM, SPF, etc.). Poor DNS configuration can make Rspamd non-functional.

**Requirements:**
1. Use a **local recursive resolver** (Unbound recommended)
2. Do not rely on public DNS (Google, Cloudflare) — they rate-limit RBL queries
3. Your ISP's resolver may return incorrect results (browser redirects instead of NXDOMAIN)

**Configuration:**

```hcl
# /etc/rspamd/local.d/options.inc
dns {
  nameserver = ["127.0.0.1"];
}
```

With fallback:
```hcl
dns {
  nameserver = "master-slave:127.0.0.1,8.8.8.8";
}
```

For large-scale deployments with multiple resolvers:
```hcl
dns {
  nameserver = "hash:10.0.0.1,10.1.0.1,10.3.0.1";
}
```

**Important:** Rspamd does not use system resolver libraries. Changes require restart. The `/etc/hosts` file is not read.

See [Unbound setup guide](https://wiki.archlinux.org/index.php/unbound) for resolver installation.

---

## Configuration

### How do I view my current configuration?

```bash
rspamadm configdump          # Full configuration
rspamadm configdump -j       # JSON format
rspamadm configdump -c       # Preserve comments
rspamadm configdump multimap # Specific section
rspamadm configdump worker   # Worker configuration
```

### What are the configuration directories?

| Variable | Default | Purpose |
|----------|---------|---------|
| `CONFDIR` | `/etc/rspamd` | Main configuration |
| `LOCAL_CONFDIR` | `/etc/rspamd` | User configuration |
| `DBDIR` | `/var/lib/rspamd` | Runtime data (statistics, caches) |
| `RUNDIR` | `/var/run/rspamd` | PID files |
| `LOGDIR` | `/var/log/rspamd` | Log files |
| `SHAREDIR` | `/usr/share/rspamd` | Shared files |
| `PLUGINSDIR` | `${SHAREDIR}/plugins` | Lua plugins |
| `LUALIBDIR` | `${SHAREDIR}/lualib` | Shared Lua libraries |

### What is the difference between local.d and override.d?

Both directories extend default configuration without editing core files:

| Directory | Priority | Behavior |
|-----------|----------|----------|
| `local.d/` | 1 | **Merges** with defaults. Collections and lists are combined. |
| `override.d/` | 10 | **Replaces** defaults. Entire sections are overwritten. |

**Example — Original config:**
```hcl
example {
  option1 = "value";
  option2 = true;
}
```

**local.d/example.conf:**
```hcl
option2 = false;
option3 = 1.0;
```

**Result with local.d:**
```hcl
example {
  option1 = "value";   # From default
  option2 = false;     # From local.d
  option3 = 1.0;       # From local.d
}
```

**Result with override.d:**
```hcl
example {
  option2 = false;     # Only override.d content
  option3 = 1.0;
}
```

### Why isn't my configuration working?

**Common mistake — Extra nesting:**

```hcl
# WRONG - local.d/dkim_signing.conf
dkim_signing {    # Don't add this wrapper!
  domain { ... }
}

# CORRECT - local.d/dkim_signing.conf
domain { ... }
```

Rspamd reports nesting issues in logs and via `rspamadm configtest`.

### How do I change a symbol's score?

**If using WebUI:** The WebUI stores scores in `$DBDIR/rspamd_dynamic`. These take precedence over config files. Edit or remove this file to use config-based scores.

**Via configuration:** Edit `local.d/groups.conf`:

```hcl
symbols {
  "SOME_SYMBOL" {
    weight = 1.0;
  }
}
```

Or for a specific group (e.g., `local.d/rbl_group.conf`):

```hcl
symbols {
  "RBL_CUSTOM" {
    weight = 5.0;
  }
}
```

Verify with:
```bash
rspamadm configdump -g        # Show all groups and scores
rspamadm configdump -g -j | jq  # JSON for processing
```

### How do I list enabled plugins?

```bash
rspamadm configdump -m        # List modules with status
rspamadm configwizard         # Interactive configuration
```

### How do I disable a module?

```hcl
# local.d/modulename.conf
enabled = false;
```

### How do I disable a specific rule?

Create a `.lua` file in `/etc/rspamd/lua.local.d/` and add a condition:

```lua
rspamd_config:add_condition('SOME_SYMBOL', function(task) return false end)
```

Or use [settings](/configuration/settings) for dynamic control.

---

## Scores and Actions

### What actions does Rspamd support?

| Action | Description |
|--------|-------------|
| `no action` | Message passes |
| `add header` | Add spam headers |
| `rewrite subject` | Modify subject line |
| `soft reject` | Temporary rejection (greylisting, ratelimit) |
| `reject` | Permanent rejection |
| `quarantine` | Move to quarantine (requires MTA support) |
| `discard` | Silently drop message |

Configure thresholds in `local.d/actions.conf`:

```hcl
reject = 15;
add_header = 6;
greylist = 4;
```

**Important:** Always use the **action**, not the score, to decide message handling. Some modules set actions directly regardless of score.

### Why is my score zero but the message is rejected?

Some modules set **passthrough actions** that bypass scoring:

- `greylist` — Sets `soft reject` for greylisting
- `ratelimit` — Sets `soft reject` when limit reached
- `antivirus` — Can set actions for virus detection
- `multimap` — Sets actions for matched maps
- `force_actions` — Explicit passthrough actions

Check logs for `forced:` entries explaining the action.

### Why do I get different scores for the same message?

1. **Early rejection:** Once a message hits `reject` threshold, some checks stop to save resources. Use `Pass: all` header (or `rspamc -p`) to force all checks.

2. **Timeouts:** Async rules may not complete before task timeout. Check:
   ```bash
   rspamadm confighelp options.dns
   rspamadm confighelp workers.normal.task_timeout
   ```

### Why do some symbols have variable scores?

Rspamd supports **dynamic scoring**. The symbol score is multiplied by a confidence factor (0-1):

- Bayes: Score scales with probability (50% → ~0, 90% → ~0.95, 100% → 1.0)
- Fuzzy: Score scales with match weight
- Phishing: Score varies by confidence

---

## Modules

### How do I whitelist senders or skip checks?

Several options:

1. **[Whitelist module](/modules/whitelist)** — For SPF/DKIM/DMARC-based whitelisting
2. **[Multimap module](/modules/multimap)** — Flexible list-based checks and actions
3. **[Settings](/configuration/settings)** — Disable rules for specific conditions:

```hcl
# rspamd.conf.local
settings {
  whitelist_authenticated {
    authenticated = true;
    apply {
      symbols_enabled = ["DKIM_SIGNED", "ARC_SIGNED"];
      flags = ["skip_process"];
    }
  }
}
```

### How do I blacklist file extensions?

Using multimap in `local.d/multimap.conf`:

```hcl
file_extension_blacklist {
  type = "filename";
  filter = "extension";
  map = "${LOCAL_CONFDIR}/local.d/blocked_extensions.map";
  symbol = "BLOCKED_EXTENSION";
  prefilter = true;
  action = "reject";
  message = "Attachment type not allowed";
}
```

### What does URIBL_BLOCKED mean?

You've exceeded the free query limit for SURBL/URIBL services. This happens when:

1. Using public DNS (Google, Cloudflare) — they aggregate queries and hit limits
2. High mail volume exceeding free tier

**Solutions:**
- Use a local recursive resolver
- Purchase a [commercial subscription](http://www.surbl.org/df)

The symbol has zero weight and doesn't affect scoring.

### Why do I see "monitored" errors?

```
DNS reply returned 'no error' for multi.uribl.com while 'no records with this name' was expected
```

Rspamd monitors DNS lists by querying addresses that should return NXDOMAIN. Errors indicate:

1. **Rate limiting** — You're using public DNS or exceeded free limits
2. **Broken RBL** — The list is returning false positives
3. **DNS hijacking** — Your resolver returns redirects instead of NXDOMAIN

### Why aren't fuzzy checks working?

Fuzzy storage uses **UDP port 1335** (not TCP, not TLS).

```bash
rspamadm fuzzyping   # Test connectivity
```

If you see packet loss, check your firewall allows outbound UDP to port 1335.

---

## Statistics and Learning

### Which backend should I use for statistics?

**Redis is recommended** for both statistics and fuzzy storage.

Convert from SQLite:

```bash
rspamadm statconvert \
  --spam-db /var/lib/rspamd/bayes.spam.sqlite \
  --ham-db /var/lib/rspamd/bayes.ham.sqlite \
  --symbol-spam BAYES_SPAM \
  --symbol-ham BAYES_HAM \
  -h localhost
```

Configure in `local.d/classifier-bayes.conf`:

```hcl
backend = "redis";
```

See [Statistics configuration](/configuration/statistic) for details.

### How do I train the Bayes classifier?

```bash
rspamc learn_spam message.eml   # Train as spam
rspamc learn_ham message.eml    # Train as ham
```

Requires `enable` level access (check `enable_password` or `secure_ip`).

For automatic learning, see [Autolearning documentation](/configuration/statistic#autolearning).

### Can I retrain messages for fuzzy storage?

To move a hash between lists:

```bash
rspamc -f 1 fuzzy_del message.eml    # Remove from list 1
rspamc -f 2 -w 10 fuzzy_add message.eml  # Add to list 2
```

For statistics, Rspamd handles relearning automatically via the learn cache.

### What does "inv_chi_square: exp overflow" mean?

One statistics class is overloaded while the other is underlearned. Train more messages from both spam and ham classes to balance the classifier.

---

## Troubleshooting

### How do I debug a module?

Enable debug logging in `local.d/logging.inc`:

```hcl
debug_modules = ["module_name"];
```

### How do I get a core dump after a crash?

**1. Create core directory:**
```bash
mkdir /coreland
chmod 1777 /coreland
```

**2. Configure core pattern:**

Linux:
```bash
sysctl kernel.core_pattern=/coreland/%e-%p.core
sysctl kernel.core_uses_pid=1
sysctl fs.suid_dumpable=2
```

FreeBSD:
```bash
sysctl kern.corefile=/coreland/%N-%P.core
sysctl kern.sugid_coredump=1
```

**3. Enable systemd core dumps** (if applicable):

Edit `/etc/systemd/system.conf`:
```ini
DefaultLimitCORE=infinity
```

Then:
```bash
systemctl daemon-reload
systemctl daemon-reexec
```

**4. Install debug symbols:**
- DEB: `apt install rspamd-dbg`
- RPM: `dnf install rspamd-debuginfo`

**5. Test setup:**
```bash
kill -s 4 $(pgrep rspamd | head -1)  # Send SIGILL
ls /coreland/  # Check for core file
```

### How do I use ASAN packages for debugging?

ASAN (AddressSanitizer) packages detect memory errors. Install `rspamd-asan` instead of `rspamd`.

Configure ASAN logging:

```bash
export ASAN_OPTIONS="log_path=/tmp/rspamd-asan"
```

Or in systemd (`systemctl edit rspamd`):

```ini
[Service]
Environment="ASAN_OPTIONS=log_path=/tmp/rspamd-asan"
```

After a crash, collect both core file and `/tmp/rspamd-asan.<pid>` for bug reports.

See [Downloads page](/downloads#asan-packages) for more details.

### How do I analyze a core file?

```bash
gdb $(which rspamd) -c /coreland/rspamd.core
(gdb) bt full

# Or with lldb
lldb $(which rspamd) -c /coreland/rspamd.core
(lldb) bt all
```

### How do I limit core file disk usage?

```hcl
# local.d/options.inc
cores_dir = "/coreland/";
max_cores_size = 1G;
```

---

## Administration

### How do I read Rspamd logs?

Logs include a **tag** (e.g., `<b120f6>`) linking related entries:

```bash
grep 'b120f6' /var/log/rspamd/rspamd.log
```

The final `rspamd_task_write_log` line shows the complete result.

### How do I customize log format?

In `local.d/logging.inc`:

```hcl
log_format =<<EOD
id: <$mid>, ip: [$ip], from: <$smtp_from>, (default: $is_spam ($action): [$scores] [$symbols_scores]), len: $len, time: $time_real
EOD
```

See [Logging documentation](/configuration/logging) for all variables.

### What Redis keys does Rspamd use?

| Module | Key Pattern |
|--------|-------------|
| Statistics | `<SYMBOL><username>` |
| Ratelimit | Per-limit keys (see [ratelimit docs](/modules/ratelimit)) |
| DMARC | Per-domain aggregation keys |
| Reputation | IP/domain reputation keys |

Set `maxmemory` limits and consider separate Redis instances for different data types.

### How do I delete Redis keys by pattern?

```bash
redis-cli --scan --pattern 'rn_SHORT_*' | xargs redis-cli unlink
```

### How do I use Unix sockets with Redis?

**Redis config** (`/etc/redis/rspamd.conf`):
```
bind 127.0.0.1
port 0
unixsocket /var/run/redis/rspamd.sock
unixsocketperm 770
```

**Rspamd config** (`local.d/redis.conf`):
```hcl
servers = "/var/run/redis/rspamd.sock";
```

Add rspamd user to redis group:
```bash
usermod -a -G redis _rspamd
```

### What should I back up?

| Data | Location |
|------|----------|
| Configuration | `/etc/rspamd/` |
| Runtime data | `/var/lib/rspamd/` (exclude `*.hs`, `*.hsmp`, `*.map` caches) |
| Redis config | `/etc/redis/redis.conf` |
| Redis data | `/var/lib/redis/dump.rdb` (safe to copy while running) |

### Why do I get errors after migrating to different hardware?

**Hyperscan caches** are platform-specific. Delete `*.hs` and `*.hsmp` files from `/var/lib/rspamd/`.

**RRD files** cannot transfer between architectures. Export and reimport:

```bash
# On source system
rrdtool dump rspamd.rrd > rspamd.rrd.xml

# On target system
rrdtool restore -f rspamd.rrd.xml rspamd.rrd
```

---

## Web Interface

### What are the password types?

| Setting | Purpose |
|---------|---------|
| `password` | Read-only access |
| `enable_password` | Full access (learning, configuration) |
| `secure_ip` | IPs with full access without password |

If only `password` is set, it grants full access.

### How do I create a secure password?

```bash
rspamadm pw
```

This generates a PBKDF2/Catena hash. Add to `local.d/worker-controller.inc`:

```hcl
password = "$2$...generated_hash...";
enable_password = "$2$...another_hash...";
```

### How do I run the WebUI behind a proxy?

**Nginx:**
```nginx
location /rspamd/ {
  proxy_pass http://localhost:11334/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For "";
}
```

**Apache:**
```apache
RewriteRule ^/rspamd$ /rspamd/ [R,L]
RewriteRule ^/rspamd/(.*) http://localhost:11334/$1 [P,L]
```

### Where does the WebUI store settings?

Dynamic settings go to `$DBDIR/rspamd_dynamic` (typically `/var/lib/rspamd/rspamd_dynamic`). This file has priority 5, so `override.d` (priority 10) can override it.

### Why can't I edit some maps in WebUI?

- File must exist and be writable by rspamd user
- HTTP maps cannot be edited
- Signed maps cannot be edited

### How do I set up WebUI clustering?

Configure neighbors in `local.d/options.inc`:

```hcl
neighbours {
  server1 {
    host = "http://server1:11334";
  }
  server2 {
    host = "http://server2:11334";
  }
}
```

See [Options documentation](/configuration/options#neighbours-list).

### Why does the User column show "undefined"?

The User column displays the authenticated username from outbound mail scanning. It's empty for inbound mail.

---

## MTA Integration

### How do I distinguish inbound from outbound mail?

Use the [settings module](/configuration/settings) with `settings-id`:

```hcl
# Settings configuration
settings {
  outbound {
    id = "outbound";
    apply {
      actions {
        reject = 150.0;
        "add header" = 6.0;
      }
      groups_disabled = ["hfilter", "rbl"];
    }
  }
}
```

Configure proxy to send the header:

```hcl
# Proxy configuration
upstream "local" {
  self_scan = yes;
  settings_id = "outbound";
}
```

Alternatively, use `authenticated = true` or IP-based conditions in settings.

### Can I scan outbound mail safely?

Yes. Rspamd automatically applies safe defaults for:
- Authenticated senders
- Senders from `local_networks` (RFC 1918 addresses, loopback)

Many checks are disabled for outbound. Be careful not to accidentally trigger this mode (e.g., by not using XCLIENT on a proxy MTA).

See [Scanning Outbound documentation](/tutorials/scanning_outbound).

### Can I use Rspamd only for DKIM signing?

Yes, use settings to skip processing:

```hcl
settings {
  sign_only {
    authenticated = true;
    apply {
      symbols_enabled = ["DKIM_SIGNED", "ARC_SIGNED"];
      flags = ["skip_process"];
    }
  }
}
```

---

## Lua Development

### What's the difference between plugins and rules?

| Type | Purpose | Capabilities |
|------|---------|--------------|
| **Rules** | Simple checks | Return `true`/`false`, synchronous |
| **Plugins** | Complex logic | Async requests, multiple symbols, `task:insert_result()` |

Use `rspamd_config:register_symbol` for plugins.

### What is the table form of function calls?

```lua
-- Sequential form
func(a, b, c, d)

-- Table form (preferred for 3+ arguments)
func({
  param1 = a,
  param2 = b,
  param3 = c,
  param4 = d
})
```

Table form is easier to read, extend, and maintain.

### How do I use Rspamd modules in Lua?

```lua
local rspamd_logger = require 'rspamd_logger'
local rspamd_regexp = require 'rspamd_regexp'
```

Additional libraries available:
- [Lua Functional](https://github.com/rtsisyk/luafun)
- [Lua LPEG](https://www.inf.puc-rio.br/~roberto/lpeg/)

### How do I log from Lua?

```lua
local rspamd_logger = require 'rspamd_logger'

-- Modern format (recommended)
rspamd_logger.infox(task, "Processing %s from %s", message_id, sender)

-- Positional arguments
rspamd_logger.infox("%s %1 %2", "abc", 1, {true, 1})
-- Output: abc abc 1 [[1] = true, [2] = 1]
```

Use `rspamd_logger.slog` for string formatting without logging.

### Should I use `local` for variables?

**Always use `local`** unless absolutely necessary. Global variables significantly degrade Lua performance.

### How do I create regexps safely?

Regexp objects don't have garbage collection. **Always use the cache:**

```lua
-- CORRECT: Uses cached regexp
local re = rspamd_regexp.create_cached('/pattern/')

-- WRONG: Memory leak!
local re = rspamd_regexp.create('/pattern/')
```

If you must create dynamic regexps, destroy them manually:

```lua
local re = rspamd_regexp.create(dynamic_pattern)
-- ... use re ...
re:destroy()
```

Consider using [multimap](/modules/multimap) regexp maps for dynamic patterns.

---

## Quick Reference

### Common Commands

```bash
# Configuration
rspamadm configtest              # Validate configuration
rspamadm configdump              # Show effective config
rspamadm confighelp options      # Get help on options

# Testing
rspamc < message.eml             # Scan a message
rspamc -p < message.eml          # Scan with all checks (Pass: all)
rspamc stat                      # Show statistics

# Learning
rspamc learn_spam message.eml    # Train as spam
rspamc learn_ham message.eml     # Train as ham
rspamc -f 1 -w 10 fuzzy_add msg  # Add to fuzzy storage

# Administration
rspamadm control stat            # Runtime statistics
rspamadm control fuzzystat       # Fuzzy storage statistics
rspamadm pw                      # Generate password hash
```

### Common Paths

| Path | Purpose |
|------|---------|
| `/etc/rspamd/local.d/` | Local configuration overrides |
| `/etc/rspamd/override.d/` | High-priority overrides |
| `/var/lib/rspamd/` | Runtime data |
| `/var/log/rspamd/rspamd.log` | Main log file |

### What are rspamc and rspamadm?

| Tool | Purpose | Communication |
|------|---------|---------------|
| `rspamadm` | Administration | Local Unix socket |
| `rspamc` | Client operations | HTTP to scanner/controller |

```bash
rspamadm help           # List admin commands
rspamadm help <command> # Command-specific help

rspamc --help           # Client help
rspamc stat             # Get statistics via HTTP
```
