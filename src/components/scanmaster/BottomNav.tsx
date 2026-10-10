'use client'

import { memo } from 'react'
import { Home, Wrench, FolderOpen, Camera, User } from 'lucide-react'
import { motion } from 'framer-motion'

import { useAppStore } from '@/store/useAppStore'

const tabs = [
  { id: 'home' as const, icon: Home, label: 'Home' },
  { id: 'tools' as const, icon: Wrench, label: 'Tools' },
  { id: 'files' as const, icon: FolderOpen, label: 'Files' },
  { id: 'profile' as const, icon: User, label: 'Profile' },
]

export default memo(function BottomNav() {
  const { activeTab, setActiveTab, setActiveView } = useAppStore()

  const renderTab = (tab: (typeof tabs)[number]) => {
    const isActive = activeTab === tab.id
    const Icon = tab.icon
    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        aria-label={tab.label}
        aria-current={isActive ? 'page' : undefined}
        className="flex min-h-[52px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5"
      >
        <div className="relative">
          {isActive && (
            <motion.span
              layoutId="navActive"
              className="absolute -inset-2 rounded-xl bg-accent"
              transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
            />
          )}
          <Icon
            className={`relative z-10 h-[22px] w-[22px] transition-colors duration-200 ${
              isActive ? 'text-primary' : 'text-nav-inactive'
            }`}
            strokeWidth={isActive ? 2.2 : 1.9}
            aria-hidden
          />
        </div>
        <span
          className={`text-[11px] font-medium leading-none transition-colors duration-200 ${
            isActive ? 'text-primary' : 'text-nav-inactive'
          }`}
        >
          {tab.label}
        </span>
      </button>
    )
  }

  return (
    <nav
      aria-label="Primary"
      // Fully opaque, theme-aware surface. The previous translucent glass let
      // scrolled tool titles/descriptions show through the dock.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-dock-border bg-dock"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-5 items-center px-1.5 pt-1 pb-1.5">
        {renderTab(tabs[0])}
        {renderTab(tabs[1])}

        {/* Central Scan action */}
        <div className="flex items-start justify-center">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveView('scan-to-pdf')}
            aria-label="Quick Scan"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, #0A84FF 0%, #00BDEB 100%)',
              // Restrained cyan accent ring instead of a large glow halo.
              boxShadow: '0 4px 14px rgba(10,132,255,0.35), 0 0 0 4px var(--dock-bg)',
            }}
          >
            <Camera className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
          </motion.button>
        </div>

        {renderTab(tabs[2])}
        {renderTab(tabs[3])}
      </div>
    </nav>
  )
})
