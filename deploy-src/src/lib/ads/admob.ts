/**
 * AdMob Platform Adapter
 *
 * Provides a unified API for AdMob that works in both:
 * 1. Web/PWA mode — renders mock/placeholder ads (for development)
 * 2. Capacitor native mode — uses the Capacitor AdMob plugin for real ads
 *
 * IMPORTANT: Do NOT import '@capacitor-community/admob' directly in this file.
 * That package is only available inside a native Capacitor app shell and will
 * cause "Module not found" errors in web/PWA mode.
 *
 * Instead, we access the plugin through window.Capacitor.Plugins.AdMob, which
 * is auto-registered when the app is wrapped with Capacitor and the plugin is
 * installed in the native project. See getCapacitorAdMob() below.
 *
 * In web mode, the app shows styled placeholder banners instead of real ads.
 * This is by design — AdMob mobile SDK requires a native app container.
 */

import {
  getAdMobConfig,
  getEffectiveBannerId,
  getEffectiveInterstitialId,
  getEffectiveRewardedId,
  adLog,
  adLogError,
} from './config'

// ─── Platform Detection ──────────────────────────────────────────────────────

/**
 * Detect if running inside a Capacitor native shell.
 * When wrapped with Capacitor, window.Capacitor is available.
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).Capacitor
}

/**
 * Get the Capacitor AdMob plugin if available.
 * Returns null if not in native mode or plugin not installed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCapacitorAdMob(): any | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any
  if (!win.Capacitor) return null
  const cap = win.Capacitor
  if (!cap.Plugins) return null
  const plugins = cap.Plugins
  if (!plugins.AdMob) return null
  return plugins.AdMob
}

// ─── Initialization State ────────────────────────────────────────────────────

let initialized = false
let initializing = false

export function isAdMobInitialized(): boolean {
  return initialized
}

/**
 * Initialize AdMob SDK.
 *
 * - In native (Capacitor) mode: calls AdMob.initialize()
 * - In web mode: marks as initialized (mock mode)
 *
 * Safe to call multiple times — will only initialize once.
 */
export async function initializeAdMob(): Promise<boolean> {
  const config = getAdMobConfig()

  if (!config.configured) {
    adLog('AdMob not configured — skipping initialization')
    return false
  }

  if (initialized) {
    adLog('AdMob already initialized — skipping')
    return true
  }

  if (initializing) {
    adLog('AdMob already initializing — waiting')
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (initialized) {
          clearInterval(check)
          resolve(true)
        }
      }, 100)
      setTimeout(() => {
        clearInterval(check)
        resolve(false)
      }, 10000)
    })
  }

  initializing = true

  try {
    const adMob = getCapacitorAdMob()
    if (adMob?.initialize) {
      // ─── Capacitor Native Mode ──────────────────────────────────────────
      adLog('Initializing AdMob (native/Capacitor mode)')
      await adMob.initialize({
        testingDevices: [],
        initializeForTesting: config.testMode,
      })
      adLog('AdMob initialized (native)', { appId: config.appId, testMode: config.testMode })
    } else {
      // ─── Web/PWA Mode ───────────────────────────────────────────────────
      adLog('Initializing AdMob (web/mock mode)', {
        appId: config.appId,
        testMode: config.testMode,
        bannerId: getEffectiveBannerId(),
        interstitialId: getEffectiveInterstitialId(),
        rewardedId: getEffectiveRewardedId(),
      })
    }

    initialized = true
    return true
  } catch (error) {
    adLogError('AdMob initialization failed', error)
    return false
  } finally {
    initializing = false
  }
}

// ─── Banner Ad ───────────────────────────────────────────────────────────────

let bannerLoaded = false

export function isBannerLoaded(): boolean {
  return bannerLoaded
}

export function setBannerLoaded(loaded: boolean): void {
  bannerLoaded = loaded
}

/**
 * Show a banner ad (native mode only).
 * In web mode, the BannerAd component handles this.
 */
export async function showBannerAd(): Promise<void> {
  if (!initialized) {
    adLog('Cannot show banner — AdMob not initialized')
    return
  }

  const adMob = getCapacitorAdMob()
  if (adMob?.prepareBanner && adMob?.showBanner) {
    try {
      const bannerId = getEffectiveBannerId()
      await adMob.prepareBanner({
        adId: bannerId,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
      })
      await adMob.showBanner()
      bannerLoaded = true
      adLog('Banner ad shown (native)', { bannerId })
    } catch (error) {
      adLogError('Failed to show banner ad (native)', error)
    }
  }
  // Web mode: BannerAd component handles rendering
}

/**
 * Hide the banner ad (native mode only).
 */
export async function hideBannerAd(): Promise<void> {
  const adMob = getCapacitorAdMob()
  if (adMob?.hideBanner && initialized) {
    try {
      await adMob.hideBanner()
      bannerLoaded = false
      adLog('Banner ad hidden (native)')
    } catch (error) {
      adLogError('Failed to hide banner ad (native)', error)
    }
  }
}

// ─── Interstitial Ad ─────────────────────────────────────────────────────────

/**
 * Interstitial ad management with cooldown.
 *
 * Cooldown logic:
 * - Minimum interval between interstitial ads: 150 seconds (2.5 minutes)
 * - Only shown AFTER a successful export, download, or share
 * - Never shown before the user action
 */

