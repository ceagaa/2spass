import { argon2id } from 'hash-wasm'

/**
 * client-side cryptography.
 *
 * Derivation model (Bitwarden-style, adapted):
 *
 *   masterKeyBytes = Argon2id(masterPassword, salt = email.toLowerCase())
 *   authSecret     = HKDF(masterKeyBytes, info="supabase-auth")   -> sent to Supabase as the account password
 *   encryptionKey  = HKDF(masterKeyBytes, info="vault-encryption", salt = vaultSalt) -> NEVER leaves the client
 *
 * The master password never leaves the browser. Supabase only receives the derived
 * `authSecret` (bcrypt-hashed server-side) which is cryptographically unrelated to the
 * key used to encrypt the vault. The server only ever stores AES-GCM ciphertext.
 *
 * The email is used as the KDF salt so the auth credential is deterministically
 * derivable *before* authentication (no chicken-and-egg / user-enumeration oracle).
 * Salts are not secret. A second, per-user random `vaultSalt` is mixed into the
 * encryption key as defense in depth.
 */

export const KDF = {
  /** Argon2id parameters — OWASP recommended baseline (64 MiB, t=3). */
  argon2: {
    parallelism: 1,
    iterations: 3,
    memorySize: 64 * 1024, // KiB => 64 MiB
    hashLength: 32,
  },
  /** PBKDF2 fallback when WebAssembly/Argon2 is unavailable. */
  pbkdf2: { iterations: 600_000, hash: 'SHA-256' as const },
} as const

export type Bytes = Uint8Array<ArrayBuffer>

/* ------------------------------------------------------------------ */
/* Encoding helpers                                                     */
/* ------------------------------------------------------------------ */

export function utf8(input: string): Bytes {
  return new TextEncoder().encode(input)
}

export function toBase64(input: Bytes): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < input.length; i += chunk) {
    binary += String.fromCharCode(...input.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function fromBase64(input: string): Bytes {
  const binary = atob(input)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function randomBytes(length: number): Bytes {
  const out = new Uint8Array(length)
  crypto.getRandomValues(out)
  return out
}

export function bytesToHex(input: Bytes): string {
  return Array.from(input)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Constant-time comparison to avoid timing side-channels. */
export function safeEqual(a: Bytes, b: Bytes): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/* ------------------------------------------------------------------ */
/* Key derivation                                                       */
/* ------------------------------------------------------------------ */

async function pbkdf2Fallback(password: Bytes, salt: Bytes): Promise<Bytes> {
  const baseKey = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: KDF.pbkdf2.iterations,
      hash: KDF.pbkdf2.hash,
    },
    baseKey,
    KDF.argon2.hashLength * 8,
  )
  return new Uint8Array(bits)
}

/** Argon2id with a transparent PBKDF2 fallback if WASM is blocked. */
export async function deriveMasterKeyBytes(
  masterPassword: string,
  kdfSalt: string,
): Promise<Bytes> {
  const password = utf8(masterPassword)
  const salt = utf8(kdfSalt.trim().toLowerCase())
  try {
    const out = await argon2id({
      password,
      salt,
      parallelism: KDF.argon2.parallelism,
      iterations: KDF.argon2.iterations,
      memorySize: KDF.argon2.memorySize,
      hashLength: KDF.argon2.hashLength,
      outputType: 'binary',
    })
    return new Uint8Array(out as ArrayLike<number>)
  } catch {
    return pbkdf2Fallback(password, salt)
  }
}

/** HKDF-SHA256 expansion of the master key. */
export async function hkdf(
  ikm: Bytes,
  info: string,
  salt: Bytes = new Uint8Array(0),
  length = 32,
): Promise<Bytes> {
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8(info) },
    baseKey,
    length * 8,
  )
  return new Uint8Array(bits)
}

/**
 * Deterministic credential used to authenticate against Supabase.
 * Useless for decrypting the vault (different HKDF domain) and never equals the
 * master password.
 */
export async function deriveAuthSecret(masterKeyBytes: Bytes): Promise<string> {
  const secret = await hkdf(masterKeyBytes, 'supabase-auth', undefined, 32)
  return toBase64(secret)
}

