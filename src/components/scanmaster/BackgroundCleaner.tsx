'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  ArrowLeft,
  Sparkles,
  FileImage,
  RefreshCw,
  Eye,
  CheckCircle,
  Loader2,
  Share2,
  Download
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { pickImages, downloadFile, shareFile } from '@/lib/capacitor-fs'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

type CleanMode = 'auto' | 'bw' | 'grayscale' | 'contrast' | 'light'

export default function BackgroundCleaner() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [cleanedImage, setCleanedImage] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<CleanMode>('auto')
  const [intensity, setIntensity] = useState(50) // slider range 0 - 100
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const handlePickFile = async () => {
    try {
      const picked = await pickImages()
      if (picked && picked.length > 0) {
        setFile(picked[0])
        setCleanedImage(null)
        setSuccess(false)
        setActiveMode('auto')
        setIntensity(50)
        
        const reader = new FileReader()
        reader.onload = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(picked[0])
      }
    } catch {
      toast.error('Failed to pick document.')
    }
  }

  // Pixel manipulation scan engine
  const processImage = useCallback(() => {
    if (!imagePreview) return
    setLoading(true)
    
    setTimeout(() => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setLoading(false)
          return
        }

        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imgData.data
        const len = pixels.length

        // Contrast scale calculations
        const factor = (259 * (intensity + 25)) / (255 * (259 - intensity))
        const thresholdVal = (intensity / 100) * 255

        for (let i = 0; i < len; i += 4) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          
          // Calculate grayscale
          const gray = 0.299 * r + 0.587 * g + 0.114 * b

          switch (activeMode) {
            case 'auto':
              // Auto Clean: flatten yellow/gray tint above 140, boost white, increase contrast of text below 140
              if (gray > 150) {
                pixels[i] = 255
                pixels[i + 1] = 255
                pixels[i + 2] = 255
              } else {
                // Boost contrast of text
                const nr = Math.min(255, Math.max(0, (r - 100) * 1.8 + 100))
                const ng = Math.min(255, Math.max(0, (g - 100) * 1.8 + 100))
                const nb = Math.min(255, Math.max(0, (b - 100) * 1.8 + 100))
                pixels[i] = nr
                pixels[i + 1] = ng
                pixels[i + 2] = nb
              }
              break

            case 'bw':
              // Black & White dynamic thresholding
              const val = gray > thresholdVal ? 255 : 0
              pixels[i] = val
              pixels[i + 1] = val
              pixels[i + 2] = val
              break

            case 'grayscale':
              // Smooth Grayscale
              pixels[i] = gray
              pixels[i + 1] = gray
              pixels[i + 2] = gray
              break

            case 'contrast':
              // High Contrast
              pixels[i] = Math.min(255, Math.max(0, (r - 128) * factor + 128))
              pixels[i + 1] = Math.min(255, Math.max(0, (g - 128) * factor + 128))
              pixels[i + 2] = Math.min(255, Math.max(0, (b - 128) * factor + 128))
              break

            case 'light':
              // Light Enhancement: brighten overall midtones and shadows
              const lightFactor = 1 + (intensity / 100) * 0.5
              pixels[i] = Math.min(255, r * lightFactor)
              pixels[i + 1] = Math.min(255, g * lightFactor)
              pixels[i + 2] = Math.min(255, b * lightFactor)
              break
          }
        }

        ctx.putImageData(imgData, 0, 0)
        setCleanedImage(canvas.toDataURL('image/jpeg', 0.95))
        setLoading(false)
      }
      img.src = imagePreview
    }, 150)
  }, [imagePreview, activeMode, intensity])

  useEffect(() => {
    if (imagePreview) {
      processImage()
    }
  }, [imagePreview, activeMode, intensity, processImage])

  const handleSaveFile = () => {
    if (!cleanedImage || !file) return
    
    // Save new file to App store
    const originalName = file.name.replace(/\.[^/.]+$/, "")
    const newName = `${originalName}_cleaned.jpg`

    addFile({
      id: crypto.randomUUID(),
      name: newName,
      type: 'image',
      size: Math.round(cleanedImage.length * 0.75),
      createdAt: new Date(),
      category: ['recent', 'scanned'],
      favorite: false,
      dataUrl: cleanedImage
    })

    setSuccess(true)
    toast.success('Document background cleaned successfully!')
    showAdAfterSuccess()
  }

  const handleDownload = async () => {
    if (!cleanedImage || !file) return
    try {
      const base64 = cleanedImage.split(',')[1]
      const raw = atob(base64)
      const length = raw.length
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        bytes[i] = raw.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' })
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      await downloadFile(blob, `${originalName}_cleaned.jpg`)
      toast.success('Enhanced scan downloaded successfully!')
    } catch {
      toast.error('Failed to download image.')
    }
  }

  const handleShare = async () => {
    if (!cleanedImage || !file) return
    try {
      const base64 = cleanedImage.split(',')[1]
      const raw = atob(base64)
      const length = raw.length
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        bytes[i] = raw.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' })
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      await shareFile(blob, `${originalName}_cleaned.jpg`, 'Share Cleaned Scan')
    } catch (err: any) {
      if (err.message && !err.message.includes('cancel')) {
        toast.error('Failed to share scan.')
      }
    }
  }

  const modes = [
    { id: 'auto' as const, label: 'Auto Clean' },
    { id: 'bw' as const, label: 'B & W' },
    { id: 'grayscale' as const, label: 'Grayscale' },
    { id: 'contrast' as const, label: 'High Contrast' },
    { id: 'light' as const, label: 'Brighten' }
  ]

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border shrink-0">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Sparkles className="h-5 w-5 text-teal-400 animate-pulse" />
        <h2 className="text-lg font-semibold gradient-text">Background Cleaner</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full safe-bottom">
        {/* Upload Zone */}
        {!file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-glass-border"
          >
            <div className="h-14 w-14 rounded-full bg-teal-500/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-teal-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Clean Document Scan Background</p>
              <p className="text-xs text-muted-foreground mt-1">Remove gray/yellow tint, enhance text contrast, and flatten shadows</p>
            </div>
            <Button onClick={handlePickFile} className="bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-1.5 h-10 px-6 text-xs rounded-xl">
              <FileImage className="h-4 w-4" /> Pick Document Image
            </Button>
          </motion.div>
        )}

        {/* Cleaner workarea */}
        {file && !success && (
          <div className="space-y-4">
            {/* Mode selection grid */}
            <div className="glass-card p-3 flex flex-wrap gap-2 justify-center">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMode(m.id)}
                  className={`text-xs font-medium py-1.5 px-3 rounded-lg border transition-all ${
                    activeMode === m.id
                      ? 'bg-teal-500/20 text-teal-400 border-teal-500/40 shadow-sm shadow-teal-500/15'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 text-muted-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Slider options */}
            {activeMode !== 'grayscale' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card p-4 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Filter Intensity</span>
                  <span className="text-teal-400 font-mono">{intensity}%</span>
                </div>
                <Slider
                  value={[intensity]}
                  min={10}
                  max={90}
                  step={2}
                  onValueChange={(val) => setIntensity(val[0])}
                  className="py-1"
                />
              </motion.div>
            )}

            {/* Main view panel */}
            <div className="relative w-full flex justify-center bg-slate-950/60 rounded-2xl p-4 border border-glass-border overflow-hidden min-h-[300px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
                  <p className="text-xs text-muted-foreground animate-pulse">Processing image...</p>
                </div>
              ) : (
                <div className="relative max-w-full rounded-lg overflow-hidden border border-glass-border shadow-2xl">
                  <img
                    src={showOriginal ? imagePreview! : cleanedImage || imagePreview!}
                    alt="Scan View"
                    className="max-h-[360px] w-auto object-contain pointer-events-none rounded-lg"
                  />

                  {/* Hold to see original */}
                  <button
                    onMouseDown={() => setShowOriginal(true)}
                    onMouseUp={() => setShowOriginal(false)}
                    onTouchStart={() => setShowOriginal(true)}
                    onTouchEnd={() => setShowOriginal(false)}
                    className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 border border-white/10 rounded-xl px-2.5 py-1 text-[10px] font-semibold text-white flex items-center gap-1 active:scale-95 select-none transition-all"
                  >
                    <Eye className="h-3 w-3" /> Press & Hold for Original
                  </button>
                </div>
              )}
            </div>

            {/* Bottom buttons */}
            <div className="flex gap-3">
              <Button onClick={handlePickFile} variant="outline" className="flex-1 border-glass-border h-11 text-xs rounded-xl">
                Upload New Image
              </Button>
              <Button
                onClick={handleSaveFile}
                disabled={loading || !cleanedImage}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-teal-600/20"
              >
                <CheckCircle className="h-4 w-4" /> Save Cleaned
              </Button>
            </div>
          </div>
        )}

        {/* Success block */}
        <AnimatePresence>
          {success && cleanedImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card p-6 text-center space-y-4 border-green-500/20"
            >
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto text-green-500">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Scan Enhanced!</h3>
                <p className="text-xs text-muted-foreground mt-1">Flat contrast background saved under app scanned category</p>
              </div>

              <div className="rounded-xl overflow-hidden border border-glass-border max-w-[200px] mx-auto shadow-lg bg-slate-900 p-1">
                <img src={cleanedImage} alt="Enhanced Scan" className="w-full h-auto object-contain rounded-lg" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="glass-card-hover border-glass-border text-xs rounded-xl h-10 flex items-center justify-center gap-1.5"
                >
                  <Download className="h-4 w-4 text-electric" /> Save to Device
                </Button>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="glass-card-hover border-glass-border text-xs rounded-xl h-10 flex items-center justify-center gap-1.5"
                >
                  <Share2 className="h-4 w-4 text-indigo-400" /> Share Scan
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setFile(null)
                  setImagePreview(null)
                  setCleanedImage(null)
                  setSuccess(false)
                }}
                className="text-xs text-muted-foreground w-full py-2 hover:bg-white/5"
              >
                Clean Another Document
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
