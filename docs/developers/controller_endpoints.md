# Controller WebUI Endpoints Development Guide

This document provides a comprehensive guide for developing controller WebUI endpoints in Rspamd, covering both the existing C-based endpoints and how to create new Lua-based endpoints.

## Overview

The Rspamd controller is an HTTP daemon that provides a REST API interface for managing and monitoring Rspamd. It serves both built-in C endpoints and dynamically loaded Lua endpoints for extended functionality.

### Architecture

The controller system consists of:
- **C core**: Built-in endpoints implemented in `src/controller.c`
- **Lua plugin system**: Dynamic endpoints loaded from `rules/controller/` directory
- **HTTP router**: Routes requests to appropriate handlers
- **Authentication system**: Password-based security with different privilege levels

### URL Structure

- Built-in C endpoints: `/{endpoint}` (e.g., `/stat`, `/scan`)
- Lua plugin endpoints: `/plugins/{plugin}/{path}` (e.g., `/plugins/neural/learn`)
- Static files: Served from configured static directory

## Built-in C Endpoints

The following endpoints are implemented in C and provide core functionality:

### Authentication & Status
- `POST /auth` - Authenticate and get system status
- `GET /ping` - Simple health check
- `GET /healthy` - Comprehensive health check with worker status
- `GET /ready` - Readiness check for scanner workers

### Statistics & Monitoring
- `GET /stat` - Get detailed statistics
- `GET /statreset` - Reset statistics (privileged)
- `GET /metrics` - Prometheus-format metrics
- `GET /counters` - Symbol counters from cache
- `GET /errors` - Recent error logs (privileged)

### Configuration & Management
- `GET /symbols` - List all symbols with weights and descriptions
- `GET /actions` - List actions with thresholds
- `POST /saveactions` - Save action thresholds (privileged)
- `POST /savesymbols` - Save symbol weights (privileged)

### Maps Management
- `GET /maps` - List all maps
- `GET /getmap` - Get map content by ID
- `POST /savemap` - Save map content (privileged)

### Message Processing
- `POST /scan` - Scan message and return results
- `POST /check` - Alias for `/scan`
- `POST /checkv2` - Extended scan endpoint
- `POST /learnspam` - Learn message as spam (privileged)
- `POST /learnham` - Learn message as ham (privileged)

### Data Visualization
- `GET /graph` - Time-series graph data for WebUI
- `GET /pie` - Pie chart data for action statistics

### History & Analysis
- `GET /history` - Message processing history
- `POST /historyreset` - Clear history (privileged)

### System Information
- `GET /neighbours` - Configured neighbour nodes
- `GET /plugins` - List available Lua plugins
- `GET /bayes/classifiers` - List Bayes classifiers

## Creating Lua Endpoints

Lua endpoints provide a flexible way to extend controller functionality. They are automatically registered through the plugin system.

### Basic Structure

Create a Lua file in `rules/controller/` directory:

```lua
-- rules/controller/example.lua
local function handle_hello(task, conn, req_params)
  conn:send_ucl({
    success = true,
    message = "Hello from Lua endpoint!",
    params = req_params
  })
end

return {
  hello = {
    handler = handle_hello,
    enable = false,     -- Normal password sufficient for read-only operation
    need_task = false,
  }
}
```

This creates an endpoint at `/plugins/example/hello`.

### Endpoint Configuration

Each endpoint is defined with the following properties:

```lua
endpoint_name = {
  handler = function,     -- Required: Handler function
  enable = boolean,       -- Required: Authentication level (false=normal, true=privileged)
  need_task = boolean,    -- Optional: Whether to create a task object
  version = number,       -- Optional: API version
}
```

#### Configuration Options

- **`handler`**: Function that processes the request
- **`enable`**: Authentication level - `true` requires privileged (enable) password, `false` allows normal password
- **`need_task`**: Set to `true` if the handler needs access to message content
- **`version`**: API version number (optional)

#### Choosing Authentication Level

**Use `enable = false` for:**
- Read-only operations (list data, query information)
- Public API endpoints that don't modify system state
- Endpoints that should be accessible with basic credentials

