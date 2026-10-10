'use client'

import { memo } from 'react'
import { Home, Wrench, FolderOpen, User } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { motion } from 'framer-motion'

const tabs = [
  { id: 'home' as const, icon: Home, label: 'Home' },
  { id: 'tools' as const, icon: Wrench, label: 'Tools' },
  { id: 'files' as const, icon: FolderOpen, label: 'Files' },
  { id: 'profile' as const, icon: User, label: 'Profile' },
]

export default memo(function BottomNav() {
  const { activeTab, setActiveTab, bannerAdActive } = useAppStore()

  return (
    <nav
      className={`fixed left-0 right-0 z-[100] bg-background border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.45)] transition-all duration-200 ${
        bannerAdActive ? 'rounded-t-2xl border-l border-r border-b' : 'rounded-none border-b-0 border-l-0 border-r-0'
      }`}
      style={{
        bottom: bannerAdActive ? '50px' : '0px',
        paddingBottom: bannerAdActive ? '10px' : 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        paddingTop: '10px',
        transition: 'bottom 0.2s ease-in-out, padding 0.2s ease-in-out',
      }}
    >
      <div className="flex items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center justify-center gap-1.5 py-1 px-3 rounded-xl transition-all relative min-h-[48px] min-w-[56px] flex-1"
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative flex items-center justify-center">
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -inset-x-4 -inset-y-2 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl electric-glow-sm border border-primary/20"
                    transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                  />
                )}
                <Icon
                  className={`h-5 w-5 relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-semibold tracking-wide relative z-10 transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
})
