'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useAd } from '@/contexts/AdContext'
import { adLog, adLogError } from '@/lib/ads/config'

/**
 * useRewardedAd Hook
 *
 * Provides a safe way to show rewarded ads.
 *
 * Usage:
 * ```tsx
 * const { showRewardedAd, ready } = useRewardedAd()
 *
 * // When user hits a daily limit:
 * const earned = await showRewardedAd()
 * if (earned) {
 *   // Grant temporary access (e.g., +1 OCR usage, remove watermark once)
 * }
 * ```
 *
 * Features:
 * - Pre-loads the rewarded ad when the hook mounts
 * - Returns true only if the user completed the full ad
 * - Gracefully handles failures (app continues normally)
 * - In test mode, shows a brief mock overlay
 */
export function useRewardedAd() {
  const { initialized, configured, showRewarded, prepareRewarded, rewardedShowing } = useAd()
  const prepareAttempted = useRef(false)

  // Pre-load the rewarded ad when hook mounts
  useEffect(() => {
    if (!configured || !initialized) return
    if (prepareAttempted.current) return

    prepareAttempted.current = true
    prepareRewarded().then((prepared) => {
      if (prepared) {
        adLog('Rewarded ad pre-loaded for this screen')
      }
    }).catch((err) => {
      adLogError('Failed to pre-load rewarded ad', err)
    })
  }, [configured, initialized, prepareRewarded])

  /**
   * Show a rewarded ad.
   *
   * Returns true if the user watched the complete ad and earned the reward.
   * Returns false if the ad failed, was dismissed early, or couldn't be shown.
   *
   * @returns true if reward earned, false otherwise
   */
  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    if (!configured || !initialized) {
      adLog('Rewarded ad skipped — not configured/initialized')
      return false
    }

    try {
      const earned = await showRewarded()
      if (earned) {
        adLog('User earned reward from ad')
      } else {
        adLog('Rewarded ad not completed')
      }
      return earned
    } catch (error) {
      adLogError('Rewarded ad error (non-blocking)', error)
      return false
    }
  }, [configured, initialized, showRewarded])

  return {
    /**
     * Show a rewarded ad and return true if the reward was earned.
     * Non-blocking — returns false if ad can't be shown.
     */
    showRewardedAd,
    /** Whether AdMob is initialized and configured */
    ready: initialized && configured,
    /** Whether a rewarded ad is currently being shown */
    showing: rewardedShowing,
  }
}
