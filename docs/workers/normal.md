---
title: Normal worker (scanner)
---

# Rspamd normal worker

Rspamd normal worker is intended to scan messages for spam. It has the following configuration options available:

| Option | Default | Description |
|--------|---------|-------------|
| `count` | 4 | Number of normal worker processes to run |
| `mime` | true | Set to `false` if you want to scan non-MIME messages (e.g. forum comments or SMS) |
| `timeout` | 60s | Protocol I/O timeout |
| `task_timeout` | 8s | Maximum time to process a single task |
| `max_tasks` | 0 | Maximum count of parallel tasks processed by a single worker (0 = no limit) |
| `keypair` | - | Encryption keypair for secure communications |
| `encrypted_only` | false | Allow only encrypted connections |

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
