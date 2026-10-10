'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Database,
  HardDrive,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  Download,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getSetupStatus,
  invalidateSetupCache,
  getCachedSetupStatus,
  isInSetupPendingBackoff,
  type SetupStatus,
} from '@/lib/setup-status-cache'

const MIGRATION_SQL = `-- ============================================================
-- ScanMaster — Supabase Database Schema
-- Run this SQL in the Supabase SQL Editor
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create user_files table
CREATE TABLE IF NOT EXISTS public.user_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_type TEXT DEFAULT 'pdf',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_files_user_id ON public.user_files(user_id);
CREATE INDEX IF NOT EXISTS idx_user_files_created_at ON public.user_files(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;

-- 4. Profiles: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Profiles: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. User files: Users can read only their own files
CREATE POLICY "Users can read own files"
  ON public.user_files FOR SELECT
  USING (auth.uid() = user_id);

-- 8. User files: Users can insert only their own files
CREATE POLICY "Users can insert own files"
  ON public.user_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 9. User files: Users can update only their own files
CREATE POLICY "Users can update own files"
  ON public.user_files FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. User files: Users can delete only their own files
CREATE POLICY "Users can delete own files"
  ON public.user_files FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Storage Policies
-- ============================================================

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- Trigger: Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();`

// Module-level flag: prevents the mount-time checkStatus from running
// more than once per app session, even if the dialog opens/closes multiple times.
let hasAutoCheckedWizard = false

