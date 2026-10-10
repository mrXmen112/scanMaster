'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import {
  initializeAdMob,
  isAdMobInitialized,
  prepareInterstitialAd,
  showInterstitialAd,
  canShowInterstitial,
  isNativePlatform,
} from '@/lib/ads/admob'
import { getAdMobConfig, adLog, adLogError } from '@/lib/ads/config'

// ─── Context Shape ───────────────────────────────────────────────────────────

interface AdContextValue {
  /** Whether AdMob has been initialized */
  initialized: boolean
  /** Whether AdMob is configured (has required env vars) */
  configured: boolean
  /** Whether we're in test mode */
  testMode: boolean
  /** Whether an interstitial ad is currently showing */
  interstitialShowing: boolean
  /**
   * Show an interstitial ad after a successful action.
   * Respects cooldown — returns false if cooldown is active.
   * Should ONLY be called AFTER a successful export/download/share.
   */
  showInterstitial: () => Promise<boolean>
  /**
   * Prepare an interstitial ad for later display.
   * Call this when entering a tool screen so the ad loads in advance.
   */
  prepareInterstitial: () => Promise<boolean>
}

const AdContext = createContext<AdContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function AdProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false)
  const [interstitialShowing, setInterstitialShowing] = useState(false)
  const initAttempted = useRef(false)

  const config = getAdMobConfig()

  // Initialize AdMob once on mount
  useEffect(() => {
    if (initAttempted.current) return
    initAttempted.current = true

    if (!config.configured) {
      adLog('AdMob not configured — provider will be inactive')
      return
    }

    let cancelled = false

    initializeAdMob().then((success) => {
      if (!cancelled) {
        setInitialized(success)
        if (success) {
          adLog('AdProvider: AdMob initialized successfully')
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const handleShowInterstitial = useCallback(async (): Promise<boolean> => {
    if (!isAdMobInitialized()) {
      adLog('Cannot show interstitial — not initialized')
      return false
    }

    if (!canShowInterstitial()) {
      adLog('Interstitial blocked by cooldown')
      return false
    }

    // In web/mock mode, just log and return true
    if (!isNativePlatform()) {
      setInterstitialShowing(true)
      adLog('Interstitial shown (web mock) — will auto-dismiss')

      const shown = await showInterstitialAd()
      if (shown) {
        // Auto-dismiss the mock interstitial after a short delay
        setTimeout(() => {
          setInterstitialShowing(false)
          adLog('Interstitial dismissed (web mock)')
        }, 1500)
      } else {
        setInterstitialShowing(false)
      }
      return shown
    }

    // Native mode
    setInterstitialShowing(true)
    try {
      const shown = await showInterstitialAd()
      return shown
    } catch (error) {
      adLogError('Interstitial display error', error)
      return false
    } finally {
      // Interstitial has its own dismiss flow in native mode
      setTimeout(() => setInterstitialShowing(false), 2000)
    }
  }, [])

  const handlePrepareInterstitial = useCallback(async (): Promise<boolean> => {
    if (!isAdMobInitialized()) return false
    return prepareInterstitialAd()
  }, [])

  const value: AdContextValue = {
    initialized,
    configured: config.configured,
    testMode: config.testMode,
    interstitialShowing,
    showInterstitial: handleShowInterstitial,
    prepareInterstitial: handlePrepareInterstitial,
  }

  return <AdContext.Provider value={value}>{children}</AdContext.Provider>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAd(): AdContextValue {
  const context = useContext(AdContext)
  if (!context) {
    // Return a safe fallback if used outside provider
    return {
      initialized: false,
      configured: false,
      testMode: true,
      interstitialShowing: false,
      showInterstitial: async () => false,
      prepareInterstitial: async () => false,
    }
  }
  return context
}
