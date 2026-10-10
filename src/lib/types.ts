/**
 * Plaintext shapes that only ever exist decrypted inside the browser.
 *
 * Hierarchy: Grupo → Item → N credenciais (senhas).
 *   📁 Projetos
 *      └── 🔑 Supabase            (Item)
 *            ├── Admin · usuário/senha/url/notas   (Credencial)
 *            └── Read-only · usuário/senha/url/notas
 */

export interface VaultGroup {
  id: string
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

/** A single password record inside an item. */
export interface VaultCredential {
  id: string
  label: string
  username: string
  password: string
  url: string
  notes: string
  createdAt: string
  updatedAt: string
}

/** A named entry (e.g. "Supabase") that groups many credentials. */
export interface VaultItem {
  id: string
  groupId: string | null
  name: string
  favorite: boolean
  credentials: VaultCredential[]
  createdAt: string
  updatedAt: string
}

export interface VaultData {
  version: number
  groups: VaultGroup[]
  items: VaultItem[]
}

export interface VaultRow {
  id: string
  user_id: string
  salt: string
  kdf_salt: string
  encrypted_data: string | null
  data_version: number
  updated_at: string
  created_at: string
}

/** Row shape used by the offline IndexedDB cache. Ciphertext only. */
export interface CachedVault {
  userId: string
  encryptedData: string | null
  salt: string
  updatedAt: string
  pending: boolean
}

export const VAULT_VERSION = 2

export function newId(): string {
  return crypto.randomUUID()
}

export function emptyVault(): VaultData {
  return { version: VAULT_VERSION, groups: [], items: [] }
}

/**
 * Normalises any decrypted payload into the current schema.
 *
 * v1 → v2: each old flat "entry" becomes an item holding a single credential,
 * so previously stored vaults keep working without data loss.
 */
export function migrateVault(raw: unknown): VaultData {
  if (!raw || typeof raw !== 'object') return emptyVault()
  const data = raw as Record<string, unknown>
  const groups = Array.isArray(data.groups) ? (data.groups as VaultGroup[]) : []

  if (Array.isArray(data.items)) {
    return { version: VAULT_VERSION, groups, items: data.items as VaultItem[] }
  }

  if (Array.isArray(data.entries)) {
    const now = new Date().toISOString()
    const items = (data.entries as LegacyEntry[]).map((entry) => ({
      id: entry.id ?? newId(),
      groupId: entry.groupId ?? null,
      name: entry.title ?? '',
      favorite: Boolean(entry.favorite),
      createdAt: entry.createdAt ?? now,
      updatedAt: entry.updatedAt ?? now,
      credentials: [
        {
          id: newId(),
          label: '',
          username: entry.username ?? '',
          password: entry.password ?? '',
          url: entry.url ?? '',
          notes: entry.notes ?? '',
          createdAt: entry.createdAt ?? now,
          updatedAt: entry.updatedAt ?? now,
        },
      ],
    }))
    return { version: VAULT_VERSION, groups, items }
  }

  return { version: VAULT_VERSION, groups, items: [] }
}

interface LegacyEntry {
  id?: string
  groupId?: string | null
  title?: string
  username?: string
  password?: string
  url?: string
  notes?: string
  favorite?: boolean
  createdAt?: string
  updatedAt?: string
}
