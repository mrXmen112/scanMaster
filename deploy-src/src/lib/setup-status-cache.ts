/**
 * Global Setup Status Cache
 *
 * Ensures only ONE /api/setup/supabase request is in-flight at any time.
 * Multiple components (Profile, SupabaseSetupWizard) share this cache
 * instead of making independent fetch calls that cause PreconditionFailed errors.
 *
 * Features:
 * - Global dedup: only one in-flight request at a time
 * - TTL-based caching: avoids hammering the API (default: 30s)
 * - Pending backoff: after a pending/503 error, waits 5s before allowing retry
 * - localStorage persistence: cache survives component remounts and navigation
 * - Timeout: requests can't hang forever (default: 12s)
 * - Force refresh: for manual "Check Status" clicks
 * - PreconditionFailed/pending-state detection in BOTH status code AND response body
 */

import { buildApiUrl } from './api-base-url'

export interface SetupStatus {
  configured: boolean
  connection: boolean
  tables: { profiles: boolean; user_files: boolean }
  bucket: boolean
  allGood: boolean
  summary: string
}

const PENDING_MESSAGE = 'Setup is still processing. Please wait a few seconds and try again.'
const CACHE_TTL_MS = 30_000       // Cache results for 30 seconds (increased from 10s)
const REQUEST_TIMEOUT_MS = 12_000  // Timeout for fetch requests
const PENDING_BACKOFF_MS = 5_000   // After a pending error, wait 5s before retrying
const LS_KEY = 'scanmaster_setup_status'
const LS_TS_KEY = 'scanmaster_setup_status_ts'
const LS_PENDING_KEY = 'scanmaster_setup_pending_until'

// ─── Global singletons ────────────────────────────────────────────────────

let cachedStatus: SetupStatus | null = null
let cachedAt = 0
let inFlightPromise: Promise<SetupStatus> | null = null
let pendingUntil = 0  // Timestamp: don't make new requests before this time

// ─── Initialize from localStorage ─────────────────────────────────────────

function initFromLocalStorage() {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(LS_KEY)
    const storedTs = localStorage.getItem(LS_TS_KEY)
    const storedPending = localStorage.getItem(LS_PENDING_KEY)

    if (stored && storedTs) {
      const ts = parseInt(storedTs, 10)
      if (Date.now() - ts < CACHE_TTL_MS) {
        cachedStatus = JSON.parse(stored)
        cachedAt = ts
      }
    }

    if (storedPending) {
      const pendingTs = parseInt(storedPending, 10)
      if (pendingTs > Date.now()) {
        pendingUntil = pendingTs
      }
    }
  } catch {
    // localStorage not available or corrupt — ignore
  }
}

// Run initialization immediately
initFromLocalStorage()

// ─── Helpers ──────────────────────────────────────────────────────────────

function isPendingError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message || ''
    return (
      msg.includes('pending state') ||
      msg.includes('PreconditionFailed') ||
      msg.includes('503') ||
      msg.includes('Service temporarily unavailable') ||
      msg.includes('Setup is still processing')
    )
  }
  return false
}

/**
 * Check if a parsed response body indicates a PreconditionFailed/pending error,
 * regardless of the HTTP status code. The platform may return this error with
 * status 400, 500, or any other code.
 */
function isPendingResponseBody(data: unknown): boolean {
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (
      obj.Code === 'PreconditionFailed' ||
      String(obj.Message || '').includes('pending state') ||
      String(obj.error || '').includes('pending') ||
      String(obj.message || '').includes('pending state')
    ) {
      return true
    }
  }
  return false
}

function isCacheFresh(): boolean {
  return cachedStatus !== null && (Date.now() - cachedAt) < CACHE_TTL_MS
}

function isInPendingBackoff(): boolean {
  return Date.now() < pendingUntil
}

function setPendingBackoff(): void {
  pendingUntil = Date.now() + PENDING_BACKOFF_MS
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_PENDING_KEY, String(pendingUntil))
    }
  } catch {
    // ignore
  }
}

function clearPendingBackoff(): void {
  pendingUntil = 0
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LS_PENDING_KEY)
    }
  } catch {
    // ignore
  }
}

