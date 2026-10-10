import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CachedVault } from './types'

/**
 * Offline cache for the *encrypted* vault blob.
 *
 * Only ciphertext, the public salt and bookkeeping metadata are stored here —
 * never the master key, the derived encryption key, or any plaintext entry.
 */

interface LockDB extends DBSchema {
  vaults: {
    key: string
    value: CachedVault
  }
}

let dbPromise: Promise<IDBPDatabase<LockDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<LockDB>('lock-vault', 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('vaults')) {
          database.createObjectStore('vaults', { keyPath: 'userId' })
        }
      },
    })
  }
  return dbPromise
}

export async function cacheVault(cached: CachedVault): Promise<void> {
  const database = await db()
  await database.put('vaults', cached)
}

export async function getCachedVault(userId: string): Promise<CachedVault | undefined> {
  const database = await db()
  return database.get('vaults', userId)
}

export async function markPending(userId: string, pending: boolean): Promise<void> {
  const database = await db()
  const existing = await database.get('vaults', userId)
  if (existing) {
    existing.pending = pending
    await database.put('vaults', existing)
  }
}

export async function clearVaultCache(userId: string): Promise<void> {
  const database = await db()
  await database.delete('vaults', userId)
}
