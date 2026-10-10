'use client'

import { useState, useEffect } from 'react'

/**
 * Hook that tracks real browser online/offline status.
 * Uses a lazy initializer to read navigator.onLine on mount (client-side only).
 * Updates reactively when the browser fires online/offline events.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => {
    // SSR-safe: navigator is undefined on the server
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  })

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
