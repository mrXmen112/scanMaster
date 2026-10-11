import { createBrowserClient } from '@supabase/ssr'

// Supabase ships two flavours of public key, both safe to expose in the bundle:
//   - sb_publishable_...  the current "publishable key" (preferred)
//   - eyJ...              the legacy "anon" JWT, still issued on older projects
// Prefer the publishable key and fall back to the legacy name so existing
// installs keep working. Neither key grants admin access — Row Level Security
// is the only thing protecting user data, so this ordering is a
// compatibility concern, not a security one.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''

export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    // No warning here — isSupabaseConfigured() should be checked first.
    // Logging on every call is noisy; callers already check configured.
    return createNoOpClient()
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}

// No-op client for when Supabase is not configured — prevents crashes
function createNoOpClient() {
  const handler = {
    get() {
      return () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
    },
  }
  return new Proxy({} as ReturnType<typeof createBrowserClient>, handler)
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseKey)
}
