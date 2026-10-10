'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Gift, Loader2 } from 'lucide-react'
import { useAd } from '@/contexts/AdContext'

/**
 * RewardedAdOverlay
 *
 * Shows a full-screen mock rewarded ad overlay in web/test mode.
 * In native mode, the AdMob SDK handles the rewarded ad UI.
 *
 * This overlay simulates a rewarded video ad:
 * - Shows a 2s "watching ad" animation
 * - Then auto-completes
 */
export default function RewardedAdOverlay() {
  const { rewardedShowing, testMode } = useAd()

  // In native mode, the SDK handles the overlay
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return null
  }

  return (
    <AnimatePresence>
      {rewardedShowing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          role="dialog"
          aria-label="Rewarded Advertisement"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative w-[300px] h-[260px] bg-card rounded-2xl border border-border/30 shadow-2xl flex flex-col items-center justify-center gap-4"
          >
            {/* Reward icon */}
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
              <Gift className="h-8 w-8 text-yellow-400" />
            </div>

            <div className="text-center px-6">
              <p className="text-sm font-medium text-foreground mb-1">Watch to Unlock</p>
              <p className="text-xs text-muted-foreground">
                Watch this short ad to support us
              </p>
            </div>

            {/* Loading/watching indicator */}
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Watching ad...</span>
            </div>

            {/* Test Ad badge */}
            <span className="text-[9px] text-muted-foreground/40 border border-muted-foreground/10 rounded px-1.5 py-0.5 uppercase tracking-wider">
              {testMode ? 'Test Rewarded Ad' : 'Rewarded Ad'}
            </span>

            {/* Progress bar */}
            <div className="absolute bottom-3 flex items-center gap-1.5">
              <div className="h-1 w-24 rounded-full bg-muted-foreground/10 overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'linear' }}
                  className="h-full bg-yellow-400/60 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
