import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { openDB } from 'idb'
import { CredentialStore, GenerateDHKeysType, UserClaims, UserKeys, WrappedAndSigned } from './types'
import { getUserClaims, getUserKeys, opaqueLoginBegin, opaqueLoginFinish, opaqueRegisterBegin, opaqueRegisterFinish } from './actions'
import { ready, client as opaque, server } from '@serenity-kit/opaque'
import { randomBytes } from 'crypto'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function importKEKBytes(bytes: Uint8Array, keyUsages: KeyUsage[] = ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(bytes),
    { name: 'AES-GCM', length: 256 },
    true,
    keyUsages,
  )
}

export async function importKEK(kek: string, encoding: BufferEncoding = 'base64', keyUsages: KeyUsage[] = ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']): Promise<CryptoKey> {
  return importKEKBytes(Buffer.from(kek, encoding), keyUsages)
}

export function coseToRawPublicKey(coseKey: Map<number, Uint8Array>): Uint8Array {
  const x = coseKey.get(-2) ?? []
  const y = coseKey.get(-3) ?? []
  const raw = new Uint8Array(1 + x.length + y.length)
  raw[0] = 0x04
  raw.set(x, 1)
  raw.set(y, 1 + x.length)
  return raw
}

/**
 * import public key from string
 * @param key the base64url encoded string
 * @param type must be `public-key`
 * @returns 
 */
export async function importKey(key: string, passkey = false): Promise<CryptoKey> {
  let format: KeyFormat = 'spki'
  let alg: { name: string, hash?: string, namedCurve?: string } = { name: 'RSA-OAEP', hash: 'SHA-256' }
  if (passkey) {
    format = 'raw'
    alg = { name: 'ECDH', namedCurve: 'P-256' }
  }
  return crypto.subtle.importKey(
    format,
    bytesFromBase64(key),
    alg,
    true,
    ['wrapKey'],
  )
}

export async function importX25519PublicKey(rawPublicKeyBytes: Uint8Array) {
  if (rawPublicKeyBytes.byteLength !== 32) {
    throw new Error(`X25519 public key must be exactly 32 bytes. Got ${rawPublicKeyBytes.byteLength}`)
  }
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(rawPublicKeyBytes),
    {
      name: 'X25519',
    },
    true,
    [],
  )
}

/**
 * Utility: derive a key from password using PBKDF2
 */
export async function deriveKEK(password: string, salt: Uint8Array, hkdf = false): Promise<CryptoKey> {
  const pwKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  const key = crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: Buffer.from(salt),
      iterations: 200_000,
      hash: 'SHA-256',
    },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  )

  return key
}

export type GeneratedDHKeys = Awaited<Promise<typeof generateDHKeys>>

export async function generateDHKeys(kek: CryptoKey) {
  const xKeyPair = await crypto.subtle.generateKey(
    'X25519',
    true,
    ['deriveBits', 'deriveKey'],
  ) as CryptoKeyPair
  const edKeyPair = await crypto.subtle.generateKey(
    'Ed25519',
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair
  const xPublicKey = await exportKey(xKeyPair.publicKey)
  const edPublicKey = await exportKey(edKeyPair.publicKey)
  const edNonce = secureRandomBytes(12)
  const edWrapped = await ecdhWrapKey(edKeyPair.privateKey, kek, edNonce)
  const xNonce = secureRandomBytes(12)
  const xWrapped = await ecdhWrapKey(xKeyPair.privateKey, kek, xNonce)
  
  await insertKey('dh_cipher_text', new Uint8Array(xWrapped))
  await insertKey('dh_cipher_nonce', new Uint8Array(xNonce))

  console.log('[DH] wrapped X25519:', bytesToBase64(new Uint8Array(xWrapped)))
  console.log('[DH] derived wrapper for PrivateKey BEFORE:', await exportKey(kek))
  const xUnwrapped = await ecdhUnwrapPrivateKey(bytesFromBase64(bytesToBase64(new Uint8Array(xWrapped))), kek, xNonce)
  return {
    derivation: {
      nonce: bytesToBase64(xNonce),
      privateKey: bytesToBase64(new Uint8Array(xWrapped)),
      publicKey: xPublicKey,
    },
    signing: {
      nonce: bytesToBase64(edNonce),
      privateKey: bytesToBase64(new Uint8Array(edWrapped)),
      publicKey: edPublicKey,
    },
  }
}

export function secureRandomBytes(length = 32): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

export async function rewrapMasterKey(encMK: Uint8Array, iv: Uint8Array, newWrappingKey: CryptoKey) {
  const mkKEKBytes = await reconstructKEK()
  const mkek = await importKEKBytes(mkKEKBytes, ['decrypt'])
  const mk = await unwrapMasterKey(encMK, iv, mkek)
  const rewrapped = await wrapMasterKey(mk, newWrappingKey)

  return rewrapped
}

export async function opaqueDeriveKEK(password: string, salt: Uint8Array, exportKey: Uint8Array, info = 'opaque-kek-v1'): Promise<CryptoKey> {
  const pinKeyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const stretchedPin = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: Uint8Array.from(salt),
      iterations: 600_000,
      hash: 'SHA-256',
    },
    pinKeyMaterial,
    256,
  )

  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(exportKey),
    'HKDF',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(stretchedPin),
      info: encoder.encode(info),
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt', 'unwrapKey', 'wrapKey'],
  )
}

export async function opaqueRewrapMasterKey(password: string, salt: Uint8Array, exportKey: Uint8Array): Promise<{ wrappedCipher: string, iv: string }> {
  const rawUserKeys = await retrieveKey('user_keys')
  const userKeys: UserKeys = JSON.parse(Buffer.from(rawUserKeys).toString('utf8'))

  const kekBytes = await reconstructKEK()
  const wrappingKey = await importKEKBytes(kekBytes, ['unwrapKey', 'wrapKey'])
  const kek = await opaqueDeriveKEK(password, salt, exportKey, 'opaque-wrapping-key')
  const unwrapped = await unwrapMasterKey(bytesFromBase64(userKeys.masterKey?.wrappedCipher!), bytesFromBase64(userKeys.masterKey?.iv!), wrappingKey)
  const wrapped = await wrapMasterKey(unwrapped, kek)
  const exported = await exportKEK(kek)
  await splitAndStoreKEK(
    Uint8Array.from(bytesFromBase64(exported)),
    'opqkek_part_a',
    'opqkek_part_b',
  )

  return wrapped
}

