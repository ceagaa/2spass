import type { VaultRow } from '../types'

export interface AuthUser {
  id: string
  email: string
}

/**
 * Minimal persistence/auth contract used by the app.
 *
 * Two implementations exist:
 *  - `supabaseBackend` — production (Supabase Auth + Postgres + RLS)
 *  - `localBackend`    — zero-config local mode for testing without any backend
 *                        (accounts + encrypted blobs live in this browser's IndexedDB)
 *
 * Only ciphertext ever crosses this boundary; the crypto stays in the client.
 */
export interface Backend {
  readonly mode: 'supabase' | 'local'
  getSessionUser(): Promise<AuthUser | null>
  onAuthChange(callback: (user: AuthUser | null) => void): () => void
  /** Returns the user, or `null` when the provider requires e-mail confirmation. */
  signUp(email: string, authSecret: string): Promise<AuthUser | null>
  signIn(email: string, authSecret: string): Promise<AuthUser>
  signOut(): Promise<void>
  fetchVault(userId: string): Promise<VaultRow | null>
  createVault(userId: string, email: string): Promise<VaultRow>
  /** Stores the new ciphertext and returns the fresh `updated_at` timestamp. */
  updateVault(userId: string, encryptedData: string): Promise<string>
}