**Use `enable = true` for:**
- Operations that modify configuration
- System administration functions
- Sensitive data access
- Operations that could affect system security

```lua
return {
  -- Public read-only endpoint
  status = {
    handler = handle_status,
    enable = false,       -- Normal password OK
  },
  
  -- Administrative endpoint
  reload_config = {
    handler = handle_reload_config,
    enable = true,        -- Requires privileged password
  }
}
```

### Handler Function Signatures

#### Simple Handler (need_task = false)
```lua
local function simple_handler(task, conn, req_params)
  -- task: Always present but may be minimal
  -- conn: Connection object for sending responses  
  -- req_params: Query parameters from URL/POST data
end
```

#### Task Handler (need_task = true)
```lua
local function task_handler(task, conn, req_params)
  -- task: Full task object with message processing capabilities
  -- conn: Connection object for sending responses
  -- req_params: Query parameters from URL/POST data
  
  -- Process the message
  task:process_message()
  
  -- Access message properties
  local from = task:get_from()
  local subject = task:get_header('Subject')
end
```

### Connection Object Methods

The `conn` object provides methods for sending responses:

#### Send UCL/JSON Response
```lua
conn:send_ucl({
  success = true,
  data = { key = "value" },
  count = 42
})
```

#### Send Plain Text
```lua
conn:send_string("Plain text response")
```

#### Send Error Response
```lua
conn:send_error(404, "Resource not found")
-- or
conn:send_error(500, "Internal server error: " .. error_msg)
```

### Request Parameters

Parameters come from:
- **URL query string**: `?param1=value1&param2=value2`
- **POST form data**: `application/x-www-form-urlencoded`
- **JSON POST body**: Parse manually with UCL

#### Accessing Query Parameters
```lua
local function handle_query(task, conn, req_params)
  local search_term = req_params.q or ""
  local limit = tonumber(req_params.limit) or 10
  
  -- Process query...
  conn:send_ucl({
    query = search_term,
    limit = limit,
    results = {}
  })
end
```

#### Processing JSON POST Data
```lua
local ucl = require "ucl"

local function handle_json_post(task, conn, req_params)
  local parser = ucl.parser()
  local ok, err = parser:parse_text(task:get_rawbody())
  
  if not ok then
    conn:send_error(400, "Invalid JSON: " .. err)
    return
  end
  
  local data = parser:get_object()
  -- Process data...
  
  conn:send_ucl({ success = true, received = data })
end
```

## Real-World Examples

### Example 1: Selectors Plugin

The selectors plugin demonstrates various endpoint types:

```lua
-- rules/controller/selectors.lua
local lua_selectors = require "lua_selectors"

local function handle_list_transforms(_, conn)
  conn:send_ucl(lua_selectors.list_transforms())
end

local function handle_check_message(task, conn, req_params)
  if req_params.selector and req_params.selector ~= '' then
    local selector = lua_selectors.create_selector_closure(
      rspamd_config, req_params.selector, '', true)
    
    if not selector then
      conn:send_error(500, 'invalid selector')
    else
      task:process_message()
      local elts = selector(task)
      conn:send_ucl({ success = true, data = elts })
    end
  else
    conn:send_error(404, 'missing selector')
  end
end

 return {
   list_transforms = {
     handler = handle_list_transforms,
     enable = true,          -- System information access
   },
   check_message = {
     handler = handle_check_message,
     enable = true,          -- System information access
     need_task = true,
   }
 }
```

### Example 2: Maps Query Plugin

The maps plugin shows complex parameter handling:

```lua
-- rules/controller/maps.lua
local function handle_query_map(_, conn, req_params)
  local keys_to_check = {}
  
  if req_params.value and req_params.value ~= '' then
    keys_to_check[1] = req_params.value
  elseif req_params.values then
    keys_to_check = lua_util.str_split(req_params.values, ',')
  end
  
  local results = {}
  for _, key in ipairs(keys_to_check) do
    for uri, m in pairs(maps_cache) do
      local value = m:get_key(key)
      if value then
        table.insert(results, {
          map = uri,
          key = key,
          value = value,
          hit = true
        })
      end
    end
  end
  
  conn:send_ucl({
    success = (#results > 0),
    results = results
  })
end

 return {
   query = {
     handler = handle_query_map,
     enable = false,  -- Normal password sufficient (read-only operation)
   }
 }
```

