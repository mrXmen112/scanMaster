'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { toFriendlyAuthError } from '@/lib/auth-errors'
import { ensureUserProfile, getUserProfile, type UserProfile } from '@/lib/supabase/database'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  /** Raw JWT from the current session — what the server routes expect as a
   *  Bearer token. Derived from `session` so it can never go stale. */
  accessToken: string | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ error: string | null; needsConfirmation?: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const configured = isSupabaseConfigured()
  // When configured, we need to check the existing session first (loading = true).
  // When not configured, there's nothing to check — loading = false immediately.
  const [loading, setLoading] = useState(configured)
  const profileLoadingRef = useRef<string | null>(null)
  const lastLoadedProfileIdRef = useRef<string | null>(null)

  const loadProfile = useCallback(async (userId: string, force = false) => {
    // Prevent duplicate concurrent loads for the same user
    if (profileLoadingRef.current === userId) return
    // Prevent re-loading the same user profile on token refresh
    if (!force && lastLoadedProfileIdRef.current === userId) return

    profileLoadingRef.current = userId
    lastLoadedProfileIdRef.current = userId

    try {
      const p = await getUserProfile(userId)
      setProfile(p)
    } catch {
      setProfile(null)
    } finally {
      profileLoadingRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!configured) {
      // Not configured — nothing to check, loading is done
      setLoading(false)
      return
    }

    let cancelled = false
    const supabase = createClient()

    // Get initial session — runs once on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        loadProfile(s.user.id, true)
      } else {
        setProfile(null)
        lastLoadedProfileIdRef.current = null
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (cancelled) return
        setSession(s)
        setUser(s?.user ?? null)

        if (s?.user) {
          // Only reload profile for sign-in/sign-up events, not token refresh.
          const isTokenRefresh = event === 'TOKEN_REFRESHED'
          if (isTokenRefresh) return

          await loadProfile(s.user.id, true)
          if (cancelled) return
        } else {
          setProfile(null)
          lastLoadedProfileIdRef.current = null
        }
        if (!cancelled) setLoading(false)
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [configured, loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!configured) {
      return {
        error:
          'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env.local file to enable authentication.',
      }
    }
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: toFriendlyAuthError(error).message }
      return { error: null }
    } catch (err) {
      const friendly = toFriendlyAuthError({
        code: (err as { code?: string })?.code,
        message: (err as Error)?.message,
      })
      return { error: friendly.message }
    }
  }, [configured])

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    if (!configured) {
      return {
        error:
          'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file to enable authentication.',
      }
    }
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { error: toFriendlyAuthError(error).message }

      // GoTrue returns HTTP 200 and a user object even when "Confirm email" is
      // enabled in the dashboard — but in that case `session` is null and the
      // person is NOT signed in. The old code ignored `session` entirely and
      // returned success, so the UI showed "Account created!" and then left
      // them staring at the login screen with no explanation. Signing in at
      // that point fails with email_not_confirmed.
      //
      // Reporting needsConfirmation lets the UI say "check your inbox"
      // instead of claiming success it cannot deliver.
      if (data.user && !data.session) {
        return {
          error: null,
          needsConfirmation: true,
        }
      }

      // A session exists — create the profile row now.
      if (data.user) {
        await ensureUserProfile(data.user.id, email, name)
      }

      return { error: null }
    } catch (err) {
      return { error: toFriendlyAuthError({ message: (err as Error)?.message }).message }
    }
  }, [configured])

  const signOut = useCallback(async () => {
    if (!configured) return
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      lastLoadedProfileIdRef.current = null
    } catch {
      // If signOut API call failed, still clear local state
      setUser(null)
      setProfile(null)
      setSession(null)
      lastLoadedProfileIdRef.current = null
    }
  }, [configured])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id, true)
  }, [user, loadProfile])

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        accessToken: session?.access_token ?? null,
        loading,
        configured,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
