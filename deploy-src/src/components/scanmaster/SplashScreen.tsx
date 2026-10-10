'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SplashScreenProps {
  onComplete: () => void
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true)

  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    console.log('[ScanMaster] Splash screen started')
    const timer = setTimeout(() => {
      console.log('[ScanMaster] Splash animation complete — fading out')
      setIsVisible(false)
      setTimeout(() => {
        console.log('[ScanMaster] Splash fade complete — calling onComplete')
        onCompleteRef.current()
      }, 400)
    }, 2200) // 2.2 seconds display + 0.4s fade = 2.6 seconds total

    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070d1e]"
          style={{
            background: 'radial-gradient(circle at center, #0f1c3f 0%, #060b18 100%)',
          }}
        >
          {/* Subtle grid background pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:24px_24px]" />

          {/* Logo container */}
          <div className="relative flex flex-col items-center">
            {/* Custom Premium CSS Squircle App Icon */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.7,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="relative w-28 h-28 rounded-[28px] p-[3px] bg-gradient-to-b from-white/20 to-transparent shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
            >
              <div className="w-full h-full rounded-[25px] bg-[#12224d] flex flex-col items-center justify-center relative overflow-hidden">
                {/* Embedded Glass Glow Effect */}
                <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
                
                {/* Document Icon Drawing */}
                <div className="w-11 h-14 bg-gradient-to-b from-white/90 to-white/70 rounded-md relative shadow-sm flex flex-col justify-end p-2 gap-1.5 overflow-hidden">
                  {/* Folded paper corner */}
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-gradient-to-bl from-transparent to-black/20 rounded-bl-sm after:content-[''] after:absolute after:inset-0 after:bg-slate-300/80 after:rounded-bl-sm" />
                  
                  {/* Miniature document text lines */}
                  <div className="w-full h-1 bg-primary/30 rounded-full" />
                  <div className="w-4/5 h-1 bg-primary/20 rounded-full" />
                  <div className="w-full h-1 bg-primary/20 rounded-full" />
                </div>

                {/* Bright Neon Cyan Scanner Sweep Line */}
                <motion.div
                  className="absolute left-0 right-0 h-[3px] bg-[#00f0ff] z-10"
                  style={{
                    boxShadow: '0 0 12px #00f0ff, 0 0 4px rgba(0, 240, 255, 0.6)',
                  }}
                  initial={{ top: '15%' }}
                  animate={{ top: ['15%', '85%', '15%'] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </div>
            </motion.div>

            {/* App name */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5, ease: 'easeOut' }}
              className="mt-7 text-center"
            >
              <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans drop-shadow-sm">
                Scan Master
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="text-xs text-white/50 mt-1.5 font-medium tracking-[0.2em] uppercase"
              >
                Scan. Edit. Share.
              </motion.p>
            </motion.div>
          </div>

          {/* horizontal horizontal three dots loading style of native Android */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.3 }}
            className="absolute bottom-16 flex gap-2"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-white/40"
                animate={{
                  scale: [1, 1.4, 1],
                  backgroundColor: ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']
                }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.2
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