### Example 3: Neural Network Training

The neural plugin demonstrates JSON schema validation:

```lua
-- rules/controller/neural.lua
local ts = require("tableshape").types
local ucl = require "ucl"

local learn_request_schema = ts.shape {
  ham_vec = ts.array_of(ts.array_of(ts.number)),
  spam_vec = ts.array_of(ts.array_of(ts.number)),
  rule = ts.string:is_optional(),
}

local function handle_learn(task, conn)
  local parser = ucl.parser()
  local ok, err = parser:parse_text(task:get_rawbody())
  
  if not ok then
    conn:send_error(400, err)
    return
  end
  
  local req_params = parser:get_object()
  ok, err = learn_request_schema:transform(req_params)
  
  if not ok then
    conn:send_error(400, err)
    return
  end
  
  -- Process training data...
  neural_common.spawn_train {
    ev_base = task:get_ev_base(),
    ham_vec = req_params.ham_vec,
    spam_vec = req_params.spam_vec,
    -- ... other parameters
  }
  
  conn:send_string('{"success": true}')
end

 return {
   learn = {
     handler = handle_learn,
     enable = true,       -- Requires privileged password (modifies neural networks)
     need_task = true,
   }
 }
```

## Authentication and Security

### Password Levels

The controller supports two password levels:
- **Normal password**: Read-only access to most endpoints
- **Enable password**: Full access including privileged operations

### Authentication Levels

The `enable` flag in endpoint configuration controls authentication requirements:

- **`enable = false`**: Accepts normal password (read-only access)
- **`enable = true`**: Requires privileged (enable) password (full access)

```lua
return {
  list_data = {
    handler = handle_list_data,
    enable = false,      -- Normal password sufficient
  },
  modify_settings = {
    handler = handle_modify_settings,  
    enable = true,       -- Requires privileged password
  }
}
```

### IP-based Access

Configure `secure_ip` in worker configuration for password-less access:

```lua
worker {
  type = controller
  secure_ip = ["127.0.0.1", "::1", "192.168.1.0/24"]
}
```

### Session Read-Only Mode

The controller automatically sets session permissions:
- Normal password: `session.is_read_only = true` (unless no enable password configured)
- Enable password: `session.is_read_only = false`
- Trusted IP: `session.is_read_only = false`

### Access Control in Handlers

Lua endpoints can check session permissions if needed:

```lua
local function sensitive_handler(task, conn, req_params)
  -- Authentication already handled by controller
  -- Additional checks can be implemented if needed
  
  local session = -- session access not directly exposed to Lua
  -- Use enable=true in config for privileged operations
  
  -- Proceed with operation...
end
```

## Advanced Features

### Schema Validation

Use tableshape for robust input validation:

```lua
local ts = require("tableshape").types

local request_schema = ts.shape {
  name = ts.string,
  count = ts.number:is_optional(),
  tags = ts.array_of(ts.string):is_optional(),
}

local function validated_handler(task, conn, req_params)
  local ok, err = request_schema:transform(req_params)
  if not ok then
    conn:send_error(400, "Validation error: " .. err)
    return
  end
  
  -- Process validated input...
end
```

### Asynchronous Operations

For operations requiring external HTTP requests, use the async HTTP API:

```lua
local rspamd_http = require "rspamd_http"

local function async_handler(task, conn, req_params)
  local function http_callback(err, response)
    if err then
      conn:send_error(500, "External request failed: " .. err)
      return
    end
    
    -- Process response and send result
    local data = response.content
    conn:send_ucl({ 
      success = true, 
      external_data = data,
      status_code = response.code 
    })
  end
  
  -- Make async HTTP request
  rspamd_http.request({
    url = "https://api.example.com/data",
    method = "POST",
    headers = {
      ["Content-Type"] = "application/json",
      ["Authorization"] = "Bearer " .. req_params.token
    },
    body = require("ucl").to_format({
      query = req_params.query
    }, "json"),
    callback = http_callback,
    task = task,           -- Only task needed, not both task and ev_base
    timeout = 10.0,
  })
end
```

