---
title: HTTPCrypt Encryption Protocol
---

# HTTPCrypt Encryption Protocol

## Overview

Rspamd implements the HTTPCrypt protocol for encrypting client-server communications. HTTPCrypt is a lightweight encryption protocol that predates RFC 8439 but uses similar cryptographic primitives: X25519 for key exchange, XChaCha20 for encryption, and Poly1305 for authentication. However, it employs custom key derivation methods that differ from standard IETF approaches.

The protocol provides:

- **Authenticated encryption** using XChaCha20-Poly1305
- **Forward secrecy** through ephemeral key exchange
- **Compact wire format** optimized for HTTP communication
- **Strong security** based on modern elliptic curve cryptography

## Cryptographic Primitives

HTTPCrypt combines several well-established cryptographic algorithms:

### X25519 (Curve25519)

Used for Elliptic Curve Diffie-Hellman (ECDH) key exchange. X25519 provides:

- 128-bit security level
- Fast constant-time operations
- Small key size (32 bytes)
- Protection against side-channel attacks

### XChaCha20

A stream cipher variant of ChaCha20 with extended nonce size:

- 24-byte (192-bit) nonces instead of ChaCha20's 12-byte nonces
- 256-bit keys
- High performance on all platforms
- No timing side channels

### Poly1305

A cryptographic message authentication code (MAC):

- 128-bit security level
- One-time MAC requiring unique key per message
- Fast computation
- Used in encrypt-then-MAC construction

### HChaCha20

A key derivation function based on ChaCha20:

- Takes 32-byte key and 16-byte nonce
- Produces 32-byte derived key
- Used for XChaCha20 nonce extension and custom key derivation

### Blake2b

A cryptographic hash function used for key identification:

- Faster than SHA-2 and SHA-3
- Provides 512-bit output (though only first 5 bytes used for key IDs)

## Key Generation and Management

### Long-term Server Keys

The server maintains a long-term key pair for identification and key exchange:

```bash
rspamadm keypair
```

This generates:

```
keypair {
    privkey = "e4gr3yuw4xiy6dikdpqus8cmxj8c6pqstt448ycwhewhhrtxdahy";
    id = "gnyieumi6sp6d3yaq13q4u6xycmiqaw7iahsrz97acpposod1x8zogynnishtgxr47o815dgsz9t69d66jcm1drjei4a5d";
    pubkey = "fg8uwtce9sta43sdwzddb11iez5thcskiufj4ug8esyfniqq5iiy";
    type = "kex";
    algorithm = "curve25519";
    encoding = "base32";
}
```

**Key Components:**

- **privkey**: Server's private key (32 bytes, base32-encoded)
- **pubkey**: Server's public key (32 bytes, base32-encoded)
- **id**: Full key identifier derived from the public key
- **algorithm**: Always `curve25519` for HTTPCrypt
- **encoding**: Always `base32` (RFC 4648 base32 without padding)

### Ephemeral Client Keys

For each encrypted request, the client generates a fresh ephemeral keypair:

```rust
let local_sk = SecretKey::generate(&mut OsRng);
let local_pk = local_sk.public_key();
```

This provides **forward secrecy**: even if the server's long-term key is compromised, past communications remain secure because ephemeral keys are discarded immediately after use.

### Key Identification Header

The client sends a `Key` header to identify which server public key was used and provide the client's ephemeral public key:

```
Key: <short_key_id>=<client_ephemeral_pubkey>
```

Where:

- **short_key_id**: First 5 bytes of Blake2b hash of server's public key, base32-encoded
- **client_ephemeral_pubkey**: Client's ephemeral public key, base32-encoded

**Example:**

```
Key: kbr3m=k4nz984k36xmcynm1hr9kdbn6jhcxf4ggbrb1quay7f88rpm9kay
```

The short key ID allows the server to quickly identify which of its keys should be used when it has multiple keys configured.

## Session Key Derivation (ECDH)

HTTPCrypt uses a custom ECDH key derivation that differs from standard X25519 usage:

### Step 1: Scalar Multiplication

Standard X25519 scalar multiplication is performed between the client's ephemeral private key and the server's public key:

```rust
// Clamp the private key according to X25519 spec
let e = Scalar::from_bytes_mod_order(clamp_integer(local_sk.to_bytes()));
let p = MontgomeryPoint(remote_pk);
let shared_point = e * p;
```

**Key Clamping:** The private key is "clamped" before use:
- Clear bits 0, 1, 2 of the first byte (sets lowest 3 bits to 0)
- Clear bit 7 of the last byte (clears top bit)
- Set bit 6 of the last byte (sets second-highest bit)

This ensures the scalar is in the correct range for X25519 and avoids small subgroup attacks.

