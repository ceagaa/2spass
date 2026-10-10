import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.info(
    '[lock] Supabase não configurado — rodando em MODO LOCAL (dados apenas neste navegador). ' +
      'Para usar o backend de produção, crie .env.local a partir de .env.example.',
  )
}

/**
 * Supabase client.
 *
 * `sessionStorage` is used deliberately: the auth session (JWT) is volatile and
 * disappears when the tab is closed, so a stolen disk image cannot resume the
 * session. The vault encryption key is never persisted anywhere.
 */
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    storageKey: 'lock.auth.session',
    flowType: 'pkce',
  },
  global: {
    headers: { 'x-application-name': 'lock-pwa' },
  },
})
