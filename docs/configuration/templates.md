---
title: Configuration templates
---

# Configuration templates

## Introduction

Rspamd uses a Jinja2-compatible template engine called **Lupa** to preprocess all configuration files before they are parsed by the UCL parser. Templates let you inject dynamic values -- such as environment variables, paths, and computed strings -- directly into your configuration without external tooling.

Templates are evaluated at configuration load time. If a template expression fails (e.g. a validation filter rejects input), Rspamd aborts startup with a clear error message in the logs. This makes templates suitable not only for variable substitution but also for **configuration validation**.

:::tip
This page documents the template engine itself. For UCL variable substitution using `$VARIABLE` / `${VARIABLE}` syntax, see [UCL configuration language](ucl.md#variables-support). Both systems can be used together -- UCL variables are expanded after template processing.
:::

## Template delimiters

Rspamd uses modified Jinja2 delimiters to avoid conflicts with UCL syntax:

| Purpose | Syntax | Example |
|---------|--------|---------|
| **Expressions** (output a value) | `{= ... =}` | `{= env.hostname =}` |
| **Statements** (control flow) | `{% ... %}` | `{% if env.REDIS_HOST %}` |
| **Comments** (ignored in output) | `{# ... #}` | `{# Redis configuration #}` |

:::note
Standard Jinja2 `{{ }}` delimiters are **not** used in Rspamd configuration because curly braces conflict with UCL object syntax. Use `{= =}` for variable output and `{% %}` for control structures.
:::

### Whitespace control

Add a dash (`-`) inside any delimiter to strip whitespace on that side:

```
{%- tag -%}   strips whitespace on both sides
{=- var -=}   strips whitespace on both sides
{#- comment -#}
```

## Environment variables {#environment-variables}

The primary use case for templates in Rspamd is injecting environment variables into configuration. This is especially useful for containerized deployments (Docker, Kubernetes) where configuration is managed through environment variables.

### How it works

At startup, Rspamd scans all OS environment variables. Variables whose names begin with the `RSPAMD_` prefix are collected into the `env` table, **with the prefix stripped**. This means:

| OS environment variable | Template access | Value |
|------------------------|-----------------|-------|
| `RSPAMD_REDIS_HOST=10.0.0.1` | `{= env.REDIS_HOST =}` | `10.0.0.1` |
| `RSPAMD_PASSWORD=secret` | `{= env.PASSWORD =}` | `secret` |
| `RSPAMD_MAPS_MIRROR=https://example.com` | `{= env.MAPS_MIRROR =}` | `https://example.com` |
| `RSPAMD_ENABLE_GREYLIST=true` | `{= env.ENABLE_GREYLIST =}` | `true` |

The `RSPAMD_` prefix serves as a **namespace filter** -- only variables explicitly intended for Rspamd are exposed, preventing accidental leakage of unrelated environment variables (like `PATH` or `HOME`) into the template environment. The prefix is stripped purely for convenience, so you don't need to write `env.RSPAMD_REDIS_HOST` everywhere.

:::warning
Environment variables without the `RSPAMD_` prefix are **not** accessible in templates. Setting `REDIS_HOST=10.0.0.1` alone will not work -- you must use `RSPAMD_REDIS_HOST=10.0.0.1`.
:::

### Built-in environment variables

In addition to user-defined `RSPAMD_` variables, the `env` table always contains these built-in values:

| Variable | Description | Example value |
|----------|-------------|---------------|
| `env.hostname` | System hostname | `mail.example.com` |
| `env.version` | Full Rspamd version string | `4.0.0` |
| `env.ver_major` | Major version | `3` |
| `env.ver_minor` | Minor version | `15` |
| `env.ver_id` | Build identifier | `abc1234` |
| `env.ver_num` | Numeric version (integer) | `315` |

### Practical examples

**Redis configuration via environment:**

```hcl
# Set RSPAMD_REDIS_HOST and RSPAMD_REDIS_PORT in environment
redis {
    servers = "{= env.REDIS_HOST | default "127.0.0.1" =}:{= env.REDIS_PORT | default "6379" =}";
    {%- if env.REDIS_PASSWORD %}
    password = "{= env.REDIS_PASSWORD =}";
    {%- endif %}
    {%- if env.REDIS_DB %}
    db = "{= env.REDIS_DB =}";
    {%- endif %}
}
```

**Conditional module configuration:**

```hcl
# RSPAMD_ENABLE_GREYLIST=true
{%- if is_true(env.ENABLE_GREYLIST) %}
greylist {
    enabled = true;
    expire = {= env.GREYLIST_EXPIRE | default "1d" =};
}
{%- else %}
greylist {
    enabled = false;
}
{%- endif %}
```

**Maps mirror override (used extensively in default Rspamd config):**

```hcl
# Override maps download source via RSPAMD_MAPS_MIRROR
map = "{= env.MAPS_MIRROR | default "https://maps.rspamd.com" =}/rspamd/redirectors.inc.zst";
```

### The `--lua-env` option

For complex environments, you can also load additional template variables from Lua files using the `--lua-env` command-line option (for both `rspamd` and `rspamadm`). Each file must return a table whose key-value pairs are merged into the `env` table:

```lua
-- /etc/rspamd/env.lua
return {
    CUSTOM_THRESHOLD = "15.0",
    CLUSTER_NAME = "production-eu",
}
```

```bash
rspamd --lua-env /etc/rspamd/env.lua
```

These values are then accessible as `{= env.CUSTOM_THRESHOLD =}` in templates.

## Rspamd path variables

The `paths` table provides access to Rspamd's compiled-in directory paths:

| Variable | Typical default |
|----------|----------------|
| `paths.CONFDIR` | `/etc/rspamd` |
| `paths.LOCAL_CONFDIR` | `/etc/rspamd` |
| `paths.DBDIR` | `/var/lib/rspamd` |
| `paths.RUNDIR` | `/run/rspamd` |
| `paths.LOGDIR` | `/var/log/rspamd` |
| `paths.WWWDIR` | `$PREFIX/share/rspamd/www` |
| `paths.PLUGINSDIR` | `$PREFIX/share/rspamd/plugins` |
| `paths.RULESDIR` | `$PREFIX/share/rspamd/rules` |
| `paths.LUALIBDIR` | `$PREFIX/share/rspamd/lualib` |
| `paths.SHAREDIR` | `$PREFIX/share/rspamd` |
| `paths.PREFIX` | `/usr` |

These paths can be overridden via environment variables of the same name (without `RSPAMD_` prefix), e.g. setting `DBDIR=/custom/path`.

## Expression syntax

Template expressions use **Lua syntax**, not Python. This is the key difference from standard Jinja2:

| Operation | Lua (Rspamd) | Python (Jinja2) |
|-----------|-------------|-----------------|
| String concatenation | `..` | `+` or `~` |
| Boolean values | `true`, `false` | `True`, `False` |
| Null value | `nil` | `None` |
| List literal | `{1, 2, 3}` | `[1, 2, 3]` |
| Dict literal | `{key = "val"}` | `{'key': 'val'}` |
| Not equal | `~=` | `!=` |
| Logical operators | `and`, `or`, `not` | `and`, `or`, `not` |
| Tests | `is_defined(x)` | `x is defined` |
| In operator | `is_in(x, list)` | `x in list` |
| Method calls | use filters: `s\|upper` | `s.upper()` |

## Control structures

### Conditionals

```
{%- if env.REDIS_HOST %}
servers = "{= env.REDIS_HOST =}";
{%- elseif env.REDIS_SOCKET %}
servers = "{= env.REDIS_SOCKET =}";
{%- else %}
servers = "127.0.0.1";
{%- endif %}
```

### Loops

```
{%- for item in {"rbl", "surbl", "uribl"} %}
  "{= item =}",
{%- endfor %}
```

The `loop` variable is available inside `for` blocks:

| Property | Description |
|----------|-------------|
| `loop.index` | Current iteration (1-based) |
| `loop.index0` | Current iteration (0-based) |
| `loop.first` | `true` on first iteration |
| `loop.last` | `true` on last iteration |
| `loop.length` | Total number of items |

### Variable assignment

```
{%- set timeout = env.TIMEOUT | default "300" %}
```

### Macros

```
{%- macro redis_config(host, port, db) %}
  servers = "{= host =}:{= port =}";
  db = "{= db =}";
{%- endmacro %}

redis {
  {= redis_config(env.REDIS_HOST | default "127.0.0.1", env.REDIS_PORT | default "6379", "0") =}
}
```

### Raw blocks

To output template delimiters literally without processing:

```
{% raw %}
  This {= is not processed =}
{% endraw %}
```

## Filters reference

Filters transform values using the pipe (`|`) syntax: `{= value | filter =}`.
Multiple filters can be chained: `{= value | filter1 | filter2 =}`.

### String filters

| Filter | Description | Example |
|--------|-------------|---------|
| `capitalize` | Uppercase first char, lowercase rest | `{= "foo"\|capitalize =}` &rarr; `Foo` |
| `center(width)` | Center in string of given width | `{= "foo"\|center(9) =}` |
| `escape` / `e` | HTML-escape special characters | `{= "<b>"\|e =}` &rarr; `&lt;b&gt;` |
| `lower` | Lowercase | `{= "FOO"\|lower =}` &rarr; `foo` |
| `upper` | Uppercase | `{= "foo"\|upper =}` &rarr; `FOO` |
| `title` | Titlecase each word | `{= "foo bar"\|title =}` &rarr; `Foo Bar` |
| `trim` | Strip whitespace | `{= "  foo  "\|trim =}` &rarr; `foo` |
| `truncate(len, partial, delim)` | Truncate to length | `{= "foo bar"\|truncate(4) =}` &rarr; `f...` |
| `replace(pattern, repl)` | Replace (Lua patterns) | `{= s\|replace("old", "new") =}` |
| `split(sep)` | Split into list | `{= "a,b"\|split(",") =}` |
| `striptags` | Remove HTML tags | `{= "<b>foo</b>"\|striptags =}` &rarr; `foo` |
| `wordcount` | Count words | `{= "foo bar"\|wordcount =}` &rarr; `2` |
| `wordwrap(width)` | Wrap text at width | `{= text\|wordwrap(72) =}` |
| `urlencode` | URL-encode | `{= "a b"\|urlencode =}` &rarr; `a%20b` |
| `indent(width)` | Indent lines | `{= text\|indent(4) =}` |
| `format(...)` | Printf-style formatting | `{= "%s=%d"\|format("a", 1) =}` |

### Number filters

| Filter | Description | Example |
|--------|-------------|---------|
| `abs` | Absolute value | `{= -5\|abs =}` &rarr; `5` |
| `int` | Convert to integer | `{= 3.7\|int =}` &rarr; `3` |
| `float` | Convert to float | `{= "3"\|float =}` &rarr; `3.0` |
| `round(precision, method)` | Round number | `{= 2.5\|round =}` &rarr; `3` |
| `filesizeformat` | Human-readable file size | `{= 1024\|filesizeformat =}` &rarr; `1.0 kB` |

### Collection filters

| Filter | Description | Example |
|--------|-------------|---------|
| `first` | First element | `{= items\|first =}` |
| `last` | Last element | `{= items\|last =}` |
| `length` | Length of string/table | `{= items\|length =}` |
| `join(sep)` | Join elements | `{= items\|join(", ") =}` |
| `sort` | Sort elements | `{= items\|sort =}` |
| `unique` | Remove duplicates | `{= items\|unique =}` |
| `reverse` | Reverse order | `{= items\|reverse =}` |
| `map(filter)` | Apply filter to each element | `{= items\|map("upper") =}` |
| `select(test)` | Keep items passing test | `{= items\|select("is_defined") =}` |
| `reject(test)` | Remove items passing test | `{= items\|reject("is_nil") =}` |
| `min` | Smallest element | `{= {3,1,2}\|min =}` &rarr; `1` |
| `max` | Largest element | `{= {3,1,2}\|max =}` &rarr; `3` |
| `sum` | Sum of elements | `{= {1,2,3}\|sum =}` &rarr; `6` |
| `batch(size)` | Split into batches | `{= items\|batch(3) =}` |
| `groupby(attr)` | Group by attribute | `{= items\|groupby("type") =}` |
| `keys` | Dict keys | `{= d\|keys =}` |
| `values` | Dict values | `{= d\|values =}` |
| `items` | Dict to key-value pairs | `{= d\|items =}` |
| `dictsort` | Sort dict by key | `{= d\|dictsort =}` |

### Default and serialization filters

| Filter | Description | Example |
|--------|-------------|---------|
| `default(val)` | Default value if nil | `{= x\|default("n/a") =}` |
| `tojson` | Serialize to JSON | `{= data\|tojson =}` |
| `string` | String representation | `{= {1,2}\|string =}` &rarr; `{1, 2}` |

### Rspamd-specific filters

| Filter | Description |
|--------|-------------|
| `pbkdf` | Compute PBKDF2 hash (for password configuration) |

### Validation filters (Rspamd 4.0+) {#validation-filters}

These filters are designed for validating environment variable inputs in containerized deployments. They return the value unchanged if valid, or **abort Rspamd startup** with a clear error message if validation fails. This eliminates the need for shell entrypoint scripts that validate configuration before starting Rspamd.

| Filter | Description | Example |
|--------|-------------|---------|
| `mandatory(msg)` | Error if nil or empty | `{= env.API_KEY \| mandatory("RSPAMD_API_KEY is required") =}` |
| `require_int(msg)` | Error if not a valid integer | `{= env.PORT \| require_int("PORT must be integer") =}` |
| `require_number(msg)` | Error if not a valid number | `{= env.THRESHOLD \| require_number("must be a number") =}` |
| `require_bool(msg)` | Error if not a boolean | `{= env.ENABLED \| require_bool("must be true/false") =}` |
| `require_duration(msg)` | Parse duration string, return seconds | `{= env.TIMEOUT \| require_duration("invalid duration") =}` |
| `require_json(msg)` | Error if not valid JSON/UCL | `{= env.CONFIG \| require_json("must be valid JSON") =}` |
| `fromjson` | Parse JSON/UCL string into table | `{%- set obj = env.DATA \| fromjson %}` |

All `msg` arguments are optional; sensible defaults are provided.

**`require_duration`** accepts the following format: a number followed by a unit suffix. Plain numbers are treated as seconds.

| Unit | Meaning |
|------|---------|
| `ms` | Milliseconds |
| `s` | Seconds (default) |
| `min` or `m` | Minutes |
| `h` | Hours |
| `d` | Days |
| `w` | Weeks |
| `y` | Years |

**Example: validated Docker configuration**

```hcl
# Crash at startup if critical vars are missing
password = "{= env.PASSWORD | mandatory("Set RSPAMD_PASSWORD") | pbkdf =}";

# Validate and use numeric input
{%- set spam_threshold = env.SPAM_THRESHOLD | default "15" | require_number("SPAM_THRESHOLD must be a number") %}
actions {
    reject = {= spam_threshold =};
}

# Parse JSON array from env and iterate
{%- set disabled = env.DISABLED_MODULES | default '[]' | fromjson %}
{%- for mod in disabled %}
{= mod =} {
    enabled = false;
}
{%- endfor %}

# Duration parsing
{%- set greylist_time = env.GREYLIST_EXPIRE | default "10min" | require_duration %}
greylist {
    expire = {= greylist_time =};
}
```

## Tests reference

Tests are boolean functions used in conditions. In Lupa, they are called with the `is_` prefix:

```
{% if is_defined(env.REDIS_HOST) %}...{% endif %}
```

### Type tests

| Test | Description |
|------|-------------|
| `is_defined(v)` | Not nil |
| `is_undefined(v)` / `is_nil(v)` / `is_none(v)` | Is nil |
| `is_string(v)` | Is string type |
| `is_number(v)` | Is number (or string convertible to number) |
| `is_integer(v)` | Is integer (or string convertible to integer) |
| `is_float(v)` | Is non-integer number |
| `is_boolean(v)` | Is boolean type |
| `is_mapping(v)` / `is_table(v)` | Is table |
| `is_sequence(v)` | Is table with sequential integer keys |
| `is_iterable(v)` | Is table or function |
| `is_callable(v)` | Is function |

### Value tests

| Test | Description |
|------|-------------|
| `is_true(v)` | UCL truthy value: `true`, `yes`, `on`, `1` (case-insensitive) |
| `is_false(v)` | UCL falsy value: `false`, `no`, `off`, `0` (case-insensitive) |
| `is_odd(n)` | n is odd |
| `is_even(n)` | n is even |
| `is_divisibleby(n, d)` | n is divisible by d |

:::info Rspamd 4.0 changes
`is_true` and `is_false` were updated to recognize UCL-style boolean strings (`yes`/`no`, `on`/`off`, `1`/`0`), making them practical for testing environment variable values which are always strings. Similarly, `is_number`, `is_integer`, and `is_float` now attempt string-to-number conversion.
:::

### Comparison and string tests

| Test | Description | Example |
|------|-------------|---------|
| `is_eq(a, b)` | a == b | `is_eq(env.MODE, "strict")` |
| `is_ne(a, b)` | a ~= b | |
| `is_lt(a, b)` / `is_le(a, b)` | Less than / less or equal | |
| `is_gt(a, b)` / `is_ge(a, b)` | Greater than / greater or equal | |
| `is_in(val, container)` | Substring or element check | `is_in("@", email)` |
| `is_startswith(s, prefix)` | String starts with prefix | |
| `is_endswith(s, suffix)` | String ends with suffix | |
| `is_match(s, pattern)` | Matches Lua pattern | `is_match(name, "^%a+$")` |
| `is_lower(s)` / `is_upper(s)` | All lowercase / uppercase | |
| `is_sameas(a, b)` | Alias for `is_eq` | |

### JSON test (Rspamd 4.0+)

| Test | Description | Example |
|------|-------------|---------|
| `is_json(v)` | Value is valid JSON/UCL string | `{% if is_json(env.MODULES) %}` |

## Global functions

| Function | Description | Example |
|----------|-------------|---------|
| `range(start, stop, step)` | Sequence of integers (like Python's `range()`) | `{% for i in range(1, 5) %}` |
| `cycler(...)` | Cycling iterator with `:next()` and `:reset()` | |

## Lua pattern quick reference

The `replace` filter and `is_match` test use **Lua patterns**, not regular expressions:

| Pattern | Matches |
|---------|---------|
| `.` | Any character |
| `%a` | Letter |
| `%d` | Digit |
| `%w` | Alphanumeric |
| `%s` | Whitespace |
| `%p` | Punctuation |
| `%u` / `%l` | Uppercase / lowercase letter |
| `[set]` | Character class |
| `[^set]` | Negated class |
| `*` | 0 or more (greedy) |
| `+` | 1 or more (greedy) |
| `-` | 0 or more (lazy) |
| `?` | 0 or 1 |
| `^` / `$` | Start / end anchor |
| `(...)` | Capture |

Lua patterns do **not** support alternation (`|`), lookahead, or `\d`-style escapes. Use uppercase to negate: `%D` matches non-digit, `%S` matches non-whitespace.

## Complete Docker example

Here is a real-world example showing how environment variables and validation filters work together for a fully containerized Rspamd deployment:

```bash
# docker-compose environment
RSPAMD_PASSWORD=my_secret_password
RSPAMD_REDIS_HOST=redis
RSPAMD_REDIS_PORT=6379
RSPAMD_SPAM_THRESHOLD=15
RSPAMD_GREYLIST_EXPIRE=10min
RSPAMD_DISABLED_MODULES=["rbl_surbl", "clickhouse"]
```

```hcl title="local.d/worker-controller.inc"
# Password is mandatory -- Rspamd won't start without it
password = "{= env.PASSWORD | mandatory("Set RSPAMD_PASSWORD") | pbkdf =}";
```

```hcl title="local.d/redis.conf"
servers = "{= env.REDIS_HOST | default "127.0.0.1" =}:{= env.REDIS_PORT | default "6379" =}";
```

```hcl title="local.d/actions.conf"
{%- set threshold = env.SPAM_THRESHOLD | default "15" | require_number("SPAM_THRESHOLD must be numeric") %}
reject = {= threshold =};
```

```hcl title="local.d/greylist.conf"
{%- set expire = env.GREYLIST_EXPIRE | default "10min" | require_duration("GREYLIST_EXPIRE: use 30s, 5min, 1h") %}
expire = {= expire =};
```
