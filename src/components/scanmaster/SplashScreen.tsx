'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SplashScreenProps {
  onComplete: () => void
}

const NAVY_BG = '#06102A'

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [stage, setStage] = useState(0)
  const onCompleteRef = useRef(onComplete)
  const timersRef = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  useEffect(() => {
    const timers: NodeJS.Timeout[] = []
    timersRef.current = timers

    timers.push(setTimeout(() => setStage(1), 100))
    timers.push(setTimeout(() => setStage(2), 500))
    timers.push(setTimeout(() => setStage(3), 1000))
    timers.push(setTimeout(() => setStage(4), 1600))

    timers.push(setTimeout(() => {
      setIsVisible(false)
    }, 2100))

    timers.push(setTimeout(() => {
      onCompleteRef.current()
    }, 2500))

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  const handleSkip = useCallback(() => {
    clearAllTimers()
    setIsVisible(false)
    setTimeout(() => onCompleteRef.current(), 300)
  }, [clearAllTimers])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
          style={{ backgroundColor: NAVY_BG }}
          onClick={handleSkip}
        >
          {/* Subtle background glow */}
          <div className="absolute inset-0">
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl"
              style={{ backgroundColor: 'rgba(10, 132, 255, 0.08)' }}
            />
            <div
              className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl"
              style={{ backgroundColor: 'rgba(0, 212, 255, 0.04)' }}
            />
          </div>

          {/* Main content */}
          <div className="relative flex flex-col items-center">
            {/* Scan ring animation */}
            <div className="relative flex items-center justify-center">
              {/* Outer scan ring */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={stage >= 2 ? { scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-36 h-36 rounded-full border-2"
                style={{ borderColor: 'rgba(0, 212, 255, 0.3)' }}
              />

              {/* Second ring */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={stage >= 2 ? { scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                className="absolute w-32 h-32 rounded-full border"
                style={{ borderColor: 'rgba(10, 132, 255, 0.2)' }}
              />

              {/* Logo container */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={stage >= 1 ? { scale: 1, opacity: 1 } : {}}
                transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                className="relative"
              >
                {/* Logo background glow */}
                <div
                  className="absolute inset-0 rounded-3xl blur-xl"
                  style={{ backgroundColor: 'rgba(10, 132, 255, 0.3)' }}
                />

                {/* Logo card */}
                <div
                  className="relative w-24 h-24 rounded-3xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #0B1B3F 0%, #06102A 100%)',
                    boxShadow: '0 8px 32px rgba(10, 132, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Scan corners */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 96 96">
                    {/* Top-left */}
                    <path d="M12 28 L12 16 Q12 12 16 12 L28 12" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" />
                    {/* Top-right */}
                    <path d="M84 28 L84 16 Q84 12 80 12 L68 12" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" />
                    {/* Bottom-left */}
                    <path d="M12 68 L12 80 Q12 84 16 84 L28 84" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" />
                    {/* Bottom-right */}
                    <path d="M84 68 L84 80 Q84 84 80 84 L68 84" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>

                  {/* Document icon */}
                  <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                    <path d="M10 6 L24 6 L30 12 L30 34 L10 34 Z" fill="white" />
                    <path d="M24 6 L24 12 L30 12 Z" fill="#C8D0E0" />
                    <path d="M14 18 L26 18" stroke="#B0BEC5" strokeWidth="2" strokeLinecap="round" />
                    <path d="M14 22 L26 22" stroke="#B0BEC5" strokeWidth="2" strokeLinecap="round" />
                    <path d="M14 26 L22 26" stroke="#B0BEC5" strokeWidth="2" strokeLinecap="round" />
                    {/* S-ribbon */}
                    <path d="M12 30 Q17 27 20 30 Q23 33 28 30" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </svg>

                  {/* Inner highlight */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 to-transparent" />
                </div>
              </motion.div>
            </div>

            {/* Scan sweep line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={stage >= 3 ? { opacity: [0, 1, 0], y: [-4, 4, -4] } : {}}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-1/2 -translate-x-1/2 w-20 h-0.5 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, #00D4FF, transparent)',
                top: '50%',
              }}
            />

            {/* Wordmark */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={stage >= 4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mt-8 text-center"
            >
              <h1
                className="text-3xl font-bold tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #00D4FF 50%, #0A84FF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                ScanMaster
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={stage >= 4 ? { opacity: 1 } : {}}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-xs mt-2 tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Scan · Edit · Convert · Create
              </motion.p>
            </motion.div>
          </div>

          {/* Loading indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={stage >= 4 ? { opacity: 1 } : {}}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="absolute bottom-24 flex flex-col items-center gap-3"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#0A84FF' }}
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}