export async function ecdhUnwrapPrivateKey(wrappedKeyBytes: Uint8Array, unwrapKey: CryptoKey, iv: Uint8Array) {
  return crypto.subtle.unwrapKey(
    'pkcs8',
    Uint8Array.from(wrappedKeyBytes),
    unwrapKey,
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(iv),
    },
    {
      name: 'X25519',
      // namedCurve: 'X25519',
    },
    true,
    ['deriveBits', 'deriveKey'],
  )
}

export async function ecdhDecryptData(cipherBytes: Uint8Array, key: CryptoKey, iv: Uint8Array, info: string) {
  return crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(iv),
      additionalData: encoder.encode(info),
    },
    key,
    Uint8Array.from(cipherBytes),
  )
}

export async function ecdhWrapKey(key: CryptoKey, wrappingKey: CryptoKey, iv: Uint8Array) {
  return crypto.subtle.wrapKey(
    'pkcs8',
    key,
    wrappingKey,
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(iv),
    }
  )
}

export async function ecdhEncryptData(data: Uint8Array, key: CryptoKey, iv: Uint8Array, info: string) {
  const enc = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(iv),
      additionalData: encoder.encode(info),
    },
    key,
    Uint8Array.from(data),
  )
  return new Uint8Array(enc)
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  let result = 0
  for (let i = 0; i < a.byteLength; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

/**
 * Exchange shared key using ECDH to derive KEK
 * @param otherPublicKeyBytes the PublicKey of the other party
 * @param encAccessCodeBytes the AccessCode to be wrapped
 * @param info context tag
 * @param decrypt encrypt or decrypt
 */
export async function ecdhExchangeKeys(
  otherPublicKeyBytes: Uint8Array,
  encAccessCodeBytes: Uint8Array,
  info: string,
  cryptoParams: {
    localSalt?: Uint8Array,
    remoteSalt?: Uint8Array,
    wrappedKeyBytes?: Uint8Array,
    decrypt?: boolean,
    opaque?: boolean,
  },
) {
  if (otherPublicKeyBytes.byteLength !== 32) throw new Error(`PublicKey must be exactly 32 bytes: got ${otherPublicKeyBytes.byteLength}`)
  const otherPublicKey = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(otherPublicKeyBytes),
    { name: 'X25519' },
    true,
    [],
  )

  const mkcipher = await retrieveKey('wrapped_mk_cipher')
  const mknonce = await retrieveKey('wrapped_mk_iv')

  const reconstructed = await reconstructKEK()
  const rootKEK = await importKEKBytes(reconstructed, ['decrypt', 'encrypt', 'unwrapKey', 'wrapKey'])

  const mk = await unwrapMasterKey(
    mkcipher,
    mknonce,
    rootKEK,
  )

  /* const dhSalt = await retrieveKey('dh-salt')
  if (!constantTimeEqual(dhSalt, cryptoParams?.localSalt!)) {
    throw new Error('[ECDH] salt mismatch')
  } */

  const privKEK = await deriveSubKey(mk, 'dh-wrapping-key', ['wrapKey', 'unwrapKey'], cryptoParams?.localSalt)
  /* const dhKEK = await retrieveKey('dh-kek')
  const xPrivKEK = await exportKey(privKEK)
  if (!constantTimeEqual(dhKEK, bytesFromBase64(xPrivKEK))) {
    throw new Error('DH derived keys mismatch')
  } */

  // ECDH starts here
  let publicKey: string | undefined
  let privateKey: CryptoKey
  if (cryptoParams?.wrappedKeyBytes) {
    const dhSalt = new Uint8Array(cryptoParams?.localSalt!)
    if (dhSalt.byteLength !== 32) {
      throw new Error('salt must be 32 bytes long')
    }

    const wrappedKeyBytes = new Uint8Array(cryptoParams?.wrappedKeyBytes)
    const privateKeyNonce = wrappedKeyBytes.slice(0, 12)
    const privateKeyBytes = wrappedKeyBytes.slice(12, wrappedKeyBytes.byteLength)

    const ciphertext = await retrieveKey('dh_cipher_text')
    if (cryptoParams.decrypt && !constantTimeEqual(privateKeyBytes, ciphertext)) {
      console.error(`DH ciphertext mismatched. expected=${bytesToBase64(ciphertext)} (${ciphertext.byteLength}) got=${bytesToBase64(privateKeyBytes)} (${privateKeyBytes.byteLength})`)
      throw new Error('ciphertext mismatch')
    }

    const ciphernonce = await retrieveKey('dh_cipher_nonce')
    if (cryptoParams.decrypt && !constantTimeEqual(privateKeyNonce, ciphernonce)) {
      throw new Error('cipher nonce mismatch')
    }

    privateKey = await ecdhUnwrapPrivateKey(privateKeyBytes, privKEK, privateKeyNonce)
  } else {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'X25519',
      },
      true,
      ['deriveBits', 'deriveKey'],
    ) as CryptoKeyPair
    privateKey = keyPair.privateKey
    publicKey = await exportKey(keyPair.publicKey)
  }

  // ECDH ends here
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: 'X25519',
      public: otherPublicKey,
    },
    privateKey,
    256,
  )

  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey'],
  )

  // derive AccessCode KEK
  let salt = cryptoParams?.remoteSalt ?? new Uint8Array(encoder.encode('hkdf-salt-v1'))
  const acKEK = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(encoder.encode('hkdf-salt-v1')),
      info: encoder.encode(info),
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt'],
  )
  
  const xAcKEK = await exportKey(acKEK)
  console.log('[ECDH] AC KEK:', xAcKEK, `salt=${bytesToBase64(salt)}`, `info=${info}`)
  if (cryptoParams?.decrypt) {
    const secret = await retrieveKey('secret')
    if (!constantTimeEqual(new Uint8Array(sharedSecret), secret)) {
      throw new Error('derived secret mismatch')
    }

    const sACKEK = await retrieveKey('ac-kek')
    if (!constantTimeEqual(bytesFromBase64(xAcKEK), sACKEK)) {
      throw new Error('AC KEK mismatch')
    }

    const acParts = await retrieveKey('ac-parts')
    const accessCodeNonce = encAccessCodeBytes.slice(0, 12)
    const accessCodeBytes = encAccessCodeBytes.slice(12, encAccessCodeBytes.byteLength)
    if (!constantTimeEqual(encAccessCodeBytes, acParts)) {
      throw new Error('AccessCode mismatch')
    }
    const [cipher, nonce] = await Promise.all([
      retrieveKey('ac-parts-cipher'),
      retrieveKey('ac-parts-nonce'),
    ])

    if (!constantTimeEqual(accessCodeNonce, nonce)) {
      throw new Error('nonce mismatch')
    }
    console.log('nonce matched: YES')
    if (!constantTimeEqual(accessCodeBytes, cipher)) {
      throw new Error('cipher mismatch')
    }
    console.log('cipher matched: YES')
    if (accessCodeNonce.byteLength !== 12) throw new Error('nonce must be exactly 12 bytes long')
    
    const plaintext = await ecdhDecryptData(cipher, acKEK, nonce, info)
    return {
      plaintext: bytesToBase64(Buffer.from(plaintext)),
    }
  }
  // await insertKey('secret', new Uint8Array(sharedSecret))
  // await insertKey('ac-kek', bytesFromBase64(xAcKEK))

  const accessCodeNonce = secureRandomBytes(12)
  const privateKeyNonce = secureRandomBytes(12)

  const wrappedPrivateKey = await ecdhWrapKey(privateKey, privKEK, privateKeyNonce)
  const ciphertext = await ecdhEncryptData(encAccessCodeBytes, acKEK, accessCodeNonce, info)
  const plaintext = await ecdhDecryptData(ciphertext, acKEK, accessCodeNonce, info)
  const wrappedKeyBytes = new Uint8Array(privateKeyNonce.byteLength + wrappedPrivateKey.byteLength)
  wrappedKeyBytes.set(privateKeyNonce, 0)
  wrappedKeyBytes.set(new Uint8Array(wrappedPrivateKey), privateKeyNonce.byteLength)

  const accessCodeCipherBytes = new Uint8Array(accessCodeNonce.byteLength + ciphertext.byteLength)
  accessCodeCipherBytes.set(accessCodeNonce, 0)
  accessCodeCipherBytes.set(ciphertext, accessCodeNonce.byteLength)

  const wkeyParts = bytesToBase64(wrappedKeyBytes)
  const acParts = bytesToBase64(accessCodeCipherBytes)
  
  /* await Promise.all([
    insertKey('ac-parts', accessCodeCipherBytes),
    insertKey('ac-parts-cipher', ciphertext),
    insertKey('ac-parts-nonce', accessCodeNonce),
  ]) */

  return {
    publicKey,
    wrappedPrivateKey: wkeyParts,
    accessCodeCiphertext: acParts,
    salt: bytesToBase64(salt),
  }
}

