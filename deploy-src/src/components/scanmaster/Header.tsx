'use client'

import { memo } from 'react'
import { ArrowLeft, Bell, Sun, Moon, ScanLine } from 'lucide-react'
import { useAppStore, ToolView } from '@/store/useAppStore'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useMounted } from '@/hooks/use-mounted'

const viewTitles: Record<ToolView, string> = {
  home: 'Scan Master',
  tools: 'Tools',
  files: 'My Files',
  profile: 'Profile',
  premium: 'Premium Plan',
  'text-to-pdf': 'Text to PDF',
  'image-to-pdf': 'Image to PDF',
  'scan-to-pdf': 'Scan to PDF',
  'pdf-editor': 'PDF Editor',
  'compress-pdf': 'Compress PDF',
  'merge-pdf': 'Merge PDF',
  'split-pdf': 'Split PDF',
  ocr: 'OCR to Text',
  'speech-to-text': 'Speech to Text',
  auth: 'Sign In',
  'zip-export': 'ZIP Export',
}

const mainViews: ToolView[] = ['home', 'tools', 'files', 'profile']

export default memo(function Header() {
  const { activeView, goBack, setActiveView } = useAppStore()
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  const isMainView = mainViews.includes(activeView)
  const title = viewTitles[activeView] || 'Scan Master'

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/40 safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {!isMainView && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              whileTap={{ scale: 0.92 }}
              onClick={goBack}
              className="p-2 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/30 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </motion.button>
          )}
          <div className="flex items-center gap-2.5">
            {activeView === 'home' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-md shadow-primary/20"
              >
                <ScanLine className="h-4.5 w-4.5 text-white" />
              </motion.div>
            )}
            <h1
              className={`text-lg font-bold tracking-tight ${
                activeView === 'home' 
                  ? 'bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent' 
                  : 'text-foreground'
              }`}
            >
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeView === 'home' && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setActiveView('tools')}
              className="p-2 rounded-xl hover:bg-secondary/80 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              aria-label="Search"
            >
              <svg
                className="h-5 w-5 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl hover:bg-secondary/80 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Toggle theme"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="h-5 w-5 text-muted-foreground" />
            ) : mounted && theme === 'light' ? (
              <Moon className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-muted-foreground opacity-0" />
            )}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            className="p-2 rounded-xl hover:bg-secondary/80 transition-all relative min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-background" />
          </motion.button>
        </div>
      </div>
    </header>
  )
})