### Redis Operations

For Redis operations, use the modern lua_redis module:

```lua
local lua_redis = require "lua_redis"

-- Module-level Redis configuration (usually done at module init)
local redis_params = nil

local function init_redis_config()
  local opts = rspamd_config:get_all_opt('mymodule')
  if opts and opts.redis then
    redis_params = lua_redis.parse_redis_server('mymodule')
  end
end

local function redis_handler(task, conn, req_params)
  if not redis_params then
    conn:send_error(500, "Redis not configured")
    return
  end
  
  local function redis_callback(err, data)
    if err then
      conn:send_error(500, "Redis error: " .. err)
      return
    end
    
    conn:send_ucl({ 
      success = true, 
      redis_data = data 
    })
  end
  
  -- Modern Redis API
  local attrs = {
    task = task,
    callback = redis_callback,
    is_write = false,  -- false for read operations
    key = req_params.key or "default_key"
  }
  
  lua_redis.request(redis_params, attrs, {
    'HGET', 
    req_params.key or "mykey", 
    req_params.field or "myfield"
  })
end

-- Alternative: Using Redis with coroutines (no callback)
local function redis_sync_handler(task, conn, req_params)
  if not redis_params then
    conn:send_error(500, "Redis not configured")
    return
  end
  
  local attrs = {
    task = task,
    is_write = false,
    key = req_params.key or "default_key"
  }
  
  -- This will work with coroutines
  local ok, data = lua_redis.request(redis_params, attrs, {
    'HGET', 
    req_params.key or "mykey", 
    req_params.field or "myfield"
  })
  
  if not ok then
    conn:send_error(500, "Redis request failed")
    return
  end
  
  conn:send_ucl({ 
    success = true, 
    redis_data = data 
  })
end
```

#### AWS S3 Integration Example

Based on the AWS S3 plugin, here's how to integrate with external services:

```lua
local rspamd_http = require "rspamd_http" 
local lua_aws = require "lua_aws"

local function s3_upload_handler(task, conn, req_params)
  if not req_params.bucket or not req_params.content then
    conn:send_error(400, "bucket and content parameters required")
    return
  end
  
  local function s3_callback(http_err, code, body, headers)
    if http_err then
      conn:send_error(500, "S3 upload failed: " .. http_err)
      return
    end
    
    if code == 200 then
      conn:send_ucl({ 
        success = true, 
        s3_key = req_params.key,
        status_code = code 
      })
    else
      conn:send_error(code, "S3 error: " .. (body or "unknown"))
    end
  end
  
  local s3_key = string.format("/%s/%s", req_params.path or "uploads", 
                               req_params.filename or "data.txt")
  local aws_host = string.format('%s.s3.amazonaws.com', req_params.bucket)
  
  local headers = lua_aws.aws_request_enrich({
    region = req_params.region or "us-east-1",
    headers = {
      ['Content-Type'] = req_params.content_type or "text/plain",
      ['Host'] = aws_host
    },
    uri = s3_key,
    key_id = req_params.aws_key_id,
    secret_key = req_params.aws_secret_key,
    method = 'PUT',
  }, req_params.content)
  
  rspamd_http.request({
    url = string.format("https://%s%s", aws_host, s3_key),
    method = 'PUT',
    body = req_params.content,
    headers = headers,
    callback = s3_callback,
    task = task,
    timeout = 30.0,
  })
end
```

### Error Handling

Implement comprehensive error handling:

```lua
local function robust_handler(task, conn, req_params)
  local ok, result = pcall(function()
    -- Potentially failing operation
    return process_complex_request(req_params)
  end)
  
  if not ok then
    rspamd_logger.errx(task, "Handler error: %s", result)
    conn:send_error(500, "Internal server error")
    return
  end
  
  conn:send_ucl({ success = true, data = result })
end
```

## Plugin Registration System

### Automatic Registration

Plugins are automatically loaded from:
1. `rules/controller/*.lua` - Default plugins
2. `local.d/controller.lua` - Local overrides

### Registration Process

The controller scans for plugins during startup:

