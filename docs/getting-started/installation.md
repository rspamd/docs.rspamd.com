---
title: Installation Guide
sidebar_position: 2
---

# Rspamd Installation Guide

This guide covers the recommended installation methods for Rspamd. Choose based on your deployment scenario:

- **Package Installation** (recommended): For production systems, automatic updates, system integration
- **Docker/Container**: For testing, development, cloud-native deployments, or containerized infrastructure
- **FreeBSD Ports**: For FreeBSD systems

## Installation Methods Comparison

| Method | Best For | Update Management | Complexity |
|--------|----------|-------------------|------------|
| **OS Packages** | Production servers | Automatic via package manager | Low |
| **Docker** | Testing, development, K8s | Manual image updates | Low-Medium |
| **FreeBSD Ports** | FreeBSD systems | Via pkg or ports | Low |

## Package Installation (Recommended)

Package installation provides automatic updates, system integration, and is the recommended method for production deployments.

### Supported Platforms

- **Ubuntu 20.04+, Debian 11+**: Official APT repository
- **CentOS/RHEL 8+, Rocky Linux, AlmaLinux**: Official YUM/DNF repository  
- **FreeBSD**: Official pkg repository and ports collection

### Ubuntu/Debian

```bash
# Add Rspamd repository GPG key (modern method)
curl -fsSL https://rspamd.com/apt-stable/gpg.key | \
  sudo gpg --dearmor -o /usr/share/keyrings/rspamd.gpg

# Add Rspamd repository
echo "deb [signed-by=/usr/share/keyrings/rspamd.gpg] https://rspamd.com/apt-stable/ $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/rspamd.list

# Update package list
sudo apt update

# Install Rspamd and Redis
sudo apt install rspamd redis-server

# Start and enable services
sudo systemctl start rspamd redis-server
sudo systemctl enable rspamd redis-server
```

### CentOS/RHEL/Rocky Linux/AlmaLinux

```bash
# Add Rspamd repository
curl -sSL https://rspamd.com/rpm-stable/centos-8/rspamd.repo | \
  sudo tee /etc/yum.repos.d/rspamd.repo

# Install Rspamd and Redis
sudo dnf install rspamd redis

# Start and enable services
sudo systemctl start rspamd redis
sudo systemctl enable rspamd redis
```

### FreeBSD

```bash
# Install from ports
sudo pkg install rspamd redis

# Enable services
sudo sysrc rspamd_enable="YES"
sudo sysrc redis_enable="YES"

# Start services
sudo service rspamd start
sudo service redis start
```

### Verify Installation

```bash
# Check service status
sudo systemctl status rspamd redis
# Both should show "active (running)"

# Verify ports
sudo ss -tlnp | grep rspamd
# Expected:
# 127.0.0.1:11333 (normal worker - scanner)
# 127.0.0.1:11334 (controller - web UI)
# 127.0.0.1:11332 (proxy worker - milter)
```

### Key Paths

- **Binary**: `/usr/bin/rspamd`
- **Configuration**: `/etc/rspamd/` (modify files in `/etc/rspamd/local.d/` and `/etc/rspamd/override.d/`)
- **Data**: `/var/lib/rspamd/` (statistics, learned messages)
- **Logs**: `/var/log/rspamd/`
- **Utilities**: `rspamc` (client), `rspamadm` (admin)

### Set Web Interface Password

```bash
# Generate password hash
rspamadm pw

# Add to configuration
echo 'password = "$2$your_generated_hash_here";' | sudo tee /etc/rspamd/local.d/worker-controller.inc

# Restart
sudo systemctl restart rspamd
```

Access the web interface at `http://your-server:11334`

**Next Steps**: [First Setup Guide](/getting-started/first-setup) for MTA integration and basic configuration

---

## Docker Installation

Docker is suitable for testing, development, and containerized production deployments. For production use, ensure proper DNS configuration and persistent storage.

### Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  rspamd:
    image: rspamd/rspamd:latest
    container_name: rspamd
    ports:
      - "11332:11332"  # Proxy worker
      - "11334:11334"  # Web interface
    volumes:
      - ./config:/etc/rspamd/local.d
      - ./data:/var/lib/rspamd
      - ./logs:/var/log/rspamd
    depends_on:
      - redis
      - unbound
    restart: unless-stopped

  redis:
    image: redis:alpine
    container_name: rspamd-redis
    volumes:
      - redis-data:/data
    restart: unless-stopped

  # Local recursive DNS resolver (recommended)
  # Note: you can use any unbound image; this is an example. Ensure it is configured for recursion
  unbound:
    image: mvance/unbound:latest
    container_name: rspamd-unbound
    restart: unless-stopped
    # Expose only to the compose network by default; no published ports are required
    # You can mount custom configs if desired:
    # volumes:
    #   - ./unbound:/opt/unbound/etc/unbound

volumes:
  redis-data:
```

Start the stack:
```bash
docker-compose up -d
```

### Set Web Interface Password

```bash
# Generate password hash
docker exec rspamd rspamadm pw

# Create controller configuration
echo 'password = "$2$your_generated_hash_here";' > config/worker-controller.inc

# Restart
docker-compose restart rspamd
```

Access at `http://localhost:11334`

### Important: DNS Configuration

Rspamd performs intensive DNS lookups (RBLs, DKIM, DMARC, URI checks). **You must use a local recursive DNS resolver** for proper functionality.

**Why not public resolvers?**
- Public DNS (8.8.8.8, 1.1.1.1) rate-limit RBL queries
- Docker's embedded DNS (127.0.0.11) is only a forwarder, not recursive
- This causes timeouts and poor spam detection accuracy

**Solution**: Run a local recursive resolver (Unbound, shown in docker-compose above) or use your host's resolver.

Configure Rspamd DNS (create `config/options.inc`):

```hcl
dns {
  nameserver = ["unbound"];  # Hostname support requires Rspamd 3.14+
  timeout = 1s;
  sockets = 16;
}
```

For Rspamd < 3.14, use IP addresses instead of hostnames or rely on `/etc/resolv.conf`.

### Production Considerations

- **Persistent volumes**: Required for `/var/lib/rspamd` (statistics, learned data)
- **Resource limits**: CPU: 1-2 cores, Memory: 512MB-1GB base + scale per worker
- **Health checks**: Liveness on `/ping`, readiness on `/stat`
- **Redis HA**: Use Redis Sentinel or cluster for production
- **Security**: Use [HTTPCrypt encryption](/developers/encryption) for multi-pod communication

### Kubernetes

For Kubernetes deployments, consider:
- Using a StatefulSet for Rspamd workers
- DaemonSet for local DNS resolver (Unbound or CoreDNS with recursion)
- ConfigMaps for configuration management
- Persistent volumes for data retention

