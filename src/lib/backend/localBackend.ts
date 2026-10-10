import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { randomBytes, toBase64 } from '../crypto'
import type { VaultRow } from '../types'
import type { AuthUser, Backend } from './types'

/**
 * Zero-config backend for local testing.
 *
 * Everything lives in this browser:
 *  - `accounts`: email → userId (no server, no real password auth)
 *  - `vaults`  : the same shape as the Supabase table, holding CIPHERTEXT ONLY
 *  - `sessionStorage`: which local account is currently signed in
 *
 * The master password is still validated the real way — by failing to decrypt the
 * vault — so the security-critical code path is identical to production.
 */

interface AccountRow {
  email: string
  userId: string
  createdAt: string
}

interface LocalDB extends DBSchema {
  accounts: { key: string; value: AccountRow }
  vaults: { key: string; value: VaultRow }
}

const DB_NAME = 'lock-local'
const SESSION_KEY = 'lock.local.session'

let dbPromise: Promise<IDBPDatabase<LocalDB>> | null = null

function db(): Promise<IDBPDatabase<LocalDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LocalDB>(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('accounts')) {
          database.createObjectStore('accounts', { keyPath: 'email' })
        }
        if (!database.objectStoreNames.contains('vaults')) {
          database.createObjectStore('vaults', { keyPath: 'user_id' })
        }
      },
    })
  }
  return dbPromise
}

const listeners = new Set<(user: AuthUser | null) => void>()

function readSession(): AuthUser | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function writeSession(user: AuthUser | null) {
  if (user) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else window.sessionStorage.removeItem(SESSION_KEY)
  for (const listener of listeners) listener(user)
}

export const localBackend: Backend = {
  mode: 'local',

  async getSessionUser() {
    return readSession()
  },

  onAuthChange(callback) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },

  async signUp(email, _authSecret) {
    const normalized = email.trim().toLowerCase()
    const database = await db()
    const existing = await database.get('accounts', normalized)
    if (existing) throw new Error('Este e-mail já está cadastrado. Faça login.')

    const account: AccountRow = {
      email: normalized,
      userId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    await database.put('accounts', account)
    const user = { id: account.userId, email: normalized }
    writeSession(user)
    return user
  },

  async signIn(email, _authSecret) {
    const normalized = email.trim().toLowerCase()
    const database = await db()
    const account = await database.get('accounts', normalized)
    if (!account) throw new Error('E-mail ou senha mestra incorretos.')
    const user = { id: account.userId, email: normalized }
    writeSession(user)
    return user
  },

  async signOut() {
    writeSession(null)
  },

  async fetchVault(userId) {
    const database = await db()
    return (await database.get('vaults', userId)) ?? null
  },

  async createVault(userId, email) {
    const database = await db()
    const existing = await database.get('vaults', userId)
    if (existing) return existing

    const now = new Date().toISOString()
    const row: VaultRow = {
      id: crypto.randomUUID(),
      user_id: userId,
      salt: toBase64(randomBytes(16)),
      kdf_salt: email.trim().toLowerCase(),
      encrypted_data: null,
      data_version: 1,
      updated_at: now,
      created_at: now,
    }
    await database.put('vaults', row)
    return row
  },

  async updateVault(userId, encryptedData) {
    const database = await db()
    const row = await database.get('vaults', userId)
    if (!row) throw new Error('Cofre local não encontrado.')
    row.encrypted_data = encryptedData
    row.updated_at = new Date().toISOString()
    await database.put('vaults', row)
    return row.updated_at
  },
}