```lua
-- In rules/controller/init.lua
local controller_plugin_paths = {
  maps = dofile(local_rules .. "/controller/maps.lua"),
  neural = dofile(local_rules .. "/controller/neural.lua"),
  selectors = dofile(local_rules .. "/controller/selectors.lua"),
  fuzzy = dofile(local_rules .. "/controller/fuzzy.lua"),
}

-- Local overrides
if rspamd_util.file_exists(local_conf .. '/controller.lua') then
  local overrides = dofile(local_conf .. '/controller.lua')
  controller_plugin_paths = lua_util.override_defaults(
    controller_plugin_paths, overrides)
end
```

### Custom Plugin Registration

#### User-Defined Controller Configuration

Users can create `local.d/controller.lua` to add custom endpoints or override existing ones. This file is automatically loaded by the controller initialization system.

**File Location**: `local.d/controller.lua` (in Rspamd configuration directory)

**Format**: The file should return a table mapping plugin names to their endpoint definitions:

```lua
-- local.d/controller.lua

-- Define custom endpoint handlers
local function handle_custom_status(task, conn, req_params)
  local status = {
    server_time = os.time(),
    custom_metric = get_custom_metric(),
    environment = req_params.env or "production"
  }
  conn:send_ucl({ success = true, status = status })
end

local function handle_custom_reload(task, conn, req_params)
  if not req_params.component then
    conn:send_error(400, "component parameter required")
    return
  end
  
  -- Perform custom reload logic
  local result = reload_custom_component(req_params.component)
  conn:send_ucl({ success = result, component = req_params.component })
end

-- Return plugin definitions
return {
  -- Override existing plugin with custom implementation
  maps = dofile("/usr/local/etc/rspamd/custom/enhanced_maps.lua"),
  
  -- Add completely new plugin
  custom_admin = {
    status = {
      handler = handle_custom_status,
      enable = false,        -- Normal password sufficient
      need_task = false,
    },
    reload = {
      handler = handle_custom_reload,
      enable = true,         -- Requires privileged password
      need_task = false,
    },
  },
  
  -- Load plugin from external file
  monitoring = dofile("/opt/company/rspamd/monitoring_endpoints.lua"),
}
```

#### Redis Configuration in Controllers

When using Redis in controller endpoints, initialize the configuration at module level:

```lua
-- local.d/controller.lua
local lua_redis = require "lua_redis"

-- Redis configuration initialization
local redis_params = nil

local function init_redis()
  local opts = rspamd_config:get_all_opt('controller_redis')
  if opts then
    redis_params = lua_redis.parse_redis_server('controller_redis')
  end
end

-- Initialize Redis when module loads
init_redis()

local function handle_redis_data(task, conn, req_params)
  if not redis_params then
    conn:send_error(503, "Redis not available")
    return
  end
  
  local attrs = {
    task = task,
    callback = function(err, data)
      if err then
        conn:send_error(500, "Redis error: " .. err)
      else
        conn:send_ucl({ success = true, data = data })
      end
    end,
    is_write = false,
    key = req_params.cache_key
  }
  
  lua_redis.request(redis_params, attrs, {'GET', req_params.cache_key})
end

return {
  cache = {
    get = {
      handler = handle_redis_data,
      enable = false,
      need_task = false,
    }
  }
}
```

#### Plugin Override Behavior

The system uses `lua_util.override_defaults()` to merge configurations:

- **Existing plugins**: Can be completely replaced by providing a new definition
- **New plugins**: Added alongside default plugins
- **Individual endpoints**: Cannot be selectively overridden - entire plugin must be replaced

#### Practical Examples

**Example 1: Simple Custom Endpoints**

