'use client'

/**
 * Global Error Boundary — catches ALL unhandled errors including:
 * - PreconditionFailed: function is pending state
 * - Server rendering errors
 * - Hydration errors
 * 
 * This MUST be a client component.
 * It renders a friendly UI instead of raw JSON errors.
 */

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw, WifiOff } from 'lucide-react'

function isPreconditionFailed(error: Error): boolean {
  const msg = error.message || ''
  return (
    msg.includes('PreconditionFailed') ||
    msg.includes('pending state') ||
    msg.includes('function is pending')
  )
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  const isServerDown = isPreconditionFailed(error)

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: '#1a1a2e',
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: isServerDown ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            {isServerDown ? (
              <WifiOff style={{ width: 32, height: 32, color: '#eab308' }} />
            ) : (
              <AlertTriangle style={{ width: 32, height: 32, color: '#ef4444' }} />
            )}
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
            {isServerDown ? 'Server is Warming Up' : 'Something Went Wrong'}
          </h1>

          <p
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.6)',
              maxWidth: 400,
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {isServerDown
              ? 'The app server is starting up. Your scanner and PDF tools work offline — please try again in a few seconds.'
              : 'An unexpected error occurred. Please try reloading the app.'}
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={reset}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw style={{ width: 16, height: 16 }} />
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                borderRadius: 12,
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
