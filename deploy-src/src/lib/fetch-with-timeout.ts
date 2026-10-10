/**
 * Fetch with timeout — wraps fetch() with an AbortController timeout.
 * Returns the Response or throws on timeout/network error.
 * Never throws raw JSON — always throws an Error with a clean message.
 *
 * Features:
 * - Configurable timeout (default: 5s)
 * - Auto-retry on 503 / pending-state errors (1 retry with 2s delay)
 * - Clean error messages (never exposes raw platform JSON to users)
 * - Automatic API base URL resolution for Capacitor native mode
 */

import { buildApiUrl } from './api-base-url'

const PENDING_FRIENDLY_MESSAGE = 'Setup is still processing, please try again in a few seconds.'
const TIMEOUT_FRIENDLY_MESSAGE = 'Request timed out. Please try again.'

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in ms (default: 5000) */
  timeoutMs?: number
  /** Number of retries on 503/pending errors (default: 1) */
  retryOn503?: number
  /** Delay before retry in ms (default: 2000) */
  retryDelayMs?: number
}

async function fetchOnce(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Resolve API URLs for Capacitor native mode
  const resolvedUrl = url.startsWith('/api/') ? buildApiUrl(url) : url

  // Check if native platform but backend URL is missing (resolved URL is still relative)
  if (typeof window !== 'undefined' && resolvedUrl.startsWith('/api/')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (win?.Capacitor?.isNativePlatform?.() || win?.Capacitor?.getPlatform?.() === 'android') {
      clearTimeout(timeoutId)
      throw new Error('Backend URL missing')
    }
  }

  try {
    const response = await fetch(resolvedUrl, {
      ...options,
      signal: controller.signal,
    })

    return response
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(TIMEOUT_FRIENDLY_MESSAGE)
    }
    // Convert fetch / network failures to standard user-friendly CORS or unreachable errors
    const errMsg = (err as Error).message || ''
    if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || err instanceof TypeError) {
      throw new Error('CORS/preflight failed or Server unreachable (Network request failed)')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Extract a clean error message from a failed response.
 * Never exposes raw platform JSON.
 */
function extractErrorMessage(response: Response, data: unknown): string {
  let errorMsg = `Request failed (${response.status})`

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    errorMsg = (obj.error as string) || (obj.message as string) || (obj.Message as string) || errorMsg

    const lowercaseMsg = errorMsg.toLowerCase()
    if (
      lowercaseMsg.includes('api key missing') ||
      lowercaseMsg.includes('secret key')
    ) {
      return 'AI API key missing on backend'
    }
    if (
      lowercaseMsg.includes('quota') ||
      lowercaseMsg.includes('limit') ||
      lowercaseMsg.includes('rate limit') ||
      response.status === 429
    ) {
      return 'Quota exceeded'
    }

    // Detect "function is pending state" errors specifically
    if (
      obj.Code === 'PreconditionFailed' ||
      String(obj.Message || '').includes('pending state') ||
      errorMsg.includes('PreconditionFailed')
    ) {
      return PENDING_FRIENDLY_MESSAGE
    }
  }

  if (response.status === 404) {
    return 'Server returned 404'
  }

  if (response.status === 500) {
    return 'Server returned 500'
  }

  // 503 = service unavailable (including pending state from our own API)
  if (response.status === 503) {
    return PENDING_FRIENDLY_MESSAGE
  }

  return errorMsg
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
  timeoutMs?: number
): Promise<Response> {
  const {
    timeoutMs: optTimeout = 30000,
    retryOn503 = 1,
    retryDelayMs = 2000,
    ...fetchOptions
  } = options

  const effectiveTimeout = timeoutMs || optTimeout
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retryOn503; attempt++) {
    try {
      const response = await fetchOnce(url, fetchOptions, effectiveTimeout)

      // If the response is not OK, extract clean error
      if (!response.ok) {
        let data: unknown = null
        try {
          data = await response.json()
        } catch {
          // Response wasn't JSON — use status text
        }

        const errorMsg = extractErrorMessage(response, data)

        // If it's a retryable response status and we have retries left, retry
        const isRetryableStatus = response.status === 503 || response.status === 429
        if (isRetryableStatus && attempt < retryOn503) {
          lastError = new Error(errorMsg)
          await new Promise((r) => setTimeout(r, retryDelayMs))
          continue
        }

        throw new Error(errorMsg)
      }

      return response
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''

      // If we have retries left, retry on temporary network failure, timeout, or 503/pending/quota
      const isRetryable =
        msg.includes('pending state') ||
        msg.includes('PreconditionFailed') ||
        msg.includes('503') ||
        msg.includes('Network request failed') ||
        msg.includes(TIMEOUT_FRIENDLY_MESSAGE) ||
        msg.includes('429') ||
        msg.includes('Quota exceeded')

      if (isRetryable && attempt < retryOn503) {
        lastError = err instanceof Error ? err : new Error(msg)
        await new Promise((r) => setTimeout(r, retryDelayMs))
        continue
      }

      throw err
    }
  }

  throw lastError || new Error('Request failed after retries')
}

/**
 * Check if an error is a "service unavailable" type error
 * (PreconditionFailed, pending state, timeout, network error)
 */
export function isServiceUnavailableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message || ''
    return (
      msg.includes('unavailable') ||
      msg.includes('pending state') ||
      msg.includes('PreconditionFailed') ||
      msg.includes('Setup is still processing') ||
      msg.includes('timed out') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError')
    )
  }
  return false
}
