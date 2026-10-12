import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { backend, type AuthUser } from '../lib/backend'
import {
  decryptJSON,
  deriveAuthSecret,
  deriveEncryptionKey,
  deriveMasterKeyBytes,
  encryptJSON,
  type Bytes,
} from '../lib/crypto'
import {
  createGroup as createGroupOp,
  createItem as createItemOp,
  deleteCredential as deleteCredentialOp,
  deleteGroup as deleteGroupOp,
  deleteItem as deleteItemOp,
  ensureVaultRow,
  pushVaultCiphertext,
  renameGroup as renameGroupOp,
  updateItem as updateItemOp,
  upsertCredential as upsertCredentialOp,
  type GroupNode,
  buildTree,
} from '../lib/vault'
import {
  emptyVault,
  migrateVault,
  type VaultCredential,
  type VaultData,
  type VaultItem,
} from '../lib/types'
import {
  cacheVault,
  getCachedVault,
} from '../lib/storage'
import { useAutoLock } from '../hooks/useAutoLock'
import { useToast } from './ToastContext'
import { wipeAllScheduled } from '../lib/clipboard'

export type VaultStatus = 'loading' | 'signed-out' | 'locked' | 'unlocked'
export type SyncState = 'idle' | 'syncing' | 'saved' | 'offline' | 'error'

export const AUTO_LOCK_MS = 5 * 60 * 1000

interface VaultContextValue {
  status: VaultStatus
  user: AuthUser | null
  vault: VaultData | null
  tree: GroupNode[]
  syncState: SyncState
  isOnline: boolean
  register: (email: string, masterPassword: string) => Promise<{ needsEmailConfirmation: boolean }>
  signIn: (email: string, masterPassword: string) => Promise<void>
  unlock: (masterPassword: string) => Promise<void>
  lock: () => void
  signOut: () => Promise<void>
  addGroup: (name: string, parentId: string | null) => void
  renameGroup: (id: string, name: string) => void
  removeGroup: (id: string) => void
  addItem: (name: string, groupId: string | null) => void
  saveItem: (item: VaultItem) => void
  removeItem: (id: string) => void
  saveCredential: (itemId: string, credential: VaultCredential) => void
  removeCredential: (itemId: string, credentialId: string) => void
  syncNow: () => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

function zero(bytes: Uint8Array | null) {
  if (bytes) bytes.fill(0)
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<VaultStatus>('loading')
  const [vault, setVault] = useState<VaultData | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Sensitive material — kept ONLY in refs (volatile memory), never in state/localStorage.
  const encKeyRef = useRef<CryptoKey | null>(null)
  const vaultSaltRef = useRef<string>('')
  const userIdRef = useRef<string | null>(null)
  const pendingRef = useRef(false)
  const vaultRef = useRef<VaultData | null>(null)
  // Serialises writes so an older snapshot can never overwrite a newer one.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  // True while sign-in/sign-up runs: the Supabase auth event must not flip the
  // UI to the unlock screen before the vault has actually been opened.
  const authPendingRef = useRef(false)

  const tree = useMemo(
    () => (vault ? buildTree(vault.groups, vault.items) : []),
    [vault],
  )

  const lock = useCallback(() => {
    encKeyRef.current = null
    vaultSaltRef.current = ''
    pendingRef.current = false
    vaultRef.current = null
    setVault(null)
    setStatus((current) => (current === 'signed-out' ? current : 'locked'))
    void wipeAllScheduled()
  }, [])

  useAutoLock({ enabled: status === 'unlocked', timeoutMs: AUTO_LOCK_MS, onLock: lock })

  /* ---------------- session bootstrap ---------------- */
  useEffect(() => {
    let active = true
    backend.getSessionUser().then((sessionUser) => {
      if (!active) return
      setUser(sessionUser)
      userIdRef.current = sessionUser?.id ?? null
      setStatus(sessionUser ? 'locked' : 'signed-out')
    })

    const unsubscribe = backend.onAuthChange((sessionUser) => {
      setUser(sessionUser)
      userIdRef.current = sessionUser?.id ?? null
      if (!sessionUser) {
        lock()
        setStatus('signed-out')
      } else {
        setStatus((current) =>
          current === 'unlocked' || authPendingRef.current ? current : 'locked',
        )
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [lock])

  /* ---------------- online/offline ---------------- */
  const flushPending = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid || !pendingRef.current) return
    const cached = await getCachedVault(uid)
    if (!cached?.encryptedData) return
    try {
      setSyncState('syncing')
      const updatedAt = await pushVaultCiphertext(uid, cached.encryptedData)
      await cacheVault({ ...cached, updatedAt, pending: false })
      pendingRef.current = false
      setSyncState('saved')
    } catch {
      setSyncState('offline')
    }
  }, [])

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      void flushPending()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flushPending])