```lua
-- local.d/controller.lua

local rspamd_logger = require "rspamd_logger"
local rspamd_util = require "rspamd_util"

local function handle_server_info(task, conn, req_params)
  local info = {
    hostname = rspamd_util.get_hostname(),
    version = rspamd_version,
    uptime = rspamd_util.get_uptime(),
    worker_pid = rspamd_util.get_pid(),
    memory_usage = rspamd_util.get_memory_usage(),
  }
  
  rspamd_logger.infox(rspamd_config, "Server info requested from %s", 
                      conn:get_peer_addr())
  
  conn:send_ucl({ success = true, server_info = info })
end

local function handle_custom_metrics(task, conn, req_params)
  -- Collect custom application metrics
  local metrics = collect_application_metrics()
  
  conn:send_ucl({
    success = true,
    timestamp = os.time(),
    metrics = metrics
  })
end

return {
  system_info = {
    info = {
      handler = handle_server_info,
      enable = false,           -- Read-only information
      need_task = false,
    },
    metrics = {
      handler = handle_custom_metrics,
      enable = true,            -- May contain sensitive data
      need_task = false,
    },
  }
}
```

This creates endpoints:
- `GET /plugins/system_info/info` - Server information (normal password)
- `GET /plugins/system_info/metrics` - Custom metrics (privileged password)

**Example 2: External Configuration Management**

```lua
-- local.d/controller.lua

local config_manager = dofile("/etc/rspamd/custom/config_manager.lua")

return {
  -- Replace default maps with enhanced version
  maps = dofile("/etc/rspamd/custom/enhanced_maps.lua"),
  
  -- Add configuration management endpoints
  config = config_manager.get_endpoints(),
  
  -- Add monitoring endpoints loaded from external system
  monitoring = dofile("/opt/monitoring/rspamd_endpoints.lua"),
}
```

**Example 3: Development/Debug Endpoints**

```lua
-- local.d/controller.lua

-- Only add debug endpoints in development
local environment = os.getenv("RSPAMD_ENV") or "production"

local endpoints = {}

if environment == "development" then
  local function handle_debug_symbols(task, conn, req_params)
    task:process_message()
    local symbols = task:get_symbols()
    
    conn:send_ucl({
      success = true,
      debug_info = {
        symbols = symbols,
        meta = task:get_meta(),
        headers = task:get_raw_headers(),
      }
    })
  end
  
  endpoints.debug = {
    symbols = {
      handler = handle_debug_symbols,
      enable = true,            -- Debug info is sensitive
      need_task = true,         -- Needs message content
    }
  }
end

-- Always available admin endpoints
local function handle_cache_clear(task, conn, req_params)
  clear_application_cache()
  conn:send_ucl({ success = true, message = "Cache cleared" })
end

endpoints.admin = {
  clear_cache = {
    handler = handle_cache_clear,
    enable = true,              -- Administrative operation
    need_task = false,
  }
}

return endpoints
```

#### Loading External Files

When loading endpoints from external files, ensure they return the expected format:

```lua
-- /opt/company/rspamd/monitoring_endpoints.lua

local rspamd_http = require "rspamd_http"

local function handle_health_check(task, conn, req_params)
  -- Async health check of external services
  rspamd_http.request({
    url = "http://internal-api:8080/health",
    method = "GET",
    timeout = 5.0,
    callback = function(err, response)
      if err or response.code ~= 200 then
        conn:send_error(503, "External service unavailable")
      else
        conn:send_ucl({ 
          success = true, 
          external_status = "healthy",
          response_time = response.elapsed 
        })
      end
    end,
    task = task,
    ev_base = task:get_ev_base(),
  })
end

-- Return endpoints table
return {
  health = {
    handler = handle_health_check,
    enable = false,             -- Health checks are generally public
    need_task = false,
  }
}
```

#### Best Practices for Custom Controllers

1. **Namespace your plugins** to avoid conflicts with future Rspamd updates
2. **Use descriptive handler names** for easier debugging
3. **Validate input parameters** thoroughly
4. **Log significant actions** for audit trails
5. **Handle errors gracefully** with appropriate HTTP status codes
6. **Use async operations** for external dependencies
7. **Document your custom endpoints** for team members

#### Security Considerations

- **Sensitive operations**: Always use `enable = true` for administrative functions
- **Input validation**: Validate all parameters to prevent injection attacks
- **Audit logging**: Log access to sensitive endpoints
- **Error messages**: Don't expose internal details in error responses
- **Rate limiting**: Consider implementing rate limiting for resource-intensive endpoints

## Best Practices

