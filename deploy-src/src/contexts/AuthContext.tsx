'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  emailVerified: boolean
  providers: string[]
  createdAt: string
  profile: {
    name?: string
    avatar_url?: string
    [key: string]: unknown
  }
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  loading: boolean
  pendingEmailVerification: boolean
  pendingEmail: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null; requiresVerification?: boolean }>
  signInWithOAuth: (provider: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  verifyEmail: (email: string, otp: string) => Promise<{ error: string | null }>
  resendVerification: (email: string) => Promise<{ error: string | null }>
  refreshUser: () => Promise<void>
}

function mapSupabaseUser(sbUser: User): AuthUser {
  return {
    id: sbUser.id,
    email: sbUser.email || '',
    emailVerified: !!sbUser.email_confirmed_at,
    providers: sbUser.app_metadata?.providers || [],
    createdAt: sbUser.created_at,
    profile: {
      name: sbUser.user_metadata?.name || sbUser.user_metadata?.full_name || '',
      avatar_url: sbUser.user_metadata?.avatar_url || '',
    },
  }
}

function supabaseErrorMessage(err: unknown): string {
  if (!err) return 'Something went wrong. Please try again.'
  const e = err as { message?: string; code?: string; status?: number; __isAuthError?: boolean }

  const msg = (e.message || '').toLowerCase()
  const code = (e.code || '').toUpperCase()

  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials'))
    return 'Wrong email or password. Please try again.'
  if (msg.includes('email not confirmed') || code === 'EMAIL_NOT_CONFIRMED')
    return 'Please verify your email before signing in.'
  if (msg.includes('user already registered') || code === 'USER_ALREADY_EXISTS')
    return 'An account with this email already exists. Please sign in instead.'
  if (msg.includes('weak password'))
    return 'Password is too weak. Please use at least 8 characters.'
  if (code === 'VALIDATION_ERROR' || e.status === 400 || e.status === 422)
    return 'Invalid input. Please check your details and try again.'
  if (msg.includes('rate limit') || e.status === 429)
    return 'Too many attempts. Please wait a moment and try again.'
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch'))
    return 'Network error. Please check your connection and try again.'
  if (e.status && e.status >= 500)
    return 'Authentication service is temporarily unavailable. Please try again later.'

  return e.message || 'Something went wrong. Please try again.'
}

