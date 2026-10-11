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
  Mail,
  Shield,
  Loader2,
  AlertCircle,
  Database,
  CheckCircle2,
  Wifi,
  WifiOff,
UserPlus,
    LogIn,
    Eye,
    ShieldCheck,
    FileText,
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
import { getSetupStatus, getCachedSetupStatus, type SetupStatus } from '@/lib/setup-status-cache'
import { DEV_TOOLS_ENABLED } from '@/lib/dev-tools'
import { appVersion } from '@/lib/app-version'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import SupabaseSetupWizard from './SupabaseSetupWizard'

// Module-level flag: ensures setup status is checked only ONCE per app session,
// even if the Profile component unmounts and remounts due to navigation.
let hasCheckedSetupGlobally = false

export default memo(function Profile() {
  const { setActiveView, files, toggleTheme, theme } = useAppStore()
  const { user, profile, signOut, configured, loading: authLoading } = useAuth()
  const { setTheme } = useTheme()
  const mounted = useMounted()
  const isOnline = useOnlineStatus()
  const [signingOut, setSigningOut] = useState(false)
  const [setupDialogOpen, setSetupDialogOpen] = useState(false)
  const [dbStatus, setDbStatus] = useState<SetupStatus | null>(
    DEV_TOOLS_ENABLED ? getCachedSetupStatus() : null
  )

  // Check database setup status ONCE per app session.
  // Skipped in release builds: the status UI is hidden there and the endpoint
  // is a Next.js API route that a static export does not ship, so the request
  // would always fail while burning a network round-trip on every app launch.
  useEffect(() => {
    if (!DEV_TOOLS_ENABLED) return
    if (!configured || hasCheckedSetupGlobally) return
    hasCheckedSetupGlobally = true

    let cancelled = false
    getSetupStatus().then((status) => {
      if (!cancelled) setDbStatus(status)
    })

    return () => { cancelled = true }
  }, [configured])

  // When dialog closes, refresh from cache (wizard may have updated it)
  const handleDialogChange = (open: boolean) => {
    setSetupDialogOpen(open)
    if (!open) {
      const cached = getCachedSetupStatus()
      if (cached) setDbStatus(cached)
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
    if (typeof window === 'undefined') return
    try {
      const cacheKeys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && (key.startsWith('cache_') || key.startsWith('tmp_') || key.startsWith('preview_'))) {
          cacheKeys.push(key)
        }
      }
      cacheKeys.forEach((key) => window.localStorage.removeItem(key))
      if (cacheKeys.length > 0) {
        toast.success(`Cleared ${cacheKeys.length} cached item${cacheKeys.length > 1 ? 's' : ''}`)
      } else {
        toast.info('No cache to clear')
      }
    } catch {
      toast.error('Failed to clear cache')
    }
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
    toast.info('Using ScanMaster in guest mode. Some features require sign-in.')
  }

  const displayName = profile?.name || user?.email?.split('@')[0] || 'Guest User'
  const displayEmail = user?.email || 'Not signed in'

  // Auth loading spinner
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    )
  }

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
        <h2 className="text-lg font-bold text-foreground">{displayName}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {user ? displayEmail : 'Sign in to unlock all features'}
        </p>

        {/* Status badges */}
        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
          {/* Authenticated badge */}
          {user && (
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">Authenticated</span>
            </div>
          )}

          {/* Online/Offline badge — based on real connectivity, NOT Supabase config */}
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

          {/* Setup required badge — only when Supabase is not configured */}
          {!configured && (
            <div className="flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-yellow-400" />
              <span className="text-[11px] text-yellow-400 font-medium">Setup required</span>
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

          {/* Sign In with Email — always visible */}
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
              <p className="text-sm font-medium text-foreground">Sign in with Email</p>
              <p className="text-xs text-muted-foreground">
                {configured ? 'Use your email & password' : 'Requires Supabase setup'}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.button>

          {/* Sign Up with Email — always visible */}
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
              <p className="text-xs text-muted-foreground">
                {configured ? 'Sign up for cloud sync & more' : 'Requires Supabase setup'}
              </p>
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
              <p className="text-xs text-muted-foreground">Local scanning & PDF creation</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.button>

          {/* Setup warning when not configured */}
          {!configured && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20"
            >
              <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-xs text-yellow-300 font-medium">Supabase not configured</p>
                <p className="text-[11px] text-yellow-300/70 mt-0.5">
                  Set <code className="font-mono bg-yellow-500/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                  <code className="font-mono bg-yellow-500/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your{' '}
                  <code className="font-mono bg-yellow-500/10 px-1 rounded">.env.local</code> file to enable auth & cloud sync.
                </p>
              </div>
            </motion.div>
          )}
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

      {/* Database Setup Section — always visible so users can set up Supabase */}
      {/* Backend — developer tooling only. The Android build is a static
          export with no API routes, so these actions cannot run on device. */}
      {DEV_TOOLS_ENABLED && (
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Backend
        </h3>
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => setSetupDialogOpen(true)}
          className="w-full glass-card-hover p-3 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Database className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-foreground">Database Setup</p>
            <p className="text-xs text-muted-foreground">
              {!configured
                ? 'Not configured — tap to set up'
                : dbStatus?.allGood
                  ? 'All systems operational'
                  : dbStatus?.connection
                    ? 'Needs configuration'
                    : dbStatus
                      ? 'Checking status...'
                      : 'Not checked yet'}
            </p>
          </div>
          {/* Status indicator dot */}
          <div className="flex items-center gap-1.5">
            {!configured ? (
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
            ) : dbStatus?.allGood ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : dbStatus?.connection ? (
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </motion.button>
      </div>
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
          <button
            onClick={() => toast.info('Language settings coming soon')}
            className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Globe className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Language</p>
              <p className="text-xs text-muted-foreground">English</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

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

           {/* Legal — these were previously unreachable. PrivacyPolicy.tsx and
               TermsConditions.tsx existed but were never rendered by any view,
               so the app shipped with no privacy policy or terms link at all.
               Play Store review and GDPR-style disclosure both expect one. */}
           <button
             onClick={() => setActiveView('privacy-policy')}
             className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
           >
             <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
               <ShieldCheck className="h-5 w-5 text-primary" />
             </div>
             <div className="flex-1 text-left">
               <p className="text-sm font-medium text-foreground">Privacy Policy</p>
               <p className="text-xs text-muted-foreground">How we handle your data</p>
             </div>
             <ChevronRight className="h-4 w-4 text-muted-foreground" />
           </button>

           <button
             onClick={() => setActiveView('terms-conditions')}
             className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
           >
             <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
               <FileText className="h-5 w-5 text-primary" />
             </div>
             <div className="flex-1 text-left">
               <p className="text-sm font-medium text-foreground">Terms &amp; Conditions</p>
               <p className="text-xs text-muted-foreground">Rules for using ScanMaster</p>
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
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">ScanMaster</p>
            <p className="text-xs text-muted-foreground">Version {appVersion}</p>
          </div>
        </div>
      </div>

      {/* Database Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-400" />
              Supabase Setup
            </DialogTitle>
            <DialogDescription>
              Configure your Supabase database, tables, and storage bucket.
            </DialogDescription>
          </DialogHeader>
          <SupabaseSetupWizard />
        </DialogContent>
      </Dialog>
    </div>
  )
})
