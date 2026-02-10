---
title: Workers documentation
---

# Rspamd workers

Rspamd defines several types of worker processes, each designed for specific purposes. 
For instance, some are meant for scanning mail messages, while others handle control actions 
like learning or statistic grabbing. Additionally, there's a versatile worker type 
called the 'lua' worker, which permits the execution of any Lua script as an Rspamd worker. 
This worker type acts as a proxy for Rspamd's Lua API.

## Worker types

Currently Rspamd defines the following worker types:

- [normal](/workers/normal): this worker is designed to scan mail messages
- [controller](/workers/controller): this worker performs configuration actions, such as
learning, adding fuzzy hashes and serving web interface requests
- [fuzzy_storage](/workers/fuzzy_storage): stores fuzzy hashes
- [rspamd_proxy](/workers/rspamd_proxy): handles requests forwarding and milter protocol

## Workers connections

All client applications should interact with two main workers: `normal` and `controller`.
Both of these workers utilize the `HTTP` protocol for all operations and depend on HTTP headers
to retrieve additional information from a client. Starting from Rspamd 3.15, workers can also serve HTTPS directly (see [HTTPS support](#https-support) below). Depending on your network configuration, it might be
beneficial to bind all workers to the loopback interface to prevent any external interactions.
It's important to note that Rspamd workers are **not** meant to operate in an unprotected environment, such as
the Internet without proper TLS encryption. When using plain HTTP, sensitive information might potentially be leaked.

[Fuzzy worker](/workers/fuzzy_storage) is different: it is intended to serve external requests, however, it
listens on an UDP port and does not save any state information.

## Common worker options

All workers share a set of common options. Here's a typical example of a normal worker configuration that utilizes only the common worker options:

~~~hcl
worker "normal" {
    bind_socket = "*:11333";
}
~~~

Here are options available to all workers:

- `bind_socket` - a string that defines the bind address of a worker. If the port number is omitted, port 11333 is assumed.
- `count` - the number of worker instances to run (some workers ignore this option, e.g., `hs_helper`)
- `enabled` (1.6.2+) - a Boolean (`true` or `false`), enabling or disabling a worker (`true` by default)

`bind_socket` is the most commonly used option. It defines the address where the worker should accept
connections. Rspamd allows both names and IP addresses for this option:

~~~hcl
bind_socket = "localhost:11333";
bind_socket = "127.0.0.1:11333";
bind_socket = "[::1]:11333"; # note that you need to enclose ipv6 in '[]'
~~~

Also universal listening addresses are defined:

~~~hcl
bind_socket = "*:11333"; # any ipv4 and ipv6 address
bind_socket = "*v4:11333"; # any ipv4 address
bind_socket = "*v6:11333"; # any ipv6 address
~~~

It is possible to use systemd sockets as configured via a [socket unit file](https://www.freedesktop.org/software/systemd/man/systemd.socket.html). 
However, this is not recommended, especially if one is using official packages or requires the use of multiple sockets:

~~~hcl
# Use the first socket passed through a systemd .socket file.
bind_socket = "systemd:0";
# Starting with Rspamd 2.4, one can use named socket files too. If the systemd
# FileDescriptorName= option is not specified, the socket unit name can be used.
bind_socket = "systemd:rspamd.socket";
~~~

For UNIX sockets, it is also possible to specify owner and mode using this syntax:

~~~hcl
bind_socket = "/tmp/rspamd.sock mode=0666 owner=user";
~~~

Without specifying an owner and mode, Rspamd uses the active user as the owner 
(for instance, if started by root, then `root` is used) and `0644` as the access mask. 
Please note that you need to specify the **octal** number for the mode, specifically prefixed by a zero. 
Otherwise, modes like `666` will produce unexpected results.

You can specify multiple `bind_socket` options to listen on as many addresses as you want.

## HTTPS support

Starting from version 3.15, Rspamd workers can serve HTTPS natively without requiring a TLS-terminating reverse proxy (e.g. nginx) in front. This simplifies deployments where Rspamd's HTTP API or web UI must be exposed over an encrypted connection.

:::note
A reverse proxy may still be preferred for advanced TLS features such as client certificate authentication, OCSP stapling, or centralised certificate management.
:::

### Overview

HTTPS is enabled by appending the `ssl` suffix to a `bind_socket` line. There is no separate `ssl = true` option -- the suffix on the bind line is the only mechanism. A single worker can listen on both plain HTTP and HTTPS ports simultaneously by specifying multiple `bind_socket` lines, some with the `ssl` suffix and some without.

When any `bind_socket` uses the `ssl` suffix, the worker requires two additional options:

| Option | Description |
|--------|-------------|
| `ssl_cert` | Path to the PEM-encoded certificate (or certificate chain) file |
| `ssl_key` | Path to the PEM-encoded private key file |

Both options are configured at the worker level and apply to all SSL-enabled sockets of that worker.

### Configuration

Here is an example that adds HTTPS to the controller worker while keeping the plain HTTP listener intact:

~~~hcl
# local.d/worker-controller.inc
bind_socket = "127.0.0.1:11334";         # plain HTTP (loopback only)
bind_socket = "*:11335 ssl";              # HTTPS (all interfaces)
ssl_cert = "/etc/rspamd/ssl/cert.pem";
ssl_key = "/etc/rspamd/ssl/key.pem";
~~~

The same approach works for the normal worker and proxy worker:

~~~hcl
# local.d/worker-normal.inc
bind_socket = "127.0.0.1:11333";         # plain HTTP
bind_socket = "*:11336 ssl";              # HTTPS
ssl_cert = "/etc/rspamd/ssl/cert.pem";
ssl_key = "/etc/rspamd/ssl/key.pem";
~~~

~~~hcl
# local.d/worker-proxy.inc
bind_socket = "127.0.0.1:11332";         # plain milter/HTTP
bind_socket = "*:11339 ssl";              # HTTPS
ssl_cert = "/etc/rspamd/ssl/cert.pem";
ssl_key = "/etc/rspamd/ssl/key.pem";
~~~

### Setup guide

1. **Obtain a certificate and key.** Use your existing PKI, ACME/Let's Encrypt, or generate a self-signed certificate for testing:

    ~~~
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout /etc/rspamd/ssl/key.pem \
      -out /etc/rspamd/ssl/cert.pem \
      -days 365 -subj "/CN=rspamd.example.com"
    ~~~

2. **Set file permissions.** Ensure the Rspamd user can read both files, and that the private key is not world-readable:

    ~~~
    chown _rspamd:_rspamd /etc/rspamd/ssl/key.pem /etc/rspamd/ssl/cert.pem
    chmod 600 /etc/rspamd/ssl/key.pem
    chmod 644 /etc/rspamd/ssl/cert.pem
    ~~~

3. **Add SSL bind sockets.** Edit the appropriate `local.d/worker-*.inc` file and add a `bind_socket` line with the `ssl` suffix, along with `ssl_cert` and `ssl_key` paths (see examples above).

4. **Restart Rspamd:**

    ~~~
    systemctl restart rspamd
    ~~~

5. **Verify the connection:**

    ~~~
    curl -k https://rspamd.example.com:11335/stat
    ~~~

### Proxy mirror SSL and keepalive

The proxy worker's `mirror` and `upstream` blocks also support `ssl` and `keepalive` (or `keep_alive`) options for connections to upstream/mirror servers:

~~~hcl
# local.d/worker-proxy.inc
upstream "scan" {
  default = yes;
  hosts = "scanner.example.com:11336";
  ssl = true;         # connect to upstream over TLS
  keepalive = true;   # use persistent connections
}

mirror "test" {
  hosts = "test.example.com:11336";
  probability = 0.1;
  ssl = true;
  keepalive = true;
}
~~~

This is separate from the worker-level `ssl_cert`/`ssl_key` options: the worker-level settings control the *listener* side (serving HTTPS to clients), while `ssl` in upstream/mirror blocks controls the *client* side (connecting to backend servers over TLS).
