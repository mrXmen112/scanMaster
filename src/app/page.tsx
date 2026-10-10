'use client'

import dynamic from 'next/dynamic'
import { AuthProvider } from '@/contexts/AuthContext'
import { AdProvider } from '@/contexts/AdContext'

// â”€â”€â”€ CRITICAL FIX: Load ScanMasterApp with ssr: false â”€â”€â”€
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
    <div className="h-screen flex flex-col items-center justify-center text-white" style={{ backgroundColor: '#0B1B3F' }}>
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #0B1B3F 0%, #06102A 100%)',
            boxShadow: '0 8px 32px rgba(10, 132, 255, 0.25)',
          }}
        >
          <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
            <path d="M10 6 L24 6 L30 12 L30 34 L10 34 Z" fill="white" />
            <path d="M24 6 L24 12 L30 12 Z" fill="#C8D0E0" />
            <path d="M14 18 L26 18" stroke="#B0BEC5" strokeWidth="2" strokeLinecap="round" />
            <path d="M14 22 L26 22" stroke="#B0BEC5" strokeWidth="2" strokeLinecap="round" />
            <path d="M14 26 L22 26" stroke="#B0BEC5" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 30 Q17 27 20 30 Q23 33 28 30" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          <span
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #00D4FF 50%, #0A84FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ScanMaster
          </span>
        </h1>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: '#0A84FF', animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <AuthProvider>
      <AdProvider>
        <ScanMasterApp />
      </AdProvider>
    </AuthProvider>
  )
}
