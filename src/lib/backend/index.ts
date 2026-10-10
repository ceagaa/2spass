import { isSupabaseConfigured } from '../supabase'
import { localBackend } from './localBackend'
import { supabaseBackend } from './supabaseBackend'
import type { Backend } from './types'

/**
 * Force local mode even when Supabase env vars are present (`VITE_LOCAL_MODE=1`).
 * Otherwise: if Supabase is configured → production backend, else → local backend.
 */
const forceLocal = import.meta.env.VITE_LOCAL_MODE === '1'
const useLocal = forceLocal || !isSupabaseConfigured

export const backend: Backend = useLocal ? localBackend : supabaseBackend

export const isLocalMode = useLocal

export type { AuthUser, Backend } from './types'
