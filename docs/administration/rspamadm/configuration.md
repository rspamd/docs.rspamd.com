---
title: Configuration Management
---

# Configuration Management

These commands help validate, inspect, and manipulate Rspamd configuration files.

## configtest

Validate configuration syntax and load ability.

### Purpose

Test that configuration files are syntactically correct and can be loaded without errors.

### Common Scenarios

#### Basic Validation

```bash
# Test default configuration
rspamadm configtest

# Test specific config file
rspamadm configtest -c /path/to/rspamd.conf
```

Exit codes:
- `0` - Configuration is valid
- `1` - Configuration has errors

#### Quiet Mode

```bash
# Only show errors (for scripts)
rspamadm configtest -q

# Use in scripts
if rspamadm configtest -q; then
  systemctl restart rspamd
else
  echo "Configuration errors detected"
  exit 1
fi
```

#### Strict Mode

```bash
# Stop on any error (even warnings)
rspamadm configtest -s
```

#### Skip Jinja Templates

```bash
# Don't process Jinja templates
rspamadm configtest -T
```

### Options

```
-q, --quiet             Suppress output
-c, --config <file>     Config file to test
-s, --strict            Stop on any error
-T, --skip-template     Don't apply Jinja templates
```

### Use Cases

#### Pre-Restart Validation

```bash
#!/bin/bash
# Safe Rspamd restart

echo "Validating configuration..."
if rspamadm configtest; then
  echo "Configuration valid, restarting..."
  systemctl restart rspamd
  sleep 2
  
  # Verify it started
  if systemctl is-active rspamd >/dev/null; then
    echo "Rspamd restarted successfully"
  else
    echo "Rspamd failed to start, check logs"
    systemctl status rspamd
    exit 1
  fi
else
  echo "Configuration errors detected, not restarting"
  exit 1
fi
```

#### Continuous Integration

```yaml
# .gitlab-ci.yml
test-config:
  script:
    - rspamadm configtest -c rspamd.conf -s
  only:
    - merge_requests
```

---

## configdump

Display effective configuration.

### Purpose

Show the final merged configuration after processing all includes and overrides.

### Common Scenarios

#### Dump Full Configuration

```bash
# Show complete effective config
rspamadm configdump | less

# JSON format (pretty printed)
rspamadm configdump -j | jq '.' | less

# Compact JSON
rspamadm configdump -C

# Show as UCL
rspamadm configdump
```

#### Dump Specific Module

```bash
# Show specific module config
rspamadm configdump dkim_signing

# Show classifier config
rspamadm configdump classifier

# Show worker config
rspamadm configdump worker-normal
```

#### Show Help Comments

```bash
# Include help text for options
rspamadm configdump -h

# Show saved comments
rspamadm configdump -s
```

#### Show Modules State

```bash
# Show only module states (enabled/disabled)
rspamadm configdump -m
```

#### Show Symbol Groups

```bash
# Show symbol group configuration
rspamadm configdump -g
```

### Options

```
-j, --json              JSON output (pretty)
-C, --compact           Compact JSON
-c, --config <file>     Config file
-h, --show-help         Show help comments
-s, --show-comments     Show saved comments
-m, --modules-state     Show modules state only
-g, --groups            Show symbols groups only
-T, --skip-template     Don't apply Jinja templates
```

### Use Cases

#### Debug Configuration Merging

```bash
# Check what's actually being used
rspamadm configdump redis

# Compare with what you expect
diff <(rspamadm configdump redis) expected-redis.conf
```

#### Document Current Configuration

```bash
# Export current config for documentation
rspamadm configdump -j > current-config-$(date +%Y%m%d).json

# With comments
rspamadm configdump -h -s > documented-config.txt
```

#### Verify Module Status

```bash
# Check which modules are enabled
rspamadm configdump -m | grep -v "^#"

# List disabled modules
rspamadm configdump -m | grep "enabled = false"
```

#### Extract Specific Settings

```bash
# Get Redis configuration
rspamadm configdump redis -j | jq '.redis'

# Get all DKIM selectors
rspamadm configdump dkim_signing -j | jq '.dkim_signing.domain'
```

---

## confighelp

Show documentation for configuration options.

### Purpose

Display help text and available options for configuration elements.

### Common Scenarios

#### List All Options

```bash
# Show all configuration options
rspamadm confighelp | less
```

#### Show Module Options

```bash
# Show options for specific module
rspamadm confighelp dkim_signing

# Show worker options
rspamadm confighelp worker

# Show classifier options
rspamadm confighelp classifier
```

#### Show Specific Option

```bash
# Show details about specific option
rspamadm confighelp dkim_signing.selector

# Show nested option
rspamadm confighelp surbl.rule

# Show worker-specific option
rspamadm confighelp worker-controller.password
```

### Use Cases

#### Find Available Options

```bash
# What can I configure in this module?
rspamadm confighelp multimap | grep "^\s*[a-z]"

# Show all Redis options
rspamadm confighelp redis
```

#### Configuration Writing

```bash
# While editing config, check available options
vim /etc/rspamd/local.d/dkim_signing.conf

# In another terminal:
rspamadm confighelp dkim_signing
```