### Step 2: HChaCha20 Key Derivation

**This is where HTTPCrypt diverges from standard practice.**

Standard X25519 usage (RFC 7748) would use the shared point directly or hash it with additional context. HTTPCrypt instead applies HChaCha20 with a zero nonce:

```rust
fn rspamd_x25519_ecdh(point: MontgomeryPoint) -> RspamdNM {
    let n0 = [0u8; 16];  // Zero nonce
    hchacha::<U10>(&point.to_bytes().into(), &n0)
}
```

**HChaCha20 Operation:**

1. Initialize ChaCha20 state with:
   - Constants: "expand 32-byte k" (ChaCha20 constants)
   - Key: The 32-byte shared point from X25519
   - Nonce: 16 zero bytes

2. Execute 20 rounds of ChaCha20 permutation (10 double-rounds)

3. Output: Concatenate state words [0..3] and [12..15] (first 128 bits + last 128 bits)

This produces a 32-byte **shared secret** (called `nm` in the code, standing for "NaCl-style shared secret").

**Security Note:** While non-standard, this approach is cryptographically sound. HChaCha20 acts as a key derivation function, providing additional mixing and ensuring the derived key is uniformly distributed.

## Encryption Process

### Message Authentication Code (MAC) Key Derivation

Before encrypting, a one-time Poly1305 MAC key must be derived. HTTPCrypt uses a custom method:

```rust
pub fn new(key: RspamdNM, nonce: chacha20::XNonce) -> Self {
    let mut chacha = XChaCha20::new_from_slices(key.as_slice(), nonce.as_slice()).unwrap();
    let mut mac_key: GenericArray<u8, U64> = GenericArray::default(); // 64 zero bytes
    chacha.apply_keystream(mac_key.as_mut());
    let poly = Poly1305::new_from_slice(mac_key.split_at(32).0).unwrap();
    // chacha context remains positioned for encryption
}
```

**Process:**

1. Initialize XChaCha20 with:
   - Shared secret (32 bytes) as key
   - Random nonce (24 bytes)

2. Generate 64 zero bytes

3. Encrypt these zero bytes with XChaCha20, producing keystream bytes

4. Take first 32 bytes as the Poly1305 MAC key

5. **Important:** The XChaCha20 cipher context is now positioned at byte offset 64

This approach is similar to the original ChaCha20-Poly1305 construction but uses 64 bytes instead of the RFC's 32 bytes for key material derivation.

### Encryption Algorithm

With the MAC key derived and cipher positioned, encryption proceeds:

```rust
pub fn encrypt_in_place(mut self, data: &mut [u8]) -> Tag {
    // Encrypt
    self.enc_ctx.apply_keystream(data);
    // Authenticate (encrypt-then-MAC)
    self.mac_ctx.compute_unpadded(data)
}
```

**Process:**

1. **Encrypt the plaintext** using XChaCha20 (which is already positioned at offset 64)
2. **Compute MAC** over the ciphertext using Poly1305
3. Return the 16-byte authentication tag

This is an **encrypt-then-MAC** construction, which is the secure approach (as opposed to MAC-then-encrypt or encrypt-and-MAC).

### Wire Format

The encrypted message format is:

```
+----------------------+
| Nonce (24 bytes)    |
+----------------------+
| Tag (16 bytes)      |
+----------------------+
| Ciphertext (N bytes)|
+----------------------+
```

**Field Details:**

- **Nonce (24 bytes)**: Random nonce generated for this message, sent in plaintext
- **Tag (16 bytes)**: Poly1305 authentication tag over the ciphertext
- **Ciphertext (N bytes)**: XChaCha20-encrypted payload

Total overhead: 40 bytes per message.

## Decryption Process

Decryption reverses the encryption process with authentication verification:

```rust
pub fn decrypt_in_place(&mut self, data: &mut [u8], tag: &Tag) -> Result<usize, RspamdError> {
    // Verify MAC first
    let computed = self.mac_ctx.clone().compute_unpadded(data);
    if computed != *tag {
        return Err(RspamdError::EncryptionError("Authentication failed".to_string()));
    }
    // Decrypt only if authentication succeeds
    self.enc_ctx.apply_keystream(&mut data[..]);
    Ok(computed.len())
}
```

**Process:**

1. Parse the message:
   - Extract 24-byte nonce
   - Extract 16-byte tag
   - Remaining bytes are ciphertext

2. Derive shared secret using same ECDH process

3. Initialize XChaCha20 with shared secret and nonce

4. Derive MAC key (64 zero bytes through cipher)

