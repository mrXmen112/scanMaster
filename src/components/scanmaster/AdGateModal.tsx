'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Crown, Eye, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRewardedAd } from '@/hooks/use-rewarded-ad'
import { toast } from 'sonner'

interface AdGateModalProps {
  open: boolean
  feature: string
  onWatchAd: () => void
  onPremium: () => void
  onClose: () => void
}

export default function AdGateModal({ open, feature, onWatchAd, onPremium, onClose }: AdGateModalProps) {
  const { showRewardedAd, ready: adReady, showing: adShowing } = useRewardedAd()
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
    } catch (err) {
      toast.error('Failed to load ad. Try again later.')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card max-w-sm w-full p-6 rounded-2xl text-center space-y-4 border border-glass-border"
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>

        <div className="h-14 w-14 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto">
          <Crown className="h-7 w-7 text-amber-400" />
        </div>

        <div>
          <h3 className="text-base font-bold gradient-text">Daily Limit Reached</h3>
          <p className="text-xs text-muted-foreground mt-1">
            You've used all 3 free {feature} attempts today.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <Button
            onClick={handleWatchAd}
            disabled={loading || adShowing}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {loading ? 'Loading Ad...' : 'Watch Rewarded Ad to Continue'}
          </Button>
          <Button
            onClick={onPremium}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
          >
            <Crown className="h-4 w-4" /> Get Premium — Unlimited Access
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Limit resets daily. Watch a rewarded ad for an extra attempt. Premium removes all limits.
        </p>
      </motion.div>
    </div>
  )
}
