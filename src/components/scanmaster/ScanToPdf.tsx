'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Download,
  Share2,
  Camera,
  Trash2,
  Sun,
  Contrast,
  Filter,
  ChevronUp,
  ChevronDown,
  Check,
  RefreshCw,
  Plus,
  SwitchCamera,
  ScanLine,
  ZoomIn,
  ImagePlus,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Wifi,
  ExternalLink,
  WifiOff,
  Zap,
  ZapOff,
  IdCard,
  FileText,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'
import {
  coverContentRect,
  fitGuideInContent,
  rectToSourcePixels,
  type Rect,
} from '@/lib/camera-geometry'
import {
  generateIdCardPdf,
  idCardFileName,
  ID_CARD_PAGE_SIZES,
  CARD_ASPECT,
  type IdCardPageSize,
} from '@/lib/id-card-pdf'
import {
  pickImages,
  downloadFile as saveBlob,
  shareFile,
  openFile,
} from '@/lib/capacitor-fs'

// ─── Android WebView / PWA Camera Detection ─────────────────────────────────

function isAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isAndroid = /Android/i.test(ua)
  const hasWv = /wv/.test(ua)
  const hasTwa = /; wv\)/.test(ua) || /Version\/\d.*Chrome\/\d/.test(ua)
  return isAndroid && (hasWv || hasTwa)
}

function checkSecureContext(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.isSecureContext !== 'undefined') return window.isSecureContext
  const protocol = window.location?.protocol || ''
  return protocol === 'https:' || protocol === 'localhost:' || protocol === 'file:'
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanStep = 'camera' | 'preview' | 'pages' | 'id-review' | 'id-done'

type ScanMode = 'document' | 'id'
type IdSide = 'front' | 'back'

interface CapturedPage {
  id: string
  dataUrl: string
  enhanced: boolean
  enhancedDataUrl?: string
}

/** ID-1 standard card aspect ratio used for the card-shaped guide. */
const DOCUMENT_ASPECT = 1 / 1.414

// ─── Utilities ────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the selected file'))
    reader.readAsDataURL(file)
  })
}

function enhanceImageClient(
  dataUrl: string,
  options: { brightness: number; contrast: number; bw: boolean; sharpen: boolean; shadowRemoval: boolean }
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }

      let filterStr = `brightness(${options.brightness}%) contrast(${options.contrast}%)`
      if (options.bw) filterStr += ' grayscale(100%)'
      if (options.shadowRemoval) filterStr += ' brightness(105%) contrast(110%)'

      ctx.filter = filterStr
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      ctx.filter = 'none'

      if (options.sharpen) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const w = canvas.width
        const h = canvas.height
        const copy = new Uint8ClampedArray(data)
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4
            for (let c = 0; c < 3; c++) {
              const val =
                5 * copy[idx + c] -
                copy[((y - 1) * w + x) * 4 + c] -
                copy[((y + 1) * w + x) * 4 + c] -
                copy[(y * w + (x - 1)) * 4 + c] -
                copy[(y * w + (x + 1)) * 4 + c]
              data[idx + c] = Math.min(255, Math.max(0, val))
            }
          }
        }
        ctx.putImageData(imageData, 0, 0)
      }
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

// ─── Client-side PDF generation (PRIMARY method — no backend needed) ──────────

