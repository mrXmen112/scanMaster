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
import { isNativePlatform, resolveAuthRedirect } from '@/lib/auth-redirect'
import { App } from '@capacitor/app'
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
  /** Starts an OAuth (e.g. Google) flow. Redirects the browser, so the
   *  promise resolves before the user has actually authenticated. */
  signInWithOAuth: (provider: 'google') => Promise<{ error: string | null }>
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

  /**
   * Deep-link handling for the email-confirmation link.
   *
   * With "Confirm email" enabled, tapping the emailed link reopens the app via
   * scanmaster://auth-callback?code=... . Two cases have to be covered:
   *
   *   - app already running  -> App 'appUrlOpen'
   *   - app killed / cold    -> App.getLaunchUrl() returns the same URL
   *
   * Missing the second case is a classic Capacitor bug: the user taps the link
   * while the app is not running, the app launches, and nothing happens
   * because the listener was only registered after startup.
   *
   * Either way we hand the code to exchangeCodeForSession, which signs the
   * user in and fires onAuthStateChange, which the listener above already
   * handles (sets session, user, loads profile).
   */
  useEffect(() => {
    if (!configured || !isNativePlatform()) return

    let cancelled = false

    const exchangeFromUrl = async (url: string) => {
      if (!url || cancelled) return
      if (!url.startsWith('scanmaster://')) return

      let code: string | null = null
      try {
        // scanmaster://auth-callback?code=... — URL parses this fine.
        code = new URL(url).searchParams.get('code')
      } catch {
        code = null
      }
      // Older/verify-token links use ?token_hash=&type= instead of ?code=
      const tokenHash = (() => {
        try {
          return new URL(url).searchParams.get('token_hash')
        } catch {
          return null
        }
      })()
      const type = (() => {
        try {
          return new URL(url).searchParams.get('type')
        } catch {
          return null
        }
      })()

      if (!code && !(tokenHash && type)) return

      try {
        const supabase = createClient()
        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        } else if (tokenHash && type) {
          await supabase.auth.verifyOtp({
            type: type as 'email',
            token_hash: tokenHash,
          })
        }
      } catch {
        // A failed exchange leaves the user on the login screen, where the
        // friendly error mapping will explain what to do if they try again.
      }
    }

    // Cold start: app was launched *by* the link.
    App.getLaunchUrl()
      .then((result) => {
        if (result?.url) void exchangeFromUrl(result.url)
      })
      .catch(() => {})

    // Warm start: app was already open.
    const listener = App.addListener('appUrlOpen', ({ url }) => {
      void exchangeFromUrl(url)
    })

    return () => {
      cancelled = true
      listener.then((l) => l.remove()).catch(() => {})
    }
  }, [configured])

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

      // Where Supabase should send the confirmation link. Without this it
      // falls back to the project's Site URL, which on Android means a web
      // page the user cannot get back into the app from. scanmaster:// is
      // declared in AndroidManifest.xml, so this deep-links straight back
      // into the app where the deep-link handler exchanges the code.
      const emailRedirectTo = resolveAuthRedirect()

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      })
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

  /**
   * Google sign-in via Supabase OAuth.
   *
   * This restores functionality that was present in an earlier checkpoint and
   * had gone missing: the provider button and this function were both absent
   * from the tree, so "Continue with Google" simply did not exist in the app.
   *
   * On native we must hand Supabase a redirect it can deep-link back into the
   * app with. AndroidManifest.xml already declares the matching intent-filter
   *
   *     <data android:scheme="scanmaster" android:host="auth-callback" />
   *
   * so scanmaster://auth-callback will reopen the app, where onAuthStateChange
   * (already wired above) picks up the session Google handed back.
   *
   * This redirect URL must ALSO be allow-listed in Supabase under
   * Authentication -> URL Configuration -> Redirect URLs, otherwise GoTrue
   * rejects the request before the browser ever opens.
   */
  const signInWithOAuth = useCallback(async (provider: 'google') => {
    if (!configured) {
      return { error: 'Supabase is not configured. Sign-in is unavailable right now.' }
    }
    try {
      const supabase = createClient()

      const redirectTo = resolveAuthRedirect()

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: false },
      })

      if (error) return { error: toFriendlyAuthError(error).message }
      // No error here does not mean signed in — on success the browser is
      // redirected away and this promise never meaningfully "completes" for
      // the user. The session arrives later via onAuthStateChange.
      return { error: null }
    } catch (err) {
      return {
        error:
          'Could not open Google sign-in. Check your connection and try again.',
      }
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
    signInWithOAuth,
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