/**
 * Function to derive SessionKey from AccessCode using ECDH
 * @param otherPublicKeyBytes 
 * @param accessCodeBytes encrypted bytes
 * @param info context tag
 * @param privateKEK KEK for PrivateKey
 * @param salt salt
 * @param iv iv
 * @returns derived SessionKey
 */
export async function ecdhDeriveSessionKey(
  otherPublicKeyBytes: Uint8Array,
  accessCodeBytes: Uint8Array,
  wrappedKeyBytes: Uint8Array,
  info: string,
  salt: Uint8Array,
) {
  const accessCode = await ecdhExchangeKeys(otherPublicKeyBytes, accessCodeBytes, info, { localSalt: salt, remoteSalt: new Uint8Array(encoder.encode('hkdf-salt-v1')), wrappedKeyBytes })

  const rootKey = await importKEK(accessCode.plaintext!, 'base64url', ['deriveKey', 'decrypt', 'encrypt', 'unwrapKey', 'wrapKey'])
  const sessionKey = deriveSubKey(rootKey, 'session-key')

  return sessionKey
}

export async function ecdhDeriveEphemeralKey(rootKey: CryptoKey, label: string): Promise<CryptoKey> {
  const salt = new Uint8Array(32)
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: encoder.encode(label),
    },
    rootKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function ecdhDeriveKeys(otherPublicKeyBytes: Uint8Array, accessCodeBytes: Uint8Array, wrappedKeyBytes: Uint8Array,salt: Uint8Array) {
  const sessionKey = await ecdhDeriveSessionKey(otherPublicKeyBytes, accessCodeBytes, wrappedKeyBytes, 'session-key', salt)
  const mediaKey = await ecdhDeriveEphemeralKey(sessionKey, 'media-key')

  return {
    sessionKey,
    mediaKey,
  }
}

export async function encryptFrameData(frameBytes: Uint8Array, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    Uint8Array.from(frameBytes),
  )

  return {
    frame: encrypted,
    iv,
  }
}

export async function generateMasterKey(hkdf = false, fromBytes = crypto.getRandomValues(new Uint8Array(32))): Promise<CryptoKey> {
  /* return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt', 'encrypt'],
  ) */
  return crypto.subtle.importKey(
    'raw',
    fromBytes,
    hkdf ? 'HKDF' : { name: 'AES-GCM' },
    !hkdf,
    hkdf ? ['deriveBits', 'deriveKey'] : ['decrypt', 'encrypt'],
  )
}

/**
 * Encrypt Master Key (MK) with KEK
 */
export async function wrapMasterKey(mk: CryptoKey, kek: CryptoKey, iv = crypto.getRandomValues(new Uint8Array(12)), publicKey = false) {
  // const iv = crypto.getRandomValues(new Uint8Array(12))

  let format: KeyFormat = 'raw'
  let alg: { name: string, iv?: Uint8Array, hash?: string } = { name: 'AES-GCM', iv }
  if (publicKey) {
    format = 'spki'
    alg = { name: 'RSA-OAEP', hash: 'SHA-256' }
  }

  const wrapped = await crypto.subtle.wrapKey(
    format,
    mk,
    kek,
    alg,
  )

  return { wrappedCipher: bytesToBase64(Buffer.from(wrapped)), iv: bytesToBase64(iv) }
}

