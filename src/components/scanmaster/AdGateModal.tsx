'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Eye, Loader2, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRewardedAd } from '@/hooks/use-rewarded-ad'
import { toast } from 'sonner'

interface AdGateModalProps {
  open: boolean
  feature: string
  onWatchAd: () => void
  onClose: () => void
}

/**
 * Shown when a user reaches the daily limit for an AI-assisted feature.
 *
 * ScanMaster is a free app, so there is no paid tier to upsell here. The only
 * way past the limit is watching a rewarded ad, which is the standard
 * "rewarded ad for an extra attempt" pattern and is disclosed in the Privacy
 * Policy and on the Play Store listing.
 */
export default function AdGateModal({
  open,
  feature,
  onWatchAd,
  onClose,
}: AdGateModalProps) {
  const { showRewardedAd, showing: adShowing } = useRewardedAd()
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleWatchAd = async () => {
    setLoading(true)
    try {
      const earned = await showRewardedAd()
      if (earned) {
        onWatchAd()
        toast.success('Thanks for watching! You got one more use.')
      } else {
        toast.error('Ad was not completed. No reward granted.')
      }
    } catch {
      toast.error('Failed to load ad. Try again later.')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card relative w-full max-w-sm space-y-4 rounded-2xl border border-glass-border p-6 text-center"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tool-surface">
          <Clock className="h-7 w-7 text-tool-surface-fg" strokeWidth={1.8} aria-hidden />
        </div>

        <div>
          <h3 className="gradient-text text-base font-bold">Daily Limit Reached</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            You have used today&apos;s free {feature} attempts.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <Button
            onClick={handleWatchAd}
            disabled={loading || adShowing}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {loading ? 'Loading Ad...' : 'Watch Ad for One More Use'}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="h-11 w-full rounded-xl border-glass-border text-xs font-semibold"
          >
            Come Back Tomorrow
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Limits reset daily. Watching an ad grants one extra attempt.
        </p>
      </motion.div>
    </div>
  )
}