export default function SupabaseSetupWizard() {
  const [status, setStatus] = useState<SetupStatus | null>(getCachedSetupStatus())
  const [checking, setChecking] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sqlExpanded, setSqlExpanded] = useState(false)
  const lastManualCheckRef = useRef(0)
  const creatingRef = useRef(false) // Ref for double-click guard
  const checkingRef = useRef(false) // Ref to prevent concurrent checkStatus calls
  const MANUAL_CHECK_COOLDOWN_MS = 2000 // Minimum 2s between manual "Check Status" clicks

  // Check status via shared cache — deduplicates concurrent requests automatically.
  // Respects pending backoff: if we recently got a pending error, returns cached/offline.
  const checkStatus = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent check calls (e.g., mount + click at same time)
    if (checkingRef.current) return
    // Respect pending backoff — don't make a request if we recently got a pending error
    if (!forceRefresh && isInSetupPendingBackoff()) return

    checkingRef.current = true
    setChecking(true)
    try {
      const result = await getSetupStatus(forceRefresh)
      setStatus(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('pending state') || msg.includes('PreconditionFailed') || msg.includes('503')) {
        toast.info('Setup is still processing. Please wait a few seconds and try again.')
      } else {
        toast.error('Failed to check Supabase status')
      }
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }, [])

  // Manual "Check Status" button — enforces cooldown, forces refresh
  const handleCheckStatusClick = useCallback(async () => {
    // Enforce cooldown between manual clicks
    const now = Date.now()
    if (now - lastManualCheckRef.current < MANUAL_CHECK_COOLDOWN_MS) return
    lastManualCheckRef.current = now

    await checkStatus(true) // forceRefresh = true
  }, [checkStatus])

  const handleCreateBucket = useCallback(async () => {
    // Guard: prevent double-click using a ref
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12_000)

      const res = await fetch('/api/setup/supabase', { method: 'POST', signal: controller.signal })
      clearTimeout(timeoutId)

      if (res.status === 503) {
        toast.info('Setup is still processing. Please wait a few seconds and try again.')
        return
      }

      // Check for PreconditionFailed in response body (platform may return any status)
      let data: unknown = null
      try {
        data = await res.json()
      } catch {
        // Not JSON
      }
      if (data && typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>
        if (obj.Code === 'PreconditionFailed' || String(obj.Message || '').includes('pending state')) {
          toast.info('Setup is still processing. Please wait a few seconds and try again.')
          return
        }
      }

      if (data && typeof data === 'object' && (data as Record<string, unknown>).success) {
        toast.success('Setup actions completed')
      } else if (data && typeof data === 'object') {
        const failed = ((data as Record<string, unknown>).results as { success: boolean; message: string }[])?.filter((r) => !r.success)
        if (failed?.length > 0) {
          toast.error(failed[0].message)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('pending state') || msg.includes('PreconditionFailed') || msg.includes('503') || msg.includes('timed out')) {
        toast.info('Setup is still processing. Please wait a few seconds and try again.')
      } else {
        toast.error('Failed to run setup actions')
      }
    } finally {
      creatingRef.current = false
      setCreating(false)
      // Invalidate cache so next check returns fresh data,
      // but do NOT auto-recheck here — let the user click "Check Status" manually.
      // The previous code called checkStatus(true) here, which caused
      // an immediate GET request right after the POST, hitting the same
      // pending function and causing a PreconditionFailed error.
      invalidateSetupCache()
      // Update local state from cache (which may have been invalidated)
      const cached = getCachedSetupStatus()
      if (cached) setStatus(cached)
    }
  }, [])

  const copySql = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL)
      setCopied(true)
      toast.success('SQL copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy SQL')
    }
  }, [])

  const downloadSql = useCallback(() => {
    try {
      const blob = new Blob([MIGRATION_SQL], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '001_initial_schema.sql'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('SQL file downloaded!')
    } catch {
      // Fallback: open the API endpoint in a new tab
      window.open('/api/setup/migration', '_blank')
    }
  }, [])

  // Auto-check on mount — uses shared cache, so no duplicate if Profile already checked.
  // Module-level flag ensures this only runs once per app session.
  useEffect(() => {
    if (hasAutoCheckedWizard) return
    hasAutoCheckedWizard = true
    checkStatus()
  }, [])

  const steps = [
    {
      number: 1,
      title: 'Get the SQL Migration',
      description: 'Download or copy the SQL script below, then open the Supabase Dashboard',
      link: 'https://supabase.com/dashboard/project/sswyiiqyveufsejftgbv/sql',
      completed: status?.tables.profiles && status?.tables.user_files,
    },
    {
      number: 2,
      title: 'Run in Supabase SQL Editor',
      description: 'Paste the SQL in the SQL Editor and click "Run" to create tables, policies, and triggers',
      link: 'https://supabase.com/dashboard/project/sswyiiqyveufsejftgbv/sql',
      completed: status?.tables.profiles && status?.tables.user_files,
    },
    {
      number: 3,
      title: 'Create Storage Bucket',
      description: 'Dashboard → Storage → New Bucket → Name: "user-files" → Public: Off',
      link: 'https://supabase.com/dashboard/project/sswyiiqyveufsejftgbv/storage',
      completed: status?.bucket,
    },
    {
      number: 4,
      title: 'Verify Setup',
      description: 'Click "Check Status" below to confirm everything is working',
      completed: status?.allGood,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <Database className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground">Database Setup</h2>
            <p className="text-xs text-muted-foreground">Configure your Supabase backend</p>
          </div>
          {status?.allGood && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </motion.div>
          )}
        </div>

        {/* Status Overview */}
        {status && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-2 mb-4"
          >
            {/* Connection */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/50">
              {status.connection ? (
                <Wifi className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <span className="text-xs font-medium text-foreground">
                {status.connection ? 'Connected' : 'No Connection'}
              </span>
            </div>

            {/* Tables */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/50">
              {status.tables.profiles && status.tables.user_files ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
              )}
              <span className="text-xs font-medium text-foreground">
                {status.tables.profiles && status.tables.user_files ? 'Tables OK' : 'Tables Missing'}
              </span>
            </div>

            {/* Bucket */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/50">
              {status.bucket ? (
                <HardDrive className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <HardDrive className="h-4 w-4 text-yellow-400 shrink-0" />
              )}
              <span className="text-xs font-medium text-foreground">
                {status.bucket ? 'Bucket OK' : 'Bucket Missing'}
              </span>
            </div>

            {/* Overall */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/50">
              {status.allGood ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <span className="text-xs font-medium text-foreground">
                {status.allGood ? 'All Ready' : 'Needs Setup'}
              </span>
            </div>
          </motion.div>
        )}

        {/* Summary */}
        {status && (
          <p className="text-xs text-muted-foreground mb-4">{status.summary}</p>
        )}

        {/* Action Buttons — cross-disabled to prevent concurrent requests */}
        <div className="flex gap-2">
          <button
            onClick={handleCheckStatusClick}
            disabled={checking || creating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Check Status
          </button>
          {!status?.allGood && status?.connection && (
            <button
              onClick={handleCreateBucket}
              disabled={creating || checking}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="h-4 w-4" />
              )}
              Create Bucket
            </button>
          )}
        </div>
      </motion.div>

      {/* All Good Banner */}
      {status?.allGood && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-5 border-emerald-500/30"
        >
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
              className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0"
            >
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </motion.div>
            <div>
              <h3 className="text-sm font-bold text-emerald-400">Everything is set up!</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your database tables, storage bucket, and security policies are all configured. You can now use cloud sync, file storage, and user authentication.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step-by-step Guide */}
      {!status?.allGood && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Setup Guide
          </h3>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`glass-card p-4 flex items-start gap-3 ${
                  step.completed ? 'border-emerald-500/20' : ''
                }`}
              >
                {/* Step Number / Check */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  step.completed
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    step.completed ? 'text-emerald-400' : 'text-foreground'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
                    >
                      Open in Dashboard
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* SQL Section */}
      {!status?.allGood && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => setSqlExpanded(!sqlExpanded)}
            className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">SQL Migration Script</span>
              <span className="text-[10px] text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">.sql</span>
            </div>
            {sqlExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          <AnimatePresence>
            {sqlExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="glass-card p-4 mt-2 border-t-0 rounded-t-none">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">
                      Run this SQL in the Supabase SQL Editor
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={downloadSql}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 min-h-[32px]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </button>
                      <button
                        onClick={copySql}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 min-h-[32px]"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <ScrollArea className="max-h-80 rounded-xl bg-secondary/50">
                    <pre className="p-3 text-[11px] leading-relaxed text-muted-foreground font-mono whitespace-pre overflow-x-auto">
                      {MIGRATION_SQL}
                    </pre>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