export async function createMasterKey(kek: CryptoKey, salt = secureRandomBytes(), withKeyPair = true, returnParts = false, store = true) {
  const mk = await generateMasterKey()
  const wrapped = await wrapMasterKey(mk, kek)
  console.log('[MK] before:', wrapped, `store=${store}`)
  
  if (withKeyPair) {
    console.log('[ECDH#1] salt for wrapping:', bytesToBase64(salt))

    const dhKEK = await deriveSubKey(mk, 'dh-wrapping-key', ['wrapKey', 'unwrapKey'], salt)
    const dhKEK2 = await deriveSubKey(mk, 'dh-wrapping-key', ['wrapKey', 'unwrapKey'], salt)
    const exp = await exportKey(kek)
    console.log('[ECDH] mKEK:', exp)
    const exp2 = await exportKey(dhKEK)
    console.log('[ECDH] dhKEK:', exp2)
    /* if (store) {
      await insertKey('dh-salt', salt)
      await insertKey('dh-kek', bytesFromBase64(exp2))
    } */

    console.log('before:', exp)
    let parts: string[] = []
    if (returnParts) {
      parts = await splitAndStoreKEK(bytesFromBase64(exp), 'kek_part_a', 'kek_part_b', store)
    }
    const dhKeys = await generateDHKeys(dhKEK)
    return {
      parts: returnParts ? parts : undefined,
      salt: bytesToBase64(salt),
      wrapped,
      dhKeys,
    }
  }
  return wrapped
}

export async function createHkdfKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(rawKey),
    'HKDF',
    false,
    ['deriveBits', 'deriveKey'],
  )
}

export async function unwrapMasterKey(wrappedMK: Uint8Array, iv: Uint8Array, kek: CryptoKey) {
  return crypto.subtle.unwrapKey(
    'raw',
    Uint8Array.from(wrappedMK),
    kek,
    { name: 'AES-GCM', iv: Uint8Array.from(iv) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function deriveSubKey(mk: CryptoKey, info: string, usages: KeyUsage[] = ['encrypt', 'decrypt'], salt: Uint8Array = secureRandomBytes()): Promise<CryptoKey> {
  const rawMK = await crypto.subtle.exportKey('raw', mk)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawMK,
    {
      name: 'HKDF',
      hash: 'SHA-256',
    },
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: Uint8Array.from(salt),
      info: encoder.encode(info),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    usages,
  )
}

export async function deriveMasterKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const passwordBytes = enc.encode(password)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )

  const ikm = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: Buffer.from(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )

  return crypto.subtle.importKey(
    'raw',
    ikm,
    'HKDF',
    false,
    ['deriveKey', 'deriveBits'],
  )
}

export async function deriveKey(masterKey: CryptoKey, info: string, length = 32): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const infoBytes = enc.encode(info)

  const rawMK = await crypto.subtle.exportKey('raw', masterKey)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawMK,
    'HKDF',
    false,
    ['deriveKey'],
  )

  const derivedKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array([]), info: infoBytes },
    baseKey,
    { name: 'AES-GCM', length: length * 8 },
    true,
    ['encrypt', 'decrypt', 'wrapKey'],
  )

  return derivedKey
}

export async function importDeriveKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(keyBytes),
    'HKDF',
    false,
    ['deriveKey'],
  )
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  console.log('exportKey:', raw.byteLength, 'bytes')
  return bytesToBase64(new Uint8Array(raw))
}

export async function exportKEK(kek: CryptoKey): Promise<string> {
  const key = await crypto.subtle.exportKey('raw', kek)
  return bytesToBase64(new Uint8Array(key))
}

export async function generateKeyPair(exported = true): Promise<CryptoKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  )
  return keyPair
}

export async function exportPublicKey(pubKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('spki', pubKey)
  console.log('exportPublicKey:', raw.byteLength, 'bytes')
  return bytesToBase64(Buffer.from(raw))
}

async function exportPrivateKey(privateKey: Uint8Array): Promise<string> {
  const imported = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(privateKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  const privKey = await crypto.subtle.exportKey('pkcs8', imported)
  return bytesToBase64(Buffer.from(privKey))
}

export async function encryptPrivateKey(privateKey: CryptoKey, encKey: CryptoKey): Promise<ArrayBuffer> {
  const rawPrivateKey = await crypto.subtle.exportKey('pkcs8', privateKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherText = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encKey,
    rawPrivateKey,
  )

  const result = new Uint8Array(iv.byteLength + cipherText.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(cipherText), iv.byteLength)
  return result.buffer
}

export async function decryptPrivateKey(encryptedData: Uint8Array, encKey: CryptoKey): Promise<CryptoKey> {
  const data = new Uint8Array(encryptedData)
  const iv = data.slice(0, 12)
  const cipherText = data.slice(12)

  const rawPrivateKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encKey,
    cipherText,
  )

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    rawPrivateKey,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt'],
  )

  return privateKey
}

export async function encryptKeyWithkey(targetKey: Uint8Array, kek: CryptoKey): Promise<{ ciphertext: string, iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    Buffer.from(targetKey),
  )

  return {
    ciphertext: Buffer.from(encrypted).toString('base64url'),
    iv: Buffer.from(iv).toString('base64url')
  }
}

export async function decryptKeyWithKey(cipherTextB64: string, ivB64: string, kek: CryptoKey): Promise<Uint8Array> {
  const ciphertext = bytesFromBase64(cipherTextB64)
  const iv = bytesFromBase64(ivB64)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    kek,
    ciphertext,
  )
  return new Uint8Array(decrypted)
}

export async function generateKeys(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const masterKey = await deriveMasterKey(password, salt)
  console.log('Master Key:', await exportKey(masterKey))

  const privateKeyEncKey = await deriveKey(masterKey, 'private_key_encryption')
  console.log('Private Key Encryption Key:', await exportKey(privateKeyEncKey))

  const sessionKey = await deriveKey(masterKey, 'session_key')
  console.log('Session Key:', await exportKey(sessionKey))

  const accessCodeKey = await deriveKey(masterKey, 'access_code')
  console.log('Access Code Key:', await exportKey(accessCodeKey))

  const msgSigningKey = await deriveKey(masterKey, 'msg_signing')
  console.log('Message Signing Key:', await exportKey(msgSigningKey))

  const backupKey = await deriveKey(masterKey, 'backup_key')
  console.log('Backup Key:', await exportKey(backupKey))
}

