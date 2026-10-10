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
import FloatingScanButton from './FloatingScanButton'
import Header from './Header'
import Dashboard from './Dashboard'
import ErrorBoundary from './ErrorBoundary'
import BannerAd from '@/components/ads/BannerAd'
import InterstitialAdOverlay from '@/components/ads/InterstitialAdOverlay'
import RewardedAdOverlay from '@/components/ads/RewardedAdOverlay'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
const Profile = dynamic(() => import('./Profile'), { ssr: false, loading: () => <ViewLoader /> })
const PremiumPlan = dynamic(() => import('./PremiumPlan'), { ssr: false, loading: () => <ViewLoader /> })
const AuthPage = dynamic(() => import('./AuthPage'), { ssr: false, loading: () => <ViewLoader /> })
const TextToPdf = dynamic(() => import('./TextToPdf'), { ssr: false, loading: () => <ViewLoader /> })
const ImageToPdf = dynamic(() => import('./ImageToPdf'), { ssr: false, loading: () => <ViewLoader /> })
const CompressPdf = dynamic(() => import('./CompressPdf'), { ssr: false, loading: () => <ViewLoader /> })
const MergePdf = dynamic(() => import('./MergePdf'), { ssr: false, loading: () => <ViewLoader /> })
const SplitPdf = dynamic(() => import('./SplitPdf'), { ssr: false, loading: () => <ViewLoader /> })
const OcrTool = dynamic(() => import('./OcrTool'), { ssr: false, loading: () => <ViewLoader /> })
const SpeechToText = dynamic(() => import('./SpeechToText'), { ssr: false, loading: () => <ViewLoader /> })
const PdfEditor = dynamic(() => import('./PdfEditor'), { ssr: false, loading: () => <ViewLoader /> })
const ZipExport = dynamic(() => import('./ZipExport'), { ssr: false, loading: () => <ViewLoader /> })
const ScanToPdf = dynamic(() => import('./ScanToPdf'), { ssr: false, loading: () => <ViewLoader /> })
const PasswordProtect = dynamic(() => import('./PasswordProtect'), { ssr: false, loading: () => <ViewLoader /> })
const ESignature = dynamic(() => import('./ESignature'), { ssr: false, loading: () => <ViewLoader /> })
const AiSummary = dynamic(() => import('./AiSummary'), { ssr: false, loading: () => <ViewLoader /> })
const SmartCrop = dynamic(() => import('./SmartCrop'), { ssr: false, loading: () => <ViewLoader /> })
const HandwritingToText = dynamic(() => import('./HandwritingToText'), { ssr: false, loading: () => <ViewLoader /> })
const BusinessCardScanner = dynamic(() => import('./BusinessCardScanner'), { ssr: false, loading: () => <ViewLoader /> })
const BackgroundCleaner = dynamic(() => import('./BackgroundCleaner'), { ssr: false, loading: () => <ViewLoader /> })
const ScreenshotEditor = dynamic(() => import('./ScreenshotEditor'), { ssr: false, loading: () => <ViewLoader /> })
const PrivacyPolicy = dynamic(() => import('./PrivacyPolicy'), { ssr: false, loading: () => <ViewLoader /> })
const TermsConditions = dynamic(() => import('./TermsConditions'), { ssr: false, loading: () => <ViewLoader /> })
import SplashScreen from './SplashScreen'


