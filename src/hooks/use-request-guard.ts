'use client'

import { useRef, useCallback, useState } from 'react'

/**
 * useRequestGuard — Prevents duplicate concurrent API calls, adds debounce cooldown,
 * and provides a safe async wrapper with loading state.
 *
 * Usage:
 *   const { run, loading } = useRequestGuard(async () => { ... }, { cooldownMs: 1000 })
 *   // Call run() from event handlers or effects — it's safe to call repeatedly
 */

interface RequestGuardOptions {
  /** Minimum ms between consecutive calls (default: 300) */
  cooldownMs?: number
  /** If true, silently skip when a call is already in progress instead of waiting (default: true) */
  skipIfBusy?: boolean
}

interface RequestGuardReturn<T> {
  /** Run the guarded async function. Returns the result or undefined if skipped. */
  run: (...args: unknown[]) => Promise<T | undefined>
  /** Whether a request is currently in progress */
  loading: boolean
  /** Reset the loading and cooldown state */
  reset: () => void
}

export function useRequestGuard<T>(
  fn: () => Promise<T>,
  options: RequestGuardOptions = {}
): RequestGuardReturn<T> {
  const { cooldownMs = 300, skipIfBusy = true } = options
  const [loading, setLoading] = useState(false)
  const inFlightRef = useRef(false)
  const lastCallRef = useRef(0)

  const run = useCallback(async (): Promise<T | undefined> => {
    // Guard: skip if a call is already in progress
    if (inFlightRef.current) {
      if (skipIfBusy) return undefined
      // Wait for the current call to finish, then proceed
      // (Simple spin — shouldn't happen often)
      while (inFlightRef.current) {
        await new Promise((r) => setTimeout(r, 50))
      }
    }

    // Guard: enforce cooldown between calls
    const now = Date.now()
    const elapsed = now - lastCallRef.current
    if (elapsed < cooldownMs) {
      // Skip if within cooldown window
      return undefined
    }

    inFlightRef.current = true
    setLoading(true)
    lastCallRef.current = Date.now()

    try {
      return await fn()
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [fn, cooldownMs, skipIfBusy])

  const reset = useCallback(() => {
    inFlightRef.current = false
    setLoading(false)
    lastCallRef.current = 0
  }, [])

  return { run, loading, reset }
}

/**
 * isPendingStateError — Client-side check for PreconditionFailed / pending state / 503 errors
 */
export function isPendingStateError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message || ''
    return (
      msg.includes('pending state') ||
      msg.includes('PreconditionFailed') ||
      msg.includes('Service temporarily unavailable') ||
      msg.includes('Setup is still processing') ||
      msg.includes('503')
    )
  }
  return false
}

/**
 * getPendingErrorMessage — Returns a user-friendly message for pending-state errors
 */
export function getPendingErrorMessage(err: unknown): string {
  if (isPendingStateError(err)) {
    return 'Setup is still processing, please try again in a few seconds.'
  }
  return 'Something went wrong. Please try again.'
}
