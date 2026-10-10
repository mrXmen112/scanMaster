'use client'

import { useEffect } from 'react'

/**
 * Register the service worker for PWA support.
 * Only runs on the client after mount.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })
        console.log('[SW] Service Worker registered:', registration.scope)
      } catch (error) {
        console.error('[SW] Service Worker registration failed:', error)
      }
    }

    // Delay registration slightly to not block initial render
    const timer = setTimeout(registerSW, 1000)
    return () => clearTimeout(timer)
  }, [])
}
