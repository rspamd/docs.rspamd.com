---
title: DNS & SPF Management
---

# DNS & SPF Management

These commands provide DNS querying capabilities and powerful SPF record management, including automatic flattening to avoid the 10-lookup limit.

## dnstool spf

Query and analyze SPF records.

### Purpose

Query SPF records for domains and test IP addresses against SPF policies.

### Common Scenarios

#### Query SPF Record

```bash
# Query SPF for a domain
rspamadm dnstool spf -d example.com

# Query SPF from an email address
rspamadm dnstool spf -f sender@example.com
```

Output shows:
- SPF record digest
- All SPF mechanisms
- Policy for each mechanism (pass, fail, neutral, soft fail)
- IP networks covered

#### Test IP Against SPF

```bash
# Check if IP is allowed by SPF
rspamadm dnstool spf -d example.com -i 192.0.2.1

# Check with email address
rspamadm dnstool spf -f sender@example.com -i 192.0.2.1
```

This shows whether the IP would pass, fail, or soft-fail SPF validation.

#### Show All SPF Mechanisms

```bash
# Display complete SPF record breakdown
rspamadm dnstool spf -d example.com -a
```

Use `-a` to show all mechanisms even without testing a specific IP.

### Options

```
-d, --domain <domain>    Query SPF for domain
-f, --from <email>       Query SPF from email address
-i, --ip <ip>           Test specific IP address
-a, --all               Show all SPF mechanisms
```

### Example Output

```
SPF record for example.com; digest: abc123def456

Policy: pass
Network: 192.0.2.0/24
Original: ip4:192.0.2.0/24
------
Policy: pass
Network: 2001:db8::/32
Original: ip6:2001:db8::/32
------
Policy: neutral
Network: any
Original: include:_spf.example.com
------
```

---

## dnstool spf-flatten

Flatten SPF records to avoid DNS lookup limits.

### Purpose

SPF has a 10 DNS lookup limit. Complex SPF records with multiple `include:` statements often hit this limit, causing SPF validation to fail. This tool resolves all includes and flattens the SPF record into IP addresses, optimizing and splitting records if needed.

### The SPF Lookup Problem

Standard SPF record with includes:

```
v=spf1 include:_spf.google.com include:spf.protection.outlook.com include:_spf.salesforce.com ip4:192.0.2.0/24 ~all
```

Each `include:` counts as a lookup. If those includes have more includes, you quickly hit the 10-lookup limit, causing SPF to fail with `permerror`.

### Common Scenarios

#### Basic Flattening

```bash
# Flatten SPF record
rspamadm dnstool spf-flatten example.com
```

This resolves all includes and displays:
- Number of IPv4/IPv6 networks found
- Number of dynamic mechanisms (macros)
- Other mechanisms (redirects, etc.)
- Flattened SPF record
- Whether splitting is needed

#### Example Output

```
Flattened SPF record for example.com:

Found 45 IPv4 networks, 12 IPv6 networks, 0 dynamic mechanisms, 1 other mechanisms

Result: Single record (length: 387)

v=spf1 ip4:192.0.2.0/24 ip4:198.51.100.0/24 ip4:203.0.113.0/24 [... more IPs ...] ~all
```

#### JSON Output for Automation

```bash
rspamadm dnstool spf-flatten example.com --format json
```

Returns structured JSON:

```json
{
  "domain": "example.com",
  "ipv4_count": 45,
  "ipv6_count": 12,
  "dynamic_mechanisms": [],
  "other_mechanisms": ["~all"],
  "needs_split": false,
  "record": "v=spf1 ip4:192.0.2.0/24 ... ~all"
}
```

#### DNS Zone Format

```bash
# Output in BIND zone file format
rspamadm dnstool spf-flatten example.com --format compact
```

Output:

```
example.com. IN TXT "v=spf1 ip4:192.0.2.0/24 ip4:198.51.100.0/24 ... ~all"
```

Copy-paste directly into your DNS zone file.

### Handling Oversized Records

If the flattened record exceeds 450 characters (safe DNS TXT limit), the tool automatically splits it:

```bash
rspamadm dnstool spf-flatten large-example.com --format compact
```

Output:

```
large-example.com. IN TXT "v=spf1 include:1._spf.large-example.com include:2._spf.large-example.com ~all"
1._spf.large-example.com. IN TXT "v=spf1 ip4:192.0.2.0/24 ip4:198.51.100.0/24 ... -all"
2._spf.large-example.com. IN TXT "v=spf1 ip4:203.0.113.0/24 ip4:198.18.0.0/15 ... -all"
```

The tool creates helper records and updates your main SPF to include them.

### Options

```
--format <format>    Output format: default, json, compact
```

Format options:
- `default` - Human-readable with statistics
- `json` - Structured JSON for scripting
- `compact` - DNS zone file format

### Real-World Example: Google Workspace + Microsoft 365

Many organizations use both Google and Microsoft, leading to:

