'use client'

import { useEffect } from 'react'

/**
 * Global error handler hook.
 * Catches unhandled promise rejections and prevents them from crashing the app.
 * Common Supabase/PreconditionFailed errors are silently caught since the app
 * works offline and these are transient server-side issues.
 */
export function useErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const msg = reason?.message || String(reason || '')

      // Silently handle known non-critical errors
      const isNonCritical =
        msg.includes('pending state') ||
        msg.includes('PreconditionFailed') ||
        msg.includes('503') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Network request failed') ||
        msg.includes('AbortError')

      if (isNonCritical) {
        // Prevent the unhandled rejection from showing in console as an error
        event.preventDefault()
        console.info('[ErrorHandler] Non-critical promise rejection handled:', msg)
        return
      }

      // For other errors, log them but don't crash the app
      console.error('[ErrorHandler] Unhandled rejection:', reason)
      event.preventDefault()
    }

    const handleError = (event: ErrorEvent) => {
      const msg = event.message || ''

      // Ignore chunk load errors (happen during deploys)
      if (msg.includes('Loading chunk') || msg.includes('Loading CSS chunk')) {
        event.preventDefault()
        console.warn('[ErrorHandler] Chunk load error (likely deploy), will resolve on reload')
        return
      }

      // Ignore ResizeObserver loop errors (non-critical browser behavior)
      if (msg.includes('ResizeObserver loop')) {
        event.preventDefault()
        return
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])
}
