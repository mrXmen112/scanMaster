'use client'

import { useState, memo, FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import {
  ScanLine,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Shield,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

type AuthMode = 'login' | 'signup'

export default memo(function AuthPage() {
  const { signIn, signUp, signInWithOAuth, resendVerification, configured } = useAuth()
  const { setActiveView } = useAppStore()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.')
      return
    }

    setLoading(true)
    try {
      let result: { error: string | null; needsConfirmation?: boolean }
      if (mode === 'login') {
        result = await signIn(email.trim(), password)
      } else {
        result = await signUp(email.trim(), password, name.trim())
      }

      if (result.error) {
        setError(result.error)
      } else if (result.needsConfirmation) {
        // "Confirm email" is enabled in the Supabase dashboard, so the account
        // exists but there is no session yet. Telling the user "Account
        // created!" here was the bug that made sign-up look broken: the toast
        // said success, nothing happened, and the person was still on the
        // login screen. Be explicit about the one step that is left.
        setConfirmationSent(email.trim())
      } else {
        toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setGoogleLoading(true)
    try {
      const { error: oauthError } = await signInWithOAuth('google')
      // A null error here means the browser is being handed off to Google.
      // Stop spinning or the button looks wedged if the user backs out.
      if (oauthError) setError(oauthError)
      else setGoogleLoading(false)
    } finally {
      setTimeout(() => setGoogleLoading(false), 1500)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError(null)
  }

  // Shown instead of the form once an account exists but still needs the
  // emailed link tapped. It replaces the form entirely so nobody sits there
  // guessing why signing in does not work.
  if (confirmationSent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
        <div className="relative w-full max-w-sm">
          <button
            onClick={() => { setConfirmationSent(null); setMode('login') }}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>

          <div className="glass-card p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-7 w-7 text-primary" />
            </div>

            <h1 className="text-xl font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-4">
              We sent a confirmation link to
            </p>
            <p className="text-sm font-semibold text-foreground break-all mb-4">
              {confirmationSent}
            </p>
            <p className="text-sm text-muted-foreground">
              Tap the link in that email to activate your account, then come
              back and sign in.
            </p>

            <div className="mt-6 pt-5 border-t border-glass-border space-y-2">
              <p className="text-xs text-muted-foreground">
                Nothing arrived? Check your spam folder, or
              </p>
              <button
onClick={async () => {
                        setLoading(true)
                        // Must be resendVerification() — this used to call
                        // signIn(), which cannot send an email, so the button
                        // silently did nothing useful.
                        const { error: resendError } = await resendVerification(confirmationSent)
                        setLoading(false)
                        if (resendError) {
                          toast.info(resendError)
                        } else {
                          toast.success('Confirmation sent again.')
                        }
                      }}
                disabled={loading}
                className="text-sm text-primary font-medium hover:underline disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Resend the email'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Back button */}
        <button
          onClick={() => setActiveView('profile')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </button>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg mb-4"
          >
            <ScanLine className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold">
            <span className="gradient-text">ScanMaster</span>
            <span className="text-foreground"> AI</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
          </p>
        </div>

        {/* Setup warning banner — shown when Supabase is not configured */}
        {!configured && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-4"
          >
            <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-xs text-yellow-300 font-medium">Authentication not available</p>
              <p className="text-[11px] text-yellow-300/70 mt-0.5">
                Supabase is not configured. Set{' '}
                <code className="font-mono bg-yellow-500/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                <code className="font-mono bg-yellow-500/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your{' '}
                <code className="font-mono bg-yellow-500/10 px-1 rounded">.env.local</code> file to enable authentication.
              </p>
            </div>
          </motion.div>
        )}

        {/* Auth Form — always visible */}
        <div className="glass-card p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field (signup only) */}
            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full glass-input pl-10 pr-4 py-3 text-sm"
                      autoComplete="name"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-3 text-sm"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input pl-10 pr-12 py-3 text-sm"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"
                >
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] electric-glow bg-electric hover:bg-electric/90 text-electric-foreground"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          {/* OAuth. Rendered in both modes — Google creates the account on first use,
              so a separate "sign up with Google" would be misleading. */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-glass-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-2xl text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-60"
            style={{
              background: '#F7F7F8',
              border: '1px solid #E8E8ED',
              color: '#1A1A2E',
            }}
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            )}
            <span>{googleLoading ? 'Opening Google…' : 'Continue with Google'}</span>
          </button>

          {/* Switch mode */}
          <div className="text-center mt-5">
            <p className="text-xs text-muted-foreground">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={switchMode}
                className="text-primary font-medium hover:underline"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>

{/* Security note */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              Your data is encrypted and secure
            </p>
           </div>

           {/* Legal links. Consent to the terms has to be reachable from the
               sign-up screen itself, not only from Profile after the fact —
               this is the screen where we ask for an email address. */}
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            By continuing you agree to our{' '}
            <button
              onClick={() => setActiveView('terms-conditions')}
              className="text-primary hover:underline"
            >
              Terms &amp; Conditions
            </button>{' '}
            and{' '}
            <button
              onClick={() => setActiveView('privacy-policy')}
              className="text-primary hover:underline"
            >
              Privacy Policy
            </button>
          </p>
      </motion.div>
    </div>
  )
})
