'use client'

import { useState, useCallback } from 'react'
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
  Eye,
  FileText,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'
import { downloadFile, shareFile, openFile, pickImages } from '@/lib/capacitor-fs'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [outputName, setOutputName] = useState('images.pdf')

  const addImages = useCallback((files: File[]) => {
    const validFiles = files.filter((f) => f.type.startsWith('image/') || f.name.toLowerCase().match(/\.(jpe?g|png|webp)$/))
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
    setPdfBlob(null)
    toast.success(`${newImages.length} image(s) added`)
  }, [])

  const handlePickerTrigger = useCallback(async () => {
    try {
      const picked = await pickImages()
      if (picked && picked.length > 0) {
        addImages(picked)
      }
    } catch (err) {
      console.error(err)
    }
  }, [addImages])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id)
      if (img) URL.revokeObjectURL(img.preview)
      return prev.filter((i) => i.id !== id)
    })
    setPdfBlob(null)
  }, [])

  const moveImage = useCallback((index: number, direction: 'up' | 'down') => {
    setImages((prev) => {
      const next = [...prev]
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= next.length) return prev
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
    setPdfBlob(null)
  }, [])

  const handleConvert = useCallback(async () => {
    if (loading) return
    if (images.length === 0) {
      toast.error('Please add at least one image')
      return
    }
    setLoading(true)
    try {
      // Local client-side PDF generation using jsPDF (Offline / Reliable / Avoid API routes)
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < images.length; i++) {
        const imgItem = images[i]
        
        if (i > 0) {
          pdf.addPage()
        }

        // Read image file to data URL
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(imgItem.file)
        })

        // Determine image dimensions and calculate fit
        const imgAspect = await new Promise<number>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(img.width / img.height)
          img.onerror = () => resolve(pageWidth / pageHeight)
          img.src = dataUrl
        })

        let destW = pageWidth
        let destH = pageWidth / imgAspect

        if (destH > pageHeight) {
          destH = pageHeight
          destW = pageHeight * imgAspect
        }

        const x = (pageWidth - destW) / 2
        const y = (pageHeight - destH) / 2

        const format = imgItem.file.type === 'image/png' ? 'PNG' : 'JPEG'
        pdf.addImage(
          dataUrl,
          format,
          x,
          y,
          destW,
          destH,
          undefined,
          quality === 'high' ? 'FAST' : quality === 'medium' ? 'MEDIUM' : 'SLOW'
        )
      }

      const blob = pdf.output('blob')
      setPdfBlob(blob)

      const filename = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`
      
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        addFile({
          id: crypto.randomUUID(),
          name: filename,
          type: 'pdf',
          size: blob.size,
          createdAt: new Date(),
          category: ['recent'],
          favorite: false,
          dataUrl: dataUrl,
        })
        toast.success('PDF created successfully!')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      console.error('Conversion failed:', err)
      toast.error('Failed to convert images to PDF')
    } finally {
      setLoading(false)
    }
  }, [images, quality, outputName, addFile, showAdAfterSuccess, loading])

  const handleDownload = useCallback(async () => {
    if (!pdfBlob) return
    const filename = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`
    try {
      await downloadFile(pdfBlob, filename)
      toast.success('Saved to Documents successfully!')
      showAdAfterSuccess()
    } catch {
      toast.error('Failed to save PDF')
    }
  }, [pdfBlob, outputName, showAdAfterSuccess])

  const handleShare = useCallback(async () => {
    if (!pdfBlob) return
    const filename = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`
    try {
      await shareFile(pdfBlob, filename)
    } catch (err: any) {
      if (err.message && !err.message.includes('not supported')) {
        toast.error('Failed to share PDF')
      }
    }
  }, [pdfBlob, outputName])

  const handleOpen = useCallback(async () => {
    if (!pdfBlob) return
    const filename = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`
    try {
      await openFile(pdfBlob, filename)
    } catch {
      toast.error('Failed to open PDF')
    }
  }, [pdfBlob, outputName])

  return (
    <div className="flex flex-col h-full bg-mesh">
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
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) addImages(Array.from(e.dataTransfer.files)) }}
          onClick={handlePickerTrigger}
          className={`glass-card-hover p-8 flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed transition-colors ${
            dragOver ? 'border-primary bg-primary/10' : 'border-glass-border'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Upload className="h-7 w-7 text-orange-400" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Drag & drop images or <span className="text-primary font-medium">tap to select images</span>
          </p>
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
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{images.length} image(s) selected</Label>
              <Button variant="ghost" size="sm" onClick={() => { setImages([]); setPdfBlob(null) }} className="text-xs text-destructive hover:bg-transparent">
                Clear All
              </Button>
            </div>
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
                  <img src={img.preview} alt={img.name} className="h-12 w-12 rounded-lg object-cover shrink-0 bg-white/5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{img.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(img.file.size)}</p>
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

        {/* Output Filename */}
        {images.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <Label className="text-xs text-muted-foreground">Output Filename</Label>
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              className="w-full glass-input px-4 py-2.5 text-sm rounded-xl border-0"
              placeholder="images.pdf"
            />
          </motion.div>
        )}

        {/* Action Results */}
        {pdfBlob && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
            <p className="text-sm font-semibold text-green-400">PDF Created Successfully!</p>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-orange-400" />
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">{outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`}</p>
                <p className="text-xs text-muted-foreground">{formatSize(pdfBlob.size)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownload} className="flex-1 text-xs h-9" size="sm">
                <Download className="h-3 w-3 mr-1" /> Save File
              </Button>
              <Button onClick={handleOpen} className="flex-1 text-xs bg-orange-600 hover:bg-orange-700 text-white h-9" size="sm">
                <Eye className="h-3 w-3 mr-1" /> Open
              </Button>
              <Button onClick={handleShare} variant="outline" size="sm" className="flex-1 text-xs glass-card-hover border-glass-border h-9">
                <Share2 className="h-3 w-3 mr-1" /> Share
              </Button>
            </div>
          </motion.div>
        )}

        {/* Convert Button */}
        <Button
          onClick={handleConvert}
          disabled={loading || images.length === 0}
          className="w-full electric-glow bg-primary hover:bg-primary/90 text-primary-foreground h-11"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <ImageIcon className="h-4 w-4 mr-2" />
          )}
          Convert {images.length} Image(s) to PDF
        </Button>
      </div>
    </div>
  )
}
