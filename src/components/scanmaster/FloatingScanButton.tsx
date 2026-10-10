'use client'

import { memo } from 'react'
import { Camera } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { motion } from 'framer-motion'

export default memo(function FloatingScanButton() {
  const { setActiveView } = useAppStore()

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      whileTap={{ scale: 0.88 }}
      onClick={() => setActiveView('scan-to-pdf')}
      aria-label="Quick Scan"
      className="fixed left-1/2 -translate-x-1/2 z-[110] w-14 h-14 rounded-full bg-gradient-to-br from-[#00f0ff] to-primary flex items-center justify-center text-white shadow-[0_4px_24px_rgba(0,240,255,0.5)] cursor-pointer ring-4 ring-background"
      style={{ bottom: 'calc(42px + env(safe-area-inset-bottom, 0px))' }}
    >
      <Camera className="h-6 w-6 text-[#070d1e]" />
    </motion.button>
  )
})
