---
title: Email Manipulation
---

# Email Manipulation

These commands allow you to modify, sanitize, and sign email messages.

## mime anonymize

Remove sensitive information from messages for safe sharing.

### Purpose

Anonymize emails for bug reports, testing, or sharing without exposing sensitive data like IP addresses, email addresses, domains, and personal information.

### Common Scenarios

#### Basic Anonymization

```bash
# Anonymize a message
rspamadm mime anonymize message.eml > anonymized.eml
```

This removes or replaces:
- Email addresses (sender, recipients)
- IP addresses in headers
- Hostnames and domains
- Message-IDs
- User agents and client information

#### AI-Powered Anonymization

With the GPT plugin configured:

```bash
# Use LLM for intelligent anonymization
rspamadm mime anonymize --gpt message.eml > anonymized.eml

# Specify a model
rspamadm mime anonymize --gpt --model gpt-4 message.eml > anonymized.eml
```

AI anonymization is more sophisticated and can:
- Detect and redact names in message bodies
- Remove personal identifying information in text
- Maintain message readability while removing sensitive data

#### Selective Header Anonymization

```bash
# Exclude specific headers from anonymization
rspamadm mime anonymize -X Subject -X Date message.eml > anonymized.eml

# Only anonymize specific headers
rspamadm mime anonymize -I From -I To message.eml > anonymized.eml
```

### Options

```
--exclude-header, -X    Exclude specific headers from anonymization
--include-header, -I    Only anonymize specific headers
--gpt                   Use LLM model for anonymization (requires GPT plugin)
--model                 Specify model to use with --gpt
```

### Use Cases

- **Bug Reports**: Share problematic emails with developers without exposing user data
- **Testing**: Create test datasets from real emails
- **Security Analysis**: Share samples for threat analysis
- **Compliance**: Redact PII before sharing emails externally

### Example: Preparing a Bug Report

```bash
# Anonymize and review
rspamadm mime anonymize --gpt spam-sample.eml > bug-report.eml

# Verify sensitive data is removed
grep -E '(user|company|domain)' bug-report.eml
```

---

## mime modify

Modify message headers and add footers.

### Purpose

Modify email messages by adding, removing, or rewriting headers, and adding text or HTML footers.

### Common Scenarios

#### Header Manipulation

```bash
# Add a header
rspamadm mime modify -a "X-Custom-Header: value" message.eml > modified.eml

# Add multiple headers
rspamadm mime modify \
  -a "X-Processed: true" \
  -a "X-Processing-Date: 2025-11-20" \
  message.eml > modified.eml

# Remove a header
rspamadm mime modify -r "X-Spam-Flag" message.eml > modified.eml

# Rewrite a header using Lua patterns
rspamadm mime modify -R "Subject=SPAM: %s" message.eml > modified.eml
```

#### Adding Footers

Create a text footer file:

```bash
cat > footer.txt << 'EOF'
---
This message was scanned by Example Mail System
For questions contact: security@example.com
EOF
```

Create an HTML footer file:

```bash
cat > footer.html << 'EOF'
<hr>
<p><small>This message was scanned by Example Mail System<br>
For questions contact: <a href="mailto:security@example.com">security@example.com</a></small></p>
EOF
```

Apply footers:

```bash
# Add text footer to plain text parts
rspamadm mime modify -t footer.txt message.eml > modified.eml

# Add HTML footer to HTML parts
rspamadm mime modify -H footer.html message.eml > modified.eml

# Add both text and HTML footers
rspamadm mime modify -t footer.txt -H footer.html message.eml > modified.eml
```

### Options

```
-a, --add-header <header=value>      Add header
-r, --remove-header <header>         Remove all occurrences of header
-R, --rewrite-header <header=pattern> Rewrite header with Lua pattern
-t, --text-footer <file>             Add footer to text/plain parts
-H, --html-footer <file>             Add footer to text/html parts
```

### Use Cases

- **Disclaimers**: Add legal disclaimers to outbound mail
- **Branding**: Add company footers to emails
- **Tracking**: Add custom headers for message tracking
- **Compliance**: Tag messages with processing information
- **Testing**: Modify headers for testing purposes

### Example: Corporate Email Processing

```bash
# Add compliance headers and footers
rspamadm mime modify \
  -a "X-Scanned-By: Rspamd" \
  -a "X-Scan-Date: $(date -u +%Y-%m-%d)" \
  -t corporate-footer.txt \
  -H corporate-footer.html \
  message.eml > processed.eml
```

---

## mime strip

Remove attachments from messages.

### Purpose

Strip attachments from email messages while preserving text content, useful for size reduction or security.

### Common Scenarios

#### Remove All Attachments

```bash
# Strip all attachments
rspamadm mime strip message.eml > stripped.eml
```

#### Keep Images

