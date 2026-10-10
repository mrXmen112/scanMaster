'use client'

import { useEffect, useState } from 'react'
import { useAd } from '@/contexts/AdContext'
import { isAdAllowedView, adLog, adLogError } from '@/lib/ads/config'
import { isNativePlatform, showBannerAd, hideBannerAd, setBannerLoaded } from '@/lib/ads/admob'
import { useAppStore } from '@/store/useAppStore'

/**
 * BannerAd Component
 *
 * Renders a bottom banner ad on allowed screens.
 * - In web/PWA mode: shows a styled placeholder banner
 * - In native (Capacitor) mode: triggers the native AdMob banner
 *
 * The banner sits ABOVE the BottomNav, never covering navigation or buttons.
 * If the ad fails to load, the component renders nothing (graceful degradation).
 *
 * Ads are shown only on: home, tools, files, profile
 * Ads are NOT shown on: auth, splash, camera, pdf-editor, upload, export screens
 */
export default function BannerAd() {
  const { initialized, configured, testMode } = useAd()
  const activeView = useAppStore((s) => s.activeView)

  const shouldShow = configured && initialized && isAdAllowedView(activeView)

  // Track native banner show/hide side effects
  useEffect(() => {
    if (shouldShow) {
      if (isNativePlatform()) {
        showBannerAd().catch((err) => {
          adLogError('Native banner failed to show', err)
        })
      } else {
        adLog('Banner ad visible (web mock)', { view: activeView })
        setBannerLoaded(true)
      }
    } else {
      setBannerLoaded(false)

      if (isNativePlatform()) {
        hideBannerAd().catch(() => {})
      }
    }
  }, [shouldShow, activeView])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isNativePlatform()) {
        hideBannerAd().catch(() => {})
      }
      setBannerLoaded(false)
    }
  }, [])

  if (!shouldShow) return null
  if (isNativePlatform()) return null // Native SDK handles rendering

  return <WebMockBanner testMode={testMode} />
}

// ─── Web Mock Banner ─────────────────────────────────────────────────────────

function WebMockBanner({ testMode }: { testMode: boolean }) {
  const [loaded, setLoaded] = useState(false)

  // Simulate ad loading delay (async callback is fine for setState)
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true)
      adLog('Banner loaded (web mock)')
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  if (!loaded) {
    return (
      <div className="fixed bottom-16 left-0 right-0 z-40 w-full flex items-center justify-center py-2 px-4 bg-muted/30 border-t border-border/30">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-muted-foreground/20 animate-pulse" />
          <span className="text-[10px] text-muted-foreground/50">Loading ad...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-40 w-full flex items-center justify-center py-2.5 px-4 bg-muted/20 border-t border-border/20"
      role="complementary"
      aria-label="Advertisement"
    >
      <div className="flex items-center gap-2 w-full max-w-[320px]">
        {/* Ad icon placeholder */}
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <svg
            className="h-4 w-4 text-primary/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
        </div>
        {/* Ad content placeholder */}
        <div className="flex-1 min-w-0">
          <div className="h-2.5 w-3/4 rounded bg-muted-foreground/10 mb-1.5" />
          <div className="h-2 w-1/2 rounded bg-muted-foreground/5" />
        </div>
        {/* Ad badge */}
        <span className="text-[8px] text-muted-foreground/40 border border-muted-foreground/10 rounded px-1 py-0.5 flex-shrink-0 uppercase tracking-wider">
          {testMode ? 'Test Ad' : 'Ad'}
        </span>
      </div>
    </div>
  )
}