  /* ---------------- persistence ---------------- */
  const persist = useCallback((next: VaultData) => {
    vaultRef.current = next
    setVault(next)

    const encKey = encKeyRef.current
    const uid = userIdRef.current
    if (!encKey || !uid) return

    const run = async () => {
      // Abort if the vault was locked/re-keyed while queued.
      if (encKeyRef.current !== encKey) return
      try {
        const ciphertext = await encryptJSON(encKey, next)
        const stamp = new Date().toISOString()
        await cacheVault({
          userId: uid,
          encryptedData: ciphertext,
          salt: vaultSaltRef.current,
          updatedAt: stamp,
          pending: true,
        })
        pendingRef.current = true

        if (!navigator.onLine) {
          setSyncState('offline')
          return
        }

        setSyncState('syncing')
        const updatedAt = await pushVaultCiphertext(uid, ciphertext)
        await cacheVault({
          userId: uid,
          encryptedData: ciphertext,
          salt: vaultSaltRef.current,
          updatedAt,
          pending: false,
        })
        pendingRef.current = false
        setSyncState('saved')
      } catch (error) {
        setSyncState('error')
        toast(error instanceof Error ? error.message : 'Falha ao salvar o cofre.', 'error')
      }
    }

    saveChainRef.current = saveChainRef.current.then(run, run)
  }, [toast])

  /* ---------------- key setup ---------------- */
  const activate = useCallback(
    async (targetUser: AuthUser, masterKeyBytes: Bytes, salt: string, encrypted: string | null) => {
      const encKey = await deriveEncryptionKey(masterKeyBytes, salt)
      zero(masterKeyBytes)
      encKeyRef.current = encKey
      vaultSaltRef.current = salt
      userIdRef.current = targetUser.id
      setUser(targetUser)

      let data: VaultData
      if (encrypted) {
        try {
          data = migrateVault(await decryptJSON<unknown>(encKey, encrypted))
        } catch {
          encKeyRef.current = null
          vaultSaltRef.current = ''
          throw new Error('Senha mestra incorreta ou cofre corrompido.')
        }
      } else {
        data = emptyVault()
      }
      vaultRef.current = data
      setVault(data)
      setStatus('unlocked')

      if (!encrypted) {
        // first-ever unlock: persist the empty vault so the row has ciphertext
        const ciphertext = await encryptJSON(encKey, data)
        try {
          const updatedAt = await pushVaultCiphertext(targetUser.id, ciphertext)
          await cacheVault({
            userId: targetUser.id,
            encryptedData: ciphertext,
            salt,
            updatedAt,
            pending: false,
          })
        } catch {
          pendingRef.current = true
          setSyncState('offline')
        }
      } else {
        const cached = await getCachedVault(targetUser.id)
        if (cached) pendingRef.current = cached.pending
      }
    },
    [],
  )

  const loadAndUnlock = useCallback(
    async (targetUser: AuthUser, masterKeyBytes: Bytes) => {
      const uid = targetUser.id
      let salt: string
      let encrypted: string | null

      try {
        const row = await ensureVaultRow(uid, targetUser.email ?? '')
        salt = row.salt
        encrypted = row.encrypted_data
      } catch (error) {
        // Offline: fall back to the encrypted local cache.
        const cached = await getCachedVault(uid)
        if (!cached) {
          zero(masterKeyBytes)
          throw new Error(
            error instanceof Error
              ? `${error.message} (e sem cache offline disponível)`
              : 'Falha ao carregar o cofre e sem cache offline disponível.',
          )
        }
        salt = cached.salt
        encrypted = cached.encryptedData
        setSyncState('offline')
      }

      await activate(targetUser, masterKeyBytes, salt, encrypted)
    },
    [activate],
  )

  /* ---------------- auth ---------------- */
  const register = useCallback(
    async (email: string, masterPassword: string) => {
      const normalizedEmail = email.trim().toLowerCase()
      const masterKeyBytes = await deriveMasterKeyBytes(masterPassword, normalizedEmail)
      const authSecret = await deriveAuthSecret(masterKeyBytes)

      let newUser: AuthUser | null
      authPendingRef.current = true
      try {
        newUser = await backend.signUp(normalizedEmail, authSecret)
      } catch (error) {
        authPendingRef.current = false
        zero(masterKeyBytes)
        throw new Error(translateAuthError(error instanceof Error ? error.message : String(error)))
      }

      if (!newUser) {
        authPendingRef.current = false
        zero(masterKeyBytes)
        return { needsEmailConfirmation: true }
      }

      try {
        const row = await ensureVaultRow(newUser.id, normalizedEmail)
        await activate(newUser, masterKeyBytes, row.salt, row.encrypted_data)
        return { needsEmailConfirmation: false }
      } catch (error) {
        // Conta já criada e sessão ativa: vai para a tela de desbloqueio.
        zero(masterKeyBytes)
        setStatus((current) => (current === 'unlocked' ? current : 'locked'))
        throw error
      } finally {
        authPendingRef.current = false
      }
    },
    [activate],
  )