async function generatePdfLocally(images: string[], title: string = 'Scanned Document'): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

  const a4Width = 595.28
  const a4Height = 841.89

  for (let i = 0; i < images.length; i++) {
    if (i > 0) pdf.addPage()

    const dataUrl = images[i]
    const img = new Image()
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = dataUrl
    })

    const imgW = img.naturalWidth || a4Width
    const imgH = img.naturalHeight || a4Height
    const imgAspect = imgW / imgH
    const a4Aspect = a4Width / a4Height

    let drawW: number, drawH: number
    if (imgAspect > a4Aspect) {
      drawW = a4Width
      drawH = a4Width / imgAspect
    } else {
      drawH = a4Height
      drawW = a4Height * imgAspect
    }

    const x = (a4Width - drawW) / 2
    const y = (a4Height - drawH) / 2

    pdf.addImage(dataUrl, 'JPEG', x, y, drawW, drawH)
  }

  pdf.setProperties({
    title,
    creator: 'ScanMaster',
  })

  return pdf.output('blob')
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ScanToPdf() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()

  // ── Step / flow state ──
  const [step, setStep] = useState<ScanStep>('camera')

  // ── Camera state ──
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  // ── Capture state ──
  const [lastCaptured, setLastCaptured] = useState<string | null>(null)

  // ── Enhancement state ──
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [bwFilter, setBwFilter] = useState(false)
  const [sharpenFilter, setSharpenFilter] = useState(false)
  const [shadowRemoval, setShadowRemoval] = useState(false)

  // ── Pages state ──
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([])
  const [selectedPage, setSelectedPage] = useState<number | null>(null)

  // ── PDF generation ──
  const [generating, setGenerating] = useState(false)
  const [enhancing, setEnhancing] = useState(false)

  // ── Offline mode indicator ──
  const [offlineMode, setOfflineMode] = useState(false)

  // ── Scan mode (Document | ID Card) ──
  const [scanMode, setScanMode] = useState<ScanMode>('document')

  // ── ID Card session ──
  const [idStep, setIdStep] = useState<IdSide>('front')
  const [idFront, setIdFront] = useState<string | null>(null)
  const [idBack, setIdBack] = useState<string | null>(null)
  const [idPageSize, setIdPageSize] = useState<IdCardPageSize>('a4')
  const [idResult, setIdResult] = useState<{ name: string; size: number; preview: string } | null>(null)

  // ── Torch / flash (only shown when the active track really supports it) ──
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  // ── Capture lock: prevents double-taps producing two captures ──
  const [capturing, setCapturing] = useState(false)

  // ── Live guide geometry, measured from the real preview box ──
  const [guideRect, setGuideRect] = useState<Rect | null>(null)

  // ── Refs ──
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraAbortRef = useRef<boolean>(false)
  const previewBoxRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  // ────────────────────────────────────────────────────────────────────────────
  // TORCH: only offered when the active track genuinely supports it
  // ────────────────────────────────────────────────────────────────────────────

  const syncTorchSupport = useCallback(() => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    const caps = (track as unknown as { getCapabilities?: () => { torch?: boolean } })
      ?.getCapabilities?.()
    const supported = Boolean(caps && 'torch' in caps)
    setTorchSupported(supported)
    if (!supported) setTorchOn(false)
  }, [])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0] as unknown as {
      getCapabilities?: () => { torch?: boolean }
      applyConstraints?: (c: Record<string, unknown>) => Promise<void>
    } | undefined
    if (!track?.applyConstraints) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as never)
      setTorchOn(next)
    } catch {
      // Some drivers advertise torch but reject the constraint - stay truthful.
      setTorchOn(false)
      toast.error('Flash is not available on this camera')
    }
  }, [torchOn])

  // ────────────────────────────────────────────────────────────────────────────
  // CAMERA: Start camera — fully local, NO backend dependency
  // ────────────────────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraStarting(true)
    cameraAbortRef.current = false

    try {
      // ── Step 1: Check secure context (HTTPS) ──
      if (!checkSecureContext()) {
        const isWV = isAndroidWebView()
        setCameraError(
          'Camera requires HTTPS. ' +
          (isWV
            ? 'Please install this app as a PWA (Add to Home Screen) from Chrome to get camera access.'
            : 'Please access this app via HTTPS or localhost.')
        )
        setCameraStarting(false)
        return
      }

      // ── Step 2: Check API availability ──
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isWV = isAndroidWebView()
        setCameraError(
          isWV
            ? 'Camera is not available in this Android WebView. Please open in Chrome browser or install as a PWA.'
            : 'Camera is not supported by your browser. Please use Chrome, Firefox, or Safari.'
        )
        setCameraStarting(false)
        return
      }

      // ── Step 3: Check permission on Android WebView ──
      if (isAndroidWebView() && navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (status.state === 'denied') {
            setCameraError(
              'Camera permission is denied. Please go to: Settings → Apps → ScanMaster → Permissions → Camera → Allow.'
            )
            setCameraStarting(false)
            return
          }
        } catch {
          // permissions.query not supported for camera, continue
        }
      }

      // ── Step 4: Stop any existing stream ──
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      // ── Step 5: Get camera stream with fallback strategies ──
      if (cameraAbortRef.current) { setCameraStarting(false); return }
      const strategies: { name: string; constraints: MediaStreamConstraints }[] = [
        {
          name: 'rear-camera',
          constraints: {
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          },
        },
        {
          name: 'rear-basic',
          constraints: {
            video: { facingMode: 'environment' },
            audio: false,
          },
        },
        {
          name: 'any-hd',
          constraints: {
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          },
        },
        {
          name: 'any-camera',
          constraints: { video: true, audio: false },
        },
      ]

      let stream: MediaStream | null = null
      for (const strategy of strategies) {
        try {
          console.log(`[Camera] Trying strategy: ${strategy.name}`)
          stream = await navigator.mediaDevices.getUserMedia(strategy.constraints)
          console.log(`[Camera] Strategy ${strategy.name} succeeded!`, {
            tracks: stream.getVideoTracks().length,
            label: stream.getVideoTracks()[0]?.label,
          })
          break
        } catch (err) {
          const errName = (err as DOMException)?.name
          console.warn(`[Camera] Strategy ${strategy.name} failed:`, errName)
          // If permission denied, don't try more strategies
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            throw err
          }
          continue
        }
      }

      if (!stream) {
        setCameraError('Could not start any camera. Please check your device has a camera and try again.')
        setCameraStarting(false)
        return
      }

      streamRef.current = stream

      // ── Step 6: Attach stream to video element ──
      if (cameraAbortRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setCameraStarting(false)
        return
      }
      const video = videoRef.current
      if (!video) {
        console.error('[Camera] videoRef.current is null — video element not mounted')
        setCameraError('Video element not ready. Please refresh and try again.')
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setCameraStarting(false)
        return
      }

      // Reset video element state
      video.srcObject = null
      // Small delay to let browser reset
      await new Promise((r) => setTimeout(r, 50))

      // Set the stream
      video.srcObject = stream

      // Wait for metadata to load
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for video metadata (10s)'))
        }, 10000)

        const onLoaded = () => {
          clearTimeout(timeout)
          console.log('[Camera] Metadata loaded:', video.videoWidth, 'x', video.videoHeight)
          resolve()
        }

        if (video.readyState >= 1) {
          onLoaded()
        } else {
          video.addEventListener('loadedmetadata', onLoaded, { once: true })
        }
      })

      // Play the video
      try {
        await video.play()
        console.log('[Camera] Video play() succeeded')
      } catch (playErr) {
        console.error('[Camera] play() failed:', playErr)
        // Try again with muted (some browsers require muted for autoplay)
        video.muted = true
        try {
          await video.play()
          console.log('[Camera] Video play() succeeded on retry (muted)')
        } catch {
          throw new Error('Video playback failed. Tap the screen to start the camera preview.')
        }
      }

      // Verify video has actual dimensions (not 0x0)
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn('[Camera] Video dimensions are 0x0, waiting for first frame...')
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Video never produced frames')), 5000)
          const checkDimensions = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              clearTimeout(timeout)
              resolve()
            }
          }
          const interval = setInterval(() => {
            checkDimensions()
          }, 100)
          // Also listen for 'playing' event
          video.addEventListener('playing', () => {
            clearInterval(interval)
            checkDimensions()
            if (video.videoWidth > 0) {
              clearTimeout(timeout)
              resolve()
            }
          }, { once: true })
          // Cleanup interval on timeout
          setTimeout(() => clearInterval(interval), 6000)
        })
      }

      // ── Step 7: Camera is live! ──
      if (cameraAbortRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setCameraStarting(false)
        return
      }
      console.log('[Camera] Camera is live — showing preview')
      syncTorchSupport()
      setCameraActive(true)
      setCameraStarting(false)
      toast.success('Camera ready')
    } catch (err) {
      console.error('[Camera] startCamera error:', err)
      const errName = (err as DOMException)?.name
      const errMsg = (err as Error)?.message || ''
      const isWV = isAndroidWebView()

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError(
          'Please allow camera permission to scan documents. ' +
          (isWV
            ? 'Go to: Settings → Apps → ScanMaster → Permissions → Camera → Allow.'
            : 'Tap the lock/info icon in your browser address bar → Site Settings → Camera → Allow.')
        )
      } else if (errName === 'NotFoundError') {
        setCameraError(
          isWV
            ? 'No camera found. Please install this app as a PWA from Chrome for camera access.'
            : 'No camera found on this device.'
        )
      } else if (errName === 'NotReadableError') {
        setCameraError('Camera is in use by another app. Close other camera apps and try again.')
      } else if (errName === 'SecurityError') {
        setCameraError(
          isWV
            ? 'Camera blocked by security policy. Install as a PWA (Add to Home Screen) from Chrome for full camera access.'
            : 'Camera blocked by security policy. Ensure you are using HTTPS.'
        )
      } else if (errMsg.includes('Timeout') || errMsg.includes('metadata')) {
        setCameraError(
          'Camera took too long to start. Try: 1) Close other camera apps, 2) Refresh the page, 3) Use Chrome browser.'
        )
      } else {
        setCameraError(
          errMsg || 'Camera error. Please check permissions and try again.'
        )
      }

      // Clean up stream on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setCameraStarting(false)
    }
  }, [syncTorchSupport])

  // ────────────────────────────────────────────────────────────────────────────
  // CAMERA: Stop
  // ────────────────────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCameraError(null)
  }, [])

  // ────────────────────────────────────────────────────────────────────────────
  // NAVIGATE: leave the scanner and release the camera
  // ────────────────────────────────────────────────────────────────────────────

  const handleExitCamera = useCallback(() => {
    stopCamera()
    goBack()
  }, [stopCamera, goBack])

  // ────────────────────────────────────────────────────────────────────────────
  // CAMERA: Switch front/rear
  // ────────────────────────────────────────────────────────────────────────────

  const switchCamera = useCallback(async () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newFacing)

    // Stop current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }

      toast.success(newFacing === 'environment' ? 'Rear camera' : 'Front camera')
    } catch {
      toast.error('Could not switch camera')
      setFacingMode(facingMode)
      // Restart with original facing mode
      startCamera()
    }
  }, [facingMode, startCamera])

  // ────────────────────────────────────────────────────────────────────────────
  // CAMERA: Cleanup on unmount
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cameraAbortRef.current = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [])