type WrappedKey = { wrappedCipher: string, iv: string }
export type WrappedKeyPair = {
  parts?: string[],
  salt: string,
  wrapped: WrappedKey,
  dhKeys?: {
    derivation: {
      nonce: string
      privateKey: string
      publicKey: string
    };
    signing: {
      nonce: string
      privateKey: string
      publicKey: string
    }
  }
}
export async function createUserKeys(password: string) {
  const salt = secureRandomBytes()
  console.log('[SALT#0] salt:', bytesToBase64(salt))

  // Use to encrypt/decrypt shared secrets and metadata
  const keyPair = await generateKeyPair()

  // Key used to wrap Master Key
  const masterKEK = await deriveKEK(password, salt)

  // Master Key used to derive shared keys
  const wrappedMasterKey = await createMasterKey(masterKEK, salt, true, true, true) as WrappedKeyPair
  const rebuilt = await reconstructKEK()
  const imported = await importKEKBytes(rebuilt, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'])
  const exRebuild = await exportKey(imported)
  const mk = await unwrapMasterKey(bytesFromBase64(wrappedMasterKey.wrapped.wrappedCipher), bytesFromBase64(wrappedMasterKey.wrapped.iv), imported)
  const dhKEK = await deriveSubKey(mk, 'dh-wrapping-key', ['wrapKey', 'unwrapKey'], bytesFromBase64(wrappedMasterKey.salt))
  const exp = await exportKey(dhKEK)

  const dhKeyPair = wrappedMasterKey.dhKeys

  const pubKey = dhKeyPair?.derivation.publicKey
  const dhkp = bytesToBase64(Buffer.from(JSON.stringify(dhKeyPair), 'utf8'))

  const b1 = bytesFromBase64(dhKeyPair?.derivation.nonce!)
  const b2 = bytesFromBase64(dhKeyPair?.derivation.privateKey!)
  console.log(`b1=${bytesToBase64(b1)}`, `b2=${bytesToBase64(b2)}`)

  await insertKey('dh_cipher_nonce', b1)
  await insertKey('dh_cipher_text', b2)

  const b3 = new Uint8Array(b1.byteLength + b2.byteLength)
  b3.set(b1, 0)
  b3.set(b2, b1.byteLength)
  console.log('[DHCIPHER] before:', bytesToBase64(b3))
  const b4 = b3.slice(0, b1.byteLength)
  const b5 = b3.slice(b1.byteLength, b3.byteLength)
  console.log(b4.byteLength, bytesToBase64(b4), b5.byteLength, bytesToBase64(b5))
  await ecdhUnwrapPrivateKey(b5, dhKEK, b4)

  await insertKey('wrapped_mk_cipher', bytesFromBase64(wrappedMasterKey.wrapped.wrappedCipher))
  await insertKey('wrapped_mk_iv', bytesFromBase64(wrappedMasterKey.wrapped.iv))

  const wpriv = bytesFromBase64(dhKeyPair?.derivation.privateKey!)
  const wnonce = bytesFromBase64(dhKeyPair?.derivation.nonce!)
  const saltBytes = bytesFromBase64(wrappedMasterKey.salt)

  await Promise.all([
    insertKey('dh-salt', saltBytes),
    insertKey('dh-kek', bytesFromBase64(await exportKey(dhKEK))),
    insertKey('wrapped_mk_cipher', bytesFromBase64(wrappedMasterKey.wrapped.wrappedCipher)),
    insertKey('wrapped_mk_iv', bytesFromBase64(wrappedMasterKey.wrapped.iv)),
  ])

  {
    // tutor
    const hsalt = secureRandomBytes()
    const mkek = await deriveKEK('password', secureRandomBytes())
    console.log('[MKEK] host before:', await exportKey(mkek))
    const wrappedMK = await createMasterKey(mkek, hsalt, true, false, false) as WrappedKeyPair
    let pubKeyBytes = bytesFromBase64(wrappedMK.dhKeys?.derivation.publicKey!)

    const guestAC = await createAccessCode(
      wrappedMK.dhKeys?.derivation.publicKey!,
      b3,
      false,
      undefined,
      saltBytes,
      encoder.encode('hdkf-salt-v1'),
    )
    console.log('[GUEST] access code:', guestAC)

    // HOST side
    const mk = await unwrapMasterKey(bytesFromBase64(wrappedMK.wrapped.wrappedCipher), bytesFromBase64(wrappedMK.wrapped.iv), mkek)
    await splitAndStoreKEK(bytesFromBase64(await exportKey(mkek)), 'kek_part_a', 'kek_part_b', true)

    const wkb = new Uint8Array(wnonce.byteLength + wpriv.byteLength)
    wkb.set(wnonce, 0)
    wkb.set(wpriv, wnonce.byteLength)
    const dhKEK = await deriveSubKey(mk, 'dh-wrapping-key', ['wrapKey', 'unwrapKey'], bytesFromBase64(wrappedMK.salt))
    const raw = await exportKey(dhKEK)

    const hostKeyPair = wrappedMK.dhKeys?.derivation
    const hnonce = bytesFromBase64(hostKeyPair?.nonce!)
    const hcipher = bytesFromBase64(hostKeyPair?.privateKey!)
    const hostCipherBytes = new Uint8Array(hnonce.byteLength + hcipher.byteLength)
    hostCipherBytes.set(hnonce, 0)
    hostCipherBytes.set(hcipher, hnonce.byteLength)
    pubKeyBytes = bytesFromBase64(wrappedMasterKey.dhKeys?.derivation.publicKey!)

    await Promise.all([
      insertKey('dh-salt', bytesFromBase64(wrappedMK.salt)),
      insertKey('dh-kek', bytesFromBase64(raw)),
      insertKey('wrapped_mk_cipher', bytesFromBase64(wrappedMK.wrapped.wrappedCipher)),
      insertKey('wrapped_mk_iv', bytesFromBase64(wrappedMK.wrapped.iv)),
    ])

    // HOST side
    const acParts = await retrieveKey('ac-parts')
    const ac = await unwrapAccessCode(acParts, dhKeyPair?.derivation.publicKey!, hostCipherBytes, bytesFromBase64(wrappedMK.salt!))
    const hostAC = await createAccessCode(
      dhKeyPair?.derivation.publicKey!,
      hostCipherBytes,
      true,
      bytesFromBase64(guestAC.accessCodeCiphertext!),
      bytesFromBase64(wrappedMK.salt!),
      encoder.encode('hdkf-salt-v1'),
    )
    console.log('[HOST] access code:', hostAC)
  }

  const kek64 = await exportKEK(masterKEK)
  console.log('kek64:', kek64)
  await splitAndStoreKEK(bytesFromBase64(kek64))

  return {
    salt: bytesToBase64(salt),
    publicKey: pubKey,
    masterKey: wrappedMasterKey.wrapped,
    keyCipher: dhkp,
    keyCipherSalt: bytesToBase64(salt),
  }
}

export async function deriveKeyFromSecret(secret: Uint8Array, salt: Uint8Array, context: string, derivedKeyUsages: KeyUsage[] = ['encrypt', 'decrypt']): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(secret),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      salt: Uint8Array.from(salt),
      // iterations: 100_000,
      hash: 'SHA-256',
      info: encoder.encode(context),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    derivedKeyUsages,
  )

  return derivedKey
}

