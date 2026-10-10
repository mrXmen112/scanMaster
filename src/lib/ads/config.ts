/**
 * AdMob Configuration Module
 *
 * Reads all AdMob IDs from environment variables.
 * Determines test mode based on NEXT_PUBLIC_ADMOB_TEST_MODE or NODE_ENV.
 * Provides Google test ad unit IDs for development/testing.
 *
 * IMPORTANT: No IDs are hardcoded inside components — everything comes from env vars.
 */

// ─── Environment Variable Readers ────────────────────────────────────────────

function getEnvVar(key: string, fallback: string = ''): string {
  if (typeof window === 'undefined') return fallback
  // Next.js inlines NEXT_PUBLIC_ vars at build time via process.env
  return process.env[key] || fallback
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface AdMobConfig {
  /** AdMob App ID (ca-app-pub-XXXX~YYYY) */
  appId: string
  /** Banner Ad Unit ID (ca-app-pub-XXXX/YYYY) */
  bannerId: string
  /** Interstitial Ad Unit ID (ca-app-pub-XXXX/YYYY) */
  interstitialId: string
  /** Whether to use test/demo ads instead of live production ads */
  testMode: boolean
  /** Whether AdMob is configured (has required IDs) */
  configured: boolean
}

/**
 * Build the AdMob config from environment variables.
 * This is computed once and cached at module level.
 */
export function getAdMobConfig(): AdMobConfig {
  const appId = getEnvVar('NEXT_PUBLIC_ADMOB_APP_ID')
  const bannerId = getEnvVar('NEXT_PUBLIC_ADMOB_BANNER_ID')
  const interstitialId = getEnvVar('NEXT_PUBLIC_ADMOB_INTERSTITIAL_ID')
  const testModeEnv = getEnvVar('NEXT_PUBLIC_ADMOB_TEST_MODE', 'false')

  const testMode =
    testModeEnv === 'true' ||
    (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production')

  const configured = !!(appId && bannerId && interstitialId)

  return { appId, bannerId, interstitialId, testMode, configured }
}

// ─── Google Test Ad Unit IDs ─────────────────────────────────────────────────
// https://developers.google.com/admob/android/test-ads
// https://developers.google.com/admob/ios/test-ads

export const GOOGLE_TEST_AD_IDS = {
  /** Android test banner ad unit ID */
  androidBanner: 'ca-app-pub-3940256099942544/6300978111',
  /** Android test interstitial ad unit ID */
  androidInterstitial: 'ca-app-pub-3940256099942544/1033173712',
  /** iOS test banner ad unit ID */
  iosBanner: 'ca-app-pub-3940256099942544/2934735716',
  /** iOS test interstitial ad unit ID */
  iosInterstitial: 'ca-app-pub-3940256099942544/4411468910',
} as const

/**
 * Get the effective ad unit ID to use.
 * In test mode, returns Google's official test IDs.
 * In production mode, returns the real IDs from env vars.
 */
export function getEffectiveBannerId(): string {
  const config = getAdMobConfig()
  if (config.testMode) return GOOGLE_TEST_AD_IDS.androidBanner
  return config.bannerId
}

export function getEffectiveInterstitialId(): string {
  const config = getAdMobConfig()
  if (config.testMode) return GOOGLE_TEST_AD_IDS.androidInterstitial
  return config.interstitialId
}

// ─── Views that are allowed to show banner ads ───────────────────────────────

export type AdAllowedView = 'home' | 'tools' | 'files' | 'profile'

/** Views where banner ads are permitted */
export const AD_ALLOWED_VIEWS: AdAllowedView[] = ['home', 'tools', 'files', 'profile']

/**
 * Check if a view is allowed to show banner ads.
 * Ads are NOT shown on: auth, splash, camera scanner, PDF editor,
 * file upload, export/download processing screens.
 */
export function isAdAllowedView(view: string): boolean {
  return AD_ALLOWED_VIEWS.includes(view as AdAllowedView)
}

// ─── Debug Logger ────────────────────────────────────────────────────────────

/**
 * Development-only debug logger for AdMob events.
 * Only logs when NODE_ENV is not production.
 */
export function adLog(message: string, ...args: unknown[]) {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return
  console.log(`%c[AdMob] ${message}`, 'color: #f59e0b; font-weight: bold', ...args)
}

/**
 * Development-only error logger for AdMob events.
 */
export function adLogError(message: string, ...args: unknown[]) {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return
  console.error(`%c[AdMob] ${message}`, 'color: #ef4444; font-weight: bold', ...args)
}
