---
title: User settings
---

# Rspamd user settings

## Introduction

Rspamd offers the flexibility to apply various settings for scanned messages. Each setting can define a specific set of custom metric weights, symbol scores, actions scores, and the ability to enable or disable certain checks. These settings can be loaded as dynamic maps, allowing them to be updated automatically whenever the corresponding file or URL has changed since the last update.

To load settings as a dynamic map, you can set the 'settings' to a map string as follows:

~~~hcl
settings = "http://host/url"
~~~

If you prefer not to use dynamic updates, you can define settings as an object using the following format:

~~~hcl
settings {
	setting1 = {
	...
	}
	setting2 = {
	...
	}
}
~~~

To define static settings, you can edit the `local.d/settings.conf` file (from Rspamd 1.8 onwards). On the other hand, if you want to use a dynamic map for settings, it's recommended to define it in the override file `rspamd.conf.override`:

~~~hcl
settings = "http://host/url"
~~~

Alternatively, the settings apply part (see later) could be passed to Rspamd by a client through a query parameter:

~~~
POST /scanv2?settings="{symbol1 = 10.0}" HTTP/1.0
~~~

or HTTP header

~~~
POST /scanv2 HTTP/1.0
Settings: {symbol1 = 10.0}
~~~

Settings can also be indexed by ID, enabling the selection of a specific setting without the need to check its conditions. This feature can be used to split inbound and outbound mail flows by specifying different rulesets from the MTA side. Another use case for the settings ID option is to create dedicated lightweight checks for certain conditions, such as DKIM checks.

**Important note**: Using settings ID is optimal in terms of performance.

Let's assume we have the following settings in the configuration with an ID of `dkim`:

~~~hcl
# local.d/settings.conf
dkim {
	id = "dkim";
	apply {
		groups_enabled = ["dkim"];
	}
}
~~~

Afterwards, if we send a request with this settings ID using the HTTP protocol:

~~~
POST /scanv2 HTTP/1.0
Settings-ID: dkim
~~~

Then Rspamd will only check the DKIM rules and skip the other rules. Alternatively, you could test this setup using the `rspamc` command:

~~~
rspamc --header="settings-id=dkim" message.eml
~~~

## Settings structure

The settings file should contain a single section called "settings":

~~~hcl
# local.d/settings.conf
some_users {
	id = "some_users";
	priority = high;
	from = "@example.com";
	rcpt = "admin";
	rcpt = "/user.*/";
	ip = "172.16.0.0/16";
	user = "@example.net";
	request_header = {
		"MTA-Tag" = "\.example\.net$";
	}
	apply {
		symbol1 = 10.0;
		symbol2 = 0.0;
		actions {
			reject = 100.0;
			greylist = null; # Disable greylisting (from 1.8.1)
			"add header" = 5.0; # Please note the space, NOT an underscore
		}
	}
	# Always add these symbols when settings rule has matched
	symbols [
		"symbol2", "symbol4"
	]
}
whitelist {
	priority = low;
	rcpt = "postmaster@example.com";
	want_spam = yes;
}
# Disable some checks for authenticated users
authenticated {
	priority = high;
	authenticated = yes;
	apply {
		groups_disabled = ["rbl", "spf"];
	}
}
~~~

So each setting has the following attributes:

- `name` - section name that identifies this specific setting (e.g. `some_users`)
- `priority` - `high` (3), `medium` (2), `low` (1) or any positive integer value (default priority is `low`). Rules with greater priorities are matched first. Starting from version 1.4, Rspamd checks rules with equal priorities in **alphabetical** order. Once a rule matches, only that rule is applied, and the rest are ignored.
- `match list` - list of rules which this rule matches:
	+ `from` - match SMTP sender
	+ `from_mime` - match MIME sender
	+ `rcpt` - match SMTP recipient
	+ `rcpt_mime` - match MIME recipient
	+ `ip` - match source IP address
	+ `hostname` - match the source hostname (regexp supported)
	+ `user` - matches authenticated user ID of message sender if any
	+ `authenticated` - matches any authenticated user
	+ `local` - matches any local IP
	+ `request_header` - collection of request header names and regexes to match them against (condition is satisfied if any match)
	+ `header` - collection of MIME message header names and regexes to match them against (condition is satisfied if any match), available since Rspamd 1.7
	+ `selector` - apply the specific selector to check if we need to apply these settings. If selector returns non-nil, then the settings are applied (selector's value is ignored so far). Available since Rspamd 1.8.
- `apply` - list of applied rules
	+ `symbol` - modify weight of a symbol
	+ `actions` - defines actions
	+ `symbols_enabled` - array of symbols that should be checked (all other rules are disabled)
	+ `groups_enabled` - array of rules groups that should be checked (all other rules are disabled)
	+ `symbols_disabled` - array of disabled checks by symbol name (all other rules are enabled)
	+ `groups_disabled` - array of disabled checks by group name (all other rules are enabled)
	+ `subject` - set subject based on the new pattern: `%s` is replaced with the existing subject, `%d` is replaced with the message's spam score (e.g. `subject = "SPAM: %s (%d)"`)
- `symbols` - add symbols from the list if a rule has matched
- `inverse` - inverse match (e.g. it will NOT match when all elements are matched and vice-versa)

If `symbols_enabled` or `groups_enabled` are found in `apply` element, then Rspamd disables all checks with the exception of the enabled ones. When `enabled` and `disabled` options are both presented, then the precedence of operations is the following:

1. Disable all symbols
2. Enable symbols from `symbols_enabled` and `groups_enabled`
3. Disable symbols from `symbols_disabled` and `groups_disabled`

Certain rules, like `metadata exporter`, `history redis`, or `clickhouse`, are labeled as `explicit_disable`. This means that even if you enable specific symbols in `symbols_enabled`, these rules will still be executed. This behavior is intentional as enabling specific checks should not interfere with data exporting or history logging.

**Important notice**: This is **NOT** applicable to `want_spam` option. This option disable **ALL** Rspamd rules, even history or data exporting. Actually, it is a full bypass of all Rspamd processing.

### Settings match

The match section performs `AND` operation on different matches: for example, if you have `from` and `rcpt` in the same rule, then the rule matches only when `from` `AND` `rcpt` match. For similar matches, the `OR` rule applies: if you have multiple `rcpt` matches, then *any* of these will trigger the rule. If a rule is triggered then no more rules are matched.

By default, regular expressions are case-sensitive. This can be changed with the `i` flag. 
Regexp rules can be slow and should not be used extensively.

In order to make matching case-insensitive, string comparisons convert input strings to lowercase. Thus, strings in the match lists should always be in lowercase.

The picture below describes the architecture of settings matching.

<img class="img-fluid" width="50%" src="/img/settings.png">

### Redis settings

Storing settings in Redis offers a highly flexible way to apply settings and eliminates the need to reload a map.

To utilize settings in Redis, we create one or more handlers in Lua, each of which may return a key. If a key is returned and exists in Redis, its value is used as the settings. The value of the key should be formatted similarly to the contents of the `apply` block or settings posted in headers.

Let's consider a scenario where we want to base our settings on the domain of the first SMTP recipient.

We can set our keys as follows:
~~~
127.0.0.1:6379> SET "setting:example.com" "{symbol1 = 5000;}"
OK
~~~

Where "setting:" is a prefix we have chosen for our settings and "example.com" is the recipient domain we want to apply settings to and the value of the key contains our desired settings.

We would then define configuration as follows in `/etc/rspamd/rspamd.conf.override`:

~~~hcl
# Redis settings are configured in a "settings_redis" block
settings_redis {
  # Here we will define our Lua functions
  handlers = {
    # Everything in here is a Lua function with an arbitrary name
my_check_rcpt_domain = <<EOD
return function(task)
  local rcpt = task:get_recipients('smtp')
  -- Return nothing if we can't find domain of first SMTP recipient
  if not (rcpt and rcpt[1] and rcpt[1]['domain']) then return end
  -- Return "setting:" concatenated with the domain
  local key = 'setting:' .. rcpt[1]['domain']
  return key
  -- From Rspamd 1.6.3 this function can return a list of keys to check.
  -- Use this if you need to check for settings according to priority:
  return {key, 'setting:global'}
end
EOD;
  }
}
~~~

Redis servers are configured as per usual - see [here](/configuration/redis) for details.

## External Map for Dynamic Settings

Rspamd's settings system can retrieve dynamic configuration from external sources using the external map feature. When a settings rule includes an `external_map` block, Rspamd will query an external data source for settings that will be applied to the task.

### How It Works

The external_map feature works as follows:

1. **Selector Evaluation**: When a settings rule matches, the selector is evaluated with the current task to produce key-value pairs.
2. **Map Query**: The external map is queried using these key-value pairs as the request data.
3. **Response Processing**: If the map returns data, it is parsed as UCL and applied as settings to the task.

### Configuration Structure

The `external_map` block requires two components:

- **map**: Map definition specifying the external data source
- **selector**: A [selector expression](/configuration/selectors) that generates key-value pairs for the request

**Important**: The selector must return an even number of elements that form key-value pairs. Odd elements become keys, even elements become values. Use the `id('key')` selector to specify constant keys.

### Map Types

External maps support several backends:

#### HTTP Backend

~~~hcl
external_map = {
  map = {
    external = true;
    backend = "http://settings.example.com/api";
    method = "body";        # "body", "header", or "query" 
    encode = "json";        # "json" or "messagepack"
    timeout = 5.0;          # optional timeout in seconds
  }
  selector = "id('user');user;id('from');from('smtp'):addr";
}
~~~

For HTTP maps:
- `method = "body"`: Key-value pairs are sent in request body as POST request (encoded as specified)
- `method = "header"`: Key-value pairs are sent as HTTP headers
- `method = "query"`: Key-value pairs are sent as query parameters

#### CDB Backend

CDB is a constant key-value database that can be used to store settings locally

~~~hcl
external_map = {
  map = {
    external = true;
    cdb = "/path/to/settings.cdb";
  }
  selector = "id('user');user;id('domain');from('smtp'):domain";
}
~~~

### Selector Format

The selector must return key-value pairs using the following format:
- Use `id('key_name')` to specify literal keys
- Separate key-value pairs with semicolons (`;`)
- Example: `id('user');user;id('from');from('smtp'):addr`

This selector would create the following data structure:
```json
{
  "user": "authenticated_username",
  "from": "sender@example.com"
}
```

### Response Format

The external map must return valid UCL data representing settings to apply:

~~~json
{
  "symbols": {
    "CUSTOM_SYMBOL": 10.0
  },
  "actions": {
    "reject": 15.0
  },
  "subject": "SPAM: %s"
}
~~~

### Complete Example

~~~hcl
# local.d/settings.conf
dynamic_user_settings {
  id = "dynamic_user_settings";
  priority = medium;
  authenticated = yes;
  
  external_map = {
    map = {
      external = true;
      backend = "http://settings-api.example.com/user-settings";
      method = "body";
      encode = "json";
      timeout = 2.0;
    }
    # Creates key-value pairs: {user: "username", ip: "client_ip"}
    selector = "id('user');user;id('ip');ip";
  }
}

# Settings based on sender domain and recipient count
domain_specific_settings {
  priority = low;
  
  external_map = {
    map = {
      external = true;
      cdb = "/etc/rspamd/domain_settings.cdb";
    }
    # Creates key-value pairs: {domain: "example.com", rcpt_count: "2"}
    selector = "id('domain');from('smtp'):domain;id('rcpt_count');rcpts:addr.len";
  }
}
~~~

### Error Handling

- If the selector returns nil or an odd number of elements, the external map query is skipped
- If the external map returns an error or no data, the request is logged and processing continues
- If the response cannot be parsed as UCL, an error is logged and no settings are applied

### Performance Considerations

- External map queries are asynchronous and won't block message processing
- Use appropriate timeouts to prevent slow external services from affecting performance
- Consider caching on the external service side for frequently queried keys
- CDB maps offer better performance than HTTP for static datasets

## Example HTTP Server

Here's a complete example of a Python HTTP server that can handle external map requests from Rspamd:

### Server Implementation

```python
#!/usr/bin/env python3
"""
Example HTTP server for Rspamd external settings maps
Supports different HTTP methods and database backend
"""

from flask import Flask, request, jsonify
import sqlite3
import json
import msgpack
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Database setup
def init_db():
    conn = sqlite3.connect('settings.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_settings (
            user TEXT,
            domain TEXT,
            settings TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user, domain)
        )
    ''')
    
    # Insert some example data
    examples = [
        ('user@example.com', 'example.com', {
            'symbols': {'CUSTOM_USER_SYMBOL': 5.0},
            'actions': {'reject': 20.0}
        }),
        ('admin@example.com', 'example.com', {
            'symbols': {'ADMIN_SYMBOL': -10.0},
            'actions': {'reject': 50.0}
        }),
        (None, 'spam.domain.com', {
            'symbols': {'SPAM_DOMAIN': 15.0},
            'actions': {'reject': 5.0}
        })
    ]
    
    for user, domain, settings in examples:
        cursor.execute(
            'INSERT OR REPLACE INTO user_settings (user, domain, settings) VALUES (?, ?, ?)',
            (user, domain, json.dumps(settings))
        )
    
    conn.commit()
    conn.close()

def get_settings(data):
    """Retrieve settings from database based on key-value data"""
    conn = sqlite3.connect('settings.db')
    cursor = conn.cursor()
    
    # Build query based on available data
    conditions = []
    params = []
    
    if 'user' in data:
        conditions.append('user = ?')
        params.append(data['user'])
    
    if 'domain' in data:
        conditions.append('domain = ?')
        params.append(data['domain'])
    
    if not conditions:
        return None
    
    query = 'SELECT settings FROM user_settings WHERE ' + ' AND '.join(conditions)
    cursor.execute(query, params)
    result = cursor.fetchone()
    conn.close()
    
    if result:
        return json.loads(result[0])
    return None

@app.route('/settings', methods=['POST'])
def handle_settings():
    """Handle settings requests from Rspamd"""
    data = None
    
    # Parse request data based on content type
    content_type = request.headers.get('Content-Type', '')
    
    if 'application/json' in content_type:
        data = request.get_json()
    elif 'application/x-msgpack' in content_type:
        try:
            data = msgpack.unpackb(request.data)
        except:
            app.logger.error("Failed to decode msgpack data")
            return jsonify({'error': 'Invalid msgpack data'}), 400
    else:
        # Try to parse as form data for query method
        data = dict(request.form) or dict(request.args)
    
    if not data:
        app.logger.warning("No data provided in request")
        return jsonify({'error': 'No data provided'}), 400
    
    app.logger.info(f"Looking up settings for data: {data}")
    
    # Get settings from database
    settings = get_settings(data)
    
    if settings:
        app.logger.info(f"Found settings for data: {data}")
        return jsonify(settings)
    else:
        app.logger.info(f"No settings found for data: {data}")
        return jsonify({'error': 'Settings not found'}), 404

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=8080, debug=True)
```

### Database Schema

```sql
-- settings.db schema
CREATE TABLE user_settings (
    user TEXT,
    domain TEXT,
    settings TEXT NOT NULL,  -- JSON string of settings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user, domain)
);

-- Example data
INSERT INTO user_settings (user, domain, settings) VALUES 
('user@example.com', 'example.com', '{"symbols": {"CUSTOM_USER": 5.0}, "actions": {"reject": 20.0}}'),
('admin@example.com', 'example.com', '{"symbols": {"ADMIN_SYMBOL": -10.0}, "actions": {"reject": 50.0}}'),
(NULL, 'spam.domain.com', '{"symbols": {"SPAM_DOMAIN": 15.0}, "actions": {"reject": 5.0}}');
```

### Rspamd Configuration

```hcl
# local.d/settings.conf
user_based_settings {
  priority = high;
  authenticated = yes;
  
  external_map = {
    map = {
      external = true;
      backend = "http://localhost:8080/settings";
      method = "body";
      encode = "json";
      timeout = 2.0;
    }
    selector = "id('user');user;id('domain');from('smtp'):domain";
  }
}

domain_based_settings {
  priority = medium;
  
  external_map = {
    map = {
      external = true;
      backend = "http://localhost:8080/settings";
      method = "body";
      encode = "json";
      timeout = 2.0;
    }
    selector = "id('domain');from('smtp'):domain";
  }
}
```

### Testing the Server

```bash
# Install dependencies
pip install flask msgpack

# Run the server
python3 settings_server.py

# Test with curl
curl -X POST http://localhost:8080/settings \
  -H "Content-Type: application/json" \
  -d '{"user": "user@example.com", "domain": "example.com"}'

# Test domain-only lookup
curl -X POST http://localhost:8080/settings \
  -H "Content-Type: application/json" \
  -d '{"domain": "spam.domain.com"}'
```

### Production Considerations

For production use, consider:

1. **Authentication**: Add API key authentication
2. **Rate limiting**: Implement request rate limiting
3. **Caching**: Add Redis or memory caching for frequently accessed settings
4. **Database**: Use PostgreSQL or MySQL for better performance
5. **Monitoring**: Add metrics and logging
6. **SSL/TLS**: Use HTTPS for secure communication

```python
# Example with Redis caching
import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_settings_cached(data):
    cache_key = f"settings:{json.dumps(data, sort_keys=True)}"
    
    # Try cache first
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Get from database
    settings = get_settings(data)
    if settings:
        # Cache for 5 minutes
        redis_client.setex(cache_key, 300, json.dumps(settings))
    
    return settings
```

This example provides a complete working HTTP server that can handle the key-value pairs sent by Rspamd's external map feature and can be easily extended for production use.