export async function encryptData(plaintext: string, key: CryptoKey | { type: 'public', key: CryptoKey }, options?: { iv?: Uint8Array }): Promise<{ ciphertext: string, iv?: string }> {
  const encodedData = encoder.encode(plaintext)

  if (key instanceof CryptoKey && key.algorithm.name === 'AES-GCM') {
    const iv = options?.iv ?? crypto.getRandomValues(new Uint8Array(12))
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv) },
      key,
      encodedData,
    )
    const ciphertext = bytesToBase64(Buffer.from(cipherBuffer))
    return {
      ciphertext,
      iv: bytesToBase64(iv)
    }
  }

  if ('key' in key && key.type === 'public') {
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      key.key,
      encodedData,
    )
    const ciphertext = bytesToBase64(Buffer.from(cipherBuffer))
    return { ciphertext }
  }

  throw new Error('Unsupported key type for encryption')
}

type ECDHExchangedKeys = Awaited<ReturnType<typeof ecdhExchangeKeys>>

/**
 * Creates AccessCode and encrypts or decrypts with key via ECDH Key Exchange
 * @param otherPublicKey Peer's PublicKey
 * @param wrappedKeyBytes Your wrapped PrivateKey. OPTIONAL: will create new one if not specified
 * @param decrypt Decrypt data if `true`. OPTIONAL: defaults to `false`
 * @param encAccessCodeBytes the data to encrypt or decrypt. OPTIONAL: will generate new one if not specified. Required if decrypt is set to `true`
 * @param length size of salt in bytes. OPTIONAL: default is 32
 * @returns the ciphertext or plaintext
 */
export async function createAccessCode(otherPublicKey: string, wrappedKeyBytes?: Uint8Array, decrypt = false, encAccessCodeBytes?: Uint8Array, localSalt = secureRandomBytes(), remoteSalt = secureRandomBytes(), length = 32, createLocal = false): Promise<{
    plaintext?: string;
    publicKey?: string,
    wrappedPrivateKey?: string,
    accessCodeCiphertext?: string,
    salt?: string,
    localCiphertext?: string,
}> {
  if (decrypt && !encAccessCodeBytes) {
    throw new Error('missing cipher bytes')
  }
  const accessCodeBytes = decrypt ? new Uint8Array(encAccessCodeBytes!) : secureRandomBytes(length)
  console.log('[ECDH#2] salt for wrapping:', bytesToBase64(localSalt))

  const otherPubKeyBytes = bytesFromBase64(otherPublicKey)
  const encAccessCode: ECDHExchangedKeys = await ecdhExchangeKeys(otherPubKeyBytes, accessCodeBytes, 'access-code', { localSalt, remoteSalt, wrappedKeyBytes, decrypt })

  if (createLocal) {
    const rebuilt = await reconstructKEK()
    const mKEK = await importKEKBytes(rebuilt)
    const userKeys = await getUserKeys() as UserKeys
    const unwrapped = await unwrapMasterKey(bytesFromBase64(userKeys.master_key?.wrapped_cipher!), bytesFromBase64(userKeys.master_key?.iv!), mKEK)
    const acKEK = await deriveSubKey(unwrapped, 'ac-secret-v1', ['encrypt', 'decrypt'])
    const acNonce = secureRandomBytes(12)
    const encAC = await ecdhEncryptData(accessCodeBytes, acKEK, acNonce, 'access-code')
    const cipherbytes = new Uint8Array(acNonce.byteLength + encAC.byteLength)
    cipherbytes.set(acNonce, 0)
    cipherbytes.set(encAC, acNonce.byteLength)
    return {
      ...encAccessCode,
      localCiphertext: bytesToBase64(cipherbytes),
    }
  }

  return encAccessCode
}

export async function unwrapAccessCode(accessCodeCipherBytes: Uint8Array, otherPublicKey: string, wrappedPrivateKeyBytes: Uint8Array, localSalt: Uint8Array, remoteSalt = secureRandomBytes()) {
  const rawAccessCode: ECDHExchangedKeys = await ecdhExchangeKeys(bytesFromBase64(otherPublicKey), accessCodeCipherBytes, 'access-code', { localSalt, remoteSalt, wrappedKeyBytes: wrappedPrivateKeyBytes, decrypt: true })
  return rawAccessCode.plaintext
}

export async function packageData(payload: Record<string, any>, otherPublicKey: string, yourPrivateKeyCipher?: Uint8Array) {}

export async function unpackData(payload: Uint8Array, yourPrivateKeyCipher: Uint8Array, otherPublicKey: string) {}

export async function deriveKEKFromWebAuthn(publicKey: Record<string, any>, salt: Uint8Array, info: string) {
  const credential = await navigator.credentials.get({
    publicKey: publicKey as PublicKeyCredentialRequestOptions,
  }) as PublicKeyCredential

  const signature = new Uint8Array((credential.response as AuthenticatorAssertionResponse).signature)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    signature,
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )

  const kek = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: Buffer.from(salt),
      info: encoder.encode(info),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )

  return kek
}

