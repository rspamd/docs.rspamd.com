---
title: Metadata exporter
---


# Metadata exporter

The Metadata exporter operates on a set of rules that identify interesting messages, and subsequently sends information based on these rules to an external service. The exporter supports Redis Pub/Sub, HTTP POST, and SMTP as built-in backends, while also allowing users to define custom backends as desired.

Potential applications of the Metadata exporter include quarantining, logging, alerting, and feedback loops.

### Theory of operation

For each rule defined in configuration:

 - A `selector` function identifies messages that we want to export metadata from (default selector selects all messages).
 - A `formatter` function extracts formatted metadata from the message (default formatter returns full message content).
 - A `pusher` function (defined by the `backend` setting) pushes the formatted metadata somewhere

A number of such functions are defined in the plugin which can be used in addition to user-defined functions.

### Configuration

~~~hcl
metadata_exporter {

  # Each rule defines some export process

  rules {

    # The following rule posts JSON-formatted metadata at the defined URL
    # when it sees a rejected mail from an authenticated user
    MY_HTTP_ALERT_1 {
      backend = "http";
      url = "http://127.0.0.1:8080/foo";
      # More about selectors and formatters later
      selector = "is_reject_authed";
      formatter = "json";
    }

    # This rule posts all messages to a Redis Pub/Sub channel
    MY_REDIS_PUBSUB_1 {
      backend = "redis_pubsub";
      channel = "foo";
      # Default formatter and selector is used
    }

    # This rule sends an e-Mail alert over SMTP containing message metadata
    # when it sees a rejected mail from an authenticated user
    MY_EMAIL_1 {
      backend = "send_mail";
      smtp = "127.0.0.1";
      mail_to = "user@example.com";
      selector = "is_reject_authed";
      formatter = "email_alert";
    }

  }

}
~~~

### Stock pushers (backends)

 - `http`: sends content over HTTP POST
 - `json_raw_tcp`: sends JSON content over a raw TCP connection
 - `redis_pubsub`: sends content over Redis Pub/Sub
 - `redis_stream` (4.0+): sends content to a Redis Stream
 - `send_mail`: sends content over SMTP

### Stock selectors

 - `default`: selects all mail
 - `is_spam`: matches messages with `reject`, `add header`, or `rewrite subject` action
 - `is_spam_authed`: matches messages with `reject`, `add header`, or `rewrite subject` action from authenticated users
 - `is_reject`: matches messages with `reject` action
 - `is_reject_authed`: matches messages with `reject` action from authenticated users
 - `is_not_soft_reject`: matches all messages except those with `soft reject` action

### Stock formatters

 - `default`: returns full message content
 - `email_alert`: generates an e-Mail report about the message
 - `json`: returns JSON-formatted metadata about a message
 - `multipart` (3.14.2+): Sends metadata as JSON part + raw message as `message/rfc822` part using standard `multipart/form-data`
 - `msgpack` (3.14.2+): Binary MessagePack format with embedded message (efficient for binary data)
 - `json_with_message` (3.14.2+): JSON with base64-encoded message
 - `structured` (4.0+): Rich structured export with Rspamd UUID correlation, extracted text, attachments, images, URLs in MessagePack format

### Settings: general

The following settings can be defined on any rule:

 - `selector`: defines selector for the rule
 - `formatter`: defines formatter for the rule
 - `backend`: defines backend (pusher) for the rule
 - `defer`: if true, `soft reject` action is forced on failed processing; since 4.2.2 this includes an `email_alert` that cannot be built (an invalid `mail_from`, no valid recipient, a part or a header that cannot be produced)
 - `timeout`: defines module timeout (default: '5s')

### Rule validation (4.2.2+) {#rule-validation}

Rules are validated when the configuration is loaded. A rule with an unknown option, an option of the wrong type, a missing required setting, an unknown selector, formatter or backend, or an invalid `email_parts` definition is disabled and the problem is reported, so `rspamadm configtest` fails instead of the rule misbehaving on the first message. Other rules keep working.

