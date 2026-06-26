import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cloud mode is enabled only when both env vars are present. Otherwise the app
// runs in local-only mode (browser localStorage), exactly as before.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloudEnabled = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
