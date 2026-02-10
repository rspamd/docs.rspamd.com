---
title: Controller worker
---

# Controller worker

The controller worker is primarily utilized for managing Rspamd statistics, facilitating the learning process, and serving the WebUI. 

In essence, it operates as a web server that accepts requests and delivers responses in JSON format. Various commands are mapped to specific URLs, and they fall into two categories: read-only commands, which are considered `unprivileged`, and commands like map modification, config alterations, and learning, which necessitate a higher level of privileges called `enable`. These privilege levels are differentiated by passwords. If only one password is specified in the configuration, it is used for both types of commands.

## Controller configuration

The Rspamd controller worker offers the following configuration options:

| Option | Default | Description |
|--------|---------|-------------|
| `password` | - | Password required for read-only commands |
| `enable_password` | - | Password required for write (privileged) commands |
| `secure_ip` | - | List or map of IP addresses allowed password-less access. If using a reverse proxy with `X-Forwarded-For`, include both proxy and client IPs |
| `trusted_ips` | - | Alias for `secure_ip` |
| `static_dir` | `${WWWDIR}` | Directory where static files for the web interface are located |
| `bind_socket` | `*:11334` | Bind address for the controller worker. Append `ssl` to enable HTTPS (see [HTTPS support](/workers/#https-support)). See [common worker options](/workers/#common-worker-options) |
| `timeout` | 60s | Protocol I/O timeout |
| `task_timeout` | 8s | Maximum task processing time for scan requests |
| `keypair` | - | Encryption keypair for secure communications |
| `ssl_cert` | - | Path to PEM certificate file (required when using `ssl` bind sockets) |
| `ssl_key` | - | Path to PEM private key file (required when using `ssl` bind sockets) |

## Encryption support

To generate a keypair for the scanner you could use:

    rspamadm keypair -u

After running this command, the keypair should appear as follows:

~~~hcl
keypair {
    pubkey = "tm8zjw3ougwj1qjpyweugqhuyg4576ctg6p7mbrhma6ytjewp4ry";
    privkey = "ykkrfqbyk34i1ewdmn81ttcco1eaxoqgih38duib1e7b89h9xn3y";
}
~~~

You can use its **public** part thereafter when scanning messages as following:

    rspamc --key tm8zjw3ougwj1qjpyweugqhuyg4576ctg6p7mbrhma6ytjewp4ry <file>

## Passwords encryption

Rspamd now suggests to encrypt passwords when storing them in a configuration. Currently, it uses `PBKDF2-Blake2` function to derive key from a password. To encrypt key, you can use `rspamadm pw` command as following:

    rspamadm pw
    Enter passphrase: <hidden input>
    $1$cybjp37q4w63iogc4erncz1tgm1ce9i5$kxfx9xc1wk9uuakw7nittbt6dgf3qyqa394cnradg191iqgxr8kb

You can use that line as `password` and `enable_password` (priv) values.

## Supported commands

* `/auth`
* `/symbols`
* `/actions`
* `/maps`
* `/getmap`
* `/graph`
* `/pie`
* `/history`
* `/historyreset` (priv)
* `/learnspam` (priv)
* `/learnham` (priv)
* `/fuzzyadd` (priv)
* `/fuzzydel` (priv)
* `/fuzzydelhash` (priv)
* `/saveactions` (priv)
* `/savesymbols` (priv)
* `/savemap` (priv)
* `/scan`
* `/check`
* `/checkv2`
* `/stat`
* `/statreset` (priv)
* `/counters`
* `/metrics`

More details available at [Controller HTTP endpoints](/developers/protocol#controller-http-endpoints).
