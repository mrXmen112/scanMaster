/**
 * API Base URL Helper
 *
 * In the APK (Capacitor native mode), the app is loaded from local static files
 * (the `out/` directory). API routes like /api/pdf/compress don't exist locally —
 * they run on the deployed server.
 *
 * This helper returns the correct base URL for API calls:
 * - In Capacitor native mode → points to the deployed server
 * - In web/development mode → uses relative paths (same-origin)
 *
 * Set NEXT_PUBLIC_API_BASE_URL in .env to your deployed server URL.
 */

/**
 * Get the base URL for API calls.
 * Returns empty string in web mode (relative paths), or the deployed server URL in native mode.
 */
export function getApiBaseUrl(): string {
  // Check if we're in Capacitor native mode
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    
    // Robust detection of Android/Capacitor WebView runtime
    const isNativePlatform = win?.Capacitor?.isNativePlatform?.();
    const isAndroid = win?.Capacitor?.getPlatform?.() === 'android';
    const isCapacitorScheme = window.location.protocol === 'capacitor:';
    
    // In native mode, we MUST use the hosted backend URL (never relative paths)
    if (isNativePlatform || isAndroid || isCapacitorScheme) {
      const serverUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://rtut9pdy.insforge.site';
      if (serverUrl) {
        return serverUrl.replace(/\/$/, ''); // Remove trailing slash
      }
      return 'https://rtut9pdy.insforge.site';
    }
  }
  // In web mode, use relative paths
  return '';
}

/**
 * Build a full API URL from a relative path.
 * e.g., buildApiUrl('/api/pdf/compress') → 'https://myserver.com/api/pdf/compress' (native)
 *                                        → '/api/pdf/compress' (web)
 */
export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl()
  if (!base) return path
  return `${base}${path}`
}
