'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Crop, FileType, Sparkles } from 'lucide-react'

interface SplashScreenProps {
  onComplete: () => void
}

/** Brand background, matches the native splash drawable. */
const SPLASH_BG = '#0B1B3F'

/** Total sequence length. The user asked for ~2.2s before handing off. */
const TOTAL_MS = 2200

const TOOL_CHIPS = [
  { icon: FileText, label: 'Documents' },
  { icon: Crop, label: 'Crop' },
  { icon: FileType, label: 'PDF' },
  { icon: Sparkles, label: 'AI Tools' },
]

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [stage, setStage] = useState(0)
  const onCompleteRef = useRef(onComplete)
  const timersRef = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const timers: NodeJS.Timeout[] = []
    timersRef.current = timers

    // Icon settles and the glow ring starts pulsing.
    timers.push(setTimeout(() => setStage(1), 120))
    // Wordmark begins to appear.
    timers.push(setTimeout(() => setStage(2), 1150))
    // Tagline, tool chips and the progress bar.
    timers.push(setTimeout(() => setStage(3), 1500))

    // Fade out, then hand control to the app once the fade has finished.
    timers.push(setTimeout(() => setIsVisible(false), TOTAL_MS - 380))
    timers.push(setTimeout(() => onCompleteRef.current(), TOTAL_MS))

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.38, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
          style={{ backgroundColor: SPLASH_BG }}
        >
          {/* Ambient brand glow */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 320,
              height: 320,
              background:
                'radial-gradient(circle, rgba(29,78,216,0.45) 0%, rgba(11,27,63,0) 70%)',
            }}
          />

          {/* Mark + glow ring */}
          <div className="relative flex h-40 w-40 items-center justify-center">
            {/* Pulsing cyan ring, matching the reference animation */}
            <motion.span
              className="absolute inset-0 rounded-[2rem] border-2"
              style={{ borderColor: '#22D3EE' }}
              initial={{ scale: 1, opacity: 0.25 }}
              animate={stage >= 1
                ? { scale: [1, 1.16, 1], opacity: [0.25, 0.7, 0.25] }
                : {}}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.span
              className="absolute inset-0 rounded-[2rem] border"
              style={{ borderColor: '#3B82F6' }}
              initial={{ scale: 1, opacity: 0.15 }}
              animate={stage >= 1
                ? { scale: [1.12, 1, 1.12], opacity: [0.15, 0.45, 0.15] }
                : {}}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.35 }}
            />

            {/* Icon scale-in */}
            <motion.div
              initial={{ scale: 0.55, opacity: 0 }}
              animate={stage >= 1 ? { scale: 1, opacity: 1 } : {}}
              transition={{ type: 'spring', stiffness: 180, damping: 16 }}
              className="relative h-28 w-28 overflow-hidden rounded-[1.75rem] shadow-[0_12px_40px_rgba(29,78,216,0.55)]"
            >
              {/* Plain <img>: next/image's optimizer is unavailable in the
                  static export this app ships to Capacitor. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/splash-icon.png"
                alt="ScanMaster"
                className="h-full w-full object-cover"
              />
            </motion.div>
          </div>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={stage >= 2 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="mt-8 text-center"
          >
            <h1 className="text-[32px] font-bold leading-none tracking-tight text-white">
              ScanMaster
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={stage >= 3 ? { opacity: 1 } : {}}
              transition={{ delay: 0.12, duration: 0.35 }}
              className="mt-2 text-[12px] font-medium tracking-wide text-white/55"
            >
              Scan • Edit • Convert • Create
            </motion.p>
          </motion.div>

          {/* Feature chips */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={stage >= 3 ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mt-7 flex items-center gap-3"
          >
            {TOOL_CHIPS.map((chip) => {
              const Icon = chip.icon
              return (
                <div
                  key={chip.label}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5"
                  title={chip.label}
                >
                  <Icon className="h-5 w-5 text-white/80" strokeWidth={1.8} aria-hidden />
                </div>
              )
            })}
          </motion.div>

          {/* Loading dots (stage 1-2) then progress bar (stage 3) */}
          <div className="mt-9 flex h-6 w-40 items-center justify-center">
            <AnimatePresence mode="wait">
              {stage < 3 ? (
                <motion.div
                  key="dots"
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-white/70"
                      animate={{ opacity: [0.25, 1, 0.25], scale: [1, 1.3, 1] }}
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        delay: i * 0.18,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="bar"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-[3px] w-full overflow-hidden rounded-full bg-white/15"
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #3B82F6 0%, #22D3EE 100%)',
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 0.62, ease: 'easeInOut' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
