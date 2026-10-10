'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/useAppStore'
import type { ToolView } from '@/store/useAppStore'
import { useServiceWorker } from '@/hooks/use-service-worker'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { useAuth } from '@/contexts/AuthContext'
// Eager imports — needed immediately on initial render
import BottomNav from './BottomNav'
import Header from './Header'
import Dashboard from './Dashboard'
import ErrorBoundary from './ErrorBoundary'
import BannerAd from '@/components/ads/BannerAd'
import InterstitialAdOverlay from '@/components/ads/InterstitialAdOverlay'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, ScanLine } from 'lucide-react'

// Simple loading skeleton for lazy-loaded views
function ViewLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-6 w-6 text-primary animate-spin" />
    </div>
  )
}

// Lazy-loaded tool components — reduces initial bundle size
const ToolsPage = dynamic(() => import('./ToolsPage'), { ssr: false, loading: () => <ViewLoader /> })
const FileManager = dynamic(() => import('./FileManager'), { ssr: false, loading: () => <ViewLoader /> })
const AiAssistant = dynamic(() => import('./AiAssistant'), { ssr: false, loading: () => <ViewLoader /> })
const Profile = dynamic(() => import('./Profile'), { ssr: false, loading: () => <ViewLoader /> })
const PremiumPlan = dynamic(() => import('./PremiumPlan'), { ssr: false, loading: () => <ViewLoader /> })
const AuthPage = dynamic(() => import('./AuthPage'), { ssr: false, loading: () => <ViewLoader /> })
const TextToPdf = dynamic(() => import('./TextToPdf'), { ssr: false, loading: () => <ViewLoader /> })
const ImageToPdf = dynamic(() => import('./ImageToPdf'), { ssr: false, loading: () => <ViewLoader /> })
const CompressPdf = dynamic(() => import('./CompressPdf'), { ssr: false, loading: () => <ViewLoader /> })
const MergePdf = dynamic(() => import('./MergePdf'), { ssr: false, loading: () => <ViewLoader /> })
const SplitPdf = dynamic(() => import('./SplitPdf'), { ssr: false, loading: () => <ViewLoader /> })
const Translate = dynamic(() => import('./Translate'), { ssr: false, loading: () => <ViewLoader /> })
const OcrTool = dynamic(() => import('./OcrTool'), { ssr: false, loading: () => <ViewLoader /> })
const SpeechToText = dynamic(() => import('./SpeechToText'), { ssr: false, loading: () => <ViewLoader /> })
const PdfEditor = dynamic(() => import('./PdfEditor'), { ssr: false, loading: () => <ViewLoader /> })
const ZipExport = dynamic(() => import('./ZipExport'), { ssr: false, loading: () => <ViewLoader /> })
const ScanToPdf = dynamic(() => import('./ScanToPdf'), { ssr: false, loading: () => <ViewLoader /> })
const SplashScreen = dynamic(() => import('./SplashScreen'), { ssr: false })

export default function ScanMasterApp() {
  const { activeView, setActiveView } = useAppStore()
  const { user, loading: authLoading, configured } = useAuth()
  const [showSplash, setShowSplash] = useState(true)

  // Register PWA service worker — completely non-blocking, errors are silently caught
  useServiceWorker()

  // Global error handler — catches unhandled promise rejections
  useErrorHandler()

  // Handle deep links from PWA shortcuts (e.g., ?view=scan-to-pdf)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const viewParam = params.get('view')
      if (viewParam) {
        const validViews: ToolView[] = [
          'home', 'scan-to-pdf', 'image-to-pdf', 'text-to-pdf', 'pdf-editor',
          'compress-pdf', 'merge-pdf', 'split-pdf', 'translate', 'ocr',
          'speech-to-text', 'zip-export', 'tools', 'files', 'ai', 'profile', 'premium', 'auth',
        ]
        if (validViews.includes(viewParam as ToolView)) {
          setActiveView(viewParam as ToolView)
        }
        // Clean up the URL
        window.history.replaceState({}, '', '/')
      }
    } catch {
      // Deep link parsing failed — ignore, app still works
    }
  }, [setActiveView])

  // Redirect away from auth view if user is already logged in.
  // Uses a session-stable ref keyed to the user ID — only redirects once per
  // user session, even if auth state changes (token refresh, etc.).
  // The ref is NOT reset when navigating away from auth, which prevents
  // re-triggering the redirect loop on every auth state change.
  const lastRedirectedUserId = useRef<string | null>(null)
  useEffect(() => {
    // Only act when on auth view, user is logged in, and auth is not loading
    if (activeView === 'auth' && user && !authLoading) {
      // Only redirect once per user (prevents re-trigger on token refresh)
      if (lastRedirectedUserId.current !== user.id) {
        lastRedirectedUserId.current = user.id
        setActiveView('home')
      }
    }
    // Reset the redirect guard when user signs out (user becomes null)
    if (!user) {
      lastRedirectedUserId.current = null
    }
  }, [activeView, user, authLoading, setActiveView])

  // Show splash screen on initial app load
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  // Auth loading state — show a brief loading screen while checking session
  if (authLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#06102A' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #0B1B3F 0%, #06102A 100%)',
              boxShadow: '0 8px 32px rgba(10, 132, 255, 0.25)',
            }}
          >
            <ScanLine className="h-7 w-7 text-white" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#0A84FF' }} />
        </div>
      </div>
    )
  }

  // If user is on auth page and not logged in, show auth page (no shell, no ads)
  if (activeView === 'auth') {
    return (
      <ErrorBoundary>
        <AuthPage />
      </ErrorBoundary>
    )
  }

  const renderView = () => {
    switch (activeView) {
      case 'home':
        return <Dashboard />
      case 'tools':
        return <ToolsPage />
      case 'files':
        return <FileManager />
      case 'ai':
        return <AiAssistant />
      case 'profile':
        return <Profile />
      case 'premium':
        return <PremiumPlan />
      case 'text-to-pdf':
        return <TextToPdf />
      case 'image-to-pdf':
        return <ImageToPdf />
      case 'scan-to-pdf':
        return <ScanToPdf />
      case 'pdf-editor':
        return <PdfEditor />
      case 'compress-pdf':
        return <CompressPdf />
      case 'merge-pdf':
        return <MergePdf />
      case 'split-pdf':
        return <SplitPdf />
      case 'translate':
        return <Translate />
      case 'ocr':
        return <OcrTool />
      case 'speech-to-text':
        return <SpeechToText />
      case 'zip-export':
        return <ZipExport />
      default:
        return <Dashboard />
    }
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-mesh" style={{ backgroundColor: '#06102A' }}>
        <Header />
        <main className="flex-1 overflow-y-auto pb-28">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorBoundary>
                {renderView()}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
        {/* Banner Ad — only shown on home, tools, files, profile screens */}
        <BannerAd />
        <BottomNav />
        {/* Interstitial Ad Overlay — for web mock mode only */}
        <InterstitialAdOverlay />
      </div>
    </ErrorBoundary>
  )
}
