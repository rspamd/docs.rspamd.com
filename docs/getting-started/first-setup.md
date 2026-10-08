---
title: First Setup
sidebar_position: 3
---

# First setup

This guide takes a new Rspamd installation to a working spam filter for Postfix: checking Redis and the web interface password, test scans, MTA integration and Bayes training.

## Prerequisites

- Rspamd installed (see the [installation guide](/getting-started/installation))
- Redis running; Bayes, greylisting, rate limiting and several other modules need it
- A local recursive DNS resolver such as Unbound; DNS blocklists such as Spamhaus refuse queries from public resolvers (see [DNS resolver](/getting-started/installation#dns-resolver))
- A mail server (MTA): Postfix, Exim or Sendmail
- Root access to `/etc/rspamd/`
- A mailbox on the server and an external mail account for test messages

Paths and commands on this page are for Linux packages. On FreeBSD the configuration is in `/usr/local/etc/rspamd`, runtime data is in `/var/db/rspamd`, and you manage the service with `service rspamd <command>` instead of `systemctl`. On EL 10, Valkey replaces Redis, so use `valkey-cli` wherever this page says `redis-cli`.

With the Docker setup from the installation guide, edit the files in the `local.d` directory next to `compose.yaml` (mounted as `/etc/rspamd/local.d`). Prefix `rspamc` and `rspamadm` commands with `docker compose exec rspamd` (add `-T` when you pipe a file in), and run `redis-cli` as `docker compose exec redis redis-cli`. Instead of `systemctl restart rspamd` or `systemctl reload rspamd`, run `docker compose restart rspamd`, and read the log with `docker compose logs rspamd`. Connections through the published ports, including an SSH tunnel to them, are outside `secure_ip`, so the web interface always asks for the password.

Rspamd runs several types of [worker](/developers/architecture). The shipped configuration runs the proxy (milter, `localhost:11332`), the normal worker (`localhost:11333`) and the controller (`localhost:11334`); [Verify the installation](/getting-started/installation#verify-the-installation) lists them. Packages built with Hyperscan also run an internal `hs_helper` worker, which does not listen on any port.

## Step 1: Basic configuration

### Redis

If you followed [Connect Rspamd to Redis](/getting-started/installation#connect-rspamd-to-redis), `local.d/redis.conf` already exists. With Docker it is the `local.d/redis.conf` next to `compose.yaml`, with `servers = "redis";`. Add these options to that file only if your Redis needs them:

```hcl
# /etc/rspamd/local.d/redis.conf
servers = "127.0.0.1";  # set during installation
# db = "0";
# username = "rspamd";
# password = "your_redis_password";
```

Modules that have no Redis servers of their own use these settings. Without them, Bayes, greylisting, rate limiting, neural networks, DMARC reporting and the Redis-backed message history are disabled. Static checks such as SPF, DKIM, DMARC and RBLs still work.

### Web interface password

If you did not set a password during installation, follow [Set the web interface password](/getting-started/installation#set-the-web-interface-password) now. To use a separate password for learning and configuration changes, add `enable_password = "<another hash from rspamadm pw>";` to the same `local.d/worker-controller.inc`. `password` then gives read-only access.

The controller listens on `localhost:11334` by default. Keep it that way and use an SSH tunnel for remote access:

```bash
ssh -L 11334:localhost:11334 user@your-server
```

The controller's `secure_ip` option lists `127.0.0.1` and `::1` by default, and connections from these addresses get full access without a password. Connections through an SSH tunnel arrive from localhost, so they skip the password too, as does any local user or process. To require the password for local connections as well, clear the list:

```hcl
# /etc/rspamd/local.d/worker-controller.inc
secure_ip = [];
```

This goes in the same file as the password. A `secure_ip` value in `local.d` replaces the default list instead of adding to it.

After this change every `rspamc` command needs the password, plain scans included, because `rspamc` sends all requests to the controller when it connects to localhost. Pass the password with `-P`, for example `rspamc -P yourpassword stat`.

### Actions

Rspamd adds up the scores of the [symbols](/getting-started/understanding-rspamd) that match a message and returns an action. The default thresholds are 15 for `reject`, 6 for `add_header` and 4 for `greylist`. In `actions.conf` the key is `add_header`; Rspamd reports the action as `add header`. You need `local.d/actions.conf` only to change the thresholds (see [Step 5](#step-5-fine-tuning)).

The MTA enforces the action. Postfix and Sendmail get it through the [proxy worker in milter mode](/workers/rspamd_proxy#milter-support). Exim (legacy RSPAMC protocol, `spamd_address = 127.0.0.1 11333 variant=rspamd`) and HTTP clients such as Haraka send messages directly to the normal worker; see [MTA integration](/tutorials/integration) and the HTTP [protocol](/developers/protocol). In milter mode, `add header` adds `X-Spam: Yes` to the message. The `greylist` action delays mail only through the greylist module, which needs Redis. Thresholds can be changed per domain or per user with the [settings module](/configuration/settings).

### Check and restart

```bash
sudo rspamadm configtest
```

Read all of the output, not only the last line. Warnings and non-fatal errors such as `unknown worker attribute` appear earlier in the output, and configtest still prints `syntax OK` after them. Once Redis is configured, a warning that `task_timeout` is less than the maximum symbols cache timeout is expected; the [FAQ](/faq#what-does-the-maximum-symbols-cache-timeout-warning-mean) explains it.

```bash
sudo systemctl restart rspamd
sudo systemctl status rspamd
```

Rspamd writes its log to `/var/log/rspamd/rspamd.log`:

```bash
sudo tail -n 50 /var/log/rspamd/rspamd.log
```

`journalctl -u rspamd` shows only service start and stop messages and errors from before the log file is opened. Use it when Rspamd fails to start.

## Step 2: Test basic functionality

Test with a complete message. Input without `From`, `To`, `Date` and `Message-ID` headers matches the `MISSING_FROM`, `MISSING_TO`, `MISSING_DATE` and `MISSING_MID` rules, which together score above the `add_header` threshold, so `echo "Subject: test" | rspamc` tells you little.

```bash
cat > /tmp/test.eml <<EOF
From: Sender <sender@example.org>
To: Recipient <recipient@example.com>
Subject: Rspamd test
Date: $(date -R)
Message-ID: <test-$(date +%s)@example.org>
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

This is a test message.
EOF
rspamc /tmp/test.eml
```

The output shows the action, the score and every symbol that matched. To see how Rspamd scores your own mail, scan saved messages with `rspamc /path/to/message.eml`.

To see a forced action, add the [GTUBE](/other/gtube_patterns) test string to a copy of the message:

```bash
{ cat /tmp/test.eml; echo 'XJS*C4JDBQADN1.NSBN3*2IDNEN*GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL*C.34X'; } > /tmp/gtube.eml
rspamc /tmp/gtube.eml
```

The result is the `GTUBE` symbol and the `reject` action.

Open the web interface at `http://localhost:11334` on the server, or on your workstation while the SSH tunnel from Step 1 is running.

Check that Redis answers and that Rspamd logs no Redis errors:

```bash
redis-cli -h 127.0.0.1 -p 6379 ping   # should print PONG; add -a/--user if Redis has a password
sudo grep -i redis /var/log/rspamd/rspamd.log | tail
```

`rspamc stat` shows scan and learn counters. It does not test the Redis connection.

## Step 3: Mail server integration

### Postfix

Rspamd needs no changes for Postfix. The proxy worker already runs in milter mode on `localhost:11332`. It receives each message from Postfix and, by default, forwards it over HTTP to the normal worker on `localhost:11333` for scanning. On a small server you can let the proxy scan messages itself instead; see [self-scan mode](/workers/rspamd_proxy#self-scan-mode).

Add to `/etc/postfix/main.cf`:

```ini
# /etc/postfix/main.cf
smtpd_milters = inet:localhost:11332
non_smtpd_milters = inet:localhost:11332
milter_default_action = accept
```

`smtpd_milters` covers mail received over SMTP; `non_smtpd_milters` covers mail submitted with the `sendmail` command. With `milter_default_action = accept`, Postfix accepts mail unscanned while Rspamd is unavailable. Postfix's own default, `tempfail`, defers mail until Rspamd is back.

Restart Postfix:

```bash
sudo systemctl restart postfix
```

### Other MTAs

See the [integration guide](/tutorials/integration) for Exim, Sendmail and other MTAs.

## Step 4: Verify end-to-end

With the shipped configuration, the [milter_headers](/modules/milter_headers) module adds no headers (`use = []`). Enable the ones you want first:

```hcl
# /etc/rspamd/local.d/milter_headers.conf
use = ["x-spamd-bar", "x-spam-level", "x-spam-status", "authentication-results"];
```

By default the module skips mail from local networks (loopback and the private ranges in the `local_addrs` option) and from authenticated users. Test with mail that arrives over SMTP from an external host, or add `skip_local = false;` and `skip_authenticated = false;` to the file above. Then reload Rspamd:

```bash
sudo systemctl reload rspamd
```

Send a normal message from your external account to a mailbox on the server. It should arrive with `X-Spam-Status`, `X-Spamd-Bar` and `Authentication-Results` headers.

Then pass the GTUBE message from Step 2 through Postfix:

```bash
sendmail test@yourdomain.com < /tmp/gtube.eml
```

Rspamd adds the `GTUBE` symbol and forces the `reject` action: the score is set to the reject threshold and all other rules are skipped. Look for a `milter-reject` line in the Postfix log (often `/var/log/mail.log` or `/var/log/maillog`).

To test the `add header` path as well, enable the other GTUBE patterns temporarily:

```hcl
# /etc/rspamd/local.d/options.inc
gtube_patterns = "all";  # for testing only, remove afterwards
```

After a reload, send a copy of the GTUBE message with the pattern changed to `YJS*...` through Postfix:

```bash
sed 's/^XJS/YJS/' /tmp/gtube.eml | sendmail test@yourdomain.com
```

It gets the `add header` action and arrives with `X-Spam: Yes`. Remove the setting when you are done: a message that contains one of these patterns skips all other checks, so a spammer can add one to avoid a reject.

Messages scanned through the MTA appear in the History tab of the web interface.

## Step 5: Fine-tuning

### Thresholds

Change the thresholds in `local.d/actions.conf`. List only the values you change:

```hcl
# /etc/rspamd/local.d/actions.conf
# Defaults: reject = 15; add_header = 6; greylist = 4;
add_header = 8;
```

- Too many false positives: raise `add_header`, for example to 8 as above.
- Spam gets through: lower `add_header`, but keep `greylist` below it. When two actions share a threshold, which one wins depends on internal ordering.
- Greylisting delays wanted mail: disable the greylist module with `enabled = false;` in `local.d/greylist.conf`. Setting `greylist = null;` in `actions.conf` only removes the greylist action; the module still delays mail from unknown senders that reaches the `add_header` score.

### Bayes autolearn (optional)

Bayes is already enabled and stores its data in Redis once `local.d/redis.conf` exists. Rspamd does not learn automatically unless you configure autolearn:

```hcl
# /etc/rspamd/local.d/classifier-bayes.conf
autolearn {
  spam_threshold = 15.0;  # learn as spam: reject action
  junk_threshold = 6.0;   # learn as spam: add header range
  ham_threshold = -0.5;   # learn as ham: no action, score at or below this
  check_balance = true;   # keep spam and ham learns balanced
}
```

Without `junk_threshold`, autolearn learns spam only from messages that get the `reject` action; with it, mail in the `add header` range is learned as spam too. Only messages with a queue ID are learned, so mail scanned with plain `rspamc` is not. With `check_balance`, autolearn stops learning a class once its learn count is more than `1/min_balance` times that of the other class (about 1.1 times with the default `min_balance` of 0.9). See [autolearning](/configuration/statistic#autolearning) for the other options.

By default Bayes tokens never expire. To let Rspamd drop rarely seen tokens, add `expire = 100d;` to the same file (see [Bayes expiry](/modules/bayes_expiry)).

Reload Rspamd after editing the file:

```bash
sudo systemctl reload rspamd
```

### Training

```bash
rspamc learn_spam /path/to/spam/
rspamc learn_ham /path/to/ham/
rspamc stat | grep BAYES
```

`rspamc` accepts single files or directories. Learned data goes to Redis immediately; no reload or restart is needed. Bayes gives no results until it has learned at least 200 spam and 200 ham messages (`min_learns`). Train with similar numbers of each.

## Checklist

- `rspamadm configtest` reports no errors
- `redis-cli ping` returns `PONG`
- `rspamc` scans the test message, and the GTUBE copy gets `reject`
- Postfix logs `milter-reject` for the GTUBE message
- Mail from an external account arrives with `X-Spam-Status` and related headers
- The web interface opens on localhost or through the SSH tunnel and shows scanned messages in the History tab

## Common issues

### Connection refused

If Postfix cannot connect to port 11332:

```bash
sudo systemctl status rspamd
sudo ss -tlnp | grep rspamd   # should show 11332, 11333 and 11334
sudo ss -tlnp 'sport = :11332'   # any other process holding the milter port
sudo rspamadm configdump worker | grep bind_socket
```

The proxy listens on localhost only. If Postfix runs on another host or in a container, make the proxy listen on an address it can reach and restrict access to the port with a firewall. [Security](/getting-started/installation#security) in the installation guide shows the settings.

### No spam headers

```bash
rspamadm configdump milter_headers
rspamc stat   # "Messages scanned" shows whether mail reaches Rspamd
postconf | grep milter
```

Check that `use` lists the headers you expect ([Step 4](#step-4-verify-end-to-end)) and that the test mail does not come from a local network or an authenticated user. While `use` is empty, a clean message gets no spam header at all: the proxy adds only `X-Spam: Yes`, and only for the `add header` action.

### All messages marked as spam

Check which symbols fire: open the History tab, or scan a real message with `rspamc /path/to/message.eml`. Test input without headers scores high on its own (see [Step 2](#step-2-test-basic-functionality)).

Common causes:

1. Bayes trained mostly on one class. There is no `rspamc` command to reset Bayes; delete its data from Redis. With the default classifier settings these commands remove the tokens, the learn counters and the cache of already learned messages:

   ```bash
   rspamadm statistics_dump dump > bayes-$(date +%F).dump   # optional backup
   redis-cli --scan --pattern 'RS_*' | xargs -r redis-cli unlink
   redis-cli --scan --pattern 'learned_ids*' | xargs -r redis-cli unlink
   redis-cli unlink RS BAYES_SPAM_keys BAYES_HAM_keys
   ```

   Add `-n`, `-a` or `--user` to `redis-cli` if your Redis setup needs them. If Bayes has a Redis database of its own, `FLUSHDB` on that database does the same. Then retrain with similar numbers of spam and ham messages.

2. Thresholds too low: raise them in `local.d/actions.conf`.

### Spam gets through

If messages show `RBL_SPAMHAUS_BLOCKED_OPENRESOLVER`, `DBL_BLOCKED_OPENRESOLVER` or `URIBL_BLOCKED`, the blocklists refuse queries from your DNS resolver and their checks do not work. Use a local recursive resolver (see [DNS resolver](/getting-started/installation#dns-resolver)).

### Web interface won't load

```bash
sudo ss -tlnp | grep 11334
curl http://localhost:11334/ping   # should print "pong"
```

The controller answers on localhost only, so from another machine use the SSH tunnel from [Step 1](#web-interface-password). The page loads even without `local.d/worker-controller.inc`; the password matters only for logging in. With Docker, with a changed `bind_socket`, or behind a reverse proxy that sends `X-Forwarded-For`, the web interface asks for the password. If logging in fails there, set your own `password` in `local.d/worker-controller.inc`: Rspamd refuses the shipped placeholder password for clients outside `secure_ip`.

## Performance tuning

### Worker count

By default the normal worker starts as many processes as there are CPU cores minus two, with at least one and at most four. To change the number:

```hcl
# /etc/rspamd/local.d/worker-normal.inc
count = 6;  # example value
```

In self-scan mode the proxy scans the messages, so set `count` in `local.d/worker-proxy.inc` instead.

### DNS

Use a local recursive resolver; [DNS resolver](/getting-started/installation#dns-resolver) explains why and shows the `dns.nameserver` setting.

Leave the other `dns` options (`timeout`, `retransmits`, `sockets`) at their defaults. If you raise the DNS `timeout`, raise `task_timeout` as well, or checks that wait on DNS, such as SPF and DMARC, can be cut off before they finish.

### Scan limits

`task_timeout`, `max_message`, `max_urls` and `max_recipients` go into `local.d/options.inc`. [General options](/guides/configuration/fundamentals#general-options) lists their defaults and meaning.

```hcl
# /etc/rspamd/local.d/options.inc
task_timeout = 12s;  # example values
max_message = 100mb;
```

## Security hardening

### Web interface access

Keep the controller bound to localhost and use an SSH tunnel for remote access. Local connections skip the password unless you clear `secure_ip` (see [Web interface password](#web-interface-password)).

### HTTPS (optional)

Since Rspamd 4.0 the controller can serve HTTPS. Add a `bind_socket` with the `ssl` suffix, such as `"*:11443 ssl"`, and set `ssl_cert` and `ssl_key` (see [HTTPS support](/workers/#https-support) for creating the certificate):

```hcl
# /etc/rspamd/local.d/worker-controller.inc
password = "$2$your_generated_hash_here";
bind_socket = "localhost:11334";   # plain HTTP for rspamc and SSH tunnels
bind_socket = "*:11443 ssl";       # HTTPS listener
ssl_cert = "/etc/rspamd/ssl/cert.pem";
ssl_key = "/etc/rspamd/ssl/key.pem";
allow_file_and_shm_inputs = false;
```

`bind_socket` in `local.d` replaces the default, so repeat the localhost line: `rspamc` has no TLS support and needs the plain listener. The Rspamd user (`_rspamd`, or `rspamd` on FreeBSD) must be able to read the key. A listener on a public address needs a strong password and a firewall rule that limits who can reach the port. `allow_file_and_shm_inputs = false` stops clients of a TCP listener from making Rspamd read local files.

### Rate limiting

The [ratelimit](/modules/ratelimit) module caps how much mail each authenticated user can send, so a compromised account cannot send unlimited spam:

```hcl
# /etc/rspamd/local.d/ratelimit.conf
rates {
  user = {
    bucket = {
      burst = 100;  # example values
      rate = "10 / 1m";
    }
  }
}
```

`burst` and `rate` are both required; a bucket without `burst` is discarded with an error in the log. Each recipient counts against the bucket. Over the limit, Rspamd returns a soft reject (temporary failure). To limit inbound mail per recipient address, use the `to` type instead of `user`. The module needs Redis.

### Updates

```bash
sudo apt update && sudo apt upgrade rspamd  # Debian/Ubuntu
sudo dnf update rspamd                      # RHEL/Rocky
sudo pkg upgrade rspamd                     # FreeBSD
```

## Backup and recovery

### Configuration and local data

Back up all of `/etc/rspamd`. Besides `local.d/` and `override.d/`, it holds `rspamd.conf.local`, `rspamd.conf.local.override` and `rspamd.conf.override` if you use them. From `/var/lib/rspamd`, keep `rspamd_dynamic` (score and action changes saved from the web interface) and the DKIM private keys if you store them in `/var/lib/rspamd/dkim/`:

```bash
sudo tar -czf rspamd-backup-$(date +%F).tar.gz /etc/rspamd \
  /var/lib/rspamd/rspamd_dynamic /var/lib/rspamd/dkim
```

Leave out paths that do not exist on your system.

### Redis data

```bash
redis-cli BGSAVE
sudo cp /var/lib/redis/dump.rdb /backup/
```

`BGSAVE` writes the dump in the background; copy the file only after `redis-cli INFO persistence` shows `rdb_bgsave_in_progress:0`. If the dump is not in `/var/lib/redis`, `redis-cli CONFIG GET dir` shows the directory Redis writes it to. `SAVE` writes the dump in the foreground and blocks Redis, including Rspamd's queries, until it is done. To export only the Bayes data, use `rspamadm statistics_dump dump > bayes.dump`.

### Restore

```bash
sudo tar -xzf rspamd-backup-YYYY-MM-DD.tar.gz -C /
sudo systemctl restart rspamd
rspamadm statistics_dump restore -m replace bayes.dump   # if you exported Bayes data
```

By default `restore` adds the dumped counts to whatever Redis already holds (`-m append`). `-m replace` overwrites them instead, so restoring onto a Redis that still has Bayes data does not double the counts.

## Next steps

- Watch the History tab and adjust thresholds
- Read [configuration fundamentals](/guides/configuration/fundamentals)
- Review the [architecture](/developers/architecture) for troubleshooting
- Write [custom rules](/developers/writing_rules)

## Getting help

- [Configuration reference](/configuration/)
- [Community support](/support)
- [FAQ](/faq)
