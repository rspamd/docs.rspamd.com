---
title: Running Rspamd in Kubernetes
---

# Running Rspamd in Kubernetes

Rspamd can run as a fully stateless deployment. Every worker type scales horizontally, and all data that must survive a pod lives in Redis or Valkey. Pod restarts are cheap: with Hyperscan databases [loaded from Redis](#hyperscan-cache-in-redis), a new pod only downloads its remote maps, which are a few megabytes, [compressed with zstd](/configuration/maps), and can come from [your own mirror](#maps-mirror).

Two things still need care. A pod must not receive traffic until its maps are loaded, because until then its verdicts are wrong rather than slow. And it should finish in-flight requests before it exits. This guide covers:

- [how to split Rspamd into deployments](#deployment-layout),
- [how to deliver the configuration](#configuration) to a read-only container,
- [where to keep state](#state) so that pods stay disposable,
- [startup probes](#startup-probes) that admit traffic only to a warm scanner,
- [graceful shutdown](#graceful-shutdown) that drains connections before `SIGTERM`.

Redis, the DNS resolver and controller passwords are covered in the [installation guide](/getting-started/installation#kubernetes). The snippets here are plain Kubernetes manifests and fit into Helm charts, Kustomize or the official [Tanka example](https://github.com/rspamd/rspamd-docker/tree/main/examples/k8s/tanka) alike.

## Deployment layout

Run each worker type as its own `Deployment` behind its own `Service`, so that each one scales and rolls out independently:

| Deployment | Workers | Serves | Replicas |
|------------|---------|--------|----------|
| `rspamd-proxy-milter` | `rspamd_proxy` in milter mode | MTAs in the same cluster; [next to the MTA](#milter-traffic-from-outside-the-cluster) otherwise | Fixed, see below |
| `rspamd-proxy-http` | `rspamd_proxy` without `self_scan` | HTTP clients: `rspamc`, applications, other proxies | Fixed, see below |
| `rspamd-normal` | `normal`, plus `controller` for the startup probe | Scanning requests from both proxies | Autoscaled on CPU |
| `rspamd-fuzzy` | `fuzzy_storage` | Fuzzy hash queries and updates, [preferably over TCP](#fuzzy-storage-over-tcp) | Two, for high availability: a single pod handles a very high query rate, and the network is usually the limit |
| `rspamd-neural-trainer` | Exact copy of `rspamd-normal` | [Neural training](#neural-training-with-rspamd-normal-autoscaling) when scanners autoscale; no Service | Exactly one |

Both proxies use the `rspamd-normal` Service as their upstream. Clients never talk to scanners directly, so scanner pods can be replaced at any time: the proxies retry on another upstream, and the [startup probe](#startup-probes) keeps cold scanners out of the Service. Proxy pods are cheap and start in seconds, which makes them a stable endpoint for MTAs while the scanners change behind them.

The proxies face the clients and work essentially as load balancers, so keep their number stable rather than autoscaling them. Choose a fixed number of replicas once, usually between two and five, and tune their memory: the load depends on message size as much as on message count, because every message in flight is held in memory. A HorizontalPodAutoscaler can be added, but it gains little here.

### Neural training with rspamd-normal autoscaling

The [neural module](/modules/neural) trains its networks on the primary controller of every Rspamd instance, and a Redis lock lets only one of them train at a time. An autoscaled `rspamd-normal` deployment causes two problems:

- Training takes minutes, and a scale-down does not choose which pod to remove. The HorizontalPodAutoscaler can stop exactly the pod that is halfway through training (the `preStop` hook waits for connections, not for training). The CPU spent on it is wasted, and the lock blocks other pods until it expires.
- Training competes with scanning for CPU, so a pod that is training right now can answer noticeably slower than pods that are not.

Separate the roles. The autoscaled scanners keep collecting training vectors but do not train:

```hcl
# local.d/neural.conf on rspamd-normal
rules {
  default {
    train {
      store_set_only = true;   # write spam/ham sets, skip training
    }
  }
}
```

A second deployment, `rspamd-neural-trainer`, is an exact copy of `rspamd-normal` with `replicas: 1` and `store_set_only = false`. It gets no Service, so it receives no scanning traffic and only trains.

Keep everything else identical: image, configuration and environment. Each network is stored under a digest of the symbol profile that the configuration produces, and the trainer only trains networks for its own digest. A trainer whose configuration has drifted from the scanners (a different image tag, a disabled module, an extra rule) gets a different digest, looks for training vectors under its own keys, finds none, and never trains on the vectors the scanners collect. Render both deployments from one template, with an environment variable that switches only `store_set_only`.

With a fixed number of scanner replicas and no autoscaler, the split is optional.

### Fuzzy storage over TCP

Fuzzy storage listens on UDP and TCP on the same port, but clients use UDP unless told otherwise. Inside a cluster both work through a Service, but exposing UDP outside of it is harder: not every Ingress controller or load balancer can forward UDP. TCP is the more portable choice in Kubernetes, and it is enabled per rule in `fuzzy_check`:

```hcl
# local.d/fuzzy_check.conf
rule "local" {
  servers = "rspamd-fuzzy:11335";
  tcp = true;
}
```

### Node-local DNS

Few programs depend on DNS as heavily as Rspamd: a single scan can make up to `dns_max_requests` DNS queries (64 by default, and often raised), for blocklists, SPF, DKIM, DMARC and URL checks. Its results and latency depend directly on DNS. The [installation guide](/getting-started/installation#dns-resolver) explains why the queries must end up at a recursive resolver rather than at cluster DNS, which only forwards them.

In any busy cluster, enable [NodeLocal DNSCache](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/), the Kubernetes add-on that runs a DNS cache on every node. Without it, every query goes through the CoreDNS Service and lands on whichever node hosts a CoreDNS pod, so a CoreDNS pod that crashes, restarts or runs on an overloaded node affects a random share of queries from every Rspamd pod. With NodeLocal DNSCache, each pod asks the cache on its own node, and a DNS problem stays on that node and affects only the pods running there. This is a general recommendation for DNS-heavy workloads, MTAs included, but with the query volume of Rspamd it matters most.

Configure NodeLocal DNSCache to forward external names to your recursive resolver instead of the upstream servers it inherits from the node by default. Rspamd needs no changes: without `dns.nameserver` it uses the pod's `/etc/resolv.conf`, which already leads to the node-local cache.

### Milter traffic from outside the cluster

The milter protocol has no encryption and no authentication. A milter connection carries the whole message and the verdict back, so a `rspamd-proxy-milter` Service must not be reachable from MTAs outside the cluster or across untrusted networks.

When the MTAs run elsewhere, deploy `rspamd-proxy-milter` next to each MTA instead: as a sidecar in the MTA pod, or on the MTA host listening on loopback or a Unix socket. Only the proxy's upstream connection then crosses the network. That connection is HTTP and can be encrypted with [HTTPCrypt](/developers/encryption), Rspamd's own encryption based on a keypair, or with TLS.

To offer both, publish the upstream through an Ingress with TLS enabled and turn off its automatic redirect from HTTP to HTTPS:

- HTTPCrypt clients connect over plain HTTP (port 80). The redirect is off, so the request reaches Rspamd, and HTTPCrypt encrypts it.
- TLS clients connect over HTTPS (port 443) without HTTPCrypt. The Ingress terminates TLS with the certificates you already manage there.

Add such an Ingress wherever you need one: both `rspamd-normal` and `rspamd-proxy-http` work as targets, since proxies can be chained. Behind `rspamd-proxy-http`, HTTPCrypt clients use the public key of that proxy's `keypair` instead of the scanners'. If your Ingress controller limits the request body size by default (some do, others such as HAProxy do not), raise the limit above Rspamd's `max_message_size`, or large messages are rejected before they reach Rspamd.

```hcl
# local.d/worker-proxy.inc on the milter proxy: HTTPCrypt
upstream "scan" {
  default = yes;
  hosts = "rspamd-normal.mail.example.com:80";
  key = "...";        # public key of the scanners' keypair (rspamadm keypair -u)
  compression = yes;
}

# ...or TLS
upstream "scan" {
  default = yes;
  hosts = "rspamd-normal.mail.example.com:443";
  ssl = true;
  compression = yes;
}
```

Because TLS ends at the Ingress, requests reach the scanners as plain HTTP from a non-loopback address, so `encrypted_only = true` on the scanners would reject the TLS clients. Leave it off when you offer both.

[Mirroring](/workers/rspamd_proxy#mirroring) traffic to a test deployment (another set of scanners with a new version or configuration) is easier to manage in one place. When the milter proxies are spread over many MTA deployments or hosts, each of them would need its own `mirror` configuration, kept in sync by hand; it can be simpler to send their upstream to `rspamd-proxy-http` and enable mirroring only there. With a single in-cluster `rspamd-proxy-milter` deployment this makes no difference, and mirroring can stay on the milter proxy itself.

## Configuration

The deployments share most of their configuration but differ in workers, ports, probes and volume sizes. A Helm chart (or a comparable templating tool) keeps that in one values file: the common options, the Redis endpoints per module, the probe and `preStop` scripts, and per-component overrides. Rspamd reads values from environment variables with [configuration templates](/configuration/templates), so the chart passes settings as variables.

There are two ways to get `local.d`, `override.d` and custom Lua rules into the pods. Pick the one that fits how you already ship software; both run the same way.

**Bake it into the image.** Copy the configuration into a derived image at build time and keep every environment-specific value a template variable with a sensible default:

```hcl
# local.d/redis.conf
servers = "{= env.REDIS_SERVERS | default "redis:6379" =}";
```

```dockerfile
FROM rspamd/rspamd:4.3.1
COPY local.d/    /etc/rspamd/local.d/
COPY override.d/ /etc/rspamd/override.d/
COPY lua.local.d/ /etc/rspamd/lua.local.d/
```

The configuration is then versioned and tested together with the image, and a configuration change rolls out as an image update. This suits teams that build their own images anyway, for example to add custom plugins.

**Mount it from ConfigMaps and Secrets.** Keep the stock image and let the chart render the configuration files into a `ConfigMap` mounted at `/etc/rspamd/local.d` (and `override.d` if needed). This suits teams that manage everything through Helm values and do not want an image build for each change. Two details matter:

- A changed `ConfigMap` does not restart the pods. Add its checksum to the pod template annotations (`checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}`) so that every change triggers a rollout.
- Keep passwords, keypairs and Redis credentials in a `Secret` and pass it to the container as `RSPAMD_*` environment variables (`envFrom: [{ secretRef: { name: rspamd-secrets } }]`). Templates read only environment variables, not files, so a Secret mounted as a file cannot be referenced from the configuration.

Either way, the container needs no custom entrypoint script. The image's default command starts the Rspamd main process in the foreground (`rspamd -f`), so it becomes PID 1 and receives `SIGTERM` directly. Rspamd resolves the templates in memory when it loads the configuration, so nothing has to render files with `envsubst` or similar at startup; such a script would need a writable `/etc/rspamd`. The container therefore runs as the unprivileged `_rspamd` user (uid 11333) with a read-only root filesystem and no capabilities, and the only writable paths are the [`emptyDir` volumes](#local-volumes):

```yaml
securityContext:            # pod
  runAsNonRoot: true
  runAsUser: 11333
  runAsGroup: 11333
  fsGroup: 11333
---
securityContext:            # container
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
```

## State

A pod that can be killed and rescheduled at any time should not depend on its local disk. Everything Rspamd needs across restarts either lives in Redis or can be rebuilt quickly:

| Data | Default location | Recommendation |
|------|------------------|----------------|
| Bayes, fuzzy hashes, neural networks, reputation | Redis | Already external; [one instance per module](#redis-per-module) on large setups |
| Hyperscan databases | `hs_cache_dir` (`$DBDIR`) | [Redis cache backend](#hyperscan-cache-in-redis) for `hs_helper` |
| Dynamic configuration (WebUI score and action changes) | `$DBDIR/rspamd_dynconf.json` | [Redis backend, or disabled](#dynamic-configuration) |
| Scan history | Redis (`history_redis`) | [ClickHouse or Elasticsearch](#scan-history); built-in rolling history on the `emptyDir` |
| Remote maps cache | `maps_cache_dir` (`$DBDIR`) | Dedicated `emptyDir`, gated by the [startup probe](#startup-probes); maps from [your own mirror](#maps-mirror) |
| `/tmp`, `/dev/shm` | Container filesystem | `emptyDir` with `medium: Memory`; a [cleaner sidecar](#stale-shared-memory-on-rspamd-proxy-http) on `rspamd-proxy-http` |

### Local volumes

Use `emptyDir` volumes rather than a `PersistentVolumeClaim` for `/var/lib/rspamd`. An `emptyDir` survives container restarts inside the same pod, so a crashed or OOM-killed container comes back warm. A PVC does not fit a `Deployment` anyway: one claim per pod requires a StatefulSet, and the only option in a `Deployment` is a single `ReadWriteMany` claim shared by all pods, which Rspamd's local caches have no use for.

Give the maps cache and the local counters their own volumes instead of sharing `/var/lib/rspamd`. Each volume then gets its own `sizeLimit`, so a growing cache cannot evict the pod by filling the shared directory, and once Hyperscan and dynamic configuration live in Redis the rest of `/var/lib/rspamd` stays tiny. Point Rspamd at the mounts in `local.d/options.inc`:

```hcl
maps_cache_dir = "/var/lib/rspamd/maps_cache";
stats_file = "/var/lib/rspamd/stats/stats.ucl";
rrd = "/var/lib/rspamd/stats/rspamd.rrd";
```

`stats_file` keeps the counters shown by `rspamc stat`, and the RRD file feeds the throughput graph in the WebUI. Both are per pod and lost with it. That is acceptable: if scans are already sent to ClickHouse or Elasticsearch, these counters add nothing, and the RRD file can be switched off entirely with `rrd = null;`.

All of these volumes can use `medium: Memory`: they are small, and tmpfs keeps disk I/O off the scan path. A memory-backed `emptyDir` counts toward the container's memory limit, so include the `sizeLimit` values in it. A complete set of volumes is shown in the [example](#example-volumes) at the end.

### Stale shared memory on rspamd-proxy-http

`rspamd-proxy-http` keeps the body of every request in `/dev/shm` while it is being scanned. When one pod gets a burst of parallel scans with large payloads, the bodies can exceed the volume's `sizeLimit`, and the worker crashes. The files that were in flight at that moment are never removed: they stay on the `emptyDir`, which outlives the container, and take space from every following request until the volume is full for good.

Give `/dev/shm` on proxy pods a generous `sizeLimit` (hundreds of megabytes rather than the 64 MB that is enough elsewhere), and add a small sidecar that deletes stale body files. Set the age well above the longest request you expect:

```yaml
- name: shm-cleaner
  image: busybox:1.36
  command: ["/bin/sh", "-c"]
  args:
    - |
      while true; do
        find /dev/shm -maxdepth 1 -type f -mmin +5 \
          -regex '/dev/shm/rhm\.[a-z0-9]\{20\}' -print -delete
        sleep 60
      done
  securityContext:
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]
  volumeMounts:
    - { name: shm, mountPath: /dev/shm }
```

The other worker types do not store request bodies in shared memory and need no cleaner.

### Redis per module

All persistent data lives in Redis, but putting every module into one instance only works while nothing gets evicted. As soon as the instance hits `maxmemory`, the eviction policy decides which data disappears, and with several modules in one keyspace that decision makes no sense:

- `volatile-ttl` evicts the keys closest to expiry. TTLs of different modules are not comparable: a greylisting record with a five-minute TTL and a Bayes token with a long TTL say nothing about which one matters more.
- `volatile-lru` and `allkeys-lru` evict what was read least recently, and `volatile-lfu` and `allkeys-lfu` evict what is read least often. When the records belong to different modules, neither recency nor frequency of access says which of them is more valuable. A fuzzy hash or the reputation of an IP address or domain may be read rarely, yet it took a long time to accumulate.
- `noeviction` keeps everything, and the modules whose data grows with traffic (replies with the Message-ID of every sent message, reputation, URL redirector and MX check caches, antivirus results) eventually run the whole instance into OOM, taking every other module down with it.

On large installations give each module that holds significant data its own Redis or Valkey instance; every module accepts its own servers, see [Redis setup](/configuration/redis#redis-setup). Within one module, a `volatile-*` policy makes sense again, because it chooses among records of the same kind. Size each instance for your own traffic, and alert when an instance approaches `maxmemory` where you don't expect it to: eviction should be a safety net, not the normal way data leaves Redis.

On its own instance, a module can also rely on eviction deliberately: give its records a long expiry and let `maxmemory` be the real limit. The URL redirector or reputation can work this way, but the most common case is Bayes, described in [bayes_expiry](/modules/bayes_expiry#limiting-memory-usage); it is worth its own instance even on a small installation.

For Redis high availability, see the [installation guide](/getting-started/installation#production-notes).

### Hyperscan cache in Redis

On a cold start every pod compiles the same Hyperscan databases, which costs CPU and time on each rollout. Since Rspamd 4.0 the `hs_helper` worker can keep compiled databases in Redis instead of the local directory: the first pod on a given CPU architecture compiles and stores them, and the other pods on the same architecture load them.

```hcl
# local.d/worker-hs_helper.inc
cache_backend = "redis";
redis {
  servers = "redis-hs:6379";
  prefix = "rspamd_zhs";
  ttl = 2592000;      # 30 days
  compression = true;
}
```

Hyperscan databases depend on the CPU features of the host, so Redis accumulates a separate set for every CPU architecture that Rspamd has ever run on in the cluster. Sets for node types that are long gone remain until their `ttl` expires.

### Dynamic configuration

The WebUI and the controller API can change symbol scores and action thresholds at runtime. Since Rspamd 4.3.1 these changes are handled by the dynamic configuration framework (`dynconf`), which stores them in a file by default. With several replicas the file backend is not suitable: each pod writes its own file, so the replicas end up with different settings, and the changes are lost when a pod is replaced. In Kubernetes, use one of the two other options.

If you want to change scores at runtime without going through your configuration code, use the Redis backend, which all pods share:

```hcl
# local.d/dynconf.conf
backend = "redis";
servers = "redis-dynconf:6379";   # falls back to the global `redis` section when omitted
```

Otherwise disable the framework and keep all scores in the configuration, rendered from environment variables or values with [configuration templates](/configuration/templates). If the configuration is managed as code (Helm values, GitOps), this also avoids drift between the code and what runs:

```hcl
# local.d/dynconf.conf
enabled = false;
```

### Scan history

[`history_redis`](/modules/history_redis) is a simple, short history: the last `nrows` scans (200 by default), searchable in the WebUI but without analytics, dashboards or aggregation. It is designed for a handful of long-lived hosts and fits Kubernetes poorly:

- Its default key contains the hostname (`rs_history{{HOSTNAME}}{{COMPRESS}}`), and the names of Deployment pods change on every rollout. Each new pod starts an empty list, and the old lists stay in Redis forever unless `expire` is set.
- The controller shows only the list of its own hostname, so with several scanner pods behind one Service every WebUI request shows the history of whichever pod answered it.
- A fixed `key_prefix` without `{{HOSTNAME}}` makes all pods share one list, but that list holds only the last `nrows` scans of the whole fleet, which on a busy cluster is a few seconds of traffic.

Send history to [ClickHouse](/modules/clickhouse) or [Elasticsearch](/modules/elastic) instead: both keep every scan from all pods and support search and aggregation. Exclude `history_redis` from the common Redis settings with `disabled_modules`:

```hcl
# local.d/redis.conf
disabled_modules = ["history_redis"];
```

Without Redis, the WebUI falls back to Rspamd's built-in rolling history: the last `history_rows` scans of the pod, kept in shared memory and saved to `history_file` on shutdown. With `history_file` on the `emptyDir` it survives container restarts, which is enough for a quick look at a pod.

### Maps mirror

The stock configuration downloads its built-in maps from `https://maps.rspamd.com`. To use your own mirror instead, set `RSPAMD_MAPS_MIRROR`:

```yaml
env:
  - name: RSPAMD_MAPS_MIRROR
    value: http://rspamd-maps.mail.svc.cluster.local
```

Rspamd then requests `/rspamd/*.inc.zst` and `/freemail/*.txt.zst` from that address. Fill the mirror from the [rspamd/maps](https://github.com/rspamd/maps) repository; it keeps the files uncompressed, so compress them after each update:

```bash
git clone --depth 1 https://github.com/rspamd/maps.git
cd maps
find rspamd freemail -type f \( -name '*.inc' -o -name '*.txt' \) -exec zstd -q -f -19 {} \;
```

Upload the files to an S3-compatible bucket, or serve the directory with any static web server, and refresh them with a `CronJob`. Rspamd fetches maps with plain HTTP requests and does not sign them, so a bucket needs public read access. S3 and common web servers such as nginx send `Last-Modified` and `ETag` out of the box, so Rspamd downloads a map again only when it has changed. With a mirror inside your own infrastructure, a new pod loads its maps in milliseconds and does not depend on an external host to become ready.

## Startup probes

The [health endpoints](/getting-started/installation#production-notes) `/ping` and `/ready` report that workers are running, but not that remote maps have been downloaded. A scanner answers both while it still runs with empty multimaps, RBL allow lists or SpamAssassin rule maps, and its verdicts during that window are wrong rather than slow. `initialDelaySeconds` does not fix this: it is a guess that is too long on a fast start and too short when a map server is slow.

The controller's `/maps` endpoint lists every map with its `loaded` and `cached` flags, and the startup probe below uses it. Two details decide how the probe is built:

- `httpGet` probes come from the node, not from loopback. The kubelet connects to the pod IP from the node's address, so controller endpoints ask for a password. `exec` probes run inside the container and reach the controller over `127.0.0.1`, which is a `secure_ip` in the stock configuration. `secure_ip` set in `local.d/worker-controller.inc` is added to the defaults; only `override.d` replaces them.
- The official image has no `curl` or `jq`; its own `HEALTHCHECK` uses bash `/dev/tcp`. The probe scripts need both, so install them in a [derived image](#configuration).

### Startup script

The script checks that the scanner answers and that every HTTP(S) map is cached. It supports two modes:

- `strict` keeps the pod out of service until all maps are cached. A map server that is down blocks the rollout, which is visible and safe.
- `optimistic` waits for maps up to a deadline and then admits traffic anyway, so one unreachable map does not stall the deployment. Use it when you would rather scan with a missing map than not scan at all.

```bash
#!/bin/bash
# startup.sh strict|optimistic [deadline_seconds]
set -o pipefail
MODE=${1:-strict}
DEADLINE=${2:-50}

pending_maps() {
  curl -fsS --max-time 2 http://127.0.0.1:11334/maps |
    jq '[.[] | select(.type == "http" or .type == "https") | select(.cached | not)] | length'
}

if ! curl -fsS --max-time 2 http://127.0.0.1:11333/ping | grep -q pong; then
  echo "scanner does not answer /ping"
  exit 1
fi

if [ "$MODE" = strict ]; then
  PENDING=$(pending_maps) || { echo "cannot read /maps"; exit 2; }
  if [ "$PENDING" -gt 0 ]; then
    echo "$PENDING remote maps are not cached yet"
    exit 3
  fi
else
  END=$((SECONDS + DEADLINE))
  until PENDING=$(pending_maps) && [ "$PENDING" -eq 0 ]; do
    if [ "$SECONDS" -ge "$END" ]; then
      echo "${PENDING:-unknown number of} maps still not cached, starting anyway"
      break
    fi
    sleep 3
  done
fi

# The controller caches the map first; scanner workers pick it up from the
# shared cache on their own timer a few seconds later
sleep 6
```

The script reads `/maps` from the controller, so the controller worker must run in the same container as the scanner.

### Probe configuration

The startup probe runs first; liveness and readiness probes start only after it succeeds, so the pod receives no traffic while maps are loading. After startup, the unauthenticated `/ping` on the scanner port is enough for both:

```yaml
startupProbe:
  exec:
    command: ["/scripts/startup.sh", "strict"]
  periodSeconds: 3
  timeoutSeconds: 10      # covers the final sleep
  failureThreshold: 60    # give up after ~3 minutes and restart the container
livenessProbe:
  httpGet:
    path: /ping
    port: 11333
  periodSeconds: 3
  timeoutSeconds: 2
  failureThreshold: 10
readinessProbe:
  httpGet:
    path: /ping
    port: 11333
  periodSeconds: 3
  timeoutSeconds: 2
  successThreshold: 2
  failureThreshold: 2
```

In the optimistic mode the script itself waits, so the probe needs a long timeout and few retries:

```yaml
startupProbe:
  exec:
    command: ["/scripts/startup.sh", "optimistic", "50"]
  periodSeconds: 3
  timeoutSeconds: 60      # longer than the deadline plus the final sleep
  failureThreshold: 15
```

Proxy and fuzzy pods do not load scanner maps and need simpler probes, matched to the protocol they serve:

| Deployment | Probe |
|------------|-------|
| `rspamd-proxy-http` | `httpGet` on `/ping` at the proxy port (11332) |
| `rspamd-proxy-milter` | `tcpSocket` on the milter port: milter is not HTTP |
| `rspamd-fuzzy` | `exec` with `rspamadm control fuzzystat`: fuzzy storage speaks its own UDP/TCP protocol, not HTTP |

## Graceful shutdown

When a pod is deleted, Kubernetes marks it as terminating, removes it from Service endpoints, runs the `preStop` hook and only then sends `SIGTERM`. Endpoint removal is asynchronous: kube-proxy and Ingress controllers may still route new connections to the pod for a few seconds. Without a `preStop` hook, Rspamd receives `SIGTERM` while requests are in flight, and clients see closed connections. Depending on the client this means a temporary failure, a retry, or a message that passes unscanned.

`rspamadm control stat -j` reports the number of open connections across workers in `.total.conns`. The hook first waits for traffic to stop arriving, then waits for the counter to drop to zero, with an upper bound:

```bash
#!/bin/bash
# prestop.sh [timeout_seconds]
TIMEOUT=${1:-60}

# Let kube-proxy and Ingress controllers stop sending new connections
sleep 5

for ((i = 0; i < TIMEOUT; i++)); do
  CONNS=$(rspamadm control stat -j 2>/dev/null | jq -r '.total.conns // 0')
  [ "${CONNS:-0}" -gt 0 ] || break
  sleep 1
done
```

```yaml
spec:
  terminationGracePeriodSeconds: 75   # preStop budget plus time to exit after SIGTERM
  containers:
    - name: rspamd
      lifecycle:
        preStop:
          exec:
            command: ["/scripts/prestop.sh", "60"]
```

Set the timeout to about twice the `task_timeout` from `options.inc`, so the slowest legitimate scan still completes. `terminationGracePeriodSeconds` includes the `preStop` hook: if it is shorter than the hook, the kubelet kills the container with `SIGKILL` in the middle of draining.

Not every worker type reports its connections:

| Worker | Connections counted |
|--------|--------------------|
| `normal`, `controller` | Yes |
| `rspamd_proxy` (HTTP and milter) | Yes |
| `fuzzy_storage` | No |

For `rspamd-fuzzy` the counter is always 0, so the script would return at once. Its `preStop` hook must be a plain `sleep` that covers endpoint propagation and the longest fuzzy request, for example `command: ["sleep", "10"]`.

## Example volumes

The scripts are usually shipped in a `ConfigMap` mounted with an executable mode, next to the [local volumes](#local-volumes) of a scanner pod:

```yaml
volumes:
  - name: scripts
    configMap:
      name: rspamd-scripts
      defaultMode: 0555
  - name: dbdir
    emptyDir:
      medium: Memory
      sizeLimit: 8Mi      # small once Hyperscan cache and dynconf are in Redis
  - name: maps-cache
    emptyDir:
      medium: Memory
      sizeLimit: 64Mi
  - name: stats
    emptyDir:
      medium: Memory
      sizeLimit: 1Mi      # stats_file; raise it if the RRD file is kept here too
  - name: tmp
    emptyDir:
      medium: Memory
      sizeLimit: 64Mi
  - name: shm
    emptyDir:
      medium: Memory
      sizeLimit: 64Mi
containers:
  - name: rspamd
    volumeMounts:
      - { name: scripts,    mountPath: /scripts, readOnly: true }
      - { name: dbdir,      mountPath: /var/lib/rspamd }
      - { name: maps-cache, mountPath: /var/lib/rspamd/maps_cache }
      - { name: stats,      mountPath: /var/lib/rspamd/stats }
      - { name: tmp,        mountPath: /tmp }
      - { name: shm,        mountPath: /dev/shm }
```

## Related documentation

- [Installation: Kubernetes](/getting-started/installation#kubernetes) — Redis, DNS resolver and health endpoints
- [Controller worker](/workers/controller) — passwords and `secure_ip`
- [Proxy worker](/workers/rspamd_proxy) — upstreams, encryption and mirroring
- [Neural module](/modules/neural) — training options such as `store_set_only`
- [Maps](/configuration/maps) — map types, caching and compression
- [Configuration templates](/configuration/templates) — rendering configuration from environment variables
- [Global options](/configuration/options) — `task_timeout`, `maps_cache_dir`, `stats_file`, `rrd`
