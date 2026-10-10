'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useAd } from '@/contexts/AdContext'
import { adLog, adLogError } from '@/lib/ads/config'

/**
 * useInterstitialAd Hook
 *
 * Provides a safe way to show interstitial ads after successful actions.
 *
 * Usage:
 * ```tsx
 * const { showAdAfterSuccess } = useInterstitialAd()
 *
 * // After successful export/download/share:
 * await performExport()
 * await showAdAfterSuccess()
 * ```
 *
 * Features:
 * - Only shows ads AFTER a successful action (never before)
 * - Enforces a cooldown between interstitials (60 seconds)
 * - Gracefully handles AdMob failures (app continues normally)
 * - In test mode, shows a brief mock overlay
 * - Does not block the user's workflow
 */
export function useInterstitialAd() {
  const { initialized, configured, showInterstitial, prepareInterstitial } = useAd()
  const prepareAttempted = useRef(false)

  // Prepare the interstitial ad in advance when the hook mounts
  // This way the ad is loaded and ready when needed
  useEffect(() => {
    if (!configured || !initialized) return
    if (prepareAttempted.current) return

    prepareAttempted.current = true
    prepareInterstitial().then((prepared) => {
      if (prepared) {
        adLog('Interstitial pre-loaded for this screen')
      }
    }).catch((err) => {
      adLogError('Failed to pre-load interstitial', err)
    })
  }, [configured, initialized, prepareInterstitial])

  /**
   * Show an interstitial ad after a successful action.
   *
   * IMPORTANT: Call this ONLY after the action has succeeded.
   * Never call it before or during the action.
   *
   * The function is non-blocking — if the ad can't be shown
   * (cooldown active, AdMob not ready, etc.), it silently returns false.
   *
   * @returns true if the ad was shown, false otherwise
   */
  const showAdAfterSuccess = useCallback(async (): Promise<boolean> => {
    if (!configured || !initialized) {
      adLog('Interstitial skipped — not configured/initialized')
      return false
    }

    try {
      const shown = await showInterstitial()
      if (shown) {
        adLog('Interstitial shown after successful action')
      } else {
        adLog('Interstitial not shown (cooldown or error)')
      }
      return shown
    } catch (error) {
      adLogError('Interstitial error (non-blocking)', error)
      return false
    }
  }, [configured, initialized, showInterstitial])

  return {
    /**
     * Show an interstitial ad after a successful action.
     * Non-blocking — returns false if ad can't be shown.
     */
    showAdAfterSuccess,
    /** Whether AdMob is initialized and configured */
    ready: initialized && configured,
  }
}
