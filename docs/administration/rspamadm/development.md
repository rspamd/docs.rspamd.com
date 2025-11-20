---
title: Development & Testing
---

# Development & Testing

These commands support development, testing, and advanced debugging of Rspamd.

## lua

Interactive Lua REPL with Rspamd API access.

### Purpose

Provides a Lua Read-Eval-Print Loop (REPL) with full access to Rspamd's Lua API, enabling testing of Lua code, functions, and modules.

### Common Scenarios

#### Interactive REPL

```bash
# Start interactive Lua shell
rspamadm lua
```

This gives you a Lua prompt where you can:
- Test Lua expressions
- Call Rspamd Lua functions
- Load and test modules
- Experiment with the API

Example session:
```lua
> local rspamd_util = require "rspamd_util"
> local hash = rspamd_util.get_hostname()
> print(hash)
localhost
> return 2 + 2
4
```

#### Execute Lua Script

```bash
# Run a Lua script
rspamadm lua -s script.lua

# Run multiple scripts
rspamadm lua -s init.lua -s main.lua
```

#### Execute Lua Code

```bash
# Execute Lua code directly
rspamadm lua -e 'print("Hello from Rspamd Lua")'

# Execute with API
rspamadm lua -e 'local util = require "rspamd_util"; print(util.get_time())'
```

#### Batch Mode

```bash
# Non-interactive batch execution
rspamadm lua -b -s script.lua
```

#### Pass Arguments

```bash
# Pass arguments to Lua script
rspamadm lua -s script.lua -a arg1 -a arg2 -a arg3

# In script, access via: arg[1], arg[2], arg[3]
```

#### Custom Lua Paths

```bash
# Add custom Lua paths
rspamadm lua -P /path/to/modules -s script.lua
```

#### HTTP Server Mode

```bash
# Start HTTP server serving Lua
rspamadm lua -S

# Default: http://localhost:8080
```

Useful for testing HTTP endpoints and handlers.

### Options

```
-s, --script <file>         Load and execute script
-P, --path <path>          Add to Lua search path
-H, --history-file <file>  Readline history file
-m, --max-history <N>      Max history entries
-S, --serve                Start HTTP server
-b, --batch                Batch mode (non-interactive)
-e, --exec <code>          Execute Lua code
-a, --args <arg>           Arguments to pass to script
```

### Use Cases

#### Test Lua Functions

```lua
-- test-function.lua
local rspamd_logger = require "rspamd_logger"
local rspamd_util = require "rspamd_util"

-- Test logging
rspamd_logger.infox("Testing logger")

-- Test utilities
local hostname = rspamd_util.get_hostname()
print("Hostname: " .. hostname)

-- Test parsing
local url = require "rspamd_url"
local parsed = url.create("https://example.com/path")
if parsed then
  print("Host: " .. tostring(parsed:get_host()))
  print("Path: " .. tostring(parsed:get_path()))
end
```

```bash
rspamadm lua -s test-function.lua
```

#### Debug Module

```lua
-- debug-module.lua
local module_name = arg[1] or "dkim_signing"

-- Load module
local module = require("rspamd_plugins." .. module_name)

-- Inspect module
print("Module: " .. module_name)
print("Module functions:")
for k, v in pairs(module) do
  if type(v) == "function" then
    print("  - " .. k)
  end
end
```

```bash
rspamadm lua -s debug-module.lua -a dkim_signing
```

#### Interactive Development

```bash
# Start REPL with custom paths
rspamadm lua -P /path/to/dev/modules

# In REPL, test your module
> local my_module = require "my_custom_module"
> my_module.test_function()
```

---

## corpustest

Test rules against email corpus.

### Purpose

Process a corpus of emails and generate logs, useful for testing rules, debugging, and benchmarking.

### Common Scenarios

#### Process Email Corpus

```bash
# Process emails and generate logs
rspamadm corpustest -i /path/to/corpus/*.eml

# Process with specific config
rspamadm corpustest -c /path/to/rspamd.conf -i corpus/*.eml

# Output to specific directory
rspamadm corpustest -i corpus/*.eml -o test-logs/
```

### Options

```
-c, --config <file>         Config file
-i, --input <pattern>       Input files (glob pattern)
-o, --output <dir>          Output directory for logs
```

### Use Cases

#### Rule Development

```bash
#!/bin/bash
# Test new rule against corpus

CORPUS="/data/test-corpus"
OUTPUT="/tmp/rule-test"

mkdir -p "$OUTPUT"

# Test with new rule
rspamadm corpustest \
  -c /etc/rspamd/rspamd.conf \
  -i "$CORPUS/spam/*.eml" \
  -i "$CORPUS/ham/*.eml" \
  -o "$OUTPUT"

# Analyze results
echo "=== Rule Statistics ==="
grep "MY_NEW_RULE" "$OUTPUT"/* | wc -l
echo "matches"

# Check false positives
grep "MY_NEW_RULE" "$OUTPUT"/ham-* | wc -l
echo "false positives"
```

