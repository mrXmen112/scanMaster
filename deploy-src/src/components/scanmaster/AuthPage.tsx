'use client'

import { useState, memo, FormEvent, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import {
  Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle,
  ArrowLeft, Shield, CheckCircle2, RefreshCw, Sparkles,
  Zap, Brain, Rocket, ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

type AuthMode = 'login' | 'signup' | 'verify-email'

const features = [
  { icon: Zap, label: 'Smart Scan', desc: 'Scan and digitize documents with your camera' },
  { icon: Brain, label: 'PDF Tools', desc: 'Edit, merge, split and compress documents' },
  { icon: Rocket, label: 'Fast & Private', desc: 'Optimized for speed and on-device processing' },
]

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle at 30% 30%, #7B61FF, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <motion.div
        animate={{ x: [0, -30, 40, 0], y: [0, 50, -30, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle at 70% 70%, #FF4FD8, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  )
}

function HeroSphere() {
  const sphereRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!sphereRef.current) return
      const rect = sphereRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      sphereRef.current.style.transform = `perspective(800px) rotateY(${x * 15}deg) rotateX(${-y * 15}deg)`
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="relative flex items-center justify-center mb-10">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative"
      >
        <div
          ref={sphereRef}
          className="w-56 h-56 md:w-64 md:h-64 rounded-full relative transition-transform duration-200 ease-out"
          style={{
            background: 'linear-gradient(135deg, rgba(123,97,255,0.2), rgba(255,79,216,0.15))',
            boxShadow: '0 0 80px rgba(123,97,255,0.15), inset 0 0 80px rgba(255,255,255,0.05)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="absolute inset-2 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.15), transparent 60%)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-xl">
              <Sparkles className="w-10 h-10 md:w-12 md:h-12 text-white" style={{ filter: 'drop-shadow(0 0 10px rgba(123,97,255,0.5))' }} />
            </div>
          </div>
          {/* Orbiting rings */}
          <svg className="absolute inset-0 w-full h-full animate-spin-slow" viewBox="0 0 256 256" style={{ animationDuration: '20s' }}>
            <ellipse cx="128" cy="128" rx="120" ry="40" fill="none" stroke="rgba(123,97,255,0.12)" strokeWidth="1" transform="rotate(30 128 128)" />
            <ellipse cx="128" cy="128" rx="120" ry="40" fill="none" stroke="rgba(255,79,216,0.1)" strokeWidth="1" transform="rotate(-30 128 128)" />
          </svg>
        </div>
        {/* Glow dots */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: i === 1 ? '#7B61FF' : '#FF4FD8',
              boxShadow: `0 0 8px ${i === 1 ? '#7B61FF' : '#FF4FD8'}`,
              top: `${40 + Math.sin(i * 2.1) * 35}%`,
              left: `${40 + Math.cos(i * 2.1) * 35}%`,
            }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2 + i, repeat: Infinity, delay: i * 0.7 }}
          />
        ))}
      </motion.div>
    </div>
  )
}

