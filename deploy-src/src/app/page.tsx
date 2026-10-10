'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { AuthProvider } from '@/contexts/AuthContext'
import { AdProvider } from '@/contexts/AdContext'

// ─── CRITICAL FIX: Load ScanMasterApp with ssr: false ───
// This prevents the page from needing a serverless function to render.
// The HTML shell loads instantly (static), then JavaScript hydrates on the client.
// This eliminates the "PreconditionFailed: function is pending state" error
// because no server-side rendering is required.
const ScanMasterApp = dynamic(
  () => import('@/components/scanmaster/ScanMasterApp'),
  {
    ssr: false,
    loading: () => <AppLoadingShell />,
  }
)

function AppLoadingShell() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#1a1a2e] text-white">
      <div className="flex flex-col items-center gap-4">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
          <svg
            className="h-8 w-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">
          <span className="text-primary">ScanMaster</span> AI
        </h1>
        {/* Loading dots */}
        <div className="flex gap-1.5 mt-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  useEffect(() => {
    console.log('[ScanMaster] Page Home component mounted')
  }, [])

  return (
    <AuthProvider>
      <AdProvider>
        <ScanMasterApp />
      </AdProvider>
    </AuthProvider>
  )
}
