import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { VaultRow } from '../types'
import type { AuthUser, Backend } from './types'

function toUser(user: User): AuthUser {
  return { id: user.id, email: user.email ?? '' }
}

export const supabaseBackend: Backend = {
  mode: 'supabase',

  async getSessionUser() {
    const { data } = await supabase.auth.getSession()
    return data.session?.user ? toUser(data.session.user) : null
  },

  onAuthChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? toUser(session.user) : null)
    })
    return () => data.subscription.unsubscribe()
  },

  async signUp(email, authSecret) {
    const { data, error } = await supabase.auth.signUp({ email, password: authSecret })
    if (error) throw error
    // No session => the provider requires e-mail confirmation. Report that
    // instead of a half-authenticated user whose vault reads would run as `anon`.
    return data.session?.user ? toUser(data.session.user) : null
  },

  async signIn(email, authSecret) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: authSecret,
    })
    if (error || !data.session || !data.user) {
      throw new Error('E-mail ou senha mestra incorretos.')
    }
    return toUser(data.user)
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  async fetchVault(userId) {
    const { data, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return (data as VaultRow | null) ?? null
  },

  async createVault(userId, email) {
    const { data, error } = await supabase
      .from('vaults')
      .insert({ user_id: userId, salt: randomSalt(), kdf_salt: email.trim().toLowerCase() })
      .select('*')
      .single()
    if (error) throw error
    return data as VaultRow
  },

  async updateVault(userId, encryptedData) {
    const { data, error } = await supabase
      .from('vaults')
      .update({ encrypted_data: encryptedData, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('updated_at')
      .single()
    if (error) throw error
    return (data as { updated_at: string }).updated_at
  },
}

function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}