```
v=spf1 include:_spf.google.com include:spf.protection.outlook.com include:_spf.salesforce.com include:servers.mcsv.net ip4:192.0.2.0/24 ~all
```

This easily exceeds 10 lookups. Flatten it:

```bash
rspamadm dnstool spf-flatten mycompany.com --format compact > spf-new.txt
```

Review the output, then update your DNS.

### Workflow for SPF Optimization

1. **Check current SPF**:
   ```bash
   rspamadm dnstool spf -d example.com -a
   ```

2. **Count includes manually** or use a validator to see if you're hitting limits

3. **Flatten the record**:
   ```bash
   rspamadm dnstool spf-flatten example.com --format json > flattened.json
   ```

4. **Review the output** - Check `needs_split` and IP counts

5. **Generate DNS records**:
   ```bash
   rspamadm dnstool spf-flatten example.com --format compact
   ```

6. **Update DNS** with the new records

7. **Test** with `rspamadm dnstool spf -d example.com -i [your-mail-server-ip]`

8. **Monitor** - Remember to re-flatten periodically as cloud providers change IPs

### Important Considerations

#### Maintenance Required

Flattened SPF records contain static IPs. When your email providers change their IPs (which happens regularly), your flattened SPF becomes outdated.

**Best practices:**
- Re-flatten quarterly or when providers announce IP changes
- Monitor SPF failures in DMARC reports
- Consider using SPF macros for your own servers
- Keep the original unflatted record documented

#### Preserving Dynamic Mechanisms

The tool preserves:
- SPF macros (like `%{i}`, `%{d}`)
- `redirect=` modifiers
- `exists:` mechanisms

These remain in the flattened record as they require runtime evaluation.

#### Testing Before Deployment

Always test with `-i` before deploying:

```bash
# Test that your mail servers still pass
rspamadm dnstool spf -d example.com -i 192.0.2.50
```

### Use Cases

1. **Fix "permerror"** - When SPF validation fails due to too many lookups
2. **Optimize delivery** - Reduce DNS queries during email validation
3. **Audit SPF** - Understand exactly which IPs are authorized
4. **Multi-vendor environments** - Combine Google, Microsoft, Salesforce, etc.
5. **Compliance** - Document exact IP ranges authorized to send email

### Limitations

- **Static snapshots** - Requires periodic updates
- **Not suitable for dynamic IPs** - Don't use for DHCP or frequently changing IPs
- **Loss of semantics** - Doesn't show which IPs belong to which service
- **DNS limits** - Very large organizations may need multiple domains

### Automation Example

```bash
#!/bin/bash
# Monthly SPF flattening automation

DOMAIN="example.com"
ZONE_FILE="/var/named/example.com.zone"
BACKUP_DIR="/var/backups/dns"

# Backup current zone
cp "$ZONE_FILE" "$BACKUP_DIR/example.com.zone.$(date +%Y%m%d)"

# Generate new SPF records
rspamadm dnstool spf-flatten "$DOMAIN" --format compact > /tmp/new-spf.txt

# Review and approve (in real automation, add validation)
echo "New SPF records:"
cat /tmp/new-spf.txt

# Manual step: update zone file and reload
echo "Update $ZONE_FILE with the above records and run: rndc reload"
```

## Practical Examples

### Debugging SPF Failures

```bash
# Check current SPF
rspamadm dnstool spf -d example.com -a

# Test specific IP that's failing
rspamadm dnstool spf -d example.com -i 203.0.113.50

# If showing neutral or fail, flatten and check if IP is included
rspamadm dnstool spf-flatten example.com | grep "203.0.113"
```

### Before and After Flattening

```bash
# Before: Show all includes
echo "Current SPF with includes:"
dig +short TXT example.com | grep spf1

# Flatten
echo -e "\nFlattened SPF:"
rspamadm dnstool spf-flatten example.com

# After: Update DNS and verify
echo -e "\nVerifying flattened SPF:"
rspamadm dnstool spf -d example.com -i 192.0.2.1
```

### Multi-Domain SPF Management

```bash
#!/bin/bash
# Flatten SPF for all company domains

DOMAINS="example.com example.org example.net"

for domain in $DOMAINS; do
  echo "=== $domain ==="
  rspamadm dnstool spf-flatten "$domain" --format compact
  echo
done
```

## Tips and Best Practices

1. **Test before deploying** - Always validate with `-i` using your actual mail server IPs
2. **Document the source** - Keep notes on which includes were flattened
3. **Set calendar reminders** - Re-flatten quarterly
4. **Monitor DMARC reports** - Watch for SPF failures indicating stale records
5. **Use compact format for DNS** - Easier to copy into zone files
6. **Consider partial flattening** - Keep stable includes, flatten problematic ones
7. **Backup before changes** - Keep the original SPF record
8. **Check length limits** - DNS TXT records should be under 512 bytes ideally

## Related Documentation

- [DKIM Management](dkim-management.md) - Complete email authentication
- [Operations](operations.md) - DMARC report sending
- [Configuration](configuration.md) - Configure SPF checking in Rspamd