async function syncProfileFromDb(userId: string, email: string): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    return {
      id: userId,
      email,
      emailVerified: true,
      providers: [],
      createdAt: '',
      profile: {
        name: profile?.name || email.split('@')[0],
        avatar_url: profile?.avatar_url || '',
      },
    }
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingEmailVerification, setPendingEmailVerification] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const AUTH_TIMEOUT_MS = 3000

    const restore = async () => {
      console.log('[ScanMaster] Supabase auth check started')
      try {
        if (!isSupabaseConfigured()) {
          console.warn('[ScanMaster] Supabase not configured — guest mode')
          if (!cancelled) setUser(null)
          return
        }

        const supabase = createClient()
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<{ data: { session: null }; error: 'timeout' }>(
          (resolve) => setTimeout(() => resolve({ data: { session: null }, error: 'timeout' }), AUTH_TIMEOUT_MS)
        )

        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]) as any

        if (!cancelled) {
          if (error === 'timeout') {
            console.warn('[ScanMaster] Auth check timed out — guest mode')
            setUser(null)
          } else if (data?.session?.user) {
            const sbUser = data.session.user as User
            console.log('[ScanMaster] Session found:', sbUser.email)
            const mappedUser = mapSupabaseUser(sbUser)
            const synced = await syncProfileFromDb(sbUser.id, sbUser.email || '')
            if (synced) {
              mappedUser.profile = synced.profile
            }
            setUser(mappedUser)
            setAccessToken(data.session.access_token)
          } else {
            console.log('[ScanMaster] No session — guest mode')
            setUser(null)
          }
        }
      } catch (err) {
        console.warn('[ScanMaster] Auth check failed — guest mode:', err)
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    restore()

    const supabase = isSupabaseConfigured() ? createClient() : null
    const { data: listener } = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const mappedUser = mapSupabaseUser(session.user)
        setUser(mappedUser)
        setAccessToken(session.access_token)
        setPendingEmailVerification(false)
        setPendingEmail(null)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setAccessToken(null)
      } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        setAccessToken(session.access_token)
      }
    }) ?? { data: { subscription: null } }

    return () => {
      cancelled = true
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Contact support.' }
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: supabaseErrorMessage(error) }
      if (data?.user) {
        const mappedUser = mapSupabaseUser(data.user)
        const synced = await syncProfileFromDb(data.user.id, data.user.email || '')
        if (synced) mappedUser.profile = synced.profile
        setUser(mappedUser)
        setAccessToken(data.session?.access_token ?? null)
        setPendingEmailVerification(false)
        setPendingEmail(null)
      }
      return { error: null }
    } catch (err) {
      return { error: supabaseErrorMessage(err) }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    try {
      if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Contact support.' }
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
          options: {
            data: { name: name || email.split('@')[0] },
            emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
          },
      })
      if (error) return { error: supabaseErrorMessage(error) }

      if (data?.user?.identities?.length === 0) {
        return { error: 'An account with this email already exists. Please sign in instead.' }
      }

      if (data?.user && !data.user.email_confirmed_at) {
        setPendingEmailVerification(true)
        setPendingEmail(email)
        return { error: null, requiresVerification: true }
      }

      if (data?.user && data.session?.access_token) {
        const mappedUser = mapSupabaseUser(data.user)
        const synced = await syncProfileFromDb(data.user.id, data.user.email || '')
        if (synced) mappedUser.profile = synced.profile
        setUser(mappedUser)
        setAccessToken(data.session.access_token)
      }
      return { error: null }
    } catch (err) {
      return { error: supabaseErrorMessage(err) }
    }
  }, [])

  const signInWithOAuth = useCallback(async (provider: string) => {
    try {
      if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Contact support.' }
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
        },
      })
      if (error) return { error: supabaseErrorMessage(error) }
      if (data?.url) {
        window.location.href = data.url
        return { error: null }
      }
      return { error: 'OAuth provider unavailable. Try another method.' }
    } catch (err) {
      return { error: supabaseErrorMessage(err) }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient()
        await supabase.auth.signOut()
      }
    } catch {
      // ignore
    } finally {
      setUser(null)
      setAccessToken(null)
      setPendingEmailVerification(false)
      setPendingEmail(null)
    }
  }, [])

  const verifyEmail = useCallback(async (email: string, otp: string) => {
    try {
      if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Contact support.' }
      const supabase = createClient()
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })
      if (error) return { error: supabaseErrorMessage(error) }
      if (data?.user) {
        const mappedUser = mapSupabaseUser(data.user)
        const synced = await syncProfileFromDb(data.user.id, data.user.email || '')
        if (synced) mappedUser.profile = synced.profile
        setUser(mappedUser)
        setAccessToken(data.session?.access_token ?? null)
        setPendingEmailVerification(false)
        setPendingEmail(null)
      }
      return { error: null }
    } catch (err) {
      return { error: supabaseErrorMessage(err) }
    }
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    try {
      if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Contact support.' }
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (error) return { error: supabaseErrorMessage(error) }
      return { error: null }
    } catch (err) {
      return { error: supabaseErrorMessage(err) }
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      if (!isSupabaseConfigured()) return
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        const mappedUser = mapSupabaseUser(data.user)
        const synced = await syncProfileFromDb(data.user.id, data.user.email || '')
        if (synced) mappedUser.profile = synced.profile
        setUser(mappedUser)
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        pendingEmailVerification,
        pendingEmail,
        signIn,
        signUp,
        signInWithOAuth,
        signOut,
        verifyEmail,
        resendVerification,
        refreshUser,
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