export default function ScanMasterApp() {
  const { activeView, setActiveView, previousView } = useAppStore()
  const { user, loading: authLoading } = useAuth()
  const [showSplash, setShowSplash] = useState(true)
  const [forceReady, setForceReady] = useState(false)
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null)

  const PREMIUM_LOCKED_VIEWS = [
    'merge-pdf',
    'split-pdf',
    'compress-pdf'
  ]

  const isPremium = user?.profile?.tier === 'premium' || user?.profile?.premium_status === true

  // Intercept locked features and redirect to home/previous view while launching the gorgeous paywall
  useEffect(() => {
    if (PREMIUM_LOCKED_VIEWS.includes(activeView) && !isPremium && !authLoading) {
      const prev = previousView || 'home'
      setActiveView(prev)
      setPaywallFeature(activeView)
    }
  }, [activeView, isPremium, authLoading, previousView, setActiveView])

  // Register PWA service worker — completely non-blocking, errors are silently caught
  useServiceWorker()

  // Global error handler — catches unhandled promise rejections
  useErrorHandler()

  // Console log for app mount
  useEffect(() => {
    console.log('[ScanMaster] App mounted')
  }, [])

  // Hide native Capacitor splash screen once app is mounted
  useEffect(() => {
    const hideNativeSplash = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any
        if (win?.Capacitor?.Plugins?.SplashScreen) {
          await win.Capacitor.Plugins.SplashScreen.hide()
          console.log('[ScanMaster] Native Capacitor splash hidden')
        }
      } catch (err) {
        console.warn('[ScanMaster] Failed to hide native splash:', err)
      }
    }
    hideNativeSplash()
  }, [])

  // Safety timeout: if splash + auth takes too long, force the app open
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceReady(true)
      setShowSplash(false)
      console.log('[ScanMaster] Safety timeout — forcing app to Home screen')
    }, 3500) // 3.5s absolute max for entire startup
    return () => clearTimeout(timer)
  }, [])

  // Handle deep links from PWA shortcuts (e.g., ?view=scan-to-pdf)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const viewParam = params.get('view')
      if (viewParam) {
        const validViews: ToolView[] = [
          'home', 'scan-to-pdf', 'image-to-pdf', 'text-to-pdf', 'pdf-editor',
          'compress-pdf', 'merge-pdf', 'split-pdf', 'ocr',
          'speech-to-text', 'zip-export', 'tools', 'files', 'profile', 'premium', 'auth',
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
  const lastRedirectedUserId = useRef<string | null>(null)
  useEffect(() => {
    if (activeView === 'auth' && user && !authLoading) {
      if (lastRedirectedUserId.current !== user.id) {
        lastRedirectedUserId.current = user.id
        setActiveView('home')
      }
    }
    if (!user) {
      lastRedirectedUserId.current = null
    }
  }, [activeView, user, authLoading, setActiveView])

  const handleUpgrade = async (plan: 'monthly' | 'yearly') => {
    if (!user) {
      toast.error('Please sign in or sign up first to purchase Premium.')
      setPaywallFeature(null)
      setActiveView('auth')
      return
    }

    setActiveView('premium')
  }

  if (showSplash && !forceReady) {
    return <SplashScreen onComplete={() => {
      setShowSplash(false)
      console.log('[ScanMaster] Splash complete — navigating to Home')
    }} />
  }

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
      case 'ocr':
        return <OcrTool />
      case 'speech-to-text':
        return <SpeechToText />
      case 'zip-export':
        return <ZipExport />
      case 'password-protect':
        return <PasswordProtect />
      case 'e-signature':
        return <ESignature />
      case 'ai-summary':
        return <AiSummary />
      case 'smart-crop':
        return <SmartCrop />
      case 'handwriting-to-text':
        return <HandwritingToText />
      case 'business-card-scanner':
        return <BusinessCardScanner />
      case 'background-cleaner':
        return <BackgroundCleaner />
      case 'screenshot-editor':
        return <ScreenshotEditor />
      case 'privacy-policy':
        return <PrivacyPolicy />
      case 'terms-conditions':
        return <TermsConditions />
      default:
        return <Dashboard />
    }
  }

  const showBottomNav = ['home', 'tools', 'files', 'profile'].includes(activeView)

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-mesh">
        <Header />
        <main className={`flex-1 overflow-y-auto ${showBottomNav ? 'pb-[160px]' : 'pb-6 safe-bottom'}`}>
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
        {showBottomNav && <BottomNav />}
        {showBottomNav && <FloatingScanButton />}
        {/* Interstitial Ad Overlay — for web mock mode only */}
        <InterstitialAdOverlay />
        {/* Rewarded Ad Overlay — for web mock mode only */}
        <RewardedAdOverlay />

        {/* Premium Paywall Modal */}
        <AnimatePresence>
          {paywallFeature && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="glass-card w-full max-w-sm p-6 space-y-6 text-center border-yellow-500/20 shadow-xl shadow-yellow-500/5 relative overflow-hidden"
              >
                {/* Background Sparkle Effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-gradient-to-b from-yellow-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                <div className="space-y-2">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center mx-auto mb-1 border border-yellow-500/30">
                    <svg
                      className="h-6 w-6 text-yellow-400 animate-pulse"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Unlock this Premium feature</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed px-2">
                    Get AI Document Summary, Handwriting OCR, and more.
                  </p>
                </div>

                {/* Pricing Tiers */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col justify-between h-28 text-left">
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Monthly</p>
                      <p className="text-lg font-bold text-foreground mt-1">₹99<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                    </div>
                    <button
                      onClick={() => handleUpgrade('monthly')}
                      className="w-full py-1.5 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-lg hover:bg-secondary/80 transition-colors"
                    >
                      Upgrade Monthly
                    </button>
                  </div>

                  <div className="p-3 bg-primary/10 rounded-xl border border-primary/30 flex flex-col justify-between h-28 text-left relative">
                    <div className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[7px] font-black uppercase">
                      Best Value
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-primary uppercase">Yearly</p>
                      <p className="text-lg font-bold text-foreground mt-1">₹799<span className="text-xs font-normal text-muted-foreground">/yr</span></p>
                      <p className="text-[8px] text-primary font-medium mt-0.5">Saves ₹389/year</p>
                    </div>
                    <button
                      onClick={() => handleUpgrade('yearly')}
                      className="w-full py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg hover:bg-primary/95 transition-colors shadow-lg shadow-primary/25"
                    >
                      Upgrade Yearly
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setPaywallFeature(null)}
                    className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                  >
                    Maybe Later
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  )
}
