'use client'

import { Check, Crown, X, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

const premiumFeatures = [
  'Unlimited PDF editing',
  'No watermark',
  'High-quality compression',
  'Unlimited OCR',
  'Unlimited translation',
  'Unlimited speech to text',
  'AI PDF summary',
  'Cloud backup',
  'Batch export',
  'ZIP export',
  'Password protection',
]

const freeFeatures = [
  { name: 'PDF editing', free: '3/day', premium: 'Unlimited' },
  { name: 'OCR', free: '2/day', premium: 'Unlimited' },
  { name: 'Translation', free: '2/day', premium: 'Unlimited' },
  { name: 'Speech to Text', free: '1/day', premium: 'Unlimited' },
  { name: 'Compression', free: 'Basic', premium: 'High Quality' },
  { name: 'Watermark', free: 'Yes', premium: 'No' },
  { name: 'AI Summary', free: 'No', premium: 'Yes' },
  { name: 'Cloud Backup', free: 'No', premium: 'Yes' },
  { name: 'Password Protection', free: 'No', premium: 'Yes' },
  { name: 'Batch Export', free: 'No', premium: 'Yes' },
]

export default function PremiumPlan() {
  const { goBack } = useAppStore()

  const handleSubscribe = (plan: string) => {
    toast.success(`${plan} subscription activated! (Demo)`)
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
        <h2 className="text-2xl font-bold gradient-text">Go Premium</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Unlock the full power of ScanMaster
        </p>
      </motion.div>

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
              className={`contents ${
                i % 2 === 0 ? '' : ''
              }`}
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

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Monthly */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card-hover p-5 flex flex-col"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Monthly
          </p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground">₹99</span>
            <span className="text-sm text-muted-foreground">/month</span>
          </div>
          <button
            onClick={() => handleSubscribe('Monthly')}
            className="mt-4 w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors"
          >
            Subscribe
          </button>
        </motion.div>

        {/* Yearly */}
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
            Yearly
          </p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground">₹799</span>
            <span className="text-sm text-muted-foreground">/year</span>
          </div>
          <p className="text-xs text-primary mt-1">Save ₹389 per year!</p>
          <button
            onClick={() => handleSubscribe('Yearly')}
            className="mt-4 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors electric-glow-sm"
          >
            Subscribe
          </button>
        </motion.div>
      </div>

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
