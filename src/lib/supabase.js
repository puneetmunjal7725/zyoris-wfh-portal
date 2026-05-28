import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''

export function isSupabaseConfigured() {
  return Boolean(url && anonKey)
}

export const supabase = isSupabaseConfigured() ? createClient(url, anonKey) : null