### 1. Error Handling
- Always validate input parameters
- Use appropriate HTTP status codes
- Provide meaningful error messages
- Log errors for debugging

### 2. Response Format
- Use consistent JSON structure
- Include `success` field for status
- Provide descriptive field names
- Handle empty results gracefully

### 3. Performance
- Cache expensive computations
- Use `need_task = false` when possible
- Implement pagination for large datasets
- Consider async operations for slow tasks

### 4. Security
- Validate all inputs
- Sanitize user data
- Use schema validation
- Be cautious with file operations

### 5. Documentation
- Document endpoint parameters
- Provide usage examples
- Describe return formats
- Note any special requirements

## Testing Endpoints

### Manual Testing with curl

```bash
# Test simple endpoint
curl "http://localhost:11334/plugins/example/hello?param=value"

# Test with authentication
curl -H "Password: your-password" \
     "http://localhost:11334/plugins/example/data"

# Test POST with JSON
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Password: your-password" \
     -d '{"key": "value"}' \
     "http://localhost:11334/plugins/example/process"
```

### Functional Testing

Create test cases in the functional test suite using async HTTP API:

```lua
-- test/functional/lua/controller_test.lua
local rspamd_http = require "rspamd_http"

local function test_custom_endpoint()
  local function http_callback(err, response)
    if err then
      error("HTTP request failed: " .. err)
    end
    
    -- Assert expected response
    assert(response.code == 200)
    assert(response.content:match("success"))
  end
  
  rspamd_http.request({
    url = "http://127.0.0.1:11334/plugins/example/hello",
    method = "GET",
    headers = {
      ["Content-Type"] = "application/json",
      ["Password"] = "test_password"  -- Add authentication if needed
    },
    callback = http_callback,
    task = task,    -- Pass task if available
    timeout = 5.0,
  })
end

-- Example with POST data
local function test_custom_post_endpoint()
  local function http_callback(err, response)
    if err then
      error("HTTP POST failed: " .. err)
    end
    
    local ucl = require "ucl"
    local parser = ucl.parser()
    parser:parse_string(response.content)
    local data = parser:get_object()
    
    assert(data.success == true)
    assert(data.processed_count > 0)
  end
  
  rspamd_http.request({
    url = "http://127.0.0.1:11334/plugins/example/process",
    method = "POST",
    headers = {
      ["Content-Type"] = "application/json",
      ["Password"] = "enable_password"  -- Privileged endpoint
    },
    body = require("ucl").to_format({
      items = {"item1", "item2", "item3"},
      operation = "batch_process"
    }, "json"),
    callback = http_callback,
    task = task,
    timeout = 10.0,
  })
end
```

## Debugging

### Logging in Handlers

```lua
local rspamd_logger = require "rspamd_logger"

local function debug_handler(task, conn, req_params)
  rspamd_logger.infox(task, "Handler called with params: %s", 
                      req_params)
  
  -- Log error conditions
  if not req_params.required_param then
    rspamd_logger.warnx(task, "Missing required parameter")
    conn:send_error(400, "Missing required parameter")
    return
  end
  
  -- Debug processing
  rspamd_logger.debugx(task, "Processing request for: %s", 
                       req_params.item)
end
```

### Common Issues

1. **Endpoint not found**: Check plugin registration in `init.lua`
2. **Authentication failures**: 
   - Verify password configuration in worker config
   - Check if `enable = true` endpoints require privileged password
   - Ensure correct password headers are sent
3. **Task errors**: Ensure `need_task = true` when accessing message content
4. **JSON parsing errors**: Validate input format and encoding
5. **Permission errors**: Check file system permissions for maps/static files
6. **Enable flag confusion**: 
   - `enable = false` allows normal password access
   - `enable = true` requires privileged (enable) password
   - Flag controls authentication level, not endpoint availability

## Conclusion

The Rspamd controller provides a powerful framework for extending WebUI functionality through Lua plugins. By following the patterns and best practices outlined in this guide, you can create robust, secure, and efficient endpoints that integrate seamlessly with the existing system.

For more examples, examine the existing plugins in the `rules/controller/` directory and refer to the Rspamd Lua API documentation for detailed information about available functions and objects. 