// ────────────────────────────────────────────────────────────────────────────
  // GUIDE GEOMETRY: derive the guide from the REAL displayed preview box
//
// The preview uses object-fit: cover, so container percentages do not map to
// pixels of the captured frame. Measuring the container and the video's own
// resolution lets the guide sit inside the visible video area and lets the
// capture step crop to exactly what the user framed.
// ────────────────────────────────────────────────────────────────────────────

const desiredAspect = scanMode === 'id' ? CARD_ASPECT : DOCUMENT_ASPECT

const recomputeGuide = useCallback(() => {
  const box = previewBoxRef.current
  const video = videoRef.current
  if (!box || !video || !video.videoWidth || !video.videoHeight) {
    return
  }
  const rect = box.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  // Fit the guide inside the band that is actually visible, i.e. between the
  // header and the capture dock. Otherwise the lower corners sit behind the
  // dock and the user cannot see the whole frame they are aligning to.
  const headerEl = headerRef.current
  const dockEl = dockRef.current
  const top = headerEl ? headerEl.getBoundingClientRect().bottom - rect.top : 0
  const bottom = dockEl ? dockEl.getBoundingClientRect().top - rect.top : rect.height

  const availW = rect.width
  const availH = Math.max(0, bottom - top)
  if (availW <= 0 || availH <= 0) return

  const source = { width: video.videoWidth, height: video.videoHeight }

  // Visible slice of the cover-fitted video, expressed in container space.
  // The slice must START at the header edge (not be re-centred), otherwise the
  // guide drifts back underneath the dock.
  const full = coverContentRect(source, { width: rect.width, height: rect.height })

  const inner: Rect = {
    x: full.x,
    y: top,
    width: full.width,
    height: Math.max(0, Math.min(full.height, availH)),
  }

  const guide = fitGuideInContent(inner, desiredAspect, scanMode === 'id' ? 0.12 : 0.08)
  setGuideRect(guide)
}, [desiredAspect, scanMode])

useEffect(() => {
  if (!cameraActive) return
  recomputeGuide()
  const box = previewBoxRef.current
  if (!box) return

  const ro = new ResizeObserver(() => recomputeGuide())
  ro.observe(box)
  if (dockRef.current) ro.observe(dockRef.current)
  window.addEventListener('orientationchange', recomputeGuide)
  const onLoaded = () => recomputeGuide()
  videoRef.current?.addEventListener('loadedmetadata', onLoaded)

  return () => {
    ro.disconnect()
    window.removeEventListener('orientationchange', recomputeGuide)
    videoRef.current?.removeEventListener('loadedmetadata', onLoaded)
  }
}, [cameraActive, recomputeGuide])

// ────────────────────────────────────────────────────────────────────────────
// CAPTURE: Take photo from video stream, cropped to the guide
// ────────────────────────────────────────────────────────────────────────────

const capturePhoto = useCallback(() => {
  if (capturing) return
  const video = videoRef.current
  const canvas = canvasRef.current
  if (!video || !canvas) return

  // Verify video has actual frames
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    toast.error('Camera not ready yet. Please wait a moment.')
    return
  }

  setCapturing(true)
  const box = previewBoxRef.current
  const rect = box?.getBoundingClientRect()
  const source = { width: video.videoWidth, height: video.videoHeight }

  // Crop rect in real source pixels, derived from the measured guide.
  let crop = { x: 0, y: 0, width: source.width, height: source.height }
  if (rect && rect.width > 0 && rect.height > 0 && guideRect) {
    const content = coverContentRect(source, { width: rect.width, height: rect.height })
    crop = rectToSourcePixels(guideRect, content, source)
  }

  canvas.width = crop.width
  canvas.height = crop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    setCapturing(false)
    return
  }

  try {
    ctx.drawImage(
      video,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, crop.width, crop.height
    )
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setLastCaptured(dataUrl)

    if (scanMode === 'id') {
      // Keep the two sides in one session, in a fixed order. Never mix them
      // into the multi-page document list.
      if (idStep === 'front') {
        setIdFront(dataUrl)
        setIdBack(null) // discard any stale back from a previous session
        setIdStep('back')
        toast.success('Front side captured')
      } else {
        setIdBack(dataUrl)
        setStep('id-review')
        toast.success('Back side captured')
      }
    } else {
      setStep('preview')
    }
  } catch {
    toast.error('Capture failed. Please try again.')
  } finally {
    setCapturing(false)
  }
}, [capturing, guideRect, idStep, scanMode])

// ────────────────────────────────────────────────────────────────────────────
// GALLERY: import an image as the current page / ID side
// ────────────────────────────────────────────────────────────────────────────

