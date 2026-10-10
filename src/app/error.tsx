'use client'

/**
 * Error page — catches route-level errors and shows a friendly UI.
 * Prevents raw JSON errors like "PreconditionFailed" from showing to users.
 */

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw, WifiOff } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ErrorPage]', error)
  }, [error])

  const msg = error.message || ''
  const isServerDown =
    msg.includes('PreconditionFailed') ||
    msg.includes('pending state') ||
    msg.includes('function is pending') ||
    msg.includes('Failed to fetch')

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-yellow-500/20">
        {isServerDown ? (
          <WifiOff className="h-8 w-8 text-yellow-500" />
        ) : (
          <AlertTriangle className="h-8 w-8 text-destructive" />
        )}
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">
        {isServerDown ? 'Server is Warming Up' : 'Something Went Wrong'}
      </h1>

      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        {isServerDown
          ? 'The app server is starting up. Your scanner and PDF tools work offline — please try again in a few seconds.'
          : 'An unexpected error occurred. Your data is safe — please try reloading.'}
      </p>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Reload App
        </button>
      </div>
    </div>
  )
}