#### Benchmarking

```bash
# Test performance with different configurations
for config in base.conf optimized.conf; do
  echo "Testing $config..."
  time rspamadm corpustest -c "$config" -i corpus/*.eml > /dev/null
done
```

---

## cookie

Generate message IDs and cookies.

### Purpose

Create unique message identifiers and cryptographic cookies for Rspamd internal use.

### Common Scenarios

#### Generate Message ID

```bash
# Generate unique message ID
rspamadm cookie

# Generate multiple
for i in {1..5}; do
  rspamadm cookie
done
```

### Use Cases

#### Testing

```bash
# Generate test message ID for development
MSG_ID=$(rspamadm cookie)
echo "Message-ID: <$MSG_ID@example.com>"
```

---

## publicsuffix

Manage public suffix list.

### Purpose

Compile and update the public suffix list used by Rspamd for domain parsing.

### Common Scenarios

#### Compile Public Suffix List

```bash
# Compile if needed
rspamadm publicsuffix compile

# Force recompile
rm /var/lib/rspamd/publicsuffix.db
rspamadm publicsuffix compile
```

### Use Cases

#### Update Public Suffix List

```bash
#!/bin/bash
# Update public suffix list monthly

cd /var/lib/rspamd

# Download latest list
wget -O public_suffix_list.dat.new \
  https://publicsuffix.org/list/public_suffix_list.dat

# Backup current
mv public_suffix_list.dat public_suffix_list.dat.bak

# Replace
mv public_suffix_list.dat.new public_suffix_list.dat

# Compile
rspamadm publicsuffix compile

# Reload Rspamd
systemctl reload rspamd
```

---

## Practical Examples

### Lua Development Workflow

```lua
-- test-url-parser.lua
-- Test URL parsing functionality

local rspamd_url = require "rspamd_url"
local rspamd_logger = require "rspamd_logger"

local test_urls = {
  "http://example.com/path?query=value",
  "https://user:pass@example.com:8080/path",
  "ftp://files.example.com/file.txt",
  "mailto:test@example.com"
}

print("Testing URL Parser")
print("==================")

for _, url_str in ipairs(test_urls) do
  local url = rspamd_url.create(url_str)
  
  if url then
    print(string.format("\nURL: %s", url_str))
    print(string.format("  Protocol: %s", url:get_protocol()))
    print(string.format("  Host: %s", url:get_host()))
    print(string.format("  Port: %s", url:get_port() or "default"))
    print(string.format("  Path: %s", url:get_path() or "/"))
    print(string.format("  Query: %s", url:get_query() or "none"))
  else
    rspamd_logger.errx("Failed to parse: %s", url_str)
  end
end
```

Run with:
```bash
rspamadm lua -s test-url-parser.lua
```

### Interactive Testing Session

```bash
# Start REPL
rspamadm lua

# Load required modules
> local rspamd_util = require "rspamd_util"
> local rspamd_text = require "rspamd_text"
> local rspamd_cryptobox = require "rspamd_cryptobox"

# Test hashing
> local text = rspamd_text.fromstring("Hello World")
> local hash = rspamd_cryptobox.hash_hex(text)
> print(hash)

# Test time functions
> local ts = rspamd_util.get_time()
> print(os.date("%Y-%m-%d %H:%M:%S", ts))

# Test hostname
> print(rspamd_util.get_hostname())

# Exit
> os.exit()
```

### Module Development Helper

```lua
-- module-tester.lua
-- Test custom Rspamd module

local module_path = arg[1]
if not module_path then
  print("Usage: rspamadm lua -s module-tester.lua -a /path/to/module.lua")
  os.exit(1)
end

-- Load module
local module = dofile(module_path)

-- Test if module has required structure
local required_functions = {
  "register",
  "configure"
}

print("Testing module: " .. module_path)
print("==================")

for _, func_name in ipairs(required_functions) do
  if type(module[func_name]) == "function" then
    print(string.format("✓ %s() found", func_name))
  else
    print(string.format("✗ %s() missing", func_name))
  end
end

-- List all functions
print("\nAvailable functions:")
for k, v in pairs(module) do
  if type(v) == "function" then
    print("  - " .. k)
  end
end

-- Test module options
if module.options then
  print("\nModule options:")
  for k, v in pairs(module.options) do
    print(string.format("  %s = %s", k, tostring(v)))
  end
end
```

### Corpus Analysis Script