```bash
# Strip attachments but keep images
rspamadm mime strip -i message.eml > stripped.eml
```

#### Size-Based Filtering

```bash
# Only keep text parts between 100-10000 bytes
rspamadm mime strip --min-text-size 100 --max-text-size 10000 message.eml > stripped.eml
```

### Options

```
-i, --keep-images          Keep image attachments
--min-text-size <size>     Minimum text size to keep (bytes)
--max-text-size <size>     Maximum text size to keep (bytes)
```

### Use Cases

- **Archival**: Reduce storage space by removing attachments
- **Security**: Strip potentially malicious attachments
- **Email Forwarding**: Remove large attachments before forwarding
- **Log Analysis**: Create text-only copies for processing

### Example: Security Processing

```bash
# Strip all attachments from quarantined email
rspamadm mime strip suspicious.eml > safe-to-review.eml

# Keep only images for visual inspection
rspamadm mime strip -i phishing.eml > visual-review.eml
```

---

## mime sign

Perform DKIM or ARC signing on messages.

### Purpose

Sign email messages with DKIM or ARC signatures for authentication.

### Common Scenarios

#### DKIM Signing

```bash
# Sign with DKIM
rspamadm mime sign \
  -d example.com \
  -s default \
  -k /path/to/private.key \
  message.eml > signed.eml

# Output signature only (for testing)
rspamadm mime sign \
  -d example.com \
  -s default \
  -k /path/to/private.key \
  -o signature \
  message.eml
```

#### ARC Signing

```bash
# Sign with ARC
rspamadm mime sign \
  -d example.com \
  -s default \
  -k /path/to/private.key \
  -t arc \
  message.eml > arc-signed.eml
```

### Options

```
-d, --domain <domain>        Domain for signing
-s, --selector <selector>    DKIM selector
-k, --key <key>             Private key file or key content
-t, --type <arc|dkim>       Signature type (default: dkim)
-o, --output <message|signature>  Output format (default: message)
```

### Use Cases

- **Testing DKIM**: Generate signed messages for testing
- **Manual Signing**: Sign messages that bypass normal flow
- **Signature Verification**: Generate test signatures
- **Development**: Create signed test messages

### Example: Testing DKIM Configuration

```bash
# Generate a signed message
rspamadm mime sign \
  -d example.com \
  -s mail \
  -k /etc/rspamd/dkim/example.com.key \
  test.eml > signed.eml

# Extract just the signature for inspection
rspamadm mime sign \
  -d example.com \
  -s mail \
  -k /etc/rspamd/dkim/example.com.key \
  -o signature \
  test.eml
```

---

## Practical Examples

### Preparing Emails for Bug Reports

Complete workflow for safely sharing problematic emails:

```bash
#!/bin/bash
ORIGINAL="problem.eml"
SANITIZED="bug-report.eml"

# Anonymize with AI
echo "Anonymizing message..."
rspamadm mime anonymize --gpt "$ORIGINAL" > "$SANITIZED"

# Strip any remaining attachments
echo "Removing attachments..."
rspamadm mime strip "$SANITIZED" > temp.eml && mv temp.eml "$SANITIZED"

# Add a header noting it's anonymized
echo "Adding header..."
rspamadm mime modify -a "X-Anonymized: true" "$SANITIZED" > temp.eml && mv temp.eml "$SANITIZED"

echo "Safe to share: $SANITIZED"
```

### Corporate Footer Implementation

```bash
#!/bin/bash
# Process all outbound mail with corporate footer

TEXT_FOOTER="/etc/rspamd/footer.txt"
HTML_FOOTER="/etc/rspamd/footer.html"

for email in /var/spool/outbound/*.eml; do
  rspamadm mime modify \
    -a "X-Company: Example Corp" \
    -t "$TEXT_FOOTER" \
    -H "$HTML_FOOTER" \
    "$email" > "/var/spool/processed/$(basename $email)"
done
```

### Security Quarantine Processing

```bash
# Strip attachments and add warning header
rspamadm mime strip message.eml | \
  rspamadm mime modify \
    -a "X-Quarantine-Reason: Suspicious attachment" \
    -a "X-Quarantine-Date: $(date -u)" \
    - > quarantined.eml
```

## Tips and Best Practices

1. **Test anonymization** - Always review anonymized messages before sharing
2. **Use GPT for sensitive content** - AI anonymization catches more edge cases
3. **Chain commands** - Pipe multiple operations together
4. **Preserve originals** - Always keep backups of original messages
5. **Validate signatures** - Test DKIM signatures after signing
6. **Footer placement** - Footers are added without breaking signatures if message isn't already signed

## Related Documentation

- [Email Analysis](email-analysis.md) - Inspect message content
- [DKIM Management](dkim-management.md) - Generate and manage DKIM keys
- [Cryptography](cryptography.md) - Sign and encrypt files