const handleImportImage = useCallback(async () => {
  try {
    const picked = await pickImages()
    if (!picked || picked.length === 0) return
    const dataUrl = await readFileAsDataUrl(picked[0])

    if (scanMode === 'id') {
      if (idStep === 'front') {
        setIdFront(dataUrl)
        setIdBack(null)
        setIdStep('back')
        toast.success('Front side imported')
      } else {
        setIdBack(dataUrl)
        setStep('id-review')
        toast.success('Back side imported')
      }
    } else {
      setLastCaptured(dataUrl)
      setStep('preview')
    }
  } catch {
    toast.error('Could not import that image.')
  }
}, [idStep, scanMode])

// ────────────────────────────────────────────────────────────────────────────
// MODE SWITCH: never silently mix ID pages with document pages
// ────────────────────────────────────────────────────────────────────────────

const switchMode = useCallback(
  (next: ScanMode) => {
    if (next === scanMode) return

    const discard = () => {
      if (scanMode === 'id') {
        setIdFront(null)
        setIdBack(null)
        setIdStep('front')
      }
      setScanMode(next)
      setLastCaptured(null)
      setStep('camera')
    }

    // Captured pages belong to the mode that produced them, so ask first.
    if (scanMode === 'document' && capturedPages.length > 0) {
      toast('You have captured document pages. Switch mode?', {
        action: { label: 'Discard & Switch', onClick: discard },
        duration: 6000,
      })
      return
    }
    discard()
  },
  [capturedPages.length, scanMode]
)

  // ────────────────────────────────────────────────────────────────────────────
  // PREVIEW: Accept / Retake / Add Page
  // ────────────────────────────────────────────────────────────────────────────

  const acceptCapture = useCallback(() => {
    if (!lastCaptured) return
    setCapturedPages((prev) => [...prev, { id: crypto.randomUUID(), dataUrl: lastCaptured, enhanced: false }])
    setLastCaptured(null)
    toast.success('Page added!')
    setStep('camera')
  }, [lastCaptured])

  const retakeCapture = useCallback(() => {
    setLastCaptured(null)
    setStep('camera')
  }, [])

  const acceptAndFinish = useCallback(() => {
    if (!lastCaptured) return
    setCapturedPages((prev) => [...prev, { id: crypto.randomUUID(), dataUrl: lastCaptured, enhanced: false }])
    setLastCaptured(null)
    setStep('pages')
    toast.success('Page added! Review your pages.')
  }, [lastCaptured])

  // ────────────────────────────────────────────────────────────────────────────
  // PAGES: Management
  // ────────────────────────────────────────────────────────────────────────────

  const removePage = useCallback((id: string) => {
    setCapturedPages((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const movePage = useCallback((index: number, direction: 'up' | 'down') => {
    setCapturedPages((prev) => {
      const next = [...prev]
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= next.length) return prev
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
  }, [])

  // ────────────────────────────────────────────────────────────────────────────
  // ENHANCE: Apply to all pages (client-side only, no backend)
  // ────────────────────────────────────────────────────────────────────────────

  const applyEnhancementsToAll = useCallback(async () => {
    if (enhancing || capturedPages.length === 0) return
    setEnhancing(true)
    try {
      const enhanced = await Promise.all(
        capturedPages.map(async (page) => {
          const result = await enhanceImageClient(page.dataUrl, {
            brightness, contrast, bw: bwFilter, sharpen: sharpenFilter, shadowRemoval,
          })
          return { ...page, enhancedDataUrl: result, enhanced: true }
        })
      )
      setCapturedPages(enhanced)
      toast.success('Enhancements applied')
    } catch {
      toast.error('Enhancement failed')
    } finally {
      setEnhancing(false)
    }
  }, [capturedPages, brightness, contrast, bwFilter, sharpenFilter, shadowRemoval])

  // ────────────────────────────────────────────────────────────────────────────
  // SAVE: Generate PDF — CLIENT-SIDE ONLY (no backend dependency)
  // ────────────────────────────────────────────────────────────────────────────

  const handleSaveAsPdf = useCallback(async () => {
    if (generating) return
    if (capturedPages.length === 0) { toast.error('No pages to save'); return }
    setGenerating(true)
    try {
      // Enhance all pages client-side first
      const pagesToSend = await Promise.all(
        capturedPages.map(async (page) => {
          if (page.enhanced && page.enhancedDataUrl) return page.enhancedDataUrl
          return enhanceImageClient(page.dataUrl, { brightness, contrast, bw: bwFilter, sharpen: sharpenFilter, shadowRemoval })
        })
      )

      // Generate PDF entirely client-side — NO backend API call
      console.log('[PDF] Generating PDF locally (no backend dependency)...')
      const blob = await generatePdfLocally(pagesToSend, 'Scanned Document')

      const filename = `scanned-document-${Date.now()}.pdf`
      await saveBlob(blob, filename)
      addFile({ id: crypto.randomUUID(), name: filename, type: 'pdf', size: blob.size, createdAt: new Date(), category: ['recent', 'scanned'], favorite: false })
      toast.success('PDF saved!')
      showAdAfterSuccess()
    } catch (err) {
      console.error('[PDF] Failed to create PDF:', err)
      toast.error('Failed to create PDF. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [capturedPages, brightness, contrast, bwFilter, sharpenFilter, shadowRemoval, addFile, showAdAfterSuccess])

  // ────────────────────────────────────────────────────────────────────────────
  // SHARE — CLIENT-SIDE ONLY (no backend dependency)
  // ────────────────────────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    if (generating) return
    if (capturedPages.length === 0) { toast.error('No pages to share'); return }
    setGenerating(true)
    try {
      const pagesToSend = await Promise.all(
        capturedPages.map(async (p) => p.enhanced && p.enhancedDataUrl ? p.enhancedDataUrl : p.dataUrl)
      )

      // Generate PDF entirely client-side — NO backend API call
      console.log('[PDF] Generating PDF locally for share...')
      const blob = await generatePdfLocally(pagesToSend, 'Scanned Document')

      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'scan.pdf', { type: 'application/pdf' })] })) {
        await navigator.share({ title: 'Scanned Document', files: [new File([blob], 'scanned-document.pdf', { type: 'application/pdf' })] })
        showAdAfterSuccess()
      } else {
        await saveBlob(blob, 'scanned-document.pdf')
        toast.info('Share not supported. PDF downloaded instead.')
        showAdAfterSuccess()
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Share failed')
    } finally {
      setGenerating(false)
    }
  }, [capturedPages, generating, showAdAfterSuccess])

// ────────────────────────────────────────────────────────────────────────────
// ID CARD: build the single-page PDF, then save / share / open
// ────────────────────────────────────────────────────────────────────────────

const buildIdCardPdf = useCallback(async (): Promise<Blob> => {
  if (!idFront || !idBack) {
    const missing = !idFront ? 'Front' : 'Back'
    throw new Error(`${missing} side of the ID card is missing. Please capture the ${missing.toLowerCase()} side again.`)
  }
  setGenerating(true)
  try {
    const result = await generateIdCardPdf(idFront, idBack, idPageSize)
    // generateIdCardPdf already verifies the page count before returning, so
    // reaching here means the file really holds both sides on one page.
    const name = idCardFileName()
    setIdResult({ name, size: result.blob.size, preview: idFront })
    addFile({
      id: crypto.randomUUID(),
      name,
      type: 'pdf',
      size: result.blob.size,
      createdAt: new Date(),
      category: ['recent', 'scanned'],
      favorite: false,
    })
    return result.blob
  } finally {
    setGenerating(false)
  }
}, [idBack, idFront, idPageSize, addFile])

const handleCreateIdPdf = useCallback(async () => {
  try {
    await buildIdCardPdf()
    setStep('id-done')
    toast.success('ID card PDF created')
    showAdAfterSuccess()
  } catch (err) {
    toast.error((err as Error).message || 'Could not create the ID card PDF.')
  }
}, [buildIdCardPdf, showAdAfterSuccess])

const handleIdSave = useCallback(async () => {
  try {
    const blob = await buildIdCardPdf()
    const name = idCardFileName()
    await saveBlob(blob, name)
    toast.success('Saved to Documents')
  } catch (err) {
    toast.error((err as Error).message || 'Could not save the ID card PDF.')
  }
}, [buildIdCardPdf])

const handleIdShare = useCallback(async () => {
  try {
    const blob = await buildIdCardPdf()
    await shareFile(blob, idCardFileName(), 'Share ID Card Scan')
  } catch (err) {
    const msg = (err as Error)?.message || ''
    if (!msg.toLowerCase().includes('cancel')) {
      toast.error('Could not share the ID card PDF.')
    }
  }
}, [buildIdCardPdf])

const handleIdOpen = useCallback(async () => {
  try {
    const blob = await buildIdCardPdf()
    await openFile(blob, idCardFileName())
  } catch {
    toast.error('Could not open the ID card PDF.')
  }
}, [buildIdCardPdf])

// ────────────────────────────────────────────────────────────────────────────
// RENDER HELPERS
// ────────────────────────────────────────────────────────────────────────────

  const previewFilter = `brightness(${brightness}%) contrast(${contrast}%)${bwFilter ? ' grayscale(100%)' : ''}${shadowRemoval ? ' brightness(105%) contrast(110%)' : ''}`

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: Camera Step
  //
  // KEY FIX: Uses `fixed inset-0 z-50` instead of `h-full` to guarantee
  // the video element gets proper viewport dimensions regardless of parent
  // chain height. This is the root cause of the black screen — the parent
  // div with `h-full` was getting 0 height because the motion.div > main
  // parent chain didn't establish a height context.
  // ────────────────────────────────────────────────────────────────────────────

  const renderCameraStep = () => (
    <div ref={previewBoxRef} className="fixed inset-0 z-[90] bg-black flex flex-col">
      {/* ━━━━ VIDEO ELEMENT ━━━━
          Always rendered. Uses visibility:hidden when not active (instead of
          display:none) so the browser keeps the video decoder pipeline active.
          When cameraActive is true, visibility becomes visible.
          
          CRITICAL: The video element MUST have explicit dimensions. With
          fixed inset-0 parent and w-full h-full, it gets viewport dimensions.
      */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        disablePictureInPicture
        className="absolute inset-0 w-full h-full"
        style={{
          objectFit: 'cover',
          backgroundColor: 'black',
          visibility: cameraActive ? 'visible' : 'hidden',
          opacity: cameraActive ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* ━━━━ Header ━━━━
          Grid with equal side columns keeps the title truly centred and makes
          overlap with the status bar or the instruction pill impossible: the
          controls and the guidance sit in normal flow, never absolutely on top
          of each other. No fake status bar is drawn. */}
      <div ref={headerRef} className="absolute top-0 left-0 right-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="bg-[#06102A]/85 backdrop-blur-md border-b border-[#31435B]">
          <div className="grid grid-cols-[44px_1fr_44px] items-center px-3 h-14 gap-2">
            <button
              onClick={handleExitCamera}
              className="h-11 w-11 flex items-center justify-center rounded-xl text-white/90 active:bg-white/10"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <h1 className="text-center text-base font-semibold text-white truncate px-1">
              {scanMode === 'id' ? 'ID Card Scanner' : 'Scan to PDF'}
            </h1>

            {/* Flash is only offered when the active track reports torch support */}
            {torchSupported ? (
              <button
                onClick={toggleTorch}
                className={`h-11 w-11 flex items-center justify-center rounded-xl active:bg-white/10 ${
                  torchOn ? 'text-[#00D4FF]' : 'text-white/70'
                }`}
                aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'}
                aria-pressed={torchOn}
              >
                {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
              </button>
            ) : (
              <span aria-hidden className="h-11 w-11" />
            )}
          </div>

          {/* Guidance sits directly below the header bar, inside the same flow,
              so it can never collide with the title or the controls. */}
          <div className="px-3 pb-2.5">
            <p className="mx-auto w-fit max-w-full truncate rounded-full bg-[#12213A] border border-[#31435B] px-3 py-1.5 text-[11px] font-medium text-[#CCD5E2] text-center">
              {scanMode === 'id'
                ? idStep === 'front'
                  ? 'Front side — capture the front of your card'
                  : 'Back side — capture the back of your card'
                : 'Align the document within the frame'}
            </p>
          </div>
        </div>
      </div>

      {/* ━━━━ Camera NOT active: show start/error UI ━━━━ */}
      {!cameraActive && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
          {cameraError ? (
            <div className="glass-card p-6 max-w-sm w-full text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <p className="text-sm text-red-300">{cameraError}</p>
              {cameraError.includes('HTTPS') && (
                <div className="glass-card p-3 text-left space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">How to fix:</p>
                  <div className="flex items-start gap-2">
                    <Wifi className="h-4 w-4 text-electric shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">Open in Chrome browser (not inside another app)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <ExternalLink className="h-4 w-4 text-electric shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">Tap menu (&#8942;) &rarr; &quot;Add to Home Screen&quot; to install as PWA</p>
                  </div>
                </div>
              )}
              {cameraError.includes('denied') && (
                <div className="glass-card p-3 text-left space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">How to enable camera:</p>
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-electric shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">Chrome: Tap lock icon &rarr; Site Settings &rarr; Camera &rarr; Allow</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-electric shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">Android: Settings &rarr; Apps &rarr; ScanMaster &rarr; Permissions &rarr; Camera &rarr; Allow</p>
                  </div>
                </div>
              )}
              <Button onClick={startCamera} className="electric-glow bg-electric hover:bg-electric/90 text-electric-foreground w-full">
                <Camera className="h-4 w-4 mr-2" />Try Again
              </Button>
            </div>
          ) : cameraStarting ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 text-electric animate-spin" />
              <p className="text-sm text-muted-foreground">Starting camera...</p>
            </div>
          ) : (
            <div className="glass-card p-8 max-w-sm w-full flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-electric/20 flex items-center justify-center">
                <Camera className="h-10 w-10 text-electric" />
              </div>
              <p className="text-sm text-muted-foreground text-center">Use your camera to scan documents into PDF</p>
              <Button onClick={startCamera} className="electric-glow bg-electric hover:bg-electric/90 text-electric-foreground w-full min-h-[48px]">
                <Camera className="h-4 w-4 mr-2" />Open Camera
              </Button>
            </div>
          )}
          {capturedPages.length > 0 && !cameraStarting && (
            <div className="mt-4">
              <Button variant="outline" onClick={() => setStep('pages')} className="glass-card-hover border-glass-border min-h-[48px]">
                <Download className="h-4 w-4 mr-2" />View {capturedPages.length} Page{capturedPages.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ━━━━ Camera ACTIVE: overlay and controls ━━━━ */}
      {cameraActive && (
        <>
          {/* ━━━━ Guide overlay ━━━━
              Positioned from the MEASURED guide rect (real preview pixels),
              not container percentages.

              • Four corner brackets only - no full rectangle, no sweeping line.
              • The dim is a single box-shadow spread around the guide, so the
                document area inside the frame stays completely clear instead of
                being darkened by four overlapping translucent bands. */}
          {guideRect && (
            <div className="absolute inset-0 pointer-events-none z-10">
              <div
                className="absolute rounded-2xl"
                style={{
                  left: guideRect.x,
                  top: guideRect.y,
                  width: guideRect.width,
                  height: guideRect.height,
                  boxShadow: '0 0 0 9999px rgba(2, 8, 20, 0.42)',
                }}
              >
                <span className="absolute -left-px -top-px h-7 w-7 rounded-tl-xl border-l-[3px] border-t-[3px] border-[#00D4FF] rounded-tl-xl" />
                <span className="absolute -right-px -top-px h-7 w-7 rounded-tr-xl border-r-[3px] border-t-[3px] border-[#00D4FF]" />
                <span className="absolute -bottom-px -left-px h-7 w-7 rounded-bl-xl border-b-[3px] border-l-[3px] border-[#00D4FF]" />
                <span className="absolute -bottom-px -right-px h-7 w-7 rounded-br-xl border-b-[3px] border-r-[3px] border-[#00D4FF]" />
              </div>
            </div>
          )}

          {/* ━━━━ Capture dock ━━━━
              A real inset-aware dock (env(safe-area-inset-bottom)), separate from
              the preview content. Controls are laid out in a 3-column grid so
              they stay symmetric around the shutter. */}
          <div ref={dockRef} className="absolute bottom-0 left-0 right-0 z-20">
            <div
              className="bg-[#06102A]/90 backdrop-blur-md border-t border-[#31435B]"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              {/* Mode selector */}
              <div className="px-4 pt-3">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#0B1425] border border-[#31435B] p-1">
                  {([
                    { id: 'document' as const, label: 'Document', icon: FileText },
                    { id: 'id' as const, label: 'ID Card', icon: IdCard },
                  ]).map((m) => {
                    const Icon = m.icon
                    const active = scanMode === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => switchMode(m.id)}
                        aria-pressed={active}
                        className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                          active
                            ? 'bg-[#0A84FF] text-white'
                            : 'text-[#CCD5E2] active:bg-white/5'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-3 items-center px-6 py-3.5">
                {/* Gallery / import */}
                <button
                  onClick={handleImportImage}
                  className="justify-self-start h-12 w-12 rounded-full bg-[#12213A] border border-[#31435B] flex items-center justify-center text-white/90 active:bg-white/10"
                  aria-label="Import image from gallery"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>

                {/* Shutter */}
                <div className="justify-self-center">
                  <motion.button
                    onClick={capturePhoto}
                    disabled={capturing}
                    aria-label={capturing ? 'Capturing' : 'Capture'}
                    className={`h-[72px] w-[72px] rounded-full border-[3px] flex items-center justify-center disabled:opacity-60 ${
                      torchOn ? 'border-[#00D4FF]' : 'border-[#0A84FF]'
                    }`}
                    style={{ background: 'transparent' }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <motion.span
                      className="h-[58px] w-[58px] rounded-full bg-white block"
                      animate={capturing ? { scale: 0.82 } : { scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    />
                  </motion.button>
                </div>

                {/* Right slot: pages count in Document mode, camera switch otherwise */}
                <div className="justify-self-end">
                  {scanMode === 'document' ? (
                    <button
                      onClick={() => setStep('pages')}
                      className="relative h-12 w-12 rounded-full bg-[#12213A] border border-[#31435B] flex items-center justify-center text-white/90 active:bg-white/10"
                      aria-label={capturedPages.length > 0 ? `View ${capturedPages.length} captured pages` : 'No pages yet'}
                    >
                      <ScanLine className="h-5 w-5" />
                      {capturedPages.length > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#0A84FF] text-white text-[10px] font-bold flex items-center justify-center">
                          {capturedPages.length}
                        </span>
                      )}
                    </button>
                  ) : cameraActive ? (
                    <button
                      onClick={switchCamera}
                      className="h-12 w-12 rounded-full bg-[#12213A] border border-[#31435B] flex items-center justify-center text-white/90 active:bg-white/10"
                      aria-label="Switch camera"
                    >
                      <SwitchCamera className="h-5 w-5" />
                    </button>
                  ) : (
                    <span aria-hidden className="h-12 w-12" />
                  )}
                </div>
              </div>

              {/* Page counter for Document mode */}
              {scanMode === 'document' && capturedPages.length > 0 && (
                <p className="pb-2 text-center text-[11px] text-[#CCD5E2]">
                  {capturedPages.length} page{capturedPages.length !== 1 ? 's' : ''} captured
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Hidden canvas for capture — always mounted */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: Preview Step
  // ────────────────────────────────────────────────────────────────────────────

  const renderPreviewStep = () => (
    <div className="flex flex-col h-[100dvh] bg-mesh">
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={retakeCapture} className="text-foreground hover:bg-white/10 min-h-[44px] min-w-[44px]">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Check className="h-5 w-5 text-electric" />
        <h2 className="text-lg font-semibold gradient-text">Preview Capture</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card overflow-hidden">
          <div className="relative aspect-[3/4]">
            <img src={lastCaptured!} alt="Captured" className="w-full h-full object-contain bg-black/20" style={{ filter: previewFilter }} />
            <span className="absolute top-2 right-2 bg-electric/80 text-white text-[10px] font-bold px-2 py-1 rounded-full">
              Preview
            </span>
          </div>
        </motion.div>

        {/* Enhancement Controls */}
        <div className="glass-card p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Sun className="h-4 w-4 text-electric" />
            <h3 className="text-sm font-semibold text-foreground">Enhance</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground w-16 shrink-0">Bright</Label>
              <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={50} max={200} step={5} className="flex-1" />
              <span className="text-xs text-muted-foreground w-8 text-right">{brightness}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground w-16 shrink-0">Contrast</Label>
              <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={50} max={200} step={5} className="flex-1" />
              <span className="text-xs text-muted-foreground w-8 text-right">{contrast}%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { label: 'B&W', active: bwFilter, toggle: () => setBwFilter(!bwFilter), icon: Contrast },
              { label: 'Sharpen', active: sharpenFilter, toggle: () => setSharpenFilter(!sharpenFilter), icon: ZoomIn },
              { label: 'Shadow Fix', active: shadowRemoval, toggle: () => setShadowRemoval(!shadowRemoval), icon: Sun },
            ].map((opt) => (
              <Button
                key={opt.label}
                variant={opt.active ? 'default' : 'outline'}
                size="sm"
                onClick={opt.toggle}
                className={`text-xs ${opt.active ? 'bg-electric text-electric-foreground' : ''}`}
              >
                <opt.icon className="h-3 w-3 mr-1" />
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={retakeCapture} className="flex-1 min-h-[48px]">
            <RefreshCw className="h-4 w-4 mr-2" />Retake
          </Button>
          <Button onClick={acceptCapture} className="flex-1 bg-electric hover:bg-electric/90 text-electric-foreground min-h-[48px]">
            <Plus className="h-4 w-4 mr-2" />Add Page
          </Button>
        </div>
        <Button onClick={acceptAndFinish} variant="outline" className="w-full glass-card-hover border-glass-border min-h-[48px]">
          <Check className="h-4 w-4 mr-2" />Add &amp; Finish
        </Button>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: Pages Step
  // ────────────────────────────────────────────────────────────────────────────

  const renderPagesStep = () => (
    <div className="flex flex-col h-[100dvh] bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={() => setStep('camera')} className="text-foreground hover:bg-white/10 min-h-[44px] min-w-[44px]">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Download className="h-5 w-5 text-electric" />
        <h2 className="text-lg font-semibold gradient-text">Pages ({capturedPages.length})</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {capturedPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-16 w-16 rounded-full bg-electric/20 flex items-center justify-center">
              <ImagePlus className="h-8 w-8 text-electric" />
            </div>
            <p className="text-sm text-muted-foreground text-center">No pages yet. Go back and scan a document.</p>
            <Button onClick={() => setStep('camera')} className="bg-electric hover:bg-electric/90 text-electric-foreground">
              <Camera className="h-4 w-4 mr-2" />Scan Now
            </Button>
          </div>
        ) : (
          <>
            {/* Enhancement Controls for all pages */}
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-electric" />
                  <h3 className="text-sm font-semibold text-foreground">Enhance All</h3>
                </div>
                <Button size="sm" onClick={applyEnhancementsToAll} disabled={enhancing} className="bg-electric hover:bg-electric/90 text-electric-foreground">
                  {enhancing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                  {enhancing ? 'Applying...' : 'Apply'}
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Bright</Label>
                  <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={50} max={200} step={5} className="flex-1" />
                  <span className="text-xs text-muted-foreground w-8 text-right">{brightness}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Contrast</Label>
                  <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={50} max={200} step={5} className="flex-1" />
                  <span className="text-xs text-muted-foreground w-8 text-right">{contrast}%</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { label: 'B&W', active: bwFilter, toggle: () => setBwFilter(!bwFilter) },
                    { label: 'Sharpen', active: sharpenFilter, toggle: () => setSharpenFilter(!sharpenFilter) },
                    { label: 'Shadow Fix', active: shadowRemoval, toggle: () => setShadowRemoval(!shadowRemoval) },
                  ].map((opt) => (
                    <Button
                      key={opt.label}
                      variant={opt.active ? 'default' : 'outline'}
                      size="sm"
                      onClick={opt.toggle}
                      className={`text-xs ${opt.active ? 'bg-electric text-electric-foreground' : ''}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pages list */}
            <div className="space-y-3">
              {capturedPages.map((page, index) => (
                <motion.div
                  key={page.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`glass-card overflow-hidden ${selectedPage === index ? 'ring-2 ring-electric' : ''}`}
                  onClick={() => setSelectedPage(selectedPage === index ? null : index)}
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="relative w-14 h-18 shrink-0 rounded overflow-hidden bg-black/20">
                      <img
                        src={page.enhanced && page.enhancedDataUrl ? page.enhancedDataUrl : page.dataUrl}
                        alt={`Page ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Page {index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {page.enhanced ? 'Enhanced' : 'Original'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); movePage(index, 'up') }}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); movePage(index, 'down') }}
                        disabled={index === capturedPages.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={(e) => { e.stopPropagation(); removePage(page.id) }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Add more pages button */}
            <Button
              variant="outline"
              onClick={() => setStep('camera')}
              className="w-full glass-card-hover border-glass-border min-h-[48px]"
            >
              <Plus className="h-4 w-4 mr-2" />Add More Pages
            </Button>
          </>
        )}
      </div>

      {/* Bottom actions */}
      {capturedPages.length > 0 && (
        <div className="p-4 glass-card rounded-none border-0 border-t border-glass-border space-y-3 safe-bottom">
          <Button
            onClick={handleSaveAsPdf}
            disabled={generating}
            className="w-full bg-electric hover:bg-electric/90 text-electric-foreground min-h-[48px] electric-glow"
          >
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {generating ? 'Creating PDF...' : 'Save as PDF'}
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleShare}
              disabled={generating}
              className="flex-1 glass-card-hover border-glass-border min-h-[48px]"
            >
              <Share2 className="h-4 w-4 mr-2" />Share
            </Button>
            <Button
              variant="outline"
              onClick={handleExitCamera}
              className="flex-1 glass-card-hover border-glass-border min-h-[48px]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )

// ────────────────────────────────────────────────────────────────────────────
// RENDER: ID Card review — both sides, correct order, retake either side
// ────────────────────────────────────────────────────────────────────────────

const renderIdReviewStep = () => (
    <div className="flex flex-col h-[100dvh] bg-mesh">
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border safe-top">
        <Button variant="ghost" size="icon" onClick={() => setStep('camera')} className="text-foreground hover:bg-white/10 min-h-[44px] min-w-[44px]" aria-label="Back to camera">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <IdCard className="h-5 w-5 text-electric" />
        <h2 className="text-lg font-semibold gradient-text">Review ID Card</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        <div className="grid grid-cols-2 gap-3">
          {([
            { side: 'front' as const, label: 'Front', value: idFront },
            { side: 'back' as const, label: 'Back', value: idBack },
          ]).map((item) => (
            <div key={item.side} className="glass-card p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </span>
                {item.value ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                )}
              </div>

              <div className="aspect-[1.586/1] w-full overflow-hidden rounded-lg bg-black/30 border border-glass-border flex items-center justify-center">
                {item.value ? (
                  <img src={item.value} alt={`${item.label} side`} className="w-full h-full object-contain" />
                ) : (
                  <p className="text-[10px] text-muted-foreground px-2 text-center">
                    {item.label} side not captured
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  if (item.side === 'front') {
                    setIdFront(null)
                    setIdBack(null)
                    setIdStep('front')
                  } else {
                    setIdBack(null)
                    setIdStep('back')
                  }
                  setStep('camera')
                }}
                className="w-full h-9 text-xs border-glass-border"
              >
                <RefreshCw className="h-3 w-3 mr-1" />Retake {item.label}
              </Button>
            </div>
          ))}
        </div>

        <div className="glass-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Both sides are placed on a single landscape page — front on the left, back on the right.
          </p>
          <div className="flex gap-2">
            {(Object.keys(ID_CARD_PAGE_SIZES) as IdCardPageSize[]).map((k) => (
              <button
                key={k}
                onClick={() => setIdPageSize(k)}
                aria-pressed={idPageSize === k}
                className={`flex-1 h-9 rounded-lg text-xs font-medium transition-colors ${
                  idPageSize === k
                    ? 'bg-electric text-electric-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {ID_CARD_PAGE_SIZES[k].label}
              </button>
            ))}
          </div>
        </div>

        {(!idFront || !idBack) && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">
              Both sides are required. Retake the missing side before creating the PDF.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 glass-card rounded-none border-0 border-t border-glass-border space-y-3 safe-bottom">
        <Button
          onClick={handleCreateIdPdf}
          disabled={generating || !idFront || !idBack}
          className="w-full bg-electric hover:bg-electric/90 text-electric-foreground min-h-[48px]"
        >
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          {generating ? 'Creating PDF...' : 'Create PDF'}
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => { setIdFront(null); setIdBack(null); setIdStep('front'); setStep('camera') }}
            className="flex-1 glass-card-hover border-glass-border min-h-[48px]"
          >
            <X className="h-4 w-4 mr-2" />Start Over
          </Button>
        </div>
      </div>
    </div>
  )

// ────────────────────────────────────────────────────────────────────────────
// RENDER: ID Card success screen (only shown after a real 1-page file exists)
// ────────────────────────────────────────────────────────────────────────────

const renderIdDoneStep = () => (
    <div className="flex flex-col h-[100dvh] bg-mesh">
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border safe-top">
        <Button variant="ghost" size="icon" onClick={handleExitCamera} className="text-foreground hover:bg-white/10 min-h-[44px] min-w-[44px]" aria-label="Done">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Check className="h-5 w-5 text-emerald-400" />
        <h2 className="text-lg font-semibold gradient-text">ID Card Saved</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        <div className="glass-card p-6 text-center space-y-4 border-emerald-500/20">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-400">
            <Check className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">One-page ID card PDF created</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Front and back are on a single page
            </p>
            <p className="text-xs font-semibold font-mono text-electric mt-2 truncate px-4">
              {idResult?.name}
            </p>
          </div>
          {idResult?.preview && (
            <div className="rounded-xl overflow-hidden border border-glass-border max-w-[240px] mx-auto bg-slate-900 p-1">
              <img src={idResult.preview} alt="ID card front" className="w-full h-auto object-contain rounded-lg" />
            </div>
          )}
        </div>
      </div>

      <div className="p-4 glass-card rounded-none border-0 border-t border-glass-border space-y-3 safe-bottom">
        <Button onClick={handleIdSave} disabled={generating} className="w-full bg-electric hover:bg-electric/90 text-electric-foreground min-h-[48px]">
          <Download className="h-4 w-4 mr-2" />Save to Device
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleIdOpen} className="flex-1 glass-card-hover border-glass-border min-h-[48px]">
            <ExternalLink className="h-4 w-4 mr-2" />Open
          </Button>
          <Button variant="outline" onClick={handleIdShare} className="flex-1 glass-card-hover border-glass-border min-h-[48px]">
            <Share2 className="h-4 w-4 mr-2" />Share
          </Button>
        </div>
      </div>
    </div>
  )

// ────────────────────────────────────────────────────────────────────────────
// RENDER: Main
// ────────────────────────────────────────────────────────────────────────────

return (
    <>
      {step === 'camera' && renderCameraStep()}
      {step !== 'camera' && (
        // Full-screen overlay so the app shell (header + bottom nav) cannot sit
        // on top of the scanner's own controls and safe-area padding.
        <div className="fixed inset-0 z-[90] bg-background overflow-hidden">
          {step === 'preview' && renderPreviewStep()}
          {step === 'pages' && renderPagesStep()}
          {step === 'id-review' && renderIdReviewStep()}
          {step === 'id-done' && renderIdDoneStep()}
        </div>
      )}
    </>
  )
}