---

## configgraph

Visualize configuration include hierarchy.

### Purpose

Generate a graph showing how configuration files include each other.

### Common Scenarios

#### Generate Graph

```bash
# Generate Graphviz DOT format
rspamadm configgraph > config-graph.dot

# Convert to image
dot -Tpng config-graph.dot -o config-graph.png

# Convert to SVG
dot -Tsvg config-graph.dot -o config-graph.svg

# Interactive view (if you have xdot)
rspamadm configgraph | xdot -
```

### Use Cases

#### Document Configuration Structure

```bash
#!/bin/bash
# Generate configuration documentation

DATE=$(date +%Y-%m-%d)
OUTPUT="/var/www/docs/rspamd"

# Generate graph
rspamadm configgraph | \
  dot -Tsvg -o "$OUTPUT/config-includes-$DATE.svg"

# Generate HTML page
cat > "$OUTPUT/index.html" << EOF
<html>
<head><title>Rspamd Configuration Structure</title></head>
<body>
  <h1>Configuration Include Hierarchy ($DATE)</h1>
  <img src="config-includes-$DATE.svg" alt="Config Graph">
</body>
</html>
EOF
```

#### Debug Circular Includes

```bash
# Find circular includes
rspamadm configgraph | grep -i "cycle"
```

---

## configwizard

Interactive configuration setup wizard.

### Purpose

Guided configuration for Rspamd daemon with interactive prompts.

### Common Scenarios

#### Run Setup Wizard

```bash
# Start interactive wizard
rspamadm configwizard
```

The wizard will guide you through:
- Redis configuration
- Controller password
- DKIM setup
- Logging options
- Workers configuration

### Use Cases

#### Initial Setup

```bash
# After fresh install
rspamadm configwizard

# Follow prompts to configure basic settings
```

#### Quick Configuration

When you need to quickly set up a new instance with standard settings.

---

## template

Apply Jinja templates to files.

### Purpose

Process files with Jinja template syntax, useful for generating configuration from templates.

### Common Scenarios

#### Process Template

```bash
# Apply template to file
rspamadm template config.template > config.conf

# Process multiple files
rspamadm template template1 template2 template3
```

#### With Custom Variables

```bash
# Load variables from file (name=value format)
rspamadm template -e vars.env config.template > config.conf

# Load variables from Lua file
rspamadm template -l vars.lua config.template > config.conf
```

#### Save with Suffix

```bash
# Process and save with suffix
rspamadm template -s .conf config.template

# Creates: config.template.conf
```

#### In-Place Replacement

```bash
# Replace original file
rspamadm template -i config.template
```

#### Without Rspamd Variables

```bash
# Don't add internal Rspamd variables
rspamadm template -n config.template
```

### Options

```
-n, --no-vars               Don't add Rspamd variables
-e, --env <file>           Load environment from file (name=value)
-l, --lua-env <file>       Load environment from Lua file
-s, --suffix <suffix>      Save with suffix
-i, --inplace              Replace original file
```

### Use Cases

#### Configuration Generation

```bash
# vars.env
REDIS_HOST=redis.example.com
REDIS_PORT=6379
CLICKHOUSE_HOST=clickhouse.example.com

# redis.template
redis {
  servers = "{{ REDIS_HOST }}:{{ REDIS_PORT }}";
}
```

```bash
# Generate config
rspamadm template -e vars.env redis.template > redis.conf
```

#### Multi-Environment Deployment

```bash
#!/bin/bash
# Generate configs for different environments

for env in dev staging prod; do
  echo "Generating config for $env..."
  
  rspamadm template \
    -e "vars-$env.env" \
    -s "-$env.conf" \
    config.template
done
```

#### Dynamic Configuration

```lua
-- vars.lua
return {
  redis_host = "redis.local",
  redis_port = 6379,
  debug_enabled = true,
  workers = 4
}
```

```bash
rspamadm template -l vars.lua rspamd.template > rspamd.conf
```

---

## Practical Examples

### Complete Configuration Validation Pipeline

