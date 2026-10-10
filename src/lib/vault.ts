import { backend } from './backend'
import type { VaultCredential, VaultData, VaultGroup, VaultItem, VaultRow } from './types'
import { emptyVault, newId } from './types'

/* ------------------------------------------------------------------ */
/* Remote persistence (ciphertext only)                                 */
/* ------------------------------------------------------------------ */

export async function fetchVaultRow(userId: string): Promise<VaultRow | null> {
  return backend.fetchVault(userId)
}

/** Creates the vault row (with a fresh random salt) if the user has none yet. */
export async function ensureVaultRow(userId: string, email: string): Promise<VaultRow> {
  const existing = await backend.fetchVault(userId)
  if (existing) return existing

  try {
    return await backend.createVault(userId, email)
  } catch (error) {
    // Unique-violation / race with another tab — just load what exists.
    const raced = await backend.fetchVault(userId)
    if (raced) return raced
    throw error
  }
}

export async function pushVaultCiphertext(
  userId: string,
  encryptedData: string,
): Promise<string> {
  return backend.updateVault(userId, encryptedData)
}

/* ------------------------------------------------------------------ */
/* Pure vault data operations (operate on decrypted state)              */
/* ------------------------------------------------------------------ */

export function createGroup(vault: VaultData, name: string, parentId: string | null): VaultData {
  const now = new Date().toISOString()
  const group: VaultGroup = {
    id: newId(),
    parentId,
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
  }
  return { ...vault, groups: [...vault.groups, group] }
}

export function renameGroup(vault: VaultData, id: string, name: string): VaultData {
  return {
    ...vault,
    groups: vault.groups.map((g) =>
      g.id === id ? { ...g, name: name.trim(), updatedAt: new Date().toISOString() } : g,
    ),
  }
}

/** Deletes a group and everything nested beneath it (subgroups + items). */
export function deleteGroup(vault: VaultData, id: string): VaultData {
  const toDelete = collectGroupIds(vault.groups, id)
  return {
    ...vault,
    groups: vault.groups.filter((g) => !toDelete.has(g.id)),
    items: vault.items.filter((item) => !(item.groupId && toDelete.has(item.groupId))),
  }
}

function collectGroupIds(groups: VaultGroup[], rootId: string): Set<string> {
  const result = new Set<string>([rootId])
  let changed = true
  while (changed) {
    changed = false
    for (const g of groups) {
      if (g.parentId && result.has(g.parentId) && !result.has(g.id)) {
        result.add(g.id)
        changed = true
      }
    }
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Items                                                                */
/* ------------------------------------------------------------------ */

export function createItem(vault: VaultData, name: string, groupId: string | null): VaultData {
  const now = new Date().toISOString()
  const item: VaultItem = {
    id: newId(),
    groupId,
    name: name.trim(),
    favorite: false,
    credentials: [],
    createdAt: now,
    updatedAt: now,
  }
  return { ...vault, items: [...vault.items, item] }
}

export function updateItem(vault: VaultData, item: VaultItem): VaultData {
  const next = { ...item, updatedAt: new Date().toISOString() }
  const exists = vault.items.some((i) => i.id === item.id)
  return {
    ...vault,
    items: exists
      ? vault.items.map((i) => (i.id === item.id ? next : i))
      : [...vault.items, next],
  }
}

export function deleteItem(vault: VaultData, id: string): VaultData {
  return { ...vault, items: vault.items.filter((i) => i.id !== id) }
}

export function newItem(groupId: string | null): VaultItem {
  const now = new Date().toISOString()
  return {
    id: newId(),
    groupId,
    name: '',
    favorite: false,
    credentials: [],
    createdAt: now,
    updatedAt: now,
  }
}

/* ------------------------------------------------------------------ */
/* Credentials (inside an item)                                         */
/* ------------------------------------------------------------------ */

export function newCredential(): VaultCredential {
  const now = new Date().toISOString()
  return {
    id: newId(),
    label: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

/** Human-readable name shown in lists and used to confirm deletions. */
export function credentialName(credential: VaultCredential, index?: number): string {
  return (
    credential.label?.trim() ||
    credential.username?.trim() ||
    (index !== undefined ? `Senha ${index + 1}` : 'Senha')
  )
}

export function upsertCredential(
  vault: VaultData,
  itemId: string,
  credential: VaultCredential,
): VaultData {
  const now = new Date().toISOString()
  return {
    ...vault,
    items: vault.items.map((item) => {
      if (item.id !== itemId) return item
      const exists = item.credentials.some((c) => c.id === credential.id)
      const next = { ...credential, updatedAt: now }
      const credentials = exists
        ? item.credentials.map((c) => (c.id === credential.id ? next : c))
        : [...item.credentials, next]
      return { ...item, credentials, updatedAt: now }
    }),
  }
}

export function deleteCredential(
  vault: VaultData,
  itemId: string,
  credentialId: string,
): VaultData {
  const now = new Date().toISOString()
  return {
    ...vault,
    items: vault.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            credentials: item.credentials.filter((c) => c.id !== credentialId),
            updatedAt: now,
          }
        : item,
    ),
  }
}

/* ------------------------------------------------------------------ */
/* Tree helpers                                                         */
/* ------------------------------------------------------------------ */

export interface GroupNode {
  group: VaultGroup
  children: GroupNode[]
  itemCount: number
}

export function buildTree(groups: VaultGroup[], items: VaultItem[]): GroupNode[] {
  const directCounts = new Map<string | null, number>()
  for (const item of items) {
    directCounts.set(item.groupId, (directCounts.get(item.groupId) ?? 0) + 1)
  }

  const nodes = new Map<string, GroupNode>()
  for (const g of groups) {
    nodes.set(g.id, { group: g, children: [], itemCount: directCounts.get(g.id) ?? 0 })
  }

  const roots: GroupNode[] = []
  for (const node of nodes.values()) {
    const parentId = node.group.parentId
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortRec = (list: GroupNode[]) => {
    list.sort((a, b) => a.group.name.localeCompare(b.group.name, 'pt-BR'))
    for (const n of list) {
      // bubble item counts up so parents show totals
      n.itemCount += n.children.reduce((sum, c) => sum + c.itemCount, 0)
      sortRec(n.children)
    }
  }
  sortRec(roots)
  return roots
}

/** Returns every descendant group id of `rootId` (inclusive). */
export function descendantGroupIds(groups: VaultGroup[], rootId: string): Set<string> {
  return collectGroupIds(groups, rootId)
}

export { emptyVault }
