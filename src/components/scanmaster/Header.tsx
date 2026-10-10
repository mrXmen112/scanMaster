'use client'

import { memo } from 'react'
import { ArrowLeft, Bell, Sun, Moon, ScanLine } from 'lucide-react'
import { useAppStore, ToolView } from '@/store/useAppStore'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useMounted } from '@/hooks/use-mounted'

const viewTitles: Record<ToolView, string> = {
  home: 'ScanMaster',
  tools: 'Tools',
  files: 'My Files',
  ai: 'AI Assistant',
  profile: 'Profile',
  premium: 'Premium Plan',
  'text-to-pdf': 'Text to PDF',
  'image-to-pdf': 'Image to PDF',
  'scan-to-pdf': 'Scan to PDF',
  'pdf-editor': 'PDF Editor',
  'compress-pdf': 'Compress PDF',
  'merge-pdf': 'Merge PDF',
  'split-pdf': 'Split PDF',
  translate: 'Translate',
  ocr: 'OCR to Text',
  'speech-to-text': 'Speech to Text',
  'zip-export': 'ZIP Export',
}

const mainViews: ToolView[] = ['home', 'tools', 'files', 'ai', 'profile']

export default memo(function Header() {
  const { activeView, goBack } = useAppStore()
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  const isMainView = mainViews.includes(activeView)
  const title = viewTitles[activeView] || 'ScanMaster'

  return (
    <header className="sticky top-0 z-40 glass-card rounded-none border-b border-glass-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {!isMainView && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={goBack}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </motion.button>
          )}
          <div className="flex items-center gap-2">
            {activeView === 'home' && (
              <motion.div
                initial={{ rotate: -10, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
              >
                <ScanLine className="h-6 w-6 text-primary electric-glow-sm rounded-lg" />
              </motion.div>
            )}
            <h1
              className={`text-lg font-bold ${
                activeView === 'home' ? 'gradient-text' : 'text-foreground'
              }`}
            >
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="h-5 w-5 text-muted-foreground" />
            ) : mounted && theme === 'light' ? (
              <Moon className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-muted-foreground opacity-0" />
            )}
          </button>
          <button
            className="p-2 rounded-xl hover:bg-white/5 transition-colors relative min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </button>
        </div>
      </div>
    </header>
  )
})
