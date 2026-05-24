---
name: e2ee-cryptography
description: Use when working on E2EE key hierarchy, OPAQUE protocol, WebAuthn passkey registration/recovery, DHKE for session access codes, or any client-side cryptographic operations (WebCrypto, WASM).
---

# E2EE Cryptography

## Key Hierarchy

```
Password/Salt → PBKDF2 → Master KEK (mKEK)
mKEK → unwrap → Master Key (MK)
MK + context → dhKEK → wrap DH Private Key
MK → acKEK → encrypt Access Codes
```

During login: `partA XOR partB = KEK` where `partA` is session storage and `partB` is IndexedDB.

## Registration Flows

### Email/Password
1. Generate Master Key
2. Derive mKEK from password + salt
3. Split mKEK (partA in session, partB in IndexedDB)
4. Generate DH keypair
5. Derive dhKEK from MK + context
6. Wrap dhPriv with dhKEK

### Passkey PRF
1. Register passkey
2. Rewrap MK with KEK from PRF
3. Create 10 recovery codes
4. Derive KEK for each RC
5. Register

### Passkey OPAQUE
1. Register passkey
2. Nominate 6-digit PIN
3. Perform OPAQUE REGISTRATION
4. Rewrap MK with KEK from OPAQUE
5. Create ECDH keys, wrap PrivateKey with OPAQUE KEK
6. Create 10 recovery codes
7. Generate auth tag for each RC
8. Register each code via OPAQUE

## Session Booking Flow (E2EE)

1. Student books session → generates Access Code (AC)
2. Encrypt AC with Tutor's PublicKey + Student's PrivateKey via DHKE
3. Send encAC to server
4. Encrypt AC with student's acKEK (derived from MK)

## Session Creation Flow

1. Tutor opens session link with encAC
2. Decrypt encAC with DH Private Key locally
3. Derive Session Key (SK) from AC
4. Derive ephemeral keys from SK to encrypt media frames (insertable streams)
5. Use AC to join session

## Key Storage

- **Server**: `encMK, encPrivKey, PubKey, salt` (never plaintext keys)
- **Browser session**: `partA` (XOR share)
- **IndexedDB**: `partB` (XOR share)
- **Recovery**: 10 encrypted recovery codes + auth tags

## Protocols

| Protocol | Purpose | Usage |
|----------|---------|-------|
| PBKDF2 | Key stretching | Derive mKEK from password+salt |
| HKDF | Key derivation | Stretch KEK from IKM |
| X25519 | Key agreement | ECDH for session AC exchange |
| Argon2id | Memory-hard KDF | Alternative key stretching |
| OPAQUE | PAKE protocol | Passkey without PRF fallback |