Rules of a [custom backend](#custom-functions) may carry options of their own: keys the built-in backends do not know are passed to the custom pusher in its `rule` argument, while known keys are still type-checked.

### Settings: `http` backend

 - `url` (required): defines the URL to post content to
 - `meta_header_prefix`: prefix for meta headers (default: `'X-Rspamd-'`)
 - `meta_headers` (bool): if set to `true`, general metadata is added to HTTP request headers (default: `false`). **Deprecated in 3.14.2**: Use `formatter = "multipart"` or `formatter = "msgpack"` instead.
 - `mime_type`: defines the MIME type of the content sent in the HTTP POST
 - `user` & `password`: if both parameters are set, Basic authentication will be used
 - `gzip` (bool): specifies whether the payload needs to be sent with gzip compression (default: `false`)
 - `keepalive` (bool): specifies whether the connection should use keepalive (default: `false`)
 - `no_ssl_verify` (bool): disable SSL certificate verification (default: `false`)
 - `connect_timeout`: timeout for establishing the TCP connection
 - `ssl_timeout`: timeout for SSL handshake
 - `write_timeout`: timeout for writing the request body
 - `read_timeout`: timeout for reading the response

### Settings: `redis_pubsub` backend

 - `channel` (required): defines Pub/Sub channel to post content to

See [here](/configuration/redis) for information on configuring Redis servers.

### Settings: `redis_stream` backend

*Available since version 4.0*

 - `stream_key` (required): defines Redis Stream key to append content to
 - `max_len`: optional maximum length for the stream (uses `MAXLEN ~` for approximate trimming)
 - `per_recipient`: if `true`, creates per-recipient streams by appending `:recipient@address` to `stream_key`

The backend uses Redis `XADD` command. This is useful for building event-driven pipelines with consumer groups.

### Settings: `json_raw_tcp` backend

 - `host` (required): hostname or IP address of the TCP server
 - `port` (required): TCP port to connect to

The backend sends the formatted content as-is over a raw TCP connection without an application-layer framing protocol. No response is read from the server. Combine with the `json` formatter to push newline-delimited JSON to a log aggregator or SIEM.

### Settings: `send_mail` backend

If the `send_mail` backend is used with the default formatter, the original spam message content will be analyzed by Rspamd and is highly likely matched as spam.

When `send_mail` backend is used in conjunction with `email_alert` formatter, the URLs found in the symbols options will be analysed by Rspamd and the report will be matched as spam possibly.

<mark>To prevent <b>looping</b>, it is essential to ensure that email messages from the Metadata exporter are <b>not scanned</b> by Rspamd.</mark> This can be achieved by setting up a specific Postfix Transport to bypass Rspamd, or by allowing the recipient of the `email_alert` to receive spam.

 - `smtp` (required): hostname of SMTP server
 - `mail_to` (required): recipient of e-mail alert
 - `mail_from`: Sender address (default empty)
 - `email_alert_user` (1.7.0+, default false): Send a copy of the alert to the authenticated SMTP username
 - `email_alert_sender` (1.7.0+, default false): Send a copy of the alert to the SMTP sender (NB: please ensure that it can be trusted)
 - `email_alert_recipients` (1.7.0+, default false): Send a copy of the alert to SMTP recipients (NB: please ensure they can be trusted; don't use this?)
 - `email_template`: template used for alert (default shown below)
 - `helo`: HELO to send (default 'rspamd')
 - `smtp_port`: SMTP port if not 25
 - `email_alert_sender_variable` (4.2.2+): name of a [variable](#variables-and-placeholders) whose value (an address or a list of addresses) gets an extra copy of the alert
 - `email_auto_encode_headers` (4.2.2+, default true): encode non-ASCII header values of the alert, see [Header encoding](#header-encoding)
 - `email_parts`, `email_parts_type`, `auto_grouping` (4.2.2+): build the alert as a multipart message, see [Multipart alerts](#multipart-alerts)
 - `connect_timeout`, `read_timeout`, `write_timeout` (4.2.2+): per-phase SMTP timeouts. Without them, `timeout` is a single budget for the whole SMTP transaction; setting any of them gives each connect, read and write its own timer, and unset ones fall back to `timeout`

The default value for `email_template` is as follows:

~~~
From: "Rspamd" <$mail_from>
To: $mail_to
Subject: Spam alert
Date: $date
MIME-Version: 1.0
Message-ID: <$our_message_id>
Content-type: text/plain; charset=utf-8
Content-Transfer-Encoding: 8bit

Authenticated username: $user
IP: $ip
Queue ID: $qid
SMTP FROM: $from
SMTP RCPT: $rcpt
MIME From: $header_from
MIME To: $header_to
MIME Date: $header_date
Subject: $header_subject
Message-ID: $message_id
Action: $action
Score: $score
Symbols: $symbols
~~~

Variables can be substituted according to general metadata keys described in the [General metadata](#general-metadata) section, and with [variables and selectors](#variables-and-placeholders).

#### Addresses (4.2.2+)

`mail_from` and `mail_to` may contain placeholders, so they are checked for every alert:

 - each `mail_to` entry, and each extra copy from `email_alert_user`, `email_alert_sender`, `email_alert_recipients` or `email_alert_sender_variable`, must be a valid address; invalid ones are dropped with an error in the log, and the alert is not sent if no recipient is left
 - `mail_from` must be a single valid address, or empty for the null sender
 - a bare local part such as `postmaster`, or a plain authenticated username, is accepted as is
 - a literal value (one without placeholders) that is not a valid address is reported when the configuration is loaded

#### SMTP delivery (4.2.2+)

The backend greets the server with `EHLO` and falls back to `HELO` if `EHLO` is rejected. When the server advertises `8BITMIME`, the message is sent with `BODY=8BITMIME`. Otherwise, as RFC 6152 requires, a message with 8-bit data is converted to 7-bit first: 8-bit text parts are re-encoded as quoted-printable, other 8-bit parts as base64, and nested multipart and `message/*` parts are processed recursively. A message that cannot be converted, such as one with raw 8-bit data in its headers, is not sent: the error is logged and `defer` applies. This matters mostly with the default formatter, which forwards the scanned message as it is.

Line endings are normalized to CRLF and lines starting with a dot are escaped, so message content cannot end the SMTP transaction early.

### Variables and placeholders (4.2.2+) {#variables-and-placeholders}

`email_template`, the `content` and `filename` of [`email_parts`](#multipart-alerts), and the per-message routing options `mail_from`, `mail_to`, `helo`, `channel` and `stream_key` can contain placeholders that are replaced for every message:

 - `$name` or `${name}`: a [general metadata](#general-metadata) key (in `email_template` and `email_parts`) or a variable
 - `${expr}`: anything else is evaluated as a [selector](/configuration/selectors) expression, for example `${from('smtp'):addr}`

Options that control where and how a rule connects (`url`, `host`, `port`, `smtp`, `smtp_port`, `user`, `password`, timeouts, booleans and so on) are never expanded, even if their value contains `$`: message data may decide who receives an export, but not where the rule connects.

Variables are defined in the `custom_variables` group, like [custom functions](#custom-functions): each one is Lua code returning a function that takes the task and returns a string, a number, a list of strings, or `nil`. Four variables are built in:

 - `content`: the full scanned message
 - `uid`: the first 6 characters of the task ID
 - `local_date`: the local date and time
 - `our_boundary`: a random MIME boundary

A custom variable with the name of a built-in one replaces it, and a warning is logged.

~~~hcl
metadata_exporter {
  custom_variables {
    # The authenticated user's mailbox, or nil for anonymous mail
    user_mailbox = <<EOD
return function(task)
  local user = task:get_user()
  if user then
    return user .. '@example.com'
  end
end
EOD;
    queue = "return function(task) return task:get_queue_id() or 'none' end";
  }

  rules {
    USER_ALERT {
      backend = "send_mail";
      formatter = "email_alert";
      smtp = "127.0.0.1";
      mail_from = "rspamd@example.com";
      mail_to = "postmaster@example.com";
      email_alert_sender_variable = "user_mailbox";
      email_template = <<EOD
From: <$mail_from>
To: $mail_to
Subject: Rejected message $queue

Queue ID $queue, envelope sender ${from('smtp'):addr}
EOD;
      selector = "is_reject";
    }
  }
}
~~~

How values are substituted:

 - Each variable is evaluated once per alert, so a value used in several places (such as `$our_boundary`) is the same everywhere. Variables the rule does not reference are not evaluated.
 - Values substituted into the alert's headers and into routing options are collapsed to a single line, so message data cannot add a header. In the template body and in `email_parts` content a variable keeps its value as is; selector results are always a single line. A list is joined with commas.
 - Replacement happens in one pass: text that comes from a substituted value is never expanded again, and a `$name` that matches nothing is left as written.
 - If a variable raises an error or returns nothing, or a selector extracts nothing, the placeholder is replaced with `((error extracting value))` and an error is logged.
 - The Lua code is compiled when the configuration is loaded: a syntax error, or code that does not return a function, is reported by `rspamadm configtest`.

### Multipart alerts (4.2.2+) {#multipart-alerts}

With `email_parts`, an `email_alert` becomes a `multipart/mixed` message (or `multipart/<email_parts_type>`) with one part per entry. If `email_template` has a body, that body becomes the first part and keeps its own `Content-Type`, `Content-Transfer-Encoding` and `Content-Disposition` headers, while the template's other headers stay at the top of the message.

`email_parts` is a list of tables with these keys:

 - `content`: literal text, as a string or a list of lines, with placeholders expanded as in `email_template`; the default `content_type` is `text/plain; charset=utf-8`
 - `content_from_variables`: the name (or a list of names) of variables whose raw value becomes the body, which suits binary data; a list value gives one line per element, and the default `content_type` is `application/octet-stream`
 - `content_type`: MIME type of the part, checked when the configuration is loaded
 - `filename`: attachment name, with placeholders expanded; non-ASCII names are encoded as RFC 2231 parameters
 - `disposition`: `inline` or `attachment` (default: `attachment` when there is a filename, `inline` otherwise)
 - `encoding`: the Content-Transfer-Encoding:
   - `auto` (default): `7bit` for ASCII text, `quoted-printable` for other text, `base64` for anything that is not `text/*`
   - `base64` or `quoted-printable`
   - `7bit` or `8bit`: switched to `quoted-printable` when the content would break them (8-bit data for `7bit`; NUL bytes or lines over 998 characters for both)

Exactly one of `content` and `content_from_variables` must be set. A part that cannot be built, for instance because its variable returns something that is not text, stops the alert.

`auto_grouping` (default `true`) wraps an inline `text/plain` part and an inline `text/html` part, counting the template's own body, in a `multipart/alternative`, plain text first. If these two are the only parts and `email_parts_type` is not set, the alert itself becomes `multipart/alternative`. More than one plain or HTML candidate is ambiguous and disables the rule: set `auto_grouping = false` to keep all parts side by side. Keep in mind that the default `email_template` has a `text/plain` body.

~~~hcl
metadata_exporter {
  rules {
    REPORT_WITH_ORIGINAL {
      backend = "send_mail";
      formatter = "email_alert";
      smtp = "127.0.0.1";
      mail_from = "rspamd@example.com";
      mail_to = "abuse@example.com";
      selector = "is_reject";
      # No body: the parts below make up the whole message
      email_template = <<EOD
From: <$mail_from>
To: $mail_to
Subject: Rejected: $header_subject
MIME-Version: 1.0
EOD;
      email_parts = [
        {
          content = "Score $score, action $action\n$symbols_sorted";
        },
        {
          content = "<p>Score <b>$score</b>, action $action</p>";
          content_type = "text/html; charset=utf-8";
        },
        {
          content_from_variables = "content";
          filename = "original-$qid.eml";
        }
      ];
    }
  }
}
~~~

The plain and HTML parts are grouped into a `multipart/alternative`, and the original message is attached next to them as a base64-encoded file.

### Header encoding (4.2.2+) {#header-encoding}

Header values can carry non-ASCII text, from the template or from substituted values, but SMTP only carries 8-bit data in message bodies. With `email_auto_encode_headers` (default `true`), the alert's headers are encoded as RFC 2047 encoded-words:

 - address headers (`From`, `To`, `Cc`, `Bcc`, `Sender`, `Reply-To` and their `Resent-` variants): display names, group names and comments are encoded, addresses are kept unchanged
 - structured headers (`Content-Type`, `Message-ID`, `Date`, `Received`, `DKIM-Signature` and the like) are never encoded, as encoded-words are not allowed there
 - any other header is unstructured text, and its non-ASCII words are encoded

Headers that need no encoding are kept exactly as written; encoded ones are folded to fit 76 characters per line. If non-ASCII data is left that cannot be encoded (a non-ASCII address, a structured header, or a content header of the template that moves into a part), the alert is not sent and an error is logged. Set `email_auto_encode_headers = false` to send headers as they are.

### General metadata

Metadata as returned by the `json` formatter can be referenced by key in `email_template` (and, since 4.2.2, in `email_parts`). The following keys are defined:

- `action`: metric action for message
- `date` (`email_template` only): date of the alert
- `from`: SMTP FROM
- `fuzzy`: fuzzy hashes of the message
- `header_date`: Contents of Date header(s)
- `header_from`: Contents of From header(s)
- `header_subject`: Contents of Subject header(s)
- `header_to`: Contents of To header(s)
- `ip`: IP of message sender
- `mail_from` (`email_template` only): sender of alert
- `mail_to` (`email_template` only): recipient of alert
- `message_id`: Message-ID of original message
- `our_message_id` (`email_template` only): message-ID generated for alert
- `qid`: Queue-ID of message provided by MTA
- `rcpt`: SMTP RCPT
- `rspamd_server`: hostname of the Rspamd server
- `scan_time`: scan time in milliseconds
- `score`: Metric score of the message
- `size`: size of the message in bytes
- `subject`: decoded Subject of the message
- `symbols`: Symbols in metric
- `symbols_score` (4.2.2+, `email_template` only): symbols sorted by score, highest first
- `symbols_sorted` (4.2.2+, `email_template` only): symbols sorted by name
- `user`: authenticated username of message sender

### Custom functions

It is possible to define custom selectors/pushers/backends. Functions are defined in the `custom_select`/`custom_format`/`custom_push` groups and referenced by name in the `selector`/`formatter`/`backend` settings. Since 4.2.2 the code is compiled when the configuration is loaded, so errors are reported by `rspamadm configtest`, and a custom backend receives in its `rule` argument the options of its rule, including ones the built-in backends do not know. [Variables](#variables-and-placeholders) are defined the same way in `custom_variables`.

~~~hcl
metadata_exporter {

  # Define custom selector(s)
  custom_select {
    mine = <<EOD
return function(task)
  -- Select all messages
  return true
end
EOD;
  }

  # Define custom formatter(s)
  custom_format {
    mine = <<EOD
return function(task)
  -- Push message ID
  return task:get_message_id()
end
EOD;
  }

  # Define custom backend(s)
  custom_push {
    mine = <<EOD
return function (task, data, rule)
  -- Log payload
  local rspamd_logger = require "rspamd_logger"
  rspamd_logger.infox(task, 'METATEST %s', data)
end
EOD;
  }

  rules {

    CUSTOM_EXPORT {
      selector = "mine";
      formatter = "mine";
      backend = "mine";
    }

  }

}
~~~

### Examples

#### Python Receiver for `multipart` formatter

This example demonstrates how to build a simple service using `aiohttp` that accepts metadata and messages sent by the `metadata_exporter` with `formatter = "multipart"`.

It conceptually shows how to quarantine messages to Kafka or Cassandra.

Prerequisites:
```bash
pip install aiohttp aiokafka cassandra-driver
```

receiver.py:
```python
import asyncio
import json
import logging
from aiohttp import web
# Optional: import for Kafka/Cassandra
# from aiokafka import AIOKafkaProducer
# from cassandra.cluster import Cluster

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rspamd-receiver")

async def handle_push(request):
    """
    Handle POST request from Rspamd metadata_exporter (multipart).
    Expected parts:
    - 'metadata': JSON object with Rspamd metadata
    - 'message': Raw message content (optional)
    """
    reader = await request.multipart()
    metadata = {}
    message_content = b""

    # Iterate through multipart fields
    async for field in reader:
        if field.name == 'metadata':
            # Parse metadata JSON
            try:
                raw_json = await field.read()
                metadata = json.loads(raw_json)
                logger.info(f"Received metadata for Message-ID: {metadata.get('message_id')}")
            except Exception as e:
                logger.error(f"Failed to parse metadata: {e}")
                return web.Response(status=400, text="Invalid Metadata")
        
        elif field.name == 'message':
            # Read raw message content
            message_content = await field.read()
            logger.info(f"Received message content ({len(message_content)} bytes)")
    
    if not metadata:
        return web.Response(status=400, text="Missing Metadata")

    # --- Quarantine Logic Example ---
    
    # 1. Kafka Example (Async)
    # await produce_to_kafka(metadata, message_content)
    
    # 2. Cassandra Example (Async)
    # await save_to_cassandra(metadata, message_content)
    
    logger.info("Message processed successfully")
    return web.Response(text="OK")

# Mock functions for illustration
async def produce_to_kafka(metadata, content):
    # producer = AIOKafkaProducer(bootstrap_servers='localhost:9092')
    # await producer.start()
    # try:
    #     await producer.send_and_wait("rspamd-quarantine", value=content, key=metadata.get('message_id').encode())
    # finally:
    #     await producer.stop()
    pass

async def save_to_cassandra(metadata, content):
    # loop = asyncio.get_event_loop()
    # cluster = Cluster(['127.0.0.1'])
    # session = cluster.connect('mail_quarantine')
    # stmt = "INSERT INTO messages (id, metadata, content) VALUES (%s, %s, %s)"
    # await loop.run_in_executor(None, session.execute, stmt, (metadata['message_id'], json.dumps(metadata), content))
    pass

app = web.Application()
app.add_routes([web.post('/push', handle_push)])

if __name__ == '__main__':
    web.run_app(app, port=8080)
```

Configure Rspamd to use this receiver:

```hcl
metadata_exporter {
  rules {
    QUARANTINE {
      backend = "http";
      url = "http://127.0.0.1:8080/push";
      selector = "is_reject"; # Export rejected messages
      formatter = "multipart"; # Send metadata + raw message
    }
  }
}
```

### Structured formatter (4.0+)

The `structured` formatter provides rich, analysis-ready metadata in MessagePack format with Rspamd UUID correlation:

~~~hcl
metadata_exporter {
  rules {
    STRUCTURED_EXPORT {
      backend = "redis_stream";
      formatter = "structured";
      stream_key = "rspamd:events";
      max_len = 10000;
      # Optional: compress text/attachments with zstd
      zstd_compress = true;
    }
  }
}
~~~

#### Structured formatter output fields

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | String | Rspamd internal message UUID (from `task:get_uuid()`) |
| `ip` | String | Sender IP address |
| `from` | String | SMTP envelope sender |
| `rcpt` | String | SMTP envelope recipient |
| `user` | String | Authenticated username |
| `score` | Number | Spam score |
| `action` | String | Rspamd action |
| `symbols` | Object | Symbol results |
| `text` | String/Binary | Extracted plain text (optionally zstd-compressed) |
| `text_truncated` | Boolean | True if text was truncated (max 32KB) |
| `text_compressed` | Boolean | True if text is zstd-compressed |
| `attachments` | Array | Attachment metadata with content |
| `images` | Array | Embedded image metadata with content |
| `urls` | Array | Extracted URLs with host/TLD |
| `is_reply` | Boolean | True if message has In-Reply-To header |

#### Structured formatter features

- **UUID correlation**: Rspamd's internal message UUID enables cross-system correlation via the injected `X-Rspamd-UUID` header
- **X-Rspamd-UUID header**: Automatically injected into message for IMAP/external correlation
- **Smart text extraction**: Cleaned, reply-trimmed text up to 32KB
- **Attachment analysis**: Includes detected MIME type (not just announced), size, digest, and optional content
- **URL extraction**: Up to 100 URLs with host and TLD information
- **Zstd compression**: Optional compression for text, attachments, and images to reduce storage

#### Zstd compression option

When `zstd_compress = true` is set:
- Text, attachment content, and image content are compressed with zstd
- Compressed fields include `content_compressed = true` or `text_compressed = true`
- Consumer must decompress using zstd library