5. **Verify authentication tag:**
   - Compute Poly1305 MAC over ciphertext
   - Compare with received tag using constant-time comparison
   - If mismatch, **fail immediately** and return error

6. **Decrypt ciphertext** (only if authentication succeeds):
   - Re-initialize cipher (or use positioned context)
   - Apply XChaCha20 keystream to ciphertext

**Security:** Authentication is verified **before** decryption to prevent oracle attacks and ensure ciphertext integrity.

## HTTPCrypt Protocol Flow

### Client Request Encryption

When a client sends an encrypted request:

#### 1. Prepare Inner Request

Build a complete HTTP request as plaintext:

```
POST /checkv2 HTTP/1.1
From: user@example.com
IP: 192.0.2.1
Content-Length: 1234

<message body>
```

This inner request contains all the actual headers and body.

#### 2. Generate Ephemeral Keypair

```rust
let local_sk = SecretKey::generate(&mut OsRng);
let local_pk = local_sk.public_key();
```

#### 3. Perform ECDH

```rust
let ec_point = rspamd_x25519_scalarmult(server_public_key, &local_sk)?;
let shared_secret = rspamd_x25519_ecdh(ec_point);
```

#### 4. Encrypt Inner Request

```rust
let nonce = ChaChaBox::generate_nonce(&mut OsRng);
let cbox = RspamdSecretbox::new(shared_secret, nonce);
let tag = cbox.encrypt_in_place(&mut ciphertext);
```

#### 5. Build Outer Request

```http
POST /checkv2 HTTP/1.1
Content-Length: <encrypted_length>
Key: kbr3m=k4nz984k36xmcynm1hr9kdbn6jhcxf4ggbrb1quay7f88rpm9kay

<nonce (24 bytes)><tag (16 bytes)><ciphertext>
```

The `Key` header contains:
- Short ID of server's public key (5 bytes, base32)
- Client's ephemeral public key (32 bytes, base32)

### Server Response Decryption

The server can also encrypt responses using the same shared secret:

#### 1. Server Uses Same Shared Secret

The server computes:

```rust
let ec_point = rspamd_x25519_scalarmult(client_ephemeral_pk, &server_sk)?;
let shared_secret = rspamd_x25519_ecdh(ec_point);
```

This produces the **same shared secret** due to ECDH properties:
- Client: `ECDH(client_ephemeral_sk, server_pk) = shared_secret`
- Server: `ECDH(server_sk, client_ephemeral_pk) = shared_secret`

#### 2. Encrypt Response

```http
HTTP/1.1 200 OK
Content-Length: <encrypted_length>

<nonce (24 bytes)><tag (16 bytes)><encrypted JSON response>
```

#### 3. Client Decrypts

The client uses the stored shared secret (from step 3 of request encryption) to decrypt the response.

### Complete Example

**Client sends:**

```http
POST /checkv2 HTTP/1.1
Host: rspamd.example.com
Content-Type: application/octet-stream
Content-Length: 1540
Key: kbr3m=k4nz984k36xmcynm1hr9kdbn6jhcxf4ggbrb1quay7f88rpm9kay

<24-byte nonce><16-byte tag><1500 bytes encrypted inner request>
```

**Server responds:**

```http
HTTP/1.1 200 OK
Content-Type: application/octet-stream
Content-Length: 556

<24-byte nonce><16-byte tag><500 bytes encrypted JSON response>
```

## Security Considerations

### Strengths

1. **Forward Secrecy**: Ephemeral key exchange ensures past messages cannot be decrypted even if server's long-term key is compromised.

2. **Authenticated Encryption**: Poly1305 MAC provides strong authentication, preventing tampering and detecting corruption.

3. **Modern Cryptography**: Based on well-analyzed primitives (Curve25519, ChaCha20, Poly1305).

4. **Constant-Time Operations**: Implementations use constant-time comparison for MACs and constant-time X25519.

5. **Nonce Collision Resistance**: 24-byte nonces (XChaCha20) provide enormous keyspace (2^192), making collisions virtually impossible with random generation.

### Limitations and Considerations

1. **Non-Standard Key Derivation**: The use of HChaCha20 with zero nonce for ECDH key derivation is non-standard. While not insecure, it differs from RFC 7748 recommendations.

2. **No Replay Protection**: HTTPCrypt itself doesn't provide replay protection. Applications should implement this at a higher layer if needed.

3. **No Key Confirmation**: The protocol doesn't include explicit key confirmation. Authentication failures are detected during MAC verification.

4. **MAC Key Derivation**: Uses 64 zero bytes through cipher instead of RFC 8439's 32 bytes. This is a design choice from the pre-RFC era but remains secure.

5. **Single-Use Ephemeral Keys**: Each request requires a new ephemeral keypair generation, which adds computational cost but ensures forward secrecy.

