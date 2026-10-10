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
  return !!(window as Record<string, unknown>).Capacitor
}

/**
 * Get the Capacitor AdMob plugin if available.
 * Returns null if not in native mode or plugin not installed.
 */
function getCapacitorAdMob(): {
  initialize?: (opts: { testingDevices: string[]; initializeForTesting: boolean }) => Promise<void>
  prepareBanner?: (opts: { adId: string; adSize: string; position: string }) => Promise<void>
  showBanner?: () => Promise<void>
  hideBanner?: () => Promise<void>
  prepareInterstitial?: (opts: { adId: string }) => Promise<void>
  showInterstitial?: () => Promise<void>
} | null {
  if (typeof window === 'undefined') return null
  const win = window as Record<string, unknown>
  if (!win.Capacitor) return null
  const cap = win.Capacitor as Record<string, unknown>
  if (!cap.Plugins) return null
  const plugins = cap.Plugins as Record<string, unknown>
  if (!plugins.AdMob) return null
  return plugins.AdMob as NonNullable<ReturnType<typeof getCapacitorAdMob>>
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
 * - Minimum interval between interstitial ads: 60 seconds
 * - Only shown AFTER a successful export, download, or share
 * - Never shown before the user action
 */

const INTERSTITIAL_COOLDOWN_MS = 60_000 // 60 seconds
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
 * - PDF export
 * - File download
 * - File share
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