const INTERSTITIAL_COOLDOWN_MS = 150_000 // 2.5 minutes
let lastInterstitialShownAt = 0
let interstitialPrepared = false

/**
 * Check if enough time has passed since the last interstitial.
 */
export function canShowInterstitial(): boolean {
  if (!initialized) return false
  const now = Date.now()
  return now - lastInterstitialShownAt >= INTERSTITIAL_COOLDOWN_MS
}

/**
 * Get remaining cooldown time in seconds.
 */
export function getInterstitialCooldownRemaining(): number {
  const elapsed = Date.now() - lastInterstitialShownAt
  const remaining = Math.max(0, INTERSTITIAL_COOLDOWN_MS - elapsed)
  return Math.ceil(remaining / 1000)
}

/**
 * Prepare an interstitial ad for later showing.
 * Call this early (e.g., when entering a tool screen) so the ad is ready.
 */
export async function prepareInterstitialAd(): Promise<boolean> {
  if (!initialized) {
    adLog('Cannot prepare interstitial — AdMob not initialized')
    return false
  }

  const adMob = getCapacitorAdMob()
  if (adMob?.prepareInterstitial) {
    try {
      const interstitialId = getEffectiveInterstitialId()
      await adMob.prepareInterstitial({ adId: interstitialId })
      interstitialPrepared = true
      adLog('Interstitial ad prepared (native)', { interstitialId })
      return true
    } catch (error) {
      adLogError('Failed to prepare interstitial ad (native)', error)
      return false
    }
  }

  // Web mode: interstitial is simulated by the useInterstitialAd hook
  interstitialPrepared = true
  adLog('Interstitial ad prepared (web/mock mode)')
  return true
}

/**
 * Show an interstitial ad after a successful action.
 * Returns true if the ad was shown, false otherwise.
 *
 * IMPORTANT: This should ONLY be called AFTER a successful:
 * - PDF creation
 * - PDF compress
 * - File export / download / share
 * Never call it before the user action completes.
 */
export async function showInterstitialAd(): Promise<boolean> {
  if (!initialized) {
    adLog('Cannot show interstitial — AdMob not initialized')
    return false
  }

  // Enforce cooldown
  if (!canShowInterstitial()) {
    const remaining = getInterstitialCooldownRemaining()
    adLog('Interstitial cooldown active', { remainingSeconds: remaining })
    return false
  }

  const adMob = getCapacitorAdMob()
  if (adMob?.showInterstitial) {
    try {
      if (!interstitialPrepared) {
        adLog('Interstitial not prepared — preparing now')
        await prepareInterstitialAd()
      }
      await adMob.showInterstitial()
      lastInterstitialShownAt = Date.now()
      interstitialPrepared = false
      adLog('Interstitial ad shown (native)')
      return true
    } catch (error) {
      adLogError('Failed to show interstitial ad (native)', error)
      return false
    }
  }

  // Web mode: simulate showing interstitial
  lastInterstitialShownAt = Date.now()
  interstitialPrepared = false
  adLog('Interstitial ad shown (web/mock mode)')
  return true
}

// ─── Rewarded Ad ─────────────────────────────────────────────────────────────

/**
 * Rewarded ad management.
 *
 * Rewarded ads give users a temporary premium unlock in exchange
 * for watching a full video ad. Use cases:
 * - Unlock one extra OCR usage beyond free daily limit
 * - Compress a large PDF without watermark
 * - Export without watermark
 */

let rewardedPrepared = false

/**
 * Prepare a rewarded ad for later showing.
 * Call when the user approaches a limit or views the premium gate.
 */
export async function prepareRewardedAd(): Promise<boolean> {
  if (!initialized) {
    adLog('Cannot prepare rewarded ad — AdMob not initialized')
    return false
  }

  const adMob = getCapacitorAdMob()
  if (adMob?.prepareRewardVideoAd) {
    try {
      const rewardedId = getEffectiveRewardedId()
      await adMob.prepareRewardVideoAd({ adId: rewardedId })
      rewardedPrepared = true
      adLog('Rewarded ad prepared (native)', { rewardedId })
      return true
    } catch (error) {
      adLogError('Failed to prepare rewarded ad (native)', error)
      return false
    }
  }

  // Web mode mock
  rewardedPrepared = true
  adLog('Rewarded ad prepared (web/mock mode)')
  return true
}

/**
 * Show a rewarded ad.
 * Returns true if the user completed the ad and earned the reward.
 */
export async function showRewardedAd(): Promise<boolean> {
  if (!initialized) {
    adLog('Cannot show rewarded ad — AdMob not initialized')
    return false
  }

  const adMob = getCapacitorAdMob()
  if (adMob?.showRewardVideoAd) {
    try {
      if (!rewardedPrepared) {
        adLog('Rewarded ad not prepared — preparing now')
        const ok = await prepareRewardedAd()
        if (!ok) return false
      }
      const result = await adMob.showRewardVideoAd()
      rewardedPrepared = false
      // Capacitor AdMob returns reward info; if we got here it was completed
      adLog('Rewarded ad completed (native)', result)
      return true
    } catch (error) {
      adLogError('Rewarded ad failed or was dismissed (native)', error)
      rewardedPrepared = false
      return false
    }
  }

  // Web mode: simulate rewarded ad (auto-complete after brief mock)
  rewardedPrepared = false
  adLog('Rewarded ad completed (web/mock mode)')
  return true
}
