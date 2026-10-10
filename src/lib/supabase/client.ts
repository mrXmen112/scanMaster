import { createBrowserClient } from '@supabase/ssr'

// Support both common env var names for the Supabase anon key.
// NEXT_PUBLIC_SUPABASE_ANON_KEY is the standard Supabase convention.
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY was used in earlier versions of this app.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
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
