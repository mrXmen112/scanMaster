/**
 * Auth redirect URLs.
 *
 * On Android the app runs from a Capacitor WebView, so a confirmation link
 * pointed at a normal https:// page would drop the user into a browser with
 * no way back into the app. Instead we register a custom scheme that
 * AndroidManifest.xml already declares:
 *
 *     <data android:scheme="scanmaster" android:host="auth-callback" />
 *
 * Supabase redirects there with ?code=..., the deep-link handler in
 * AuthProvider picks that up and calls exchangeCodeForSession().
 *
 * This value MUST also be allow-listed in Supabase under
 * Authentication -> URL Configuration -> Redirect URLs, otherwise GoTrue
 * silently refuses the redirect.
 */

export const NATIVE_AUTH_REDIRECT = 'scanmaster://auth-callback'

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false
  const capacitor = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor
  return typeof capacitor?.isNativePlatform === 'function'
    ? capacitor.isNativePlatform()
    : false
}

/** The redirect to send to Supabase for whichever platform we are on. */
export function resolveAuthRedirect(): string {
  if (isNativePlatform()) return NATIVE_AUTH_REDIRECT
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }
  return NATIVE_AUTH_REDIRECT
}