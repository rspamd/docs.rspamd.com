---
title: Rspamd protocol
---

# Rspamd protocol



## Protocol basics

Rspamd employs the HTTP protocol, specifically versions 1.0 or 1.1. Rspamd defines some headers which allow the passing of extra information about a scanned message, such as envelope data, IP address or SMTP SASL authentication data, etc. Rspamd supports normal and chunked encoded HTTP requests.

## Rspamd HTTP request

Rspamd encourages the use of the HTTP protocol due to its universality and compatibility with virtually every programming language, without the need for obscure libraries. A typical HTTP request takes the following form:

```
  POST /checkv2 HTTP/1.0
  Content-Length: 26969
  From: smtp@example.com
  Pass: all
  Ip: 95.211.146.161
  Helo: localhost.localdomain
  Hostname: localhost

  <your message goes here>
```

For added flexibility, chunked encoding can be utilized, streamlining data transfer, particularly when the message length is unknown.

## Rspamd protocol encryption

Rspamd supports encryption by means of lightweight protocol called HTTPCrypt. For comprehensive technical details about the cryptographic primitives, key exchange, and protocol implementation, see the [Encryption Documentation](encryption.md). You can also find the original protocol specification in this [paper](https://highsecure.ru/httpcrypt.pdf).

To enable encryption, you need to generate a keypair and configure it in the corresponding worker's section (e.g. `worker-controller.inc` or `worker-normal.inc` or, even, in `worker-proxy.inc`):

```
$ rspamadm keypair

keypair {
    privkey = "e4gr3yuw4xiy6dikdpqus8cmxj8c6pqstt448ycwhewhhrtxdahy";
    id = "gnyieumi6sp6d3ykkukep9yuaq13q4u6xycmiqaw7iahsrz97acpposod1x8zogynnishtgxr47o815dgsz9t69d66jcm1drjei4a5d";
    pubkey = "fg8uwtce9sta43sdwzddb11iez5thcskiufj4ug8esyfniqq5iiy";
    type = "kex";
    algorithm = "curve25519";
    encoding = "base32";
}
```

Regrettably, the HTTPCrypt protocol hasn't gained widespread adoption among popular libraries. Nonetheless, you can effectively utilize it with the `rspamc` client and various internal clients, including Rspamd's proxy, which can serve as an encryption bridge for conducting spam scans via Rspamd. 
Moreover, you have the option to employ Nginx for SSL termination on behalf of Rspamd. While Rspamd's client-side components (e.g., proxy or `rspamc`) offer native support for SSL encryption, it's important to note that SSL support on the server side is not currently available.

### HTTP request

Normally, you should just use `/checkv2` here. However, if you want to communicate with the controller then you might want to use [controller commands](#controller-http-endpoints).

### HTTP headers

To minimize redundant processing, Rspamd enables an MTA to transmit pre-processed message data using HTTP headers. Rspamd accommodates the following non-standard HTTP headers:

| Header          | Description                       |
| :-------------- | :-------------------------------- |
| `Deliver-To` | Defines actual delivery recipient of message. Can be used for personalized statistics and for user specific options. |
| `IP`         | Defines IP from which this message is received. |
| `Helo`       | Defines SMTP helo |
| `Hostname`   | Defines resolved hostname |
| `Flags`      | Supported from version 2.0: Defines output flags as a commas separated list: `pass_all` (pass all filters), `groups` (return symbols groups), `zstd` (compressed input/output), `no_log` (do not log task), `milter` (apply milter protocol related hacks), `profile` (profile performance for this task), `body_block` (accept rewritten body as a separate part of reply, see [Body block section](#body-block-rewritten-message)), `ext_urls` (extended urls information), `skip` (skip all filters processing), `skip_process` (skip mime parsing/processing) |
| `From`       | Defines SMTP mail from command data |
| `Queue-Id`   | Defines SMTP queue id for message (can be used instead of message id in logging). |
| `Raw`        | If set to `yes`, then Rspamd assumes that the content is not MIME and treat it as raw data. |
| `Rcpt`       | Defines SMTP recipient (there may be several `Rcpt` headers) |
| `Pass`       | If this header has `all` value, all filters would be checked for this message. |
| `Subject`    | Defines subject of message (is used for non-mime messages). |
| `User`       | Defines username for authenticated SMTP client. |
| `Settings-ID` | Defines [settings id](/configuration/settings) to apply. |
| `Settings` | Defines list of rules ([settings](/configuration/settings) `apply` part) as raw json block to apply. |
| `User-Agent` | Defines user agent (special processing if it is `rspamc`). |
| `MTA-Tag` | MTA defined tag (can be used in settings). |
| `MTA-Name` | Defines MTA name, used in `Authentication-Results` routines. |
| `TLS-Cipher` | Defines TLS cipher name. |
| `TLS-Version` | Defines TLS version. |
| `TLS-Cert-Issuer` | Defines Cert issuer, can be used in conjunction with `client_ca_name` in [proxy worker](/workers/rspamd_proxy). |
| `URL-Format` | Supported from version 1.9: return all URLs and email if this header is `extended`. |
| `Filename` | Hint for filename if used with some file. |
| `Log` | If set to `no` or `false`, disables logging for this task (equivalent to `no_log` flag). |
| `Log-Tag` | Sets custom log tag for the task. Useful for correlating logs across different systems (e.g., using MTA's Queue-ID). See [logging documentation](/configuration/logging#log-tag-propagation-in-proxy-mode). |
| `Milter` | If set to `yes`, enables milter-specific processing behaviors. |
| `Mailer` | Defines the mailer software name (received from MTA via milter `{rcpt_mailer}` macro). |
| `Compression` | Specifies input compression algorithm (e.g., `zstd`). Used with compressed message content. |
| `Profile` | If set to `yes`, enables performance profiling for this task. |

Controller also defines certain headers, which you can find detailed information about [here](#controller-http-endpoints).

Furthermore, Rspamd supports standard HTTP headers like `Content-Length`.

## Rspamd HTTP reply

The response from Rspamd is encoded in `JSON` format. Here's an example of a typical HTTP reply:

  HTTP/1.1 200 OK
  Connection: close
  Server: rspamd/0.9.0
  Date: Mon, 30 Mar 2015 16:19:35 GMT
  Content-Length: 825
  Content-Type: application/json

~~~json
{
    "is_skipped": false,
    "score": 5.2,
    "required_score": 7,
    "action": "add header",
    "symbols": {
        "DATE_IN_PAST": {
            "name": "DATE_IN_PAST",
            "score": 0.1
        },
        "FORGED_SENDER": {
            "name": "FORGED_SENDER",
            "score": 5
        },
        "TEST": {
            "name": "TEST",
            "score": 100500
        },
        "FUZZY_DENIED": {
            "name": "FUZZY_DENIED",
            "score": 0,
            "options": [
                "1: 1.00 / 1.00",
                "1: 1.00 / 1.00"
            ]
        },
        "HFILTER_HELO_5": {
            "name": "HFILTER_HELO_5",
            "score": 0.1
        }
    },
    "urls": [
        "www.example.com",
        "another.example.com"
    ],
    "emails": [
        "user@example.com"
    ],
    "message-id": "4E699308EFABE14EB3F18A1BB025456988527794@example"
}
~~~

For convenience, the reply is LINTed using [JSONLint](https://jsonlint.com). The actual response is compressed for efficiency.

Each response contains the following fields:

* `is_skipped` - boolean flag that is `true` if a message has been skipped due to settings
* `score` - floating-point value representing the effective score of message
* `required_score` - floating-point value meaning the threshold value for the metric
* `action` - recommended action for a message:
  - `no action` - message is likely ham (please notice space, not an underscore)
  - `greylist` - message should be greylisted
  - `add header` - message is suspicious and should be marked as spam (please notice space, not an underscore)
  - `rewrite subject` - message is suspicious and should have subject rewritten
  - `soft reject` - message should be temporary rejected (for example, due to rate limit exhausting)
  - `reject` - message should be rejected as spam
* `symbols` - all symbols added during a message's processing, indexed by symbol names:
    - `name` - name of symbol
    - `score` - final score
    - `options` - array of symbol options as an array of strings

Additional keys that could be in the reply include:

* `subject` - if action is `rewrite subject` this value defines the desired subject for a message
* `urls` - a list of URLs found in a message (only hostnames)
* `emails` - a list of emails found in a message
* `message-id` - ID of message (useful for logging)
* `messages` - object containing optional messages added by Rspamd filters (such as `SPF`) - The value of the `smtp_message` key is intended to be returned as SMTP response text by the MTA

### Response headers

In addition to the JSON body, Rspamd may include special HTTP headers in the response:

* `Message-Offset` - When the `body_block` flag is set and the message was modified, this header contains the byte offset where the JSON response ends and the rewritten message body begins. See [Body block section](#body-block-rewritten-message) for details.
* `Compression` - Indicates the compression algorithm used (e.g., `zstd`)
* `Content-Encoding` - Mirror of the compression header for standard HTTP clients

## Milter headers

This section of the response is utilized to manipulate headers and the SMTP session. It is located under the `milter` key in the response. Here are the potential elements within this object:

* `add_headers`: headers to add (object, indexed by header name)
* `remove_headers`: headers to remove (object, indexed by header name)
* `change_from`: change SMTP from value (plain string)
* `reject`: custom rejection (plain string value), e.g. `reject="discard"` or `reject="quarantine"`
* `spam_header`: custom spam header (plain string - header name)
* `no_action`: instead of doing any action to a message, just add header `X-Rspamd-Action` equal to that action and accept message (boolean value)
* `add_rcpt`: (from 1.8.0) add new recipients (array of strings)
* `del_rcpt`: (from 1.8.0) delete recipients (array of strings)

### Adding headers

`add_headers` element has the following format:

```json
{
    "<header_name>": {
        "value": "<header_value>",
        "order": 0
    },
}
```

Where `<header_name>` represents header's name, `<header_value>` - value, and `order` the order of insertion (e.g. 0 will be the first header).

### Removing headers

`remove_headers` element has the following format:

```json
{
    "<header_name>": 1
}
```

Where `<header_name>` represents header's name, and the value is the order of the header to remove (starting from 1). There are special treatment for orders `0` and negative order:

* if order is equal to zero, then it means that **all* headers with this name should be removed
* if order is negative, it means that the `N`th header from the **end** should be removed (where `N` is `abs(order)`)

### Complete example

```json
{
    "milter":
    {
        "add_headers": {
            "ArcMessageSignature": {
                "value": "some_value with JSON\nencoded values",
                "order": 0
            },
        },
        "remove_headers": {
            "DKIM-Signature": -1
        }
    }
}
```

## Body block (rewritten message)

When a message is modified by Rspamd (for example, by Lua plugins via `task:set_message()` or ARC signing), the client can request that the modified message body be included in the response. This is controlled by the `body_block` flag.

### How it works

1. **Request**: The client includes `body_block` in the `Flags` header (e.g., `Flags: body_block` or `Flags: milter,body_block`)

2. **Response**: If the message was modified (indicated by the internal `MESSAGE_REWRITE` flag), the response contains:
   - A `Message-Offset` header indicating the byte position where the rewritten body begins
   - The standard JSON response up to the offset
   - The rewritten message body after the offset

3. **Message format**:
   - **For milter protocol** (`milter` flag present): Only the message body is included (without headers)
   - **For standard protocol**: The complete modified message is included (headers + body)

### Example with body block

Request:
```
POST /checkv2 HTTP/1.1
Content-Length: 1500
Flags: body_block
From: sender@example.com
Rcpt: recipient@example.com

[message content]
```

Response when message was modified:
```
HTTP/1.1 200 OK
Content-Type: application/json
Message-Offset: 523
Content-Length: 2100

{"action":"no action","score":0.5,"required_score":15.0,"symbols":{...},"message-id":"test@example.com"}
[rewritten message body starts here at byte 523]
From: sender@example.com
To: recipient@example.com
Subject: Test message
DKIM-Signature: v=1; a=rsa-sha256; ...

Modified message body content...
```

In this example:
- The JSON response ends at byte position 523
- The `Message-Offset` header tells the client where to split the response
- Everything after byte 523 is the rewritten message

### Parsing the response

To parse a response with body block:

1. Read the `Message-Offset` header value (e.g., `523`)
2. Parse bytes 0 to offset-1 as JSON (e.g., bytes 0-522)
3. Use bytes from offset to end as the rewritten message body (e.g., bytes 523-2099)

### Use cases

This feature is primarily used in:
- **Rspamd proxy worker** with milter protocol for message modifications
- **MTA integrations** that need to apply message modifications (DKIM signing, ARC sealing, header modifications)
- **Custom processing pipelines** where message rewriting is performed by Lua modules

### When is a message considered "rewritten"?

A message is marked as rewritten when:
- A Lua plugin calls `task:set_message()` with new content
- A Lua plugin calls `task:set_flag('message_rewrite')` explicitly
- Internal modules modify the message structure (e.g., ARC module adding signatures)

### Client-side implementation

Example Python code to parse a body block response:

```python
import requests
import json

response = requests.post('http://localhost:11333/checkv2',
                        headers={'Flags': 'body_block'},
                        data=message_content)

message_offset = response.headers.get('Message-Offset')
if message_offset:
    offset = int(message_offset)
    json_part = response.content[:offset]
    body_part = response.content[offset:]
    
    result = json.loads(json_part)
    modified_message = body_part.decode('utf-8')
    
    print(f"Scan result: {result}")
    print(f"Modified message: {modified_message}")
else:
    # No message modification, response is pure JSON
    result = response.json()
    print(f"Scan result: {result}")
```

## Compression

Rspamd supports Zstandard (zstd) compression for both requests and responses. Compression can significantly reduce bandwidth usage, especially for large messages or high-volume deployments.

### Requesting Compressed Responses

There are two ways to request compressed responses from Rspamd:

**Method 1: Using the Flags header**

```http
POST /checkv2 HTTP/1.1
Flags: zstd
Content-Length: 1500

<message content>
```

**Method 2: Using standard Accept-Encoding header**

```http
POST /checkv2 HTTP/1.1
Accept-Encoding: zstd
Content-Length: 1500

<message content>
```

### Sending Compressed Requests

To send a compressed message body, include the `Compression` header:

```http
POST /checkv2 HTTP/1.1
Compression: zstd
Content-Encoding: zstd
Content-Length: 850

<zstd-compressed message content>
```

Rspamd automatically detects zstd-compressed content by checking the magic bytes (`0x28 0xb5 0x2f 0xfd`) at the start of the body, but it's recommended to always include the `Compression` header for clarity.

### Response with Compression

When compression is enabled, the response includes compression headers:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Compression: zstd
Content-Encoding: zstd
Content-Length: 245

<zstd-compressed JSON response>
```

### Client Implementation Example

**Python example using zstandard library:**

```python
import requests
import zstandard as zstd
import json

# Compress request
cctx = zstd.ZstdCompressor()
message = open('message.eml', 'rb').read()
compressed_message = cctx.compress(message)

# Send compressed request, request compressed response
response = requests.post(
    'http://localhost:11333/checkv2',
    headers={
        'Compression': 'zstd',
        'Content-Encoding': 'zstd',
        'Accept-Encoding': 'zstd',
    },
    data=compressed_message
)

# Decompress response if compressed
if response.headers.get('Content-Encoding') == 'zstd':
    dctx = zstd.ZstdDecompressor()
    result = json.loads(dctx.decompress(response.content))
else:
    result = response.json()

print(result)
```

**Using rspamc with compression:**

```bash
rspamc -z message.eml  # Enable zstd compression
```

### Compression with Dictionaries

Rspamd supports zstd dictionary compression for even better compression ratios on typical email content. Dictionary IDs are communicated via the `Dictionary` header. This is primarily used internally by the rspamd proxy when communicating with backend workers.

### Performance Considerations

- Compression adds CPU overhead but reduces network I/O
- Recommended for remote Rspamd servers or high-latency connections
- For local Unix socket connections, compression overhead may outweigh benefits
- Typical compression ratios for email messages: 3:1 to 10:1
- JSON responses typically compress very well (5:1 to 20:1)

## Curl example

To check a message without rspamc:
`curl --data-binary @- http://localhost:11333/symbols < file.eml`

To check with compression (requires zstd command-line tool):
```bash
zstd -c message.eml | curl --data-binary @- \
  -H "Compression: zstd" \
  -H "Content-Encoding: zstd" \
  http://localhost:11333/checkv2
```

## Normal worker HTTP endpoints

The following endpoints are valid on the normal worker and accept `POST`:

* `/checkv2` - Checks message and return action

The below endpoints all use `GET`:

* `/ping` - Returns just a `pong` HTTP reply (could be used for monitoring)

## Controller HTTP endpoints

The following endpoints are valid merely on the controller. All of these may require `Password` header to be sent depending on configuration (passing this as query string works too).

* `/fuzzyadd` - Adds message to fuzzy storage
* `/fuzzydel` - Removes message from fuzzy storage

These accept `POST`. Headers which must be set are:

- `Flag`: flag identifying fuzzy storage
- `Weight`: weight to add to hashes

* `/learnspam` - Trains bayes classifier on spam message
* `/learnham` - Trains bayes classifier on ham message
* `/checkv2` - Checks message and return action (same as normal worker)

These also accept `POST`. Headers which may be set are:

- `Classifier`: classifier name to be learned. If not specified, all available classifiers will be learned.

The following endpoints all use `GET`:

* `/errors` - Returns error messages from ring buffer
* `/stat` - Returns statistics
* `/statreset` - Returns statistics and reset countes
* `/graph?type=<hourly|daily|weekly|monthly>` - Plots throughput graph
* `/history` - Returns rolling history
* `/historyreset` - Returns rolling history and resets its elements afterwards
* `/actions` - Returns thresholds for actions
* `/symbols` - Returns symbols in metric & their scores
* `/maps` - Returns list of maps
* `/neighbours` - Returns list of known peers
* `/errors` - Returns a content of erros ring buffer
* `/getmap` - Fetches contents of map according to ID passed in `Map:` header
* `/fuzzydelhash` - Deletes entries from fuzzy according to content of `Hash:` header(s)
* `/plugins` - Returns list of plugins or plugin specific stuff
* `/ping` - Returns just a `pong` HTTP reply (could be used for monitoring)
* `/metrics` - Returns OpenMetrics data

  Sample response of `/metrics` endpoint:
```
    # HELP rspamd_build_info A metric with a constant '1' value labeled by version from which rspamd was built.
  # TYPE rspamd_build_info gauge
  rspamd_build_info{version="3.2"} 1
  # HELP rspamd_config A metric with a constant '1' value labeled by id of the current config.
  # TYPE rspamd_config gauge
  rspamd_config{id="nzpuz9fm3jk1xncp3q136cudb3qycb7sygxjcko89ya69i8zs3879wbifxh9wfoip7ur8or6dx1crry9px36j9x36btbndjtxug9kub"} 1
  # HELP rspamd_scan_time_average Average messages scan time.
  # TYPE rspamd_scan_time_average gauge
  rspamd_scan_time_average 0.15881561463879001
  # HELP process_start_time_seconds Start time of the process since unix epoch in seconds.
  # TYPE process_start_time_seconds gauge
  process_start_time_seconds 1663651459
  # HELP rspamd_read_only Whether the rspamd instance is read-only.
  # TYPE rspamd_read_only gauge
  rspamd_read_only 0
  # HELP rspamd_scanned_total Scanned messages.
  # TYPE rspamd_scanned_total counter
  rspamd_scanned_total 5978
  # HELP rspamd_learned_total Learned messages.
  # TYPE rspamd_learned_total counter
  rspamd_learned_total 5937
  # HELP rspamd_spam_total Messages classified as spam.
  # TYPE rspamd_spam_total counter
  rspamd_spam_total 5978
  # HELP rspamd_ham_total Messages classified as spam.
  # TYPE rspamd_ham_total counter
  rspamd_ham_total 0
  # HELP rspamd_connections Active connections.
  # TYPE rspamd_connections gauge
  rspamd_connections 0
  # HELP rspamd_control_connections_total Control connections.
  # TYPE rspamd_control_connections_total gauge
  rspamd_control_connections_total 45399
  # HELP rspamd_pools_allocated Pools allocated.
  # TYPE rspamd_pools_allocated gauge
  rspamd_pools_allocated 45585
  # HELP rspamd_pools_freed Pools freed.
  # TYPE rspamd_pools_freed gauge
  rspamd_pools_freed 45542
  # HELP rspamd_allocated_bytes Bytes allocated.
  # TYPE rspamd_allocated_bytes gauge
  rspamd_allocated_bytes 60537276
  # HELP rspamd_chunks_allocated Memory pools: current chunks allocated.
  # TYPE rspamd_chunks_allocated gauge
  rspamd_chunks_allocated 374
  # HELP rspamd_shared_chunks_allocated Memory pools: current shared chunks allocated.
  # TYPE rspamd_shared_chunks_allocated gauge
  rspamd_shared_chunks_allocated 15
  # HELP rspamd_chunks_freed Memory pools: current chunks freed.
  # TYPE rspamd_chunks_freed gauge
  rspamd_chunks_freed 0
  # HELP rspamd_chunks_oversized Memory pools: current chunks oversized (needs extra allocation/fragmentation).
  # TYPE rspamd_chunks_oversized gauge
  rspamd_chunks_oversized 1550
  # HELP rspamd_fragmented Memory pools: fragmented memory waste.
  # TYPE rspamd_fragmented gauge
  rspamd_fragmented 0
  # HELP rspamd_learns_total Total learns.
  # TYPE rspamd_learns_total counter
  rspamd_learns_total 9526
  # HELP rspamd_actions_total Actions labelled by action type.
  # TYPE rspamd_actions_total counter
  rspamd_actions_total{type="reject"} 0
  rspamd_actions_total{type="soft reject"} 0
  rspamd_actions_total{type="rewrite subject"} 0
  rspamd_actions_total{type="add header"} 5978
  rspamd_actions_total{type="greylist"} 0
  rspamd_actions_total{type="no action"} 0
  # HELP rspamd_statfiles_revision Stat files revision.
  # TYPE rspamd_statfiles_revision gauge
  rspamd_statfiles_revision{symbol="BAYES_SPAM",type="redis"} 9429
  rspamd_statfiles_revision{symbol="BAYES_HAM",type="redis"} 97
  # HELP rspamd_statfiles_used Stat files used.
  # TYPE rspamd_statfiles_used gauge
  rspamd_statfiles_used{symbol="BAYES_SPAM",type="redis"} 0
  rspamd_statfiles_used{symbol="BAYES_HAM",type="redis"} 0
  # HELP rspamd_statfiles_totals Stat files total.
  # TYPE rspamd_statfiles_totals gauge
  rspamd_statfiles_totals{symbol="BAYES_SPAM",type="redis"} 0
  rspamd_statfiles_totals{symbol="BAYES_HAM",type="redis"} 0
  # HELP rspamd_statfiles_size Stat files size.
  # TYPE rspamd_statfiles_size gauge
  rspamd_statfiles_size{symbol="BAYES_SPAM",type="redis"} 0
  rspamd_statfiles_size{symbol="BAYES_HAM",type="redis"} 0
  # HELP rspamd_statfiles_languages Stat files languages.
  # TYPE rspamd_statfiles_languages gauge
  rspamd_statfiles_languages{symbol="BAYES_SPAM",type="redis"} 0
  rspamd_statfiles_languages{symbol="BAYES_HAM",type="redis"} 0
  # HELP rspamd_statfiles_users Stat files users.
  # TYPE rspamd_statfiles_users gauge
  rspamd_statfiles_users{symbol="BAYES_SPAM",type="redis"} 1
  rspamd_statfiles_users{symbol="BAYES_HAM",type="redis"} 1
  # HELP rspamd_fuzzy_stat Fuzzy stat labelled by storage.
  # TYPE rspamd_fuzzy_stat gauge
  rspamd_fuzzy_stat{storage="rspamd.com"} 1768011131
  # EOF
```
