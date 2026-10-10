'use client'

import { useEffect, useState, useCallback } from 'react'
import { Check, Crown, X, Sparkles, Play, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useRewardedAd } from '@/hooks/use-rewarded-ad'
import { useAuth } from '@/contexts/AuthContext'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void
    }
  }
}

const PREMIUM_MONTHLY_PRICE_INR = 99
const PREMIUM_YEARLY_PRICE_INR = 799
const PREMIUM_MONTHLY_PLAN_NAME = "Premium Monthly"
const PREMIUM_YEARLY_PLAN_NAME = "Premium Yearly"

const premiumFeatures = [
  'Unlimited PDF editing',
  'No watermark',
  'High-quality compression',
  'Unlimited OCR',
  'Unlimited speech to text',
  'AI PDF summary',
  'Cloud backup',
  'Batch export',
  'ZIP export',

]

const freeFeatures = [
  { name: 'PDF editing', free: '3/day', premium: 'Unlimited' },
  { name: 'OCR', free: '3/day', premium: 'Unlimited' },
  { name: 'Speech to Text', free: '3/day', premium: 'Unlimited' },
  { name: 'E-Signature', free: 'Unlimited', premium: 'Unlimited' },
  { name: 'Password Protection', free: 'Unlimited', premium: 'Unlimited' },
  { name: 'AI Summary', free: '2/day', premium: 'Unlimited' },
  { name: 'Compression', free: 'Basic', premium: 'High Quality' },
  { name: 'Cloud Backup', free: 'No', premium: 'Yes' },
]