function persistToLocalStorage(status: SetupStatus): void {
  cachedStatus = status
  cachedAt = Date.now()
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify(status))
      localStorage.setItem(LS_TS_KEY, String(cachedAt))
    }
  } catch {
    // ignore
  }
}

function makeOfflineStatus(): SetupStatus {
  return {
    configured: false,
    connection: false,
    tables: { profiles: false, user_files: false },
    bucket: false,
    allGood: false,
    summary: 'Unable to reach setup service. The app works offline.',
  }
}

function makePendingStatus(): SetupStatus {
  return {
    configured: true,
    connection: false,
    tables: { profiles: false, user_files: false },
    bucket: false,
    allGood: false,
    summary: PENDING_MESSAGE,
  }
}

// ─── Core fetch with timeout and dedup ────────────────────────────────────

async function fetchSetupStatusInternal(): Promise<SetupStatus> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(buildApiUrl('/api/setup/supabase'), { signal: controller.signal })

    // Check for 503 status (our API route returns this for pending errors)
    if (res.status === 503) {
      setPendingBackoff()
      if (cachedStatus) return cachedStatus
      return makePendingStatus()
    }

    // Parse response body — the platform may return PreconditionFailed
    // with any status code (not just 503)
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      // Response wasn't JSON
      if (cachedStatus) return cachedStatus
      return makeOfflineStatus()
    }

    // Detect PreconditionFailed in the response body
    if (isPendingResponseBody(data)) {
      setPendingBackoff()
      if (cachedStatus) return cachedStatus
      return makePendingStatus()
    }

    // If the response is not OK but not a pending error, return cached or offline
    if (!res.ok) {
      if (cachedStatus) return cachedStatus
      return makeOfflineStatus()
    }

    // Success! Cache and persist the result
    clearPendingBackoff()
    persistToLocalStorage(data as SetupStatus)
    return data as SetupStatus
  } catch (err) {
    if (isPendingError(err)) {
      setPendingBackoff()
      if (cachedStatus) return cachedStatus
      return makePendingStatus()
    }
    // Network error, timeout, etc. — return cached or offline status
    if (cachedStatus) return cachedStatus
    return makeOfflineStatus()
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Get the current setup status.
 * - Returns cached status immediately if fresh (< TTL)
 * - Respects pending backoff: if we recently got a pending error, returns cached/offline
 * - If a request is already in-flight, waits for that request (dedup)
 * - Otherwise, makes a new request
 *
 * @param forceRefresh - Skip cache and force a new request (for manual "Check Status")
 */
export async function getSetupStatus(forceRefresh = false): Promise<SetupStatus> {
  // 1. Return cache if fresh and not forcing refresh
  if (!forceRefresh && isCacheFresh()) {
    return cachedStatus!
  }

  // 2. If we're in pending backoff, return cached status or pending message
  //    (don't make another request that will likely fail with the same error)
  if (!forceRefresh && isInPendingBackoff()) {
    if (cachedStatus) return cachedStatus
    return makePendingStatus()
  }

  // 3. If a request is already in-flight, piggyback on it (dedup)
  if (inFlightPromise) {
    return inFlightPromise
  }

  // 4. Start a new request
  inFlightPromise = fetchSetupStatusInternal().finally(() => {
    inFlightPromise = null
  })

  return inFlightPromise
}

/**
 * Invalidate the cache — call this after POST /api/setup/supabase (create bucket)
 * so the next GET returns fresh data.
 */
export function invalidateSetupCache(): void {
  cachedAt = 0
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LS_TS_KEY)
    }
  } catch {
    // ignore
  }
}

/**
 * Get the currently cached status without making a request.
 * Returns null if no cache exists.
 */
export function getCachedSetupStatus(): SetupStatus | null {
  // Re-init from localStorage if in-memory cache is empty
  if (!cachedStatus) {
    initFromLocalStorage()
  }
  return cachedStatus
}

/**
 * Check if a setup request is currently in-flight.
 */
export function isSetupRequestInFlight(): boolean {
  return inFlightPromise !== null
}

/**
 * Check if we're currently in a pending backoff period.
 * Useful for UI to show "please wait" state.
 */
export function isInSetupPendingBackoff(): boolean {
  return isInPendingBackoff()
}