function FeatureCards() {
  return (
    <div className="space-y-3 w-full max-w-sm mx-auto">
      {features.map((f, i) => (
        <motion.div
          key={f.label}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 + i * 0.12, duration: 0.5, ease: 'easeOut' }}
          className="group flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 cursor-default"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          whileHover={{
            background: 'rgba(255,255,255,0.08)',
            x: 4,
            transition: { duration: 0.2 },
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `linear-gradient(135deg, rgba(123,97,255,0.15), rgba(255,79,216,0.1))`,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <f.icon className="w-4.5 h-4.5" style={{ color: '#C4B5FF' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90">{f.label}</p>
            <p className="text-xs text-white/50 mt-0.5">{f.desc}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
        </motion.div>
      ))}
    </div>
  )
}

function SocialProof() {
  const avatars = [
    'https://i.pravatar.cc/40?img=1', 'https://i.pravatar.cc/40?img=2',
    'https://i.pravatar.cc/40?img=3', 'https://i.pravatar.cc/40?img=4',
    'https://i.pravatar.cc/40?img=5',
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="flex items-center justify-center gap-3 mt-6"
    >
      <div className="flex -space-x-2">
        {avatars.map((src, i) => (
          <div
            key={i}
            className="w-8 h-8 rounded-full border-2 border-white/10 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>
      <p className="text-xs text-white/60">
        <span className="text-white/90 font-medium">10M+</span> trusted users
      </p>
    </motion.div>
  )
}

function OAuthButton({ provider, icon, label }: { provider: string; icon: React.ReactNode; label: string }) {
  const { signInWithOAuth } = useAuth()
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => signInWithOAuth(provider)}
      className="w-full flex items-center justify-center gap-3 h-12 rounded-2xl text-sm font-medium transition-all duration-200 cursor-pointer"
      style={{
        background: '#F7F7F8',
        border: '1px solid #E8E8ED',
        color: '#1A1A2E',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#D0D0D8'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#E8E8ED'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {icon}
      {label}
    </motion.button>
  )
}

function AuthForm({ mode, setMode, email, setEmail, password, setPassword, name, setName, otp, setOtp, showPassword, setShowPassword, loading, error, handleSubmit, handleResendCode, resending }: {
  mode: AuthMode; setMode: (m: AuthMode) => void
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  name: string; setName: (v: string) => void
  otp: string; setOtp: (v: string) => void
  showPassword: boolean; setShowPassword: (v: boolean) => void
  loading: boolean; error: string | null
  handleSubmit: (e: FormEvent) => Promise<void>
  handleResendCode: () => Promise<void>
  resending: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className="w-full"
    >
      <div
        className="rounded-3xl p-8 md:p-10 w-full max-w-md mx-auto"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 40px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.02)',
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-3 mb-8"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #7B61FF, #FF4FD8)',
              boxShadow: '0 4px 12px rgba(123,97,255,0.3)',
            }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-base font-semibold" style={{ color: '#0D0D12' }}>ScanMaster AI</p>
            <p className="text-[11px]" style={{ color: '#8E8EA0' }}>Your all-in-one document hub</p>
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-2xl md:text-[28px] font-bold tracking-tight mb-1"
          style={{ color: '#0D0D12' }}
        >
          {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Verify email'}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-sm mb-8"
          style={{ color: '#8E8EA0' }}
        >
          {mode === 'login'
            ? 'Sign in to continue with ScanMaster AI'
            : mode === 'signup'
            ? 'Enter your details to get started'
            : 'Check your email for the confirmation link to verify your account'}
        </motion.p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Verify Email Banner */}
          <AnimatePresence mode="wait">
            {mode === 'verify-email' && (
              <motion.div
                key="verify-banner"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-start gap-2.5 p-3.5 rounded-2xl mb-2"
                style={{
                  background: 'rgba(123,97,255,0.06)',
                  border: '1px solid rgba(123,97,255,0.1)',
                }}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#7B61FF' }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: '#7B61FF' }}>Verification email sent!</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8E8EA0' }}>
                    We sent a confirmation link to{' '}
                    <span className="font-medium" style={{ color: '#0D0D12' }}>{email}</span>
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: '#8E8EA0' }}>
                    Click the link in the email to verify your account and sign in.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name */}
          <AnimatePresence>
            {mode === 'signup' && (
              <motion.div
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8E8EA0' }} />
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 text-sm rounded-2xl transition-all duration-200 outline-none"
                    style={{
                      background: '#F7F7F8',
                      border: '1px solid #E8E8ED',
                      color: '#0D0D12',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#7B61FF'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,97,255,0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#E8E8ED'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    autoComplete="name"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          {mode !== 'verify-email' && (
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8E8EA0' }} />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-11 pr-4 text-sm rounded-2xl transition-all duration-200 outline-none"
                style={{
                  background: '#F7F7F8',
                  border: '1px solid #E8E8ED',
                  color: '#0D0D12',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#7B61FF'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,97,255,0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E8ED'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                autoComplete="email"
              />
            </div>
          )}

          {/* Password */}
          {mode !== 'verify-email' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8E8EA0' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={`Password${mode === 'signup' ? ' (min 6 chars)' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-11 pr-12 text-sm rounded-2xl transition-all duration-200 outline-none"
                style={{
                  background: '#F7F7F8',
                  border: '1px solid #E8E8ED',
                  color: '#0D0D12',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#7B61FF'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,97,255,0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E8ED'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 transition-colors"
                style={{ color: '#8E8EA0' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#0D0D12'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#8E8EA0'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Remember me + Forgot */}
          {mode === 'login' && (
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded-md"
                  style={{ accentColor: '#7B61FF' }}
                />
                <span className="text-xs" style={{ color: '#8E8EA0' }}>Remember me</span>
              </label>
              <button
                type="button"
                className="text-xs font-medium transition-colors"
                style={{ color: '#7B61FF' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2 p-3 rounded-2xl"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.1)',
                }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#EF4444' }} />
                <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl text-sm font-semibold text-white transition-all duration-300 cursor-pointer disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #7B61FF, #FF4FD8)',
                boxShadow: '0 4px 16px rgba(123,97,255,0.3)',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.boxShadow = '0 6px 24px rgba(123,97,255,0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(123,97,255,0.3)'
              }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : mode === 'login' ? (
                'Sign In'
              ) : mode === 'signup' ? (
                'Create Account'
              ) : (
                'Verify Email'
              )}
            </button>
          </motion.div>
        </form>

        {/* Divider */}
        {mode !== 'verify-email' && (
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px" style={{ background: '#E8E8ED' }} />
            <span className="text-xs font-medium" style={{ color: '#B0B0C0' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#E8E8ED' }} />
          </div>
        )}

        {/* OAuth */}
        {mode !== 'verify-email' && (
          <div className="space-y-3">
            <OAuthButton
              provider="google"
              label="Continue with Google"
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              }
            />
            <OAuthButton
              provider="apple"
              label="Continue with Apple"
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1A1A2E">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.41-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 8.84 7.31c1.33.05 2.19.67 3.02.69.96-.04 1.82-.73 3.02-.66 1.57.1 2.76.73 3.57 1.84-3.25 1.89-2.63 6.08.56 7.3-.64 1.47-1.58 2.93-2.96 3.81ZM12.03 7.25c-.15-2.23 1.66-4.07 3.73-4.25.29 2.28-1.66 4.3-3.73 4.25Z"/>
                </svg>
              }
            />
          </div>
        )}

        {/* Resend */}
        {mode === 'verify-email' && (
          <div className="text-center mt-6">
            <button
              onClick={handleResendCode}
              disabled={resending}
              className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: '#7B61FF' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Resend confirmation email
            </button>
            <button
              onClick={() => setMode('login')}
              className="block text-xs mt-3 mx-auto transition-colors"
              style={{ color: '#8E8EA0' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#0D0D12'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#8E8EA0'}
            >
              Back to sign in
            </button>
          </div>
        )}

        {/* Switch mode */}
        {mode !== 'verify-email' && (
          <div className="text-center mt-6">
            <p className="text-xs" style={{ color: '#8E8EA0' }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="font-medium transition-colors"
                style={{ color: '#7B61FF' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button className="text-[11px] transition-colors" style={{ color: '#B0B0C0' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#8E8EA0'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#B0B0C0'}
          >
            Privacy Policy
          </button>
          <span style={{ color: '#D0D0D8' }}>·</span>
          <button className="text-[11px] transition-colors" style={{ color: '#B0B0C0' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#8E8EA0'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#B0B0C0'}
          >
            Terms
          </button>
          <span style={{ color: '#D0D0D8' }}>·</span>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#B0B0C0' }}>
            <Shield className="w-3 h-3" />
            Secured with Supabase
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default memo(function AuthPage() {
  const { signIn, signUp, signInWithOAuth, resendVerification, pendingEmailVerification, pendingEmail } = useAuth()
  const { setActiveView } = useAppStore()

  const [mode, setMode] = useState<AuthMode>(pendingEmailVerification ? 'verify-email' : 'login')
  const [email, setEmail] = useState(pendingEmail || '')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode !== 'verify-email') {
      if (!email.trim()) { setError('Please enter your email address.'); return }
      if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return }
      if (mode === 'signup' && !name.trim()) { setError('Please enter your name.'); return }
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        const result = await signIn(email.trim(), password)
        if (result.error) setError(result.error)
        else { toast.success('Welcome back!'); setActiveView('home') }
      } else if (mode === 'signup') {
        const result = await signUp(email.trim(), password, name.trim() || undefined)
        if (result.error) setError(result.error)
        else if (result.requiresVerification) { toast.info('Check your email for a confirmation link.'); setMode('verify-email') }
        else { toast.success('Account created! Welcome to ScanMaster AI.'); setActiveView('home') }
      }
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  const handleResendCode = async () => {
    const emailAddr = email.trim() || pendingEmail || ''
    if (!emailAddr) { setError('Please enter your email address first.'); return }
    setResending(true); setError(null)
    try {
      const result = await resendVerification(emailAddr)
      if (result.error) setError(result.error)
      else toast.success('Verification email resent. Check your inbox.')
    } finally { setResending(false) }
  }

  return (
    <div
      className="min-h-screen flex relative overflow-hidden"
      style={{ background: '#FAFAFA' }}
    >
      {/* ── LEFT: Hero ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0D0D12 0%, #1A1025 40%, #0D0D12 100%)',
        }}
      >
        <FloatingOrbs />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col items-center text-center max-w-lg"
        >
          <HeroSphere />

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight"
          >
            Your Personal
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #C4B5FF, #FF9FE8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Document Hub</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-sm md:text-base text-white/50 mb-10 leading-relaxed max-w-sm"
          >
            Scan, edit and manage documents anywhere — all in one place.
          </motion.p>

          <FeatureCards />
          <SocialProof />
        </motion.div>
      </div>

      {/* ── RIGHT: Auth ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <button
          onClick={() => setActiveView('profile')}
          className="absolute top-6 left-6 flex items-center gap-2 text-xs font-medium transition-all duration-200 z-10"
          style={{ color: '#8E8EA0' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#0D0D12'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#8E8EA0'}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <AuthForm
          mode={mode}
          setMode={(m) => { setMode(m); setError(null); setOtp('') }}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          name={name}
          setName={setName}
          otp={otp}
          setOtp={setOtp}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          loading={loading}
          error={error}
          handleSubmit={handleSubmit}
          handleResendCode={handleResendCode}
          resending={resending}
        />
      </div>
    </div>
  )
})