export default function PremiumPlan() {
  const { goBack, setActiveView } = useAppStore()
  const { showRewardedAd, ready: adReady, showing: adShowing } = useRewardedAd()
  const { user, accessToken, refreshUser } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)
  const [razorpayLoaded, setRazorpayLoaded] = useState(false)

  useEffect(() => {
    if (document.querySelector('script[src*="checkout.razorpay"]')) {
      setRazorpayLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => setRazorpayLoaded(true)
    document.body.appendChild(script)
    return () => {
    }
  }, [])

  const isPremium = user?.profile?.premium_status === true
  const subscriptionId = user?.profile?.subscription_id || ''

  const handleSubscribe = useCallback(async (planType: string) => {
    if (!user) {
      toast.error('Please sign in or sign up first to purchase Premium.')
      setActiveView('auth')
      return
    }

    if (!razorpayLoaded) {
      toast.error('Payment system is loading. Please try again.')
      return
    }

    setLoading(planType)

    try {
      const res = await fetch('/api/ai/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ planType }),
      })

      const data = await res.json()

      if (!data.success) {
        toast.error(data.message || 'Failed to start subscription.')
        setLoading(null)
        return
      }

      const checkout = new window.Razorpay({
        ...data.checkoutOptions,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch('/api/ai/subscribe/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                subscriptionId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            })
            const verifyData = await verifyRes.json()
            if (!verifyData.success) {
              toast.error('Payment verification failed. Contact support if amount was deducted.')
              return
            }
          } catch {
            toast.error('Verification error. Contact support if amount was deducted.')
            return
          }
          toast.success('Payment successful! Welcome to Premium.')
          await refreshUser()
          setActiveView('home')
        },
        modal: {
          ondismiss: () => {
            setLoading(null)
          },
        },
      })

      checkout.open()
    } catch (err: any) {
      toast.error(err.message || 'Payment failed. Please try again.')
    } finally {
      setLoading(null)
    }
  }, [user, accessToken, razorpayLoaded, refreshUser, setActiveView])

  const handleManageSubscription = useCallback(async (action: 'cancel' | 'pause' | 'resume') => {
    if (!subscriptionId) return

    setLoading('manage')

    try {
      const res = await fetch('/api/ai/subscription/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action, subscriptionId }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(`Subscription ${action}ed successfully.`)
        await refreshUser()
      } else {
        toast.error(data.message || `Failed to ${action} subscription.`)
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} subscription.`)
    } finally {
      setLoading(null)
    }
  }, [subscriptionId, accessToken, refreshUser])

  const handleWatchAd = async () => {
    const earned = await showRewardedAd()
    if (earned) {
      toast.success('Premium feature unlocked for this session! Enjoy one free premium action.')
    } else {
      toast.error('Ad was not completed. Please try again to unlock.')
    }
  }

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-3 electric-glow">
          <Crown className="h-8 w-8 text-yellow-400" />
        </div>
        <h2 className="text-2xl font-bold gradient-text">
          {isPremium ? 'You\'re Premium!' : 'Go Premium'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isPremium
            ? 'Enjoy unlimited access to all features.'
            : 'Unlock the full power of ScanMaster AI'
          }
        </p>
      </motion.div>

      {/* Premium Status Banner */}
      {isPremium && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-4 border-green-500/30 bg-green-500/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
              <Crown className="h-5 w-5 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-400">Premium Active</p>
              <p className="text-xs text-muted-foreground">
                All premium features are unlocked.
              </p>
            </div>
            {subscriptionId && (
              <button
                onClick={() => handleManageSubscription('cancel')}
                disabled={loading === 'manage'}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {loading === 'manage' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancel'}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Feature Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card overflow-hidden"
      >
        <div className="grid grid-cols-3 gap-0">
          <div className="p-3 border-b border-glass-border">
            <span className="text-xs font-semibold text-muted-foreground">
              Feature
            </span>
          </div>
          <div className="p-3 border-b border-glass-border text-center">
            <span className="text-xs font-semibold text-muted-foreground">
              Free
            </span>
          </div>
          <div className="p-3 border-b border-glass-border text-center">
            <span className="text-xs font-semibold text-primary">Premium</span>
          </div>
          {freeFeatures.map((feature, i) => (
            <div
              key={feature.name}
              className="contents"
            >
              <div className="p-2.5 border-b border-glass-border">
                <span className="text-xs text-foreground">{feature.name}</span>
              </div>
              <div className="p-2.5 border-b border-glass-border text-center">
                {feature.free === 'No' ? (
                  <X className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {feature.free}
                  </span>
                )}
              </div>
              <div className="p-2.5 border-b border-glass-border text-center">
                {feature.premium === 'Yes' ? (
                  <Check className="h-3.5 w-3.5 text-primary mx-auto" />
                ) : (
                  <span className="text-xs text-primary font-medium">
                    {feature.premium}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Watch Ad to Unlock */}
      {adReady && !isPremium && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card-hover p-5 border-yellow-500/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center">
              <Play className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Watch Ad to Unlock</p>
              <p className="text-xs text-muted-foreground">Get 1 free premium action</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Watch a short video ad to unlock one premium feature temporarily.
          </p>
          <button
            onClick={handleWatchAd}
            disabled={adShowing}
            className="w-full py-2.5 rounded-xl bg-yellow-500/15 text-yellow-400 text-sm font-semibold hover:bg-yellow-500/25 transition-colors border border-yellow-500/20 disabled:opacity-50"
          >
            {adShowing ? 'Watching Ad...' : '▶ Watch Ad & Unlock'}
          </button>
        </motion.div>
      )}

      {/* Pricing Cards */}
      {!isPremium && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card-hover p-5 flex flex-col"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {PREMIUM_MONTHLY_PLAN_NAME}
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">₹{PREMIUM_MONTHLY_PRICE_INR}</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <button
              onClick={() => handleSubscribe(PREMIUM_MONTHLY_PLAN_NAME)}
              disabled={loading === PREMIUM_MONTHLY_PLAN_NAME || !razorpayLoaded}
              className="mt-4 w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === PREMIUM_MONTHLY_PLAN_NAME ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                'Subscribe'
              )}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card-hover p-5 flex flex-col border-primary/30 relative"
          >
            <div className="absolute -top-2 right-3">
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                BEST VALUE
              </span>
            </div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
              {PREMIUM_YEARLY_PLAN_NAME}
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">₹{PREMIUM_YEARLY_PRICE_INR}</span>
              <span className="text-sm text-muted-foreground">/year</span>
            </div>
            <p className="text-xs text-primary mt-1">Save ₹{PREMIUM_MONTHLY_PRICE_INR * 12 - PREMIUM_YEARLY_PRICE_INR} per year!</p>
            <button
              onClick={() => handleSubscribe(PREMIUM_YEARLY_PLAN_NAME)}
              disabled={loading === PREMIUM_YEARLY_PLAN_NAME || !razorpayLoaded}
              className="mt-4 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors electric-glow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === PREMIUM_YEARLY_PLAN_NAME ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                'Subscribe'
              )}
            </button>
          </motion.div>
        </div>
      )}

      {/* Premium Features List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          All Premium Features
        </h3>
        <div className="glass-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {premiumFeatures.map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center gap-2"
              >
                <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm text-foreground">{feature}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