6. **No Explicit Version Negotiation**: The protocol has no version field. Any changes would require out-of-band negotiation.

### Attack Resistance

**Chosen Ciphertext Attacks (CCA):**
- Protected by encrypt-then-MAC construction
- MAC verification before decryption prevents oracle attacks

**Key Compromise:**
- Forward secrecy limits damage from server key compromise
- Past communications remain secure

**Timing Attacks:**
- Constant-time operations in X25519 and MAC verification
- Constant-time comparison prevents timing leaks

**Small Subgroup Attacks:**
- Prevented by X25519 key clamping
- Curve25519 is designed to resist these attacks

## Implementation Notes

### Key Encoding

All keys use RFC 4648 base32 encoding without padding:

- Alphabet: `abcdefghijklmnopqrstuvwxyz234567`
- Case insensitive for decoding
- No padding characters (=)
- Compact representation (32 bytes → 52 characters)

### Memory Safety

Implementations should:

1. **Zero sensitive data**: Clear private keys, shared secrets, and MAC keys after use
2. **Use secure allocators**: Consider using locked memory for key material
3. **Avoid copying keys**: Use move semantics or references when possible

**Rust example:**

```rust
use crypto_box::cipher::zeroize::Zeroizing;
type RspamdNM = Zeroizing<GenericArray<u8, U32>>;
```

The `Zeroizing` wrapper ensures the memory is zeroed when dropped.

### Error Handling

Critical errors that must be handled:

1. **Authentication Failure**: Never proceed with decryption if MAC verification fails
2. **Invalid Key Length**: Reject keys that aren't exactly 32 bytes
3. **Malformed Messages**: Check minimum message length (24 + 16 bytes) before parsing
4. **Base32 Decode Errors**: Handle invalid base32 encoding gracefully

### Performance Considerations

**Fast operations:**
- X25519 scalar multiplication: ~50-100 microseconds on modern CPUs
- XChaCha20 encryption: ~1-2 GB/s throughput
- Poly1305 MAC: ~1-2 GB/s throughput

**Slow operations:**
- Ephemeral keypair generation: Requires random number generation
- Key encoding/decoding: Base32 conversion adds overhead

**Optimization tips:**
- Reuse server keypair (don't regenerate for each request)
- Consider connection pooling to amortize key exchange costs
- Use vectorized implementations of ChaCha20 when available

### Testing

Implementations should verify:

1. **Known Answer Tests (KAT)**: Test against known test vectors
2. **Round-trip**: Encrypt and decrypt should return original plaintext
3. **Authentication**: Modified ciphertext should fail MAC verification
4. **Interoperability**: Test against reference implementations (Rust/Go clients, Rspamd server)

### Compatibility

HTTPCrypt is implemented in:

- **Rspamd server** (C): Built-in support in all workers
- **rspamc client** (C): Command-line client
- **Rspamd proxy**: Can act as encryption bridge
- **rspamdclient-rs** (Rust): Full client library
- **rspamdclient-go** (Go): Full client library

All implementations use the same wire format and are fully interoperable.

## Code References

For implementation details, see:

- **Rust client**: [rspamdclient-rs/src/protocol/encryption.rs](https://github.com/rspamd/rspamdclient-rs/blob/master/src/protocol/encryption.rs)
- **Go client**: [rspamdclient-go/protocol/encryption.go](https://github.com/rspamd/rspamdclient-go/blob/master/protocol/encryption.go)
- **Original Paper**: [HTTPCrypt Protocol Specification](https://highsecure.ru/httpcrypt.pdf)

## Further Reading

- [RFC 7748](https://tools.ietf.org/html/rfc7748) - Elliptic Curves for Security (X25519)
- [RFC 8439](https://tools.ietf.org/html/rfc8439) - ChaCha20 and Poly1305 for IETF Protocols
- [ChaCha20-Poly1305 AEAD](https://tools.ietf.org/html/rfc7539) - Original ChaCha20-Poly1305 specification
- [XChaCha20-Poly1305](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha) - Extended nonce variant

## Summary

HTTPCrypt provides lightweight, secure encryption for Rspamd client-server communications. Its design prioritizes:

- **Simplicity**: Minimal protocol overhead and complexity
- **Performance**: Fast symmetric encryption with reasonable key exchange costs
- **Security**: Modern cryptographic primitives with forward secrecy
- **Compatibility**: Base32 encoding and HTTP-friendly design

While it uses non-standard key derivation methods, the protocol is cryptographically sound and has been in production use for years. The main trade-off is non-standardization in exchange for a simpler, more compact protocol designed specifically for HTTPCrypt's use case.
