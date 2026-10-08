---
title: Installation Guide
sidebar_position: 2
---

# Installation guide

This page covers installing Rspamd from packages or running the official Docker image, checking that it works, and fixing common problems. The [downloads page](/downloads) lists the supported distribution releases, experimental and ASAN packages, and how to build from source. Once Rspamd is running, continue with [First setup](/getting-started/first-setup).

## Package installation

Packages are the recommended way to run Rspamd on a mail server. New versions arrive when you upgrade packages with `apt`, `dnf` or `pkg`, like the rest of the system.

Rspamd keeps Bayes statistics, greylisting and rate-limit data in Redis, so each distribution section below also installs a Redis server. Rspamd also needs a local recursive DNS resolver; see [DNS resolver](#dns-resolver).

### Debian and Ubuntu

```bash
# Install prerequisites
sudo apt-get update
sudo apt-get install -y lsb-release wget gpg

# Add GPG key
sudo mkdir -p /etc/apt/keyrings
wget -O- https://rspamd.com/apt-stable/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/rspamd.gpg > /dev/null

# Add repository
CODENAME=$(lsb_release -c -s)
echo "deb [signed-by=/etc/apt/keyrings/rspamd.gpg] http://rspamd.com/apt-stable/ $CODENAME main" | sudo tee /etc/apt/sources.list.d/rspamd.list
echo "deb-src [signed-by=/etc/apt/keyrings/rspamd.gpg] http://rspamd.com/apt-stable/ $CODENAME main" | sudo tee -a /etc/apt/sources.list.d/rspamd.list

# Install
sudo apt-get update
sudo apt-get --no-install-recommends install rspamd

# Install Redis and make sure both services are enabled and running
sudo apt-get install redis-server
sudo systemctl enable --now rspamd redis-server
```

### RHEL, AlmaLinux, Rocky Linux and other EL distributions

The packages need [EPEL](https://docs.fedoraproject.org/en-US/epel/):

```bash
sudo dnf install epel-release
```

On RHEL itself, `epel-release` is not in the Red Hat repositories. Install it from the Fedora project instead:

```bash
sudo dnf install https://dl.fedoraproject.org/pub/epel/epel-release-latest-$(rpm -E %rhel).noarch.rpm
```

Add the Rspamd repository and install the package:

```bash
# Determine EL version and add repository
source /etc/os-release
EL_VERSION=$(echo -n $PLATFORM_ID | sed "s/.*el//")
sudo curl -o /etc/yum.repos.d/rspamd.repo https://rspamd.com/rpm-stable/centos-${EL_VERSION}/rspamd.repo

# Install
sudo dnf install rspamd
```

Then install Redis and start the services. EL 10 ships Valkey instead of Redis; Rspamd works with it using the same settings.

```bash
# EL 8 and EL 9
sudo dnf install redis
sudo systemctl enable --now rspamd redis

# EL 10
sudo dnf install valkey
sudo systemctl enable --now rspamd valkey
```

### FreeBSD

```bash
# Install binary packages
sudo pkg install rspamd redis

# Enable and start the services
sudo sysrc redis_enable="YES"
sudo sysrc rspamd_enable="YES"
sudo service redis start
sudo service rspamd start
```

To build from the ports tree instead, run `cd /usr/ports/mail/rspamd && make install clean`.

### Connect Rspamd to Redis

Installing Redis is not enough. The shipped configuration has no Redis server set, so Bayes, greylisting and rate limiting stay disabled until you add one:

```hcl
# /etc/rspamd/local.d/redis.conf
servers = "127.0.0.1";
```

On FreeBSD the file is `/usr/local/etc/rspamd/local.d/redis.conf`. Restart Rspamd afterwards (`sudo systemctl restart rspamd`, or `sudo service rspamd restart` on FreeBSD). [First setup](/getting-started/first-setup) and [Redis configuration](/configuration/redis) describe the other Redis options.

### Verify the installation

On Linux:

```bash
sudo systemctl status rspamd
sudo ss -tlnp | grep rspamd
```

On FreeBSD:

```bash
sudo service rspamd status
sudo sockstat -4 -6 -l | grep rspamd
```

By default every worker listens on `localhost` only, which means both `127.0.0.1` and `::1` when IPv6 is available:

| Port | Worker | Purpose |
|------|--------|---------|
| 11332 | proxy | Milter endpoint for the MTA |
| 11333 | normal | Scanner for HTTP integrations (`/checkv2`) |
| 11334 | controller | Web interface and management API |

### Key paths

| | Linux packages | FreeBSD |
|---|---|---|
| Binary | `/usr/bin/rspamd` | `/usr/local/bin/rspamd` |
| Configuration | `/etc/rspamd` | `/usr/local/etc/rspamd` |
| Runtime data | `/var/lib/rspamd` | `/var/db/rspamd` |
| Log file | `/var/log/rspamd/rspamd.log` | `/var/log/rspamd/rspamd.log` |
| User and group | `_rspamd` | `rspamd` |

Put your changes in `local.d/` (merged into the defaults) or `override.d/` (each option set there replaces its default value instead of being merged) under the configuration directory. Don't edit the shipped files. Upgrades bring new versions of them. On FreeBSD the package upgrade replaces them and your edits are lost. The RPM package keeps your copy and saves the new one as `.rpmnew`, and on Debian and Ubuntu dpkg asks which version to keep, so you have to merge the changes by hand.

The runtime data directory holds symbol and Hyperscan caches, scan history, RRD data and scan counters. Learned Bayes data is stored in Redis, not there.

Two command-line tools come with Rspamd: `rspamc` scans and learns messages and queries the controller, and `rspamadm` handles administration (configuration test and dump, passwords, keypairs and more).

### Set the web interface password

The controller trusts connections from `127.0.0.1` and `::1` (its `secure_ip` setting) and does not ask them for a password. On the server itself, the web interface opens at `http://localhost:11334` without a login. From your workstation, open an SSH tunnel and use the same URL:

```bash
ssh -L 11334:localhost:11334 user@your-server
```

Set a password anyway. Clients that connect from an address outside `secure_ip` need one, for example after you change the controller's `bind_socket` or put a reverse proxy in front of it that sends `X-Forwarded-For` (see [Security](#security)). The default password `q1` is refused for those clients. Generate a hash:

```bash
rspamadm pw
```

Add it to `/etc/rspamd/local.d/worker-controller.inc` (`/usr/local/etc/rspamd/local.d/worker-controller.inc` on FreeBSD). Create the file if it doesn't exist, and keep any other settings already in it:

```hcl
# /etc/rspamd/local.d/worker-controller.inc
password = "$2$your_generated_hash";
```

Then restart Rspamd (`sudo systemctl restart rspamd`, or `sudo service rspamd restart` on FreeBSD). Unless you also set a separate `enable_password`, this password allows learning and configuration changes too; see [Controller worker](/workers/controller).

## Docker installation

Use the image if your mail services already run in containers, or for a test instance.

The official image is [`rspamd/rspamd`](https://hub.docker.com/r/rspamd/rspamd), built from the [rspamd-docker](https://github.com/rspamd/rspamd-docker) repository. It differs from the packages in a few ways:

- It runs as uid/gid `11333:11333`.
- It logs to the console, so there is no log file; use `docker compose logs`.
- The shipped configuration lives in `/usr/share/rspamd/config`, and your files go into `/etc/rspamd/local.d` and `/etc/rspamd/override.d`.
- Workers bind to all interfaces inside the container (`RSPAMD_LOCAL_ADDR=*`). You control exposure with the published ports.

### Docker Compose

This setup follows the [official Compose example](https://github.com/rspamd/rspamd-docker/tree/main/examples/compose): Rspamd, Redis and a recursive Unbound resolver on a private network. Create a directory with these files:

```text
compose.yaml
unbound.conf
local.d/options.inc
local.d/redis.conf
```

`compose.yaml`:

```yaml
# compose.yaml
services:
  rspamd:
    image: rspamd/rspamd:latest
    depends_on:
      - redis
      - unbound
    ports:
      - "127.0.0.1:11332:11332"
      - "127.0.0.1:11333:11333"
      - "127.0.0.1:11334:11334"
    volumes:
      - ./local.d:/etc/rspamd/local.d:ro
      - rspamd-data:/var/lib/rspamd
    networks:
      - rspamd
    restart: unless-stopped

  redis:
    image: redis:latest
    command: "redis-server --save 60 1 --loglevel warning"
    volumes:
      - redis-data:/data
    networks:
      - rspamd
    restart: unless-stopped

  unbound:
    image: alpinelinux/unbound
    volumes:
      - ./unbound.conf:/etc/unbound/unbound.conf:ro
    networks:
      rspamd:
        ipv4_address: 192.0.2.254
    restart: unless-stopped

networks:
  rspamd:
    ipam:
      config:
        - subnet: 192.0.2.0/24

volumes:
  rspamd-data:
  redis-data:
```

All three ports are published on `127.0.0.1` only, as the image README recommends, so none of them is reachable from other hosts. If your MTA runs on another machine, publish 11332 on the specific address the MTA connects to. Host firewalls such as ufw don't filter ports that Docker publishes, because Docker manages its own iptables rules.

The named volume `rspamd-data` keeps `/var/lib/rspamd` across container upgrades. If you use a bind mount instead, the host directory must be writable by uid/gid 11333 (`mkdir -p data && sudo chown 11333:11333 data`). Bayes data lives in Redis, so keep the `redis-data` volume as well.

`unbound.conf` sets up a recursive resolver with no forwarders, as in the official example:

```text
# unbound.conf (mounted as /etc/unbound/unbound.conf)
server:
    access-control: 192.0.2.0/24 allow
    do-ip6: no
    interface: 0.0.0.0
    use-syslog: no
    logfile: ""
```

`local.d/options.inc` makes Rspamd use it (see [DNS resolver](#dns-resolver) for why):

```hcl
# local.d/options.inc (mounted as /etc/rspamd/local.d/options.inc)
dns {
  nameserver = ["192.0.2.254"];
}
```

`local.d/redis.conf` points Rspamd at the Redis service:

```hcl
# local.d/redis.conf (mounted as /etc/rspamd/local.d/redis.conf)
servers = "redis";
```

Start the stack and generate a controller password hash:

```bash
docker compose up -d
docker compose exec rspamd rspamadm pw
```

`rspamadm pw` reads the password from a terminal. `docker compose exec` allocates one by default; with plain `docker exec`, add `-it`.

Put the hash into `local.d/worker-controller.inc` and restart Rspamd with `docker compose restart rspamd`:

```hcl
# local.d/worker-controller.inc (mounted as /etc/rspamd/local.d/worker-controller.inc)
password = "$2$your_generated_hash";
```

The web interface is then at `http://localhost:11334` on the Docker host and asks for this password. Requests through a published port reach the container from the Docker network, not from `127.0.0.1` or `::1`, so `secure_ip` does not cover them and the default password `q1` is refused.

Read the logs with `docker compose logs -f rspamd`. To upgrade, run `docker compose pull` and then `docker compose up -d`.

### Production notes

Use `/ping` for liveness checks. It needs no authentication and works on the controller and on the normal worker (port 11333); the image's built-in `HEALTHCHECK` already requests it from the controller. For readiness, use `/ready` on the controller, which returns an error while no scanner workers are running. It requires the controller password in a `Password` header unless the probe comes from an address in `secure_ip`. Don't use `/stat` for probes; it is a password-protected statistics endpoint.

For Redis high availability, use [Redis Sentinel](/configuration/redis#redis-sentinel) (the `sentinels` option in `local.d/redis.conf`) or a primary/replica setup with `write_servers` and `read_servers`. Rspamd does not support Redis Cluster.

The official Compose example suggests `read_only: true` for the Rspamd container in production.

### Kubernetes

Run Rspamd as a Deployment and keep shared state in Redis. The official [Tanka example](https://github.com/rspamd/rspamd-docker/tree/main/examples/k8s/tanka) creates a Deployment, a Service for ports 11332, 11333 and 11334, ConfigMaps mounted as `/etc/rspamd`, `/etc/rspamd/local.d` and `/etc/rspamd/override.d`, and an optional PersistentVolumeClaim for `/var/lib/rspamd`.

The example deploys neither Redis nor a resolver. Run them separately and point `local.d/redis.conf` and `dns.nameserver` at them. Cluster DNS (CoreDNS) forwards queries rather than resolving them itself, so use a recursive resolver such as Unbound. The `/ping` and `/ready` endpoints described above work as liveness and readiness probes.

## DNS resolver

Rspamd makes many DNS queries per message: DNS blocklists, SPF, DKIM, DMARC and URL blocklists. Use a local recursive resolver, both in Docker and with packages.

With packages, Rspamd reads its nameservers from `/etc/resolv.conf`. Run a recursive resolver such as Unbound on the mail server and point `/etc/resolv.conf` at it, or set it for Rspamd only in `local.d/options.inc`:

```hcl
# /etc/rspamd/local.d/options.inc
dns {
  nameserver = ["127.0.0.1"];
}
```

Major DNS blocklists refuse queries that come through public resolvers such as 8.8.8.8 or 1.1.1.1. Spamhaus answers them with `127.255.255.254`, which Rspamd reports as `RBL_SPAMHAUS_BLOCKED_OPENRESOLVER`, `RECEIVED_SPAMHAUS_BLOCKED_OPENRESOLVER` or `DBL_BLOCKED_OPENRESOLVER`; URIBL and SURBL refusals appear as `URIBL_BLOCKED` and `SURBL_BLOCKED`. These symbols have a score of 0, so the lists stop contributing to the verdict.

Rspamd also checks each list with a periodic test query, and through a public resolver these checks usually fail as well. The log then shows notices such as `DNS query blocked on multi.uribl.com (127.0.0.1 returned)` or `DNS reply returned 'no error' for zen.spamhaus.org while 'no records with this name' was expected`, followed by `... disable object`. After that, Rspamd skips the list until a later check succeeds, so its `*_BLOCKED` symbols may disappear from scan results too.

Inside a container, `/etc/resolv.conf` points to Docker's embedded DNS server (`127.0.0.11`), which only forwards queries to the host's resolvers. That is why the Compose file above runs Unbound and `options.inc` sets it as `dns.nameserver`. The Compose file gives Unbound a fixed address, so Rspamd does not need Docker's DNS to find its resolver. A service name such as `"unbound"` also works, because Rspamd resolves nameserver hostnames once when it starts.

## Testing alongside SpamAssassin

If you are replacing SpamAssassin, you can run Rspamd next to it first and compare the results in message headers before Rspamd rejects anything. Disable the reject and greylist actions:

```hcl
# /etc/rspamd/local.d/actions.conf
reject = null;
greylist = null;
```

Setting the greylist action to `null` does not turn off the greylist module. Once Redis is configured, the module still defers new senders whose messages get the `add header` action. Turn it off while you test:

```hcl
# /etc/rspamd/local.d/greylist.conf
enabled = false;
```

`add_header` keeps its default threshold of 6, so in milter mode messages scoring 6 or more get `X-Spam: Yes` and are still delivered. Rspamd adds no score headers by default. Enable them, including for mail from local addresses and authenticated users:

```hcl
# /etc/rspamd/local.d/milter_headers.conf
extended_spam_headers = true;
skip_local = false;
skip_authenticated = false;
```

Messages then carry `X-Spamd-Result` (score and symbols), `X-Rspamd-Action`, `X-Rspamd-Server` and `X-Rspamd-Queue-Id`. See [Migrating from SpamAssassin](/tutorials/migrate_sa#rollout-strategy) for the rollout and for converting SpamAssassin rules.

## Testing your installation

### Scan a message

```bash
# Pass a message file (or several files, or a directory)
rspamc /path/to/message.eml

# Or read the message from standard input
rspamc < /path/to/message.eml
```

A message without `From`, `To`, `Date` and `Message-ID` headers scores high on its own; [First setup](/getting-started/first-setup#step-2-test-basic-functionality) shows a complete test message.

By default `rspamc` sends the message to the controller on `localhost:11334` (the controller scans messages too); use `-h` to connect to another address. It prints the action, the score and the symbols that matched. With Docker, run it inside the container; `-T` disables the terminal so the file can be piped in:

```bash
docker compose exec -T rspamd rspamc < /path/to/message.eml
```

### Web interface

Open the web interface as described in [Set the web interface password](#set-the-web-interface-password) for packages or in [Docker Compose](#docker-compose) for the container. The Status tab shows the scan counters. On the Scan/Learn tab you can paste a message and scan it; scanned messages then appear on the History tab.

### MTA integration

After you connect your MTA (see [MTA integration](/tutorials/integration)), follow [Verify end-to-end](/getting-started/first-setup#step-4-verify-end-to-end) in First setup. It enables the spam headers and explains why mail from the server itself or from authenticated users gets none.

## Troubleshooting

### Rspamd doesn't start

Test the configuration first, then read the log:

```bash
sudo rspamadm configtest

# Linux packages
sudo journalctl -u rspamd -n 50
sudo tail -n 50 /var/log/rspamd/rspamd.log

# FreeBSD
sudo tail -n 50 /var/log/rspamd/rspamd.log

# Docker
docker compose run --rm rspamd rspamadm configtest
docker compose logs rspamd
```

### Permission errors

Rspamd must be able to write to its data and log directories:

```bash
# Linux packages
sudo chown -R _rspamd:_rspamd /var/lib/rspamd /var/log/rspamd

# FreeBSD
sudo chown -R rspamd:rspamd /var/db/rspamd /var/log/rspamd
```

In Docker, a bind-mounted `/var/lib/rspamd` must be writable by uid/gid 11333.

Rspamd packages don't ship an SELinux policy module. If you suspect SELinux on an EL system, look at the actual denials (`sudo ausearch -m avc -ts recent`) and address those.

### Port already in use

```bash
# Linux
sudo ss -tlnp | grep 1133

# FreeBSD
sudo sockstat -4 -6 -l | grep 1133
```

To move a worker to another port, set `bind_socket` in its `local.d/worker-*.inc` file; this replaces the default address. If you move the normal worker, the proxy still sends messages to its default upstream on port 11333, so point that upstream at the new port as well:

```hcl
# /etc/rspamd/local.d/worker-normal.inc
bind_socket = "localhost:11433";
```

```hcl
# /etc/rspamd/local.d/worker-proxy.inc
upstream "local" {
  hosts = "localhost:11433";
}
```

`rspamc` is not affected: on localhost it sends scans to the controller on port 11334 by default.

### Redis is not used

Check that a Redis server is configured, then look for Redis errors in the Rspamd log:

```bash
# Should print a servers line
sudo rspamadm configdump redis

sudo grep -i redis /var/log/rspamd/rspamd.log | tail
# Docker: docker compose logs rspamd | grep -i redis

# Should answer PONG (valkey-cli on EL 10; docker compose exec redis redis-cli ping in Docker)
redis-cli ping
```

`rspamc stat` does not test Redis: it shows the controller's counters whether Redis works or not.

### DNS problems in Docker

Typical signs are DNS timeouts and `disable object` notices for DNS blocklists in the log, and `*_BLOCKED_OPENRESOLVER`, `URIBL_BLOCKED` or `SURBL_BLOCKED` symbols in scan results (see [DNS resolver](#dns-resolver)). The image contains no `dig`, and `/etc/resolv.conf` inside the container always shows `127.0.0.11`, whatever Rspamd itself uses. Check these instead:

```bash
# The resolver Rspamd uses: look for the dns { nameserver ... } block
docker compose exec rspamd rspamadm configdump options

# Query Unbound from a throwaway container on the same network
# (the network is named <project>_rspamd; docker network ls shows it)
docker run --rm --network <project>_rspamd busybox nslookup rspamd.com 192.0.2.254

# DNS errors, and the per-message "dns req" counts
docker compose logs rspamd | grep -i dns
```

## Security

With packages, every worker listens on localhost only and the controller trusts only `127.0.0.1` and `::1`, so nothing is reachable from the network until you change a `bind_socket`. The steps below matter once you expose a worker:

- Set a controller password (see [above](#set-the-web-interface-password)) before exposing port 11334, or keep using an SSH tunnel. If a reverse proxy on the same host sits in front of the controller, make it send `X-Forwarded-For` or `X-Real-IP`. Without one of these headers every proxied request comes from `127.0.0.1` and skips the password check.
- For an MTA on another host, bind the proxy worker to the address the MTA connects to (or to all interfaces with `*`, as below), then allow only the MTA through the firewall. An MTA on the same host needs neither change.

  ```hcl
  # /etc/rspamd/local.d/worker-proxy.inc
  bind_socket = "*:11332";
  allow_file_and_shm_inputs = false;  # don't let network clients make Rspamd read local files
  ```

  ```bash
  # Example with ufw
  sudo ufw allow from <mta-ip> to any port 11332 proto tcp
  ```

- By default, workers also read a message from a local file or shared-memory segment when a TCP client names one in its request (`allow_file_and_shm_inputs`). The proxy snippet above turns this off; set the same option to `false` in the file of any other worker you expose, and keep workers off untrusted networks.
- Keep the data and log directories owned by the Rspamd user (`_rspamd` on Linux, `rspamd` on FreeBSD), as shown under [Permission errors](#permission-errors).
- Between hosts, encrypt traffic: give the workers a keypair generated with `rspamadm keypair` ([HTTPCrypt](/workers/controller#encryption-support)), or use [native HTTPS](/workers/#https-support) (Rspamd 4.0 and later).

In Docker, workers listen on all interfaces inside the container. Limit access with the published ports (`127.0.0.1:11334:11334`), not with `bind_socket`.

## Next steps

1. [First setup](/getting-started/first-setup): test scans, actions, Postfix integration and Bayes training
2. [MTA integration](/tutorials/integration): Postfix, Exim, Sendmail and others
3. [Configuration](/configuration/): how the configuration files fit together
4. [Migrating from SpamAssassin](/tutorials/migrate_sa)

## Getting help

- [FAQ](/faq)
- [Support channels](/support): Discord, Telegram, mailing lists and GitHub Discussions
- [GitHub issues](https://github.com/rspamd/rspamd/issues) for bug reports
