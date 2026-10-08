---
title: Normal worker (scanner)
---

# Rspamd normal worker

Rspamd normal worker is intended to scan messages for spam. It has the following configuration options available:

| Option | Default | Description |
|--------|---------|-------------|
| `count` | CPU count minus 2, from 1 to 4 | Number of normal worker processes to run |
| `mime` | true | Set to `false` if you want to scan non-MIME messages (e.g. forum comments or SMS) |
| `allow_file_and_shm_inputs` | true | Allow clients connected over TCP to pass the message as a local file or shared memory segment (`File`, `Path` and `Shm` request headers). Unix socket clients can always do this. The default will become `false` in the next major release |
| `timeout` | 60s | Protocol I/O timeout |
| `task_timeout` | 8s | Maximum time to process a single task. If not set, the global [task_timeout](/configuration/options#global-options) option is used |
| `max_tasks` | 0 | Maximum count of parallel tasks processed by a single worker (0 = no limit) |
| `keypair` | - | Encryption keypair for secure communications |
| `encrypted_only` | false | Allow only encrypted connections; clients on Unix sockets and loopback addresses are exempt |
| `ssl_cert` | - | Path to PEM certificate file (required when using `ssl` bind sockets, see [HTTPS support](/workers/#https-support)) |
| `ssl_key` | - | Path to PEM private key file (required when using `ssl` bind sockets) |

## Encryption support

To generate a keypair for the scanner you could use:

    rspamadm keypair -u

After that keypair should appear as following:

~~~hcl
keypair {
    pubkey = "tm8zjw3ougwj1qjpyweugqhuyg4576ctg6p7mbrhma6ytjewp4ry";
    privkey = "ykkrfqbyk34i1ewdmn81ttcco1eaxoqgih38duib1e7b89h9xn3y";
}
~~~

You can use its **public** part thereafter when scanning messages as following:

    rspamc --key tm8zjw3ougwj1qjpyweugqhuyg4576ctg6p7mbrhma6ytjewp4ry <file>
