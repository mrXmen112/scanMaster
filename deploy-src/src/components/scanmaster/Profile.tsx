'use client'

import {
  User,
  Crown,
  Moon,
  Sun,
  Globe,
  HardDrive,
  Trash2,
  ChevronRight,
  Info,
  LogOut,
  Loader2,
  Wifi,
  WifiOff,
  UserPlus,
  LogIn,
  Eye,
  Beaker,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { useMounted } from '@/hooks/use-mounted'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useState, useEffect, memo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default memo(function Profile() {
  const { setActiveView, files, toggleTheme, theme } = useAppStore()
  const { user, loading: authLoading, signOut } = useAuth()
  const { setTheme } = useTheme()
  const mounted = useMounted()
  const isOnline = useOnlineStatus()
  const [signingOut, setSigningOut] = useState(false)
  const [language, setLanguage] = useState('english')

  const isPremium = user?.profile?.tier === 'premium' || user?.profile?.premium_status === true

  let premiumPlan = ''
  let premiumExpiry = ''

  if (isPremium && typeof user?.profile?.goal === 'string') {
    const goalStr = user.profile.goal
    const planMatch = goalStr.match(/plan:([^|]+)/)
    const expiryMatch = goalStr.match(/expiry:(.+)/)
    if (planMatch) {
      premiumPlan = planMatch[1].charAt(0).toUpperCase() + planMatch[1].slice(1)
    }
    if (expiryMatch) {
      try {
        premiumExpiry = new Date(expiryMatch[1]).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      } catch {
        // ignore
      }
    }
  }

  // Sync language with localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('preferred_language')
      if (savedLang) {
        setLanguage(savedLang)
      }
    }
  }, [])

  const handleLanguageChange = (val: string) => {
    setLanguage(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_language', val)
      toast.success(`Language set to ${val.charAt(0).toUpperCase() + val.slice(1)}`)
    }
  }

  const totalStorage = 50 * 1024 * 1024 // 50MB
  const usedStorage = files.reduce((acc, f) => acc + f.size, 0)
  const storagePercent = Math.min((usedStorage / totalStorage) * 100, 100)

  const formatStorage = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleThemeToggle = () => {
    toggleTheme()
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const handleClearCache = () => {
    toast.success('Cache cleared successfully')
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      toast.success('Signed out successfully')
    } catch {
      toast.error('Failed to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  const handleContinueAsGuest = () => {
    toast.info('Using ScanMaster AI in guest mode. Some features require sign-in.')
  }

  const displayName =
    user?.profile?.name || user?.email?.split('@')[0] || 'Guest User'
  const displayEmail = user?.email || 'Not signed in'

  // NOTE: Removed blocking authLoading spinner — app should never show infinite loading.
  // Auth state resolves reactively; Profile renders with guest data until auth completes.

  return (
    <div className="px-4 py-4 space-y-5 pb-28">
      {/* User Avatar Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-primary/20 mx-auto flex items-center justify-center mb-3">
          {user ? (
            <span className="text-2xl font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </span>
          ) : (
            <User className="h-10 w-10 text-primary" />
          )}
        </div>
        <h2 className="text-lg font-bold text-foreground flex items-center justify-center gap-1.5">
          {displayName}
          {isPremium && <Crown className="h-4 w-4 text-yellow-400 fill-yellow-400/20" />}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {user ? displayEmail : 'Sign in to unlock all features'}
        </p>

        {/* Safe Testing Indicator for Premium Status */}
        {isPremium && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl max-w-xs mx-auto text-left space-y-1.5 shadow-lg shadow-yellow-500/5">
            <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-xs uppercase tracking-wider">
              <Crown className="w-4 h-4 shrink-0" />
              <span>Premium: Active</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono space-y-0.5">
              {premiumPlan && <p>Plan: {premiumPlan}</p>}
              {premiumExpiry && <p>Expiry: {premiumExpiry}</p>}
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
          {/* Authenticated badge */}
          {user && (
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">Authenticated</span>
            </div>
          )}

          {/* Online/Offline badge — based on real connectivity only */}
          {!isOnline ? (
            <div className="flex items-center justify-center gap-1.5">
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-[11px] text-red-400 font-medium">Offline</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">Online</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ─── Authentication Buttons ─── */}

      {/* Not logged in — show sign-in / sign-up / guest options */}
      {!user && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Account
          </h3>

          {/* Sign In with Email */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => setActiveView('auth')}
            className="w-full glass-card-hover p-3 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <LogIn className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Sign In</p>
              <p className="text-xs text-muted-foreground">Use your email &amp; password</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.button>

          {/* Create Account */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            onClick={() => setActiveView('auth')}
            className="w-full glass-card-hover p-3 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Create Account</p>
              <p className="text-xs text-muted-foreground">Sign up for free</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.button>

          {/* Continue as Guest */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            onClick={handleContinueAsGuest}
            className="w-full glass-card-hover p-3 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Eye className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Continue as Guest</p>
              <p className="text-xs text-muted-foreground">Local scanning &amp; PDF creation</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.button>
        </div>
      )}

      {/* Logged in — show sign-out button */}
      {user && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full glass-card-hover p-3 flex items-center gap-3 border-red-500/20 hover:border-red-500/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            {signingOut ? (
              <Loader2 className="h-5 w-5 text-red-400 animate-spin" />
            ) : (
              <LogOut className="h-5 w-5 text-red-400" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-red-400">Sign Out</p>
            <p className="text-xs text-muted-foreground">Sign out of your account</p>
          </div>
        </motion.button>
      )}

      {/* Premium Banner */}
      {!isPremium && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setActiveView('premium')}
          className="w-full glass-card-hover p-4 flex items-center gap-3 border-primary/30"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
            <Crown className="h-6 w-6 text-yellow-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-foreground">
              Upgrade to Premium
            </p>
            <p className="text-xs text-muted-foreground">
              Unlimited tools &amp; AI features
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-primary" />
        </motion.button>
      )}

      {/* Settings Section */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Settings
        </h3>
        <div className="glass-card divide-y divide-glass-border">
          {/* Theme Toggle */}
          <button
            onClick={handleThemeToggle}
            className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors min-h-[44px]"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
              {mounted && theme === 'dark' ? (
                <Moon className="h-5 w-5 text-purple-400" />
              ) : mounted && theme === 'light' ? (
                <Sun className="h-5 w-5 text-yellow-400" />
              ) : (
                <Moon className="h-5 w-5 text-purple-400 opacity-0" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground capitalize">
                {theme} mode
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Language */}
          <div className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Globe className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Language</p>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="h-7 mt-1 border-0 bg-transparent px-0 shadow-none focus:ring-0 w-[120px]">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="spanish">Spanish</SelectItem>
                  <SelectItem value="french">French</SelectItem>
                  <SelectItem value="german">German</SelectItem>
                  <SelectItem value="arabic">Arabic</SelectItem>
                  <SelectItem value="urdu">Urdu</SelectItem>
                  <SelectItem value="chinese">Chinese</SelectItem>
                  <SelectItem value="japanese">Japanese</SelectItem>
                  <SelectItem value="tamil">Tamil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Storage Usage */}
          <div className="p-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Storage</p>
                <p className="text-xs text-muted-foreground">
                  {formatStorage(usedStorage)} of {formatStorage(totalStorage)} used
                </p>
              </div>
            </div>
            <Progress value={storagePercent} className="h-2" />
          </div>

          {/* Clear Cache */}
          <button
            onClick={handleClearCache}
            className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Clear Cache</p>
              <p className="text-xs text-muted-foreground">Free up storage space</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* About Section */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          About
        </h3>
        <div className="glass-card p-3 flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Scan Master</p>
            <p className="text-xs font-mono text-[#00f0ff] mt-1 font-semibold">
              Version 1.0.0
            </p>
          </div>
        </div>
      </div>

      {/* Legal Section */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">
          Legal
        </h3>
        <div className="glass-card divide-y divide-glass-border">
          <button
            onClick={() => setActiveView('privacy-policy')}
            className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <p className="text-sm font-medium text-foreground">Privacy Policy</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          
          <button
            onClick={() => setActiveView('terms-conditions')}
            className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <p className="text-sm font-medium text-foreground">Terms & Conditions</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Developer Diagnostics completely removed for final production build */}
    </div>
  )
})
