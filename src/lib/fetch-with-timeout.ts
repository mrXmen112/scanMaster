/**
 * Fetch with timeout — wraps fetch() with an AbortController timeout.
 * Returns the Response or throws on timeout/network error.
 * Never throws raw JSON — always throws an Error with a clean message.
 *
 * Features:
 * - Configurable timeout (default: 5s)
 * - Auto-retry on 503 / pending-state errors (1 retry with 2s delay)
 * - Clean error messages (never exposes raw platform JSON to users)
 */

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
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    return response
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(TIMEOUT_FRIENDLY_MESSAGE)
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

    // Detect "function is pending state" errors specifically
    if (
      obj.Code === 'PreconditionFailed' ||
      String(obj.Message || '').includes('pending state') ||
      errorMsg.includes('PreconditionFailed')
    ) {
      return PENDING_FRIENDLY_MESSAGE
    }
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
    timeoutMs: optTimeout = 5000,
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

        // If it's a 503/pending error and we have retries left, retry
        if (response.status === 503 && attempt < retryOn503) {
          lastError = new Error(errorMsg)
          await new Promise((r) => setTimeout(r, retryDelayMs))
          continue
        }

        throw new Error(errorMsg)
      }

      return response
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''

      // If it's a pending/503 error and we have retries left, retry
      if (
        (msg.includes('pending state') || msg.includes('PreconditionFailed') || msg.includes('503')) &&
        attempt < retryOn503
      ) {
        lastError = err instanceof Error ? err : new Error(msg)
        await new Promise((r) => setTimeout(r, retryDelayMs))
        continue
      }

      // For network/timeout errors, don't retry
      if (
        msg.includes('timed out') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError')
      ) {
        throw err
      }

      lastError = err instanceof Error ? err : new Error(msg)

      // For other errors, only retry if we haven't exhausted retries
      if (attempt < retryOn503) {
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
