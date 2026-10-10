'use client'

import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  ImageIcon,
  Upload,
  Download,
  Share2,
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Loader2,
  Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

interface ImageItem {
  id: string
  file: File
  preview: string
  name: string
  size: number
}

export default function ImageToPdf() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [images, setImages] = useState<ImageItem[]>([])
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addImages = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles = fileArray.filter((f) => f.type.startsWith('image/'))
    if (validFiles.length === 0) {
      toast.error('Please select image files (JPG, PNG, WEBP)')
      return
    }
    const newImages: ImageItem[] = validFiles.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
      name: f.name,
      size: f.size,
    }))
    setImages((prev) => [...prev, ...newImages])
    toast.success(`${newImages.length} image(s) added`)
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id)
      if (img) URL.revokeObjectURL(img.preview)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const moveImage = useCallback((index: number, direction: 'up' | 'down') => {
    setImages((prev) => {
      const next = [...prev]
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= next.length) return prev
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
  }, [])

  const handleConvert = useCallback(async () => {
    if (loading) return
    if (images.length === 0) {
      toast.error('Please add at least one image')
      return
    }
    setLoading(true)
    try {
      const base64Images = await Promise.all(images.map((img) => fileToBase64(img.file)))
      const response = await fetchWithTimeout('/api/pdf/image-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: base64Images, quality }),
      }, 15000)
      // fetchWithTimeout throws on !ok
      const blob = await response.blob()
      downloadFile(blob, 'images.pdf')
      addFile({
        id: crypto.randomUUID(),
        name: 'images.pdf',
        type: 'pdf',
        size: blob.size,
        createdAt: new Date(),
        category: ['recent'],
        favorite: false,
      })
      toast.success('PDF created and downloaded!')
      // Show interstitial ad after successful download
      showAdAfterSuccess()
    } catch {
      toast.error('Failed to create PDF from images')
    } finally {
      setLoading(false)
    }
  }, [images, quality, addFile, showAdAfterSuccess])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ScanMaster Image to PDF', text: `${images.length} images ready for PDF conversion` })
      } catch { /* cancelled */ }
    }
  }, [images])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <ImageIcon className="h-5 w-5 text-orange-400" />
        <h2 className="text-lg font-semibold gradient-text">Image to PDF</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) addImages(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-card-hover p-8 flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed transition-colors ${
            dragOver ? 'border-primary bg-primary/10' : 'border-glass-border'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Upload className="h-7 w-7 text-orange-400" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Drag & drop images or <span className="text-primary font-medium">tap to browse</span>
          </p>
          <p className="text-xs text-muted-foreground">Supports JPG, PNG, WEBP</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && addImages(e.target.files)}
            className="hidden"
          />
        </motion.div>

        {/* Quality Selector */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Image Quality</Label>
          <div className="flex gap-2">
            {(['high', 'medium', 'low'] as const).map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  quality === q
                    ? 'bg-primary text-primary-foreground electric-glow-sm'
                    : 'glass-input text-foreground hover:border-primary/30'
                }`}
              >
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Image Grid */}
        {images.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{images.length} image(s) selected</Label>
            <AnimatePresence>
              {images.map((img, index) => (
                <motion.div
                  key={img.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="glass-card p-3 flex items-center gap-3"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <img src={img.preview} alt={img.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{img.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(img.size)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveImage(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => moveImage(index, 'down')}
                      disabled={index === images.length - 1}
                      className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => removeImage(img.id)}
                      className="p-1 rounded hover:bg-white/5"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Action Buttons */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3 pb-4">
          <Button
            onClick={handleShare}
            variant="outline"
            disabled={images.length === 0}
            className="w-full glass-card-hover border-glass-border"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button
            onClick={handleConvert}
            disabled={loading || images.length === 0}
            className="w-full electric-glow bg-primary hover:bg-primary/90 text-primary-foreground h-11"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Convert to PDF
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