export async function deriveKEKFromPasskeyPRF(salt: Uint8Array, context: string): Promise<CryptoKey> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      timeout: 60_000,
      userVerification: 'required',

      extensions: {
        prf: {
          eval: {
            first: Uint8Array.from(salt),
          },
        },
      },
    },
  }) as PublicKeyCredential

  const clientExt = credential.getClientExtensionResults()

  const prfOutput = clientExt.prf?.results?.first

  if (!prfOutput) {
    throw new Error('PRF not supported on this authenticator')
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    prfOutput,
    'HKDF',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: Uint8Array.from(salt),
      info: encoder.encode(context),
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * 
 * @param challenge challenge bytes
 * @param publicKey publicKey from RP
 * @param salt random secure bytes
 * @param context string tag
 * @returns returns a string array containing recovery keys
 */
export async function deriveKEKFromPasskey(challenge: Uint8Array, publicKey: Record<string, any>, salt: Uint8Array, context = 'context'): Promise<string[]> {
  const credential = await navigator.credentials.get({
    publicKey: {
      ...publicKey,
      challenge: Uint8Array.from(challenge),
      extensions: {
        prf: {
          eval: {
            first: Uint8Array.from(salt),
          },
        },
        hmacCreateSecret: true,
      },
    } as PublicKeyCredentialRequestOptions,
  }) as PublicKeyCredential

  const caps = await PublicKeyCredential.getClientCapabilities()
  const ext = credential.getClientExtensionResults()
  console.log('ext:', ext, caps)

  const rootKeys = generateHexRootKeys()
  if (ext.prf?.results?.first) {
    const prf = Uint8Array.from(ext.prf.results.first as Uint8Array)

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      prf,
      'HKDF',
      false,
      ['deriveKey'],
    )

    const deriveKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: Uint8Array.from(salt),
        info: encoder.encode(context),
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt'],
    )

    return []
  }

  console.warn('Passkey PRF not supported. Generating recovery keys.')

  return rootKeys
}

export async function wrapAndSignMasterKey(recoveryKeys: string[], salt = crypto.getRandomValues(new Uint8Array(32)), info = 'recovery_key'): Promise<WrappedAndSigned[]> {
  const rawKEK = await reconstructKEK()
  const kek = await importKEKBytes(rawKEK)
  const rawUserKeys = await retrieveKey('user_keys')
  const userKeys = JSON.parse(Buffer.from(rawUserKeys).toString('utf8'))
  const mkc = await retrieveKey('wrapped_mk_cipher')
  const mkiv = await retrieveKey('wrapped_mk_iv')
  const mk = await unwrapMasterKey(mkc, mkiv, kek)
  const claims = await getUserClaims() as UserClaims

  const wrappedAndSigned: WrappedAndSigned[] = []
  for (let i = 0; i < recoveryKeys.length; i++) {
    const rootKey = recoveryKeys[i]
    const recoveryTag = await createRecoveryTag(rootKey, info)
    const rkek = await importKEK(rootKey, 'hex', ['encrypt', 'decrypt'])
    const kek = await opaqueDeriveKEK(rootKey, Uint8Array.from(Buffer.from(claims.pid!, 'utf8')), salt, 'recovery_tag_kek')
    const wrapped = await wrapMasterKey(mk, kek)
    // const salt = crypto.getRandomValues(new Uint8Array(32))
    const verified = await verifyRecoveryTag(rootKey, recoveryTag, info)
    if (!verified) {
      console.error('tag verification failed')
    }
    wrappedAndSigned.push({
      recoveryTag,
      wrappedMasterKey: wrapped.wrappedCipher,
      iv: wrapped.iv,
      salt: bytesToBase64(salt),
    } as WrappedAndSigned)
  }

  return wrappedAndSigned
}

export async function deriveIKMFromRecoveryCode(recoveryCode: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(recoveryCode),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: Uint8Array.from(salt),
      iterations: 600_000,
    },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function recoverMasterKey(recoveryKey: string, ...recoveryTags: string[]) {}

export async function rootKeyWrapMasterKey(...rootKeys: string[]): Promise<{ tags: string[], recoveryKeys: { cipher: Uint8Array, iv: Uint8Array, [key:string]: any }[] }> {
  const tags = await createRecoveryTags(...rootKeys)
  console.log('recovery tags:', tags)

  const rawKEK = await reconstructKEK()
  const kek = await importKEKBytes(rawKEK)
  const rawUserKeys = await retrieveKey('user_keys')
  const userKeys = JSON.parse(Buffer.from(rawUserKeys).toString('utf8'))
  const mkc = await retrieveKey('wrapped_mk_cipher')
  const mkiv = await retrieveKey('wrapped_mk_iv')
  const mk = await unwrapMasterKey(mkc, mkiv, kek)

  const rootKeyWrappedMasterKeys: { cipher: Uint8Array, iv: Uint8Array, [key:string]: any }[] = []
  for (const rk of rootKeys) {
    const kek = await importKEK(rk)
    const wrapped = await wrapMasterKey(mk, kek)
    rootKeyWrappedMasterKeys.push({
      cipher: bytesFromBase64(wrapped.wrappedCipher),
      iv: bytesFromBase64(wrapped.iv),
    })
  }

  return {
    tags,
    recoveryKeys: rootKeyWrappedMasterKeys,
  }
}

export async function generateRootKey(keyUsages: KeyUsage[] = ['encrypt', 'decrypt']): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    keyUsages,
  )
  return key
}

export async function generateRootKeys(format: string, num = 10, keyUsages: KeyUsage[] = ['encrypt', 'decrypt']): Promise<CryptoKey> {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    keyUsages,
  )
  return key
}

export function generateHexRootKey(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex')
}

export function generateHexRootKeys(num = 10): string[] {
  return Array.from({ length: num }, generateHexRootKey)
}

export function printableCodes(...rootKeys: string[]): string[] {
  return rootKeys.map(rk => {
    const chunks: string[] = []
    for (let i = 0; i < rk.length; i += 2) {
      chunks.push(rk.slice(i, i + 2))
    }
    return chunks.join(' ')
  })
}

export async function verifyRecoveryTag(rootKey: string, recoveryTag: string, context: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    bytesFromBase64(rootKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify(
    'HMAC',
    key,
    bytesFromBase64(recoveryTag),
    encoder.encode(context),
  )
}

export async function createRecoveryTag(rootKey: string, context: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    bytesFromBase64(rootKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const tagBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(context)
  )
  return bytesToBase64(Buffer.from(tagBuffer))
}

export async function createRecoveryTags(...rootKeys: string[]): Promise<string[]> {
  const tags = rootKeys.map(async (rootKey, index) => {
    const context = `recovery_key_${index+1}`
    return await createRecoveryTag(rootKey, context)
  })
  return Promise.all(tags)
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
}

export async function deriveMasterKeyFromIdToken(idToken: string, salt?: Uint8Array): Promise<CryptoKey> {
  const secretData = encoder.encode(idToken)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    secretData,
    'HKDF',
    false,
    ['deriveKey'],
  )

  const hkdfSalt = salt ?? crypto.getRandomValues(new Uint8Array(16))

  const masterKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: Uint8Array.from(hkdfSalt),
      info: encoder.encode('Master Key Derivation'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )

  return masterKey
}