Example manifests available in [rspamd-k8s-examples](https://github.com/rspamd/rspamd-k8s-examples)

---

## Migrating from SpamAssassin

If you're migrating from SpamAssassin, install Rspamd using the package method above, then configure it for parallel testing before fully switching over.

### Testing Mode Configuration

Configure Rspamd to add headers without taking actions during testing:

**`/etc/rspamd/local.d/actions.conf`**:
```hcl
# Conservative thresholds - only add headers during testing
reject = 999;
add_header = 1;
greylist = 999;
```

This allows you to:
- Run Rspamd alongside SpamAssassin
- Compare scoring and detection via headers
- Gradually tune thresholds before production cutover

**See also**: [SpamAssassin Migration Guide](/tutorials/migrate_sa) for detailed conversion steps

---

## Testing Your Installation

### Basic Functionality Test

```bash
# Test message scanning
echo "Test message" | rspamc

# Expected output includes:
# - Symbol results
# - Spam score
# - Action (e.g., "no action")
```

### Test with Real Email

```bash
# Scan a saved email file
rspamc < /path/to/email.eml

# Or via stdin
cat email.eml | rspamc
```

### Web Interface Test

After setting the password (see above), access `http://your-server:11334` and verify:
- Dashboard loads
- Statistics are visible
- You can scan test messages via the interface

### MTA Integration Test

Once integrated with your MTA (see [First Setup](/getting-started/first-setup)):
1. Send a test email through your server
2. Check mail logs for Rspamd processing
3. Verify headers are added (check `X-Spam` and `X-Spamd-Result` headers)
4. Confirm actions are applied correctly

## Troubleshooting

### Service Won't Start

```bash
# Check logs for errors
sudo journalctl -u rspamd -n 50

# Or check log file directly
sudo tail -f /var/log/rspamd/rspamd.log

# Verify configuration syntax
rspamadm configtest
```

### Permission Issues

```bash
# Fix data directory ownership
sudo chown -R _rspamd:_rspamd /var/lib/rspamd /var/log/rspamd

# SELinux (RHEL/CentOS)
sudo setsebool -P antivirus_can_scan_system 1
sudo setsebool -P antivirus_use_jit 1
```

### Port Conflicts

```bash
# Check what's using the ports
sudo lsof -i :11332
sudo lsof -i :11333
sudo lsof -i :11334

# Change ports in worker configuration if needed
# Edit /etc/rspamd/local.d/worker-*.inc
```

### Redis Connection Failed

```bash
# Test Redis
redis-cli ping  # Should return "PONG"

# Check Redis is running
sudo systemctl status redis

# Verify Rspamd can reach Redis
rspamc stat  # Should show statistics if Redis works
```

### Docker DNS Issues

**Symptoms**: Timeouts, poor spam detection, RBL failures

**Solution**: Ensure local recursive DNS resolver is configured (see Docker DNS section above)

```bash
# Verify container DNS config
docker exec rspamd cat /etc/resolv.conf

# Test DNS resolution
docker exec rspamd dig +short rspamd.com

# Check Rspamd DNS stats
docker exec rspamd rspamc stat | grep -i dns
```

**Common mistakes**:
- Using public DNS (8.8.8.8, 1.1.1.1) - these rate-limit RBL queries
- Relying on Docker's 127.0.0.11 - it's only a forwarder
- Using hostname in `dns.nameserver` with Rspamd < 3.14

## Security Considerations

### Essential Security Steps

1. **Set a strong web interface password** (required)
   ```bash
   rspamadm pw
   # Add to /etc/rspamd/local.d/worker-controller.inc
   ```

2. **Restrict controller access** - bind to localhost only
   ```hcl
   # /etc/rspamd/local.d/worker-controller.inc
   bind_socket = "localhost:11334";
   ```

3. **Firewall configuration** - allow only MTA access
   ```bash
   # Example with ufw
   sudo ufw allow from <mta-ip> to any port 11332 proto tcp
   sudo ufw deny 11334/tcp  # Block WebUI from internet
   ```

4. **File permissions** - verify ownership
   ```bash
   sudo chown -R _rspamd:_rspamd /var/lib/rspamd
   sudo chmod 750 /var/lib/rspamd
   ```

5. **Multi-server encryption** - use [HTTPCrypt](/developers/encryption) for worker communication

## Next Steps

After installation:

1. **[First Setup Guide](/getting-started/first-setup)** - Integrate with your MTA (Postfix, Exim, Sendmail)
2. **[Configuration Basics](/configuration/index)** - Learn how to customize Rspamd
3. **[Quick Start](/getting-started/quickstart)** - Get basic spam filtering working
4. **[Migration from SpamAssassin](/tutorials/migrate_sa)** - If migrating from SA

## Getting Help

- **[FAQ](/faq)** - Common questions and answers
- **[Discord/Telegram](https://rspamd.com/support.html)** - Real-time community support
- **[GitHub Issues](https://github.com/rspamd/rspamd/issues)** - Bug reports and feature requests
- **[Mailing List](https://lists.rspamd.com/)** - Discussion and announcements
