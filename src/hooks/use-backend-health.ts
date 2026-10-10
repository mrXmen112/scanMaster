'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { buildApiUrl } from '@/lib/api-base-url'

export type BackendStatus = 'checking' | 'reachable' | 'unreachable'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
const PERIODIC_CHECK_MS = 30000

interface HealthCheckResult {
  ok: boolean
  status: number
  durationMs: number
  error?: string
}

function logAnalytics(result: HealthCheckResult) {
  const win = typeof window !== 'undefined' ? window : undefined
  console.log('[AIMonitor] health-check', JSON.stringify({
    ts: new Date().toISOString(),
    ok: result.ok,
    status: result.status,
    durationMs: result.durationMs,
    error: result.error || null,
    platform: (win as any)?.Capacitor?.getPlatform?.() || 'web',
    url: buildApiUrl('/api/health/connectivity'),
  }))
}

export function useBackendHealth() {
  const [status, setStatus] = useState<BackendStatus>('checking')
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const mountedRef = useRef(true)
  const periodicRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = useCallback(async () => {
    if (!mountedRef.current) return
    setStatus('checking')

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const start = Date.now()
      try {
        const url = buildApiUrl('/api/health/connectivity')
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(url, { method: 'GET', signal: controller.signal, mode: 'cors' })
        clearTimeout(timeout)

        const duration = Date.now() - start
        console.log('[BackendHealth] attempt', attempt, '/', MAX_RETRIES, 'status:', res.status, 'duration:', duration, 'ms')

        logAnalytics({ ok: res.ok, status: res.status, durationMs: duration })

        if (res.ok) {
          if (mountedRef.current) {
            setStatus('reachable')
            setConsecutiveFailures(0)
            setLastChecked(Date.now())
          }
          return
        }

        console.warn('[BackendHealth] non-OK status:', res.status, 'attempt:', attempt)
      } catch (err) {
        const duration = Date.now() - start
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[BackendHealth] attempt', attempt, '/', MAX_RETRIES, 'failed:', errMsg, 'duration:', duration, 'ms')

        logAnalytics({ ok: false, status: 0, durationMs: duration, error: errMsg })
      }

      if (attempt < MAX_RETRIES && mountedRef.current) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      }
    }

    if (mountedRef.current) {
      setStatus('unreachable')
      setConsecutiveFailures((prev) => prev + 1)
      setLastChecked(Date.now())
    }
  }, [])

  // Initial check + periodic recheck when unreachable
  useEffect(() => {
    mountedRef.current = true
    check()

    periodicRef.current = setInterval(() => {
      if (mountedRef.current) {
        check()
      }
    }, PERIODIC_CHECK_MS)

    return () => {
      mountedRef.current = false
      if (periodicRef.current) clearInterval(periodicRef.current)
    }
  }, [check])

  return { status, lastChecked, consecutiveFailures, recheck: check }
}