export async function getIdb() {
  const db = await openDB<CredentialStore>('credentials', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys')
      }
    },
  })
  return db
}

export async function splitAndStoreKEK(kek: Uint8Array, firstHalfFragmentName = 'kek_part_a', secondHalfFragmentName = 'kek_part_b', storeparts = true) {
  const partB = crypto.getRandomValues(new Uint8Array(32))

  const partA = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    partA[i] = kek[i] ^ partB[i]
  }

  const partA64 = bytesToBase64(partA)
  if (storeparts) {
    sessionStorage.setItem(firstHalfFragmentName, partA64)

    const db = await getIdb()
    const tx = db.transaction('keys', 'readwrite')
    const store = tx.objectStore('keys')
    await store.put(partB, secondHalfFragmentName)
    await tx.done
  }

  return [partA64, bytesToBase64(partB)]
}

export async function reconstructKEK(left = 'kek_part_a', right = 'kek_part_b') {
  const partAStr = sessionStorage.getItem(left)
  if (!partAStr) throw new Error('No session part found. Re-login required')

  const partA = bytesFromBase64(partAStr)

  const partB = await retrieveKey(right)
  if (!partB) throw new Error('No disk part found')

  console.log([partAStr, bytesToBase64(partB)])

  const reconstructedKEK = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    reconstructedKEK[i] = partA[i] ^ partB[i]
  }

  return reconstructedKEK
}

export async function insertKey(key: string, value: Uint8Array) {
  const db = await getIdb()
  const tx = db.transaction('keys', 'readwrite')
  const store = tx.objectStore('keys')
  await store.put(Uint8Array.from(value), key)
  await tx.done
}

export async function retrieveKey(key: string): Promise<Uint8Array> {
  const db = await getIdb()
  const tx = db.transaction('keys', 'readonly')
  const store = tx.objectStore('keys')
  const value = await store.get(key)
  const ubuf = Uint8Array.from(Buffer.from(value ?? []))
  return ubuf
}

export async function deleteKey(key: string): Promise<void> {
  const db = await getIdb()
  const tx = db.transaction('keys', 'readwrite')
  const store = tx.objectStore('keys')
  return await store.delete(key)
}

export async function passkeyRequestCredentials(publicKey: Record<string, any>) {
  console.log(await PublicKeyCredential.getClientCapabilities())
  const credential = await navigator.credentials.create({
    publicKey: {
      ...publicKey,
      extensions: {
        prf: {},
      },
    } as PublicKeyCredentialCreationOptions,
  }) as PublicKeyCredential

  const ext = credential.getClientExtensionResults()

  const creds = JSON.parse(JSON.stringify(credential)) as Record<string, any>
  return {
    prf: (ext.prf?.enabled && !!ext.prf.results?.first) as boolean,
    creds,
  }
}

export function generateSecureBytes(length = 32, encoded = true): string | Uint8Array {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  if (encoded) {
    return bytesToBase64(bytes)
  }
  return bytes
}

export function bytesToBase64(bytes: Uint8Array, alphabet: 'base64' | 'base64url' = 'base64url'): string {
  return Buffer.from(bytes).toString(alphabet)
}

export function bytesFromBase64(b64: string, alphabet: 'base64' | 'base64url' = 'base64url') {
  return Uint8Array.from(Buffer.from(b64, alphabet))
}

export async function beforeLogout() {
  sessionStorage.removeItem('kek_part_a')

  await Promise.all([
    deleteKey('kek_part_b'),
    deleteKey('user_keys'),
    deleteKey('wrapped_mk_cipher'),
    deleteKey('wrapped_mk_iv'),
  ])
}

export async function opaqueRegistration(password: string) {
  await ready
  const setup = server.createSetup()
  const { clientRegistrationState, registrationRequest } = opaque.startRegistration({ password })
  console.log({ clientRegistrationState, registrationRequest })

  const opaqueRegisterBeginResult = await opaqueRegisterBegin(clientRegistrationState, registrationRequest)
  if (!opaqueRegisterBeginResult) {
    throw new Error('opaqueRegisterBeginResult: could not begin registration')
  }

  console.log(`[REGISTRATION] got=${opaqueRegisterBeginResult.registrationResponse}`)

  const registrationResponse = opaqueRegisterBeginResult.registrationResponse

  const claims = await getUserClaims() as UserClaims
  const identifiers = {
    client: claims.pid!,
    server: 'server',
  }
  const { registrationRecord, serverStaticPublicKey, exportKey } = opaque.finishRegistration({
    clientRegistrationState,
    registrationResponse,
    password,
    identifiers,
  })
  console.log({ registrationRecord, serverStaticPublicKey, exportKey })

  const { ok } = await opaqueRegisterFinish(registrationRecord)
  
  return { ok, exportKey }
}

export async function opaqueAuthentication(password: string) {
  await ready
  const { clientLoginState, startLoginRequest } = opaque.startLogin({ password })
  console.log('startLogin:', { clientLoginState, startLoginRequest })

  const opaqueLoginBeginResult = await opaqueLoginBegin(clientLoginState, startLoginRequest)
  if (!opaqueLoginBeginResult) {
    throw new Error('opaqueLoginBeginResult: could not begin auth')
  }
  console.log('opaqueLoginBeginResult:', opaqueLoginBeginResult)
  console.log('[LOGIN]', `got=${opaqueLoginBeginResult.loginResponse}`)

  const claims = await getUserClaims() as UserClaims
  const identifiers = {
    client: claims.pid!,
    server: 'server',
  }
  const finishLoginResult = opaque.finishLogin({
    clientLoginState,
    loginResponse: opaqueLoginBeginResult.loginResponse,
    password,
    identifiers,
  })
  console.log('finishLoginResult:', finishLoginResult)
  if (!finishLoginResult) {
    throw new Error('finishLogin failed')
  }
  const { finishLoginRequest, sessionKey, exportKey, serverStaticPublicKey } = finishLoginResult
  const { ok, salt } = await opaqueLoginFinish(finishLoginRequest, sessionKey)

  return {
    ok,
    finishLoginResult,
    salt,
  }
}