/** Import the vault encryption key as a non-extractable AES-GCM CryptoKey. */
export async function deriveEncryptionKey(
  masterKeyBytes: Bytes,
  vaultSaltBase64: string,
): Promise<CryptoKey> {
  const vaultSalt = fromBase64(vaultSaltBase64)
  const raw = await hkdf(masterKeyBytes, 'vault-encryption', vaultSalt, 32)
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
  raw.fill(0)
  return key
}

/* ------------------------------------------------------------------ */
/* Payload encryption (AES-256-GCM)                                     */
/* ------------------------------------------------------------------ */

const IV_LENGTH = 12
const PAYLOAD_VERSION = 'v1'

/** Encrypts any JSON-serializable value. Output: `v1.<iv-b64>.<ciphertext-b64>`. */
export async function encryptJSON(key: CryptoKey, value: unknown): Promise<string> {
  const iv = randomBytes(IV_LENGTH)
  const plaintext = utf8(JSON.stringify(value))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  )
  plaintext.fill(0)
  return `${PAYLOAD_VERSION}.${toBase64(iv)}.${toBase64(ciphertext)}`
}

/** Decrypts a payload produced by {@link encryptJSON}. Throws on tamper/wrong key. */
export async function decryptJSON<T>(key: CryptoKey, payload: string): Promise<T> {
  const parts = payload.split('.')
  if (parts.length !== 3 || parts[0] !== PAYLOAD_VERSION) {
    throw new Error('Formato de payload inválido.')
  }
  const iv = fromBase64(parts[1])
  const ciphertext = fromBase64(parts[2])
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

/* ------------------------------------------------------------------ */
/* Password generation                                                  */
/* ------------------------------------------------------------------ */

const CHARSETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
} as const

export interface GeneratorOptions {
  length?: number
  lower?: boolean
  upper?: boolean
  digits?: boolean
  symbols?: boolean
}

/** Cryptographically-secure password generator (rejection sampling, no modulo bias). */
export function generatePassword(options: GeneratorOptions = {}): string {
  const {
    length = 20,
    lower = true,
    upper = true,
    digits = true,
    symbols = true,
  } = options

  let pool = ''
  const required: string[] = []
  if (lower) {
    pool += CHARSETS.lower
    required.push(CHARSETS.lower)
  }
  if (upper) {
    pool += CHARSETS.upper
    required.push(CHARSETS.upper)
  }
  if (digits) {
    pool += CHARSETS.digits
    required.push(CHARSETS.digits)
  }
  if (symbols) {
    pool += CHARSETS.symbols
    required.push(CHARSETS.symbols)
  }
  if (!pool) pool = CHARSETS.lower + CHARSETS.upper + CHARSETS.digits

  const size = Math.max(length, required.length)
  const chars: string[] = []
  for (const set of required) chars.push(pickChar(set))

  while (chars.length < size) chars.push(pickChar(pool))

  // Fisher–Yates using secure randomness.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function pickChar(set: string): string {
  return set[secureRandomInt(set.length)]
}

/** Uniform random integer in [0, max) using rejection sampling. */
function secureRandomInt(max: number): number {
  if (max <= 0) return 0
  const limit = Math.floor(0xffffffff / max) * max
  const buf = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= limit)
  return value % max
}

/** Rough password strength estimate (entropy in bits) for UI feedback. */
export function estimateStrength(password: string): { bits: number; label: string; score: number } {
  let pool = 0
  if (/[a-z]/.test(password)) pool += 26
  if (/[A-Z]/.test(password)) pool += 26
  if (/[0-9]/.test(password)) pool += 10
  if (/[^A-Za-z0-9]/.test(password)) pool += 32
  const bits = password.length ? Math.round(password.length * Math.log2(pool || 1)) : 0
  let label = 'Muito fraca'
  let score = 0
  if (bits >= 128) {
    label = 'Excelente'
    score = 4
  } else if (bits >= 90) {
    label = 'Forte'
    score = 3
  } else if (bits >= 60) {
    label = 'Média'
    score = 2
  } else if (bits >= 35) {
    label = 'Fraca'
    score = 1
  }
  return { bits, label, score }
}