```bash
#!/bin/bash
# Validate and deploy configuration

CONFIG_DIR="/etc/rspamd"
BACKUP_DIR="/var/backups/rspamd/config"
DATE=$(date +%Y%m%d-%H%M%S)

# 1. Backup current config
echo "=== Backing up current configuration ==="
mkdir -p "$BACKUP_DIR"
tar czf "$BACKUP_DIR/config-$DATE.tar.gz" "$CONFIG_DIR"

# 2. Test syntax
echo "=== Testing configuration syntax ==="
if ! rspamadm configtest -s; then
  echo "ERROR: Configuration validation failed"
  exit 1
fi

# 3. Compare with previous
echo "=== Checking for changes ==="
CURRENT=$(rspamadm configdump -C)
PREVIOUS=$(cat /tmp/last-config.json 2>/dev/null || echo "{}")

if [ "$CURRENT" != "$PREVIOUS" ]; then
  echo "Configuration changes detected"
  echo "$CURRENT" | jq '.' > /tmp/config-changes.json
fi

# 4. Document current state
echo "=== Documenting configuration ==="
rspamadm configdump -j > "$BACKUP_DIR/config-dump-$DATE.json"
rspamadm configdump -m > "$BACKUP_DIR/modules-state-$DATE.txt"
rspamadm configdump -g > "$BACKUP_DIR/symbol-groups-$DATE.txt"

# 5. Generate graph
echo "=== Generating configuration graph ==="
rspamadm configgraph | dot -Tpng -o "$BACKUP_DIR/config-graph-$DATE.png"

# 6. Restart if needed
if systemctl is-active rspamd >/dev/null; then
  echo "=== Restarting Rspamd ==="
  systemctl restart rspamd
  sleep 2
  
  if ! systemctl is-active rspamd >/dev/null; then
    echo "ERROR: Rspamd failed to start!"
    echo "Restoring backup..."
    systemctl stop rspamd
    rm -rf "$CONFIG_DIR"/*
    tar xzf "$BACKUP_DIR/config-$DATE.tar.gz" -C /
    systemctl start rspamd
    exit 1
  fi
fi

# 7. Save for next comparison
echo "$CURRENT" > /tmp/last-config.json

echo "=== Configuration deployed successfully ==="
```

### Configuration Template System

```bash
#!/bin/bash
# Template-based configuration management

TEMPLATE_DIR="/etc/rspamd/templates"
ENV_DIR="/etc/rspamd/environments"
OUTPUT_DIR="/etc/rspamd"

ENVIRONMENT=${1:-production}

if [ ! -f "$ENV_DIR/$ENVIRONMENT.env" ]; then
  echo "Environment $ENVIRONMENT not found"
  exit 1
fi

echo "Generating configuration for $ENVIRONMENT environment..."

# Process all templates
for template in "$TEMPLATE_DIR"/*.template; do
  basename=$(basename "$template" .template)
  output="$OUTPUT_DIR/$basename.conf"
  
  echo "Processing $basename..."
  
  rspamadm template \
    -e "$ENV_DIR/$ENVIRONMENT.env" \
    "$template" > "$output"
  
  if [ $? -ne 0 ]; then
    echo "Error processing $template"
    exit 1
  fi
done

# Validate
echo "Validating generated configuration..."
if rspamadm configtest -s; then
  echo "Configuration valid"
else
  echo "Configuration invalid, rolling back"
  exit 1
fi
```

### Configuration Audit Script

```bash
#!/bin/bash
# Audit Rspamd configuration

REPORT_FILE="/var/log/rspamd/config-audit-$(date +%Y%m%d).txt"

{
  echo "Rspamd Configuration Audit"
  echo "=========================="
  echo "Date: $(date)"
  echo
  
  echo "=== Configuration Validity ==="
  if rspamadm configtest -q; then
    echo "✓ Configuration is valid"
  else
    echo "✗ Configuration has errors:"
    rspamadm configtest
  fi
  echo
  
  echo "=== Module Status ==="
  rspamadm configdump -m | grep -E "(module|enabled)"
  echo
  
  echo "=== Enabled Workers ==="
  rspamadm configdump worker | grep -E "type.*worker"
  echo
  
  echo "=== Redis Configuration ==="
  rspamadm configdump redis -j | jq -r '.redis | {servers, password: "***"}'
  echo
  
  echo "=== DKIM Domains ==="
  rspamadm configdump dkim_signing -j | jq -r '.dkim_signing.domain | keys[]' 2>/dev/null || echo "None configured"
  echo
  
  echo "=== Symbol Groups ==="
  rspamadm configdump -g | grep "group =" | wc -l
  echo "total groups"
  echo
  
} | tee "$REPORT_FILE"

echo "Report saved to $REPORT_FILE"
```

## Tips and Best Practices

### Configuration Testing

1. **Always test before restart** - Use `configtest` before restarting Rspamd
2. **Use strict mode** - `-s` flag catches more issues
3. **Test in CI/CD** - Validate configs in your deployment pipeline
4. **Automated testing** - Script configuration validation
5. **Keep backups** - Backup config before changes

### Configuration Inspection

1. **Use configdump to debug** - See actual merged configuration
2. **Check module states** - Verify modules are enabled as expected
3. **Document with graphs** - Generate configuration diagrams
4. **Export regularly** - Keep dumps of known-good configurations
5. **Compare environments** - Diff configs between environments

### Template Usage

1. **Version templates** - Keep templates in version control
2. **Environment-specific vars** - Separate environment variables
3. **Validate after templating** - Always run configtest
4. **Use descriptive variables** - Make templates readable
5. **Document variables** - Explain what each variable does

### Best Practices

1. **Modular configuration** - Use local.d/ and override.d/
2. **Comment your changes** - Explain why, not what
3. **Test incrementally** - Small changes, test frequently
4. **Keep defaults** - Don't override unless necessary
5. **Use confighelp** - Check available options before guessing

## Related Documentation

- [Cryptography](cryptography.md) - Encrypt sensitive config values
- [Operations](operations.md) - Reload configuration without restart
- [Configuration Guide](/configuration/index) - Rspamd configuration documentation
