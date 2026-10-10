'use client'

import { memo } from 'react'
import { Home, Wrench, FolderOpen, Camera, User } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { motion } from 'framer-motion'

const tabs = [
  { id: 'home' as const, icon: Home, label: 'Home' },
  { id: 'tools' as const, icon: Wrench, label: 'Tools' },
  { id: 'files' as const, icon: FolderOpen, label: 'Files' },
  { id: 'profile' as const, icon: User, label: 'Profile' },
]

export default memo(function BottomNav() {
  const { activeTab, setActiveTab, setActiveView } = useAppStore()

  const handleScanClick = () => {
    setActiveView('scan-to-pdf')
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-card rounded-none border-t border-glass-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-2 pt-1 pb-1 relative">
        {tabs.slice(0, 2).map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative min-h-[48px] min-w-[48px]"
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -inset-2 bg-primary/20 rounded-xl"
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                  />
                )}
                <Icon
                  className={`h-5 w-5 relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}

        {/* Central Scan Button */}
        <div className="relative flex items-center justify-center">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleScanClick}
            className="relative -mt-6 w-14 h-14 rounded-full flex items-center justify-center text-white z-10"
            style={{
              background: 'linear-gradient(135deg, #00D4FF 0%, #0A84FF 100%)',
              boxShadow: '0 4px 24px rgba(0, 212, 255, 0.4), 0 0 0 4px var(--background)',
            }}
            aria-label="Quick Scan"
          >
            <Camera className="h-6 w-6" />
          </motion.button>
        </div>

        {tabs.slice(2).map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative min-h-[48px] min-w-[48px]"
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -inset-2 bg-primary/20 rounded-xl"
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                  />
                )}
                <Icon
                  className={`h-5 w-5 relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
})