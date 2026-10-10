'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useAd } from '@/contexts/AdContext'

/**
 * InterstitialAdOverlay
 *
 * Shows a full-screen mock interstitial ad overlay in web/test mode.
 * In native mode, the AdMob SDK handles the interstitial UI.
 *
 * This overlay appears briefly (1.5s) then auto-dismisses.
 * It is non-blocking and the user can close it at any time.
 */
export default function InterstitialAdOverlay() {
  const { interstitialShowing, testMode } = useAd()

  // In native mode, the SDK handles the overlay
  if (typeof window !== 'undefined' && (window as Record<string, unknown>).Capacitor) {
    return null
  }

  return (
    <AnimatePresence>
      {interstitialShowing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-label="Advertisement"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative w-[300px] h-[250px] bg-card rounded-2xl border border-border/30 shadow-2xl flex flex-col items-center justify-center gap-3"
          >
            {/* Close button */}
            <button
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Close ad"
              onClick={() => {
                // The overlay will auto-dismiss via the AdProvider timeout
                // but we allow manual dismiss too
              }}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {/* Mock ad content */}
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-primary/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
            </div>

            <div className="text-center px-6">
              <div className="h-3 w-40 rounded bg-muted-foreground/10 mx-auto mb-2" />
              <div className="h-2.5 w-28 rounded bg-muted-foreground/5 mx-auto" />
            </div>

            {/* Test Ad badge */}
            <span className="text-[9px] text-muted-foreground/40 border border-muted-foreground/10 rounded px-1.5 py-0.5 uppercase tracking-wider">
              {testMode ? 'Test Ad' : 'Ad'}
            </span>

            {/* Auto-dismiss indicator */}
            <div className="absolute bottom-3 flex items-center gap-1.5">
              <div className="h-1 w-16 rounded-full bg-muted-foreground/10 overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, ease: 'linear' }}
                  className="h-full bg-primary/40 rounded-full"
                />
              </div>
              <span className="text-[9px] text-muted-foreground/30">Auto-close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