```bash
#!/bin/bash
# Analyze corpus with custom rules

CORPUS_DIR="/data/test-corpus"
CONFIG="/etc/rspamd/rspamd.conf"
RESULTS="/tmp/corpus-results"

rm -rf "$RESULTS"
mkdir -p "$RESULTS"

echo "Processing corpus..."

# Process spam
echo "=== Spam Analysis ==="
rspamadm corpustest \
  -c "$CONFIG" \
  -i "$CORPUS_DIR/spam/*.eml" \
  -o "$RESULTS/spam"

# Process ham
echo "=== Ham Analysis ==="
rspamadm corpustest \
  -c "$CONFIG" \
  -i "$CORPUS_DIR/ham/*.eml" \
  -o "$RESULTS/ham"

# Analyze results
echo ""
echo "=== Summary ==="
echo "Spam messages: $(ls $CORPUS_DIR/spam/*.eml | wc -l)"
echo "Ham messages: $(ls $CORPUS_DIR/ham/*.eml | wc -l)"

echo ""
echo "=== Top Symbols in Spam ==="
grep -h "symbol=" "$RESULTS/spam"/* | \
  grep -o 'symbol=[A-Z_]*' | \
  sort | uniq -c | sort -rn | head -20

echo ""
echo "=== Top Symbols in Ham ==="
grep -h "symbol=" "$RESULTS/ham"/* | \
  grep -o 'symbol=[A-Z_]*' | \
  sort | uniq -c | sort -rn | head -20
```

### Lua HTTP Server Example

```lua
-- http-server.lua
-- Simple HTTP server using Rspamd Lua

local rspamd_http = require "rspamd_http"
local rspamd_logger = require "rspamd_logger"

local function handle_request(req, res)
  rspamd_logger.infox("Request: %s %s", req.method, req.path)
  
  if req.path == "/" then
    res:send_response(200, "Hello from Rspamd Lua!")
  elseif req.path == "/api/info" then
    local info = {
      hostname = require("rspamd_util").get_hostname(),
      time = os.date("%Y-%m-%d %H:%M:%S"),
      version = "1.0"
    }
    res:send_json(info)
  else
    res:send_response(404, "Not Found")
  end
end

print("Starting HTTP server on http://localhost:8080")
print("Press Ctrl+C to stop")

-- Note: This is conceptual - actual HTTP server mode
-- uses rspamadm lua -S
```

### Rule Testing Framework

```lua
-- rule-tester.lua
-- Framework for testing custom rules

local rspamd_logger = require "rspamd_logger"
local rspamd_task = require "rspamd_task"
local rspamd_util = require "rspamd_util"

local function test_rule(rule_func, test_cases)
  local passed = 0
  local failed = 0
  
  for _, test in ipairs(test_cases) do
    -- Create mock task
    local task = {
      from = test.from,
      rcpt = test.rcpt,
      subject = test.subject
    }
    
    -- Run rule
    local result = rule_func(task)
    local expected = test.expected
    
    if result == expected then
      print(string.format("✓ %s", test.name))
      passed = passed + 1
    else
      print(string.format("✗ %s (got %s, expected %s)", 
            test.name, tostring(result), tostring(expected)))
      failed = failed + 1
    end
  end
  
  print(string.format("\nResults: %d passed, %d failed", passed, failed))
  return failed == 0
end

-- Example usage
local function my_rule(task)
  if task.from and task.from:match("spam") then
    return true
  end
  return false
end

local tests = {
  {
    name = "Spam sender",
    from = "spam@example.com",
    expected = true
  },
  {
    name = "Legitimate sender",
    from = "user@example.com",
    expected = false
  }
}

test_rule(my_rule, tests)
```

## Tips and Best Practices

### Lua Development

1. **Use REPL for quick tests** - Fastest way to test Lua code
2. **Load modules interactively** - Test API functions live
3. **Save history** - Use `-H` to save REPL history
4. **Script complex tests** - Use `-s` for reproducible tests
5. **Check API docs** - Reference Lua API documentation

### Testing

1. **Use representative corpus** - Test with real emails
2. **Test both spam and ham** - Check for false positives
3. **Automate testing** - Script your test workflows
4. **Version test data** - Keep corpus in version control
5. **Measure performance** - Use `time` to benchmark

### Development

1. **Iterate quickly** - Use Lua REPL for rapid development
2. **Test incrementally** - Test small pieces as you build
3. **Log extensively** - Use rspamd_logger in development
4. **Use debug mode** - Enable verbose logging
5. **Follow conventions** - Match Rspamd's code style

## Related Documentation

- [Email Analysis](email-analysis.md) - Analyze messages programmatically
- [Configuration](configuration.md) - Test configuration changes
- [Lua API](/lua/index) - Complete Lua API reference
- [Writing Rules](/developers/writing_rules) - Rule development guide