  const signIn = useCallback(
    async (email: string, masterPassword: string) => {
      const normalizedEmail = email.trim().toLowerCase()
      const masterKeyBytes = await deriveMasterKeyBytes(masterPassword, normalizedEmail)
      const authSecret = await deriveAuthSecret(masterKeyBytes)

      let signedUser: AuthUser
      authPendingRef.current = true
      try {
        signedUser = await backend.signIn(normalizedEmail, authSecret)
      } catch (error) {
        authPendingRef.current = false
        zero(masterKeyBytes)
        throw error instanceof Error
          ? error
          : new Error('E-mail ou senha mestra incorretos.')
      }

      try {
        await loadAndUnlock(signedUser, masterKeyBytes)
      } catch (error) {
        // Sessão já estabelecida: mostra a tela de desbloqueio em vez do login.
        zero(masterKeyBytes)
        setStatus((current) => (current === 'unlocked' ? current : 'locked'))
        throw error instanceof Error ? error : new Error('Falha ao abrir o cofre.')
      } finally {
        authPendingRef.current = false
      }
    },
    [loadAndUnlock],
  )

  const unlock = useCallback(
    async (masterPassword: string) => {
      const email = user?.email
      if (!email) throw new Error('Sessão inválida. Faça login novamente.')
      const masterKeyBytes = await deriveMasterKeyBytes(masterPassword, email)
      await loadAndUnlock(user, masterKeyBytes)
    },
    [user, loadAndUnlock],
  )

  const signOut = useCallback(async () => {
    lock()
    // Sai da UI antes da ida ao servidor: evita o flash da tela de desbloqueio.
    setUser(null)
    userIdRef.current = null
    setStatus('signed-out')
    await backend.signOut()
  }, [lock])

  /* ---------------- mutations ---------------- */
  const addGroup = useCallback(
    (name: string, parentId: string | null) => {
      const current = vaultRef.current
      if (!current) return
      void persist(createGroupOp(current, name, parentId))
    },
    [persist],
  )

  const renameGroup = useCallback(
    (id: string, name: string) => {
      const current = vaultRef.current
      if (!current) return
      void persist(renameGroupOp(current, id, name))
    },
    [persist],
  )

  const removeGroup = useCallback(
    (id: string) => {
      const current = vaultRef.current
      if (!current) return
      void persist(deleteGroupOp(current, id))
    },
    [persist],
  )

  const addItem = useCallback(
    (name: string, groupId: string | null) => {
      const current = vaultRef.current
      if (!current) return
      void persist(createItemOp(current, name, groupId))
    },
    [persist],
  )

  const saveItem = useCallback(
    (item: VaultItem) => {
      const current = vaultRef.current
      if (!current) return
      void persist(updateItemOp(current, item))
    },
    [persist],
  )

  const removeItem = useCallback(
    (id: string) => {
      const current = vaultRef.current
      if (!current) return
      void persist(deleteItemOp(current, id))
    },
    [persist],
  )

  const saveCredential = useCallback(
    (itemId: string, credential: VaultCredential) => {
      const current = vaultRef.current
      if (!current) return
      void persist(upsertCredentialOp(current, itemId, credential))
    },
    [persist],
  )

  const removeCredential = useCallback(
    (itemId: string, credentialId: string) => {
      const current = vaultRef.current
      if (!current) return
      void persist(deleteCredentialOp(current, itemId, credentialId))
    },
    [persist],
  )

  const syncNow = useCallback(async () => {
    await flushPending()
  }, [flushPending])

  const value = useMemo<VaultContextValue>(
    () => ({
      status,
      user,
      vault,
      tree,
      syncState,
      isOnline,
      register,
      signIn,
      unlock,
      lock,
      signOut,
      addGroup,
      renameGroup,
      removeGroup,
      addItem,
      saveItem,
      removeItem,
      saveCredential,
      removeCredential,
      syncNow,
    }),
    [
      status,
      user,
      vault,
      tree,
      syncState,
      isOnline,
      register,
      signIn,
      unlock,
      lock,
      signOut,
      addGroup,
      renameGroup,
      removeGroup,
      addItem,
      saveItem,
      removeItem,
      saveCredential,
      removeCredential,
      syncNow,
    ],
  )

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'Este e-mail já está cadastrado. Faça login.'
  }
  if (m.includes('password should be at least')) {
    return 'A senha mestra é muito curta.'
  }
  if (m.includes('unable to validate email')) {
    return 'E-mail inválido.'
  }
  return message
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault deve ser usado dentro de <VaultProvider>.')
  return ctx
}
