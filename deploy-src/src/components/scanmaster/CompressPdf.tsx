'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Minimize2,
  Upload,
  Download,
  Share2,
  X,
  Loader2,
  FileText,
  Gauge,
  Eye,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'
import { downloadFile, shareFile, openFile, pickSinglePdf } from '@/lib/capacitor-fs'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const compressionLevels = [
  { id: 'low', label: 'Low', description: 'Best quality', color: 'bg-green-500/20 text-green-400 border-green-500/30', indicator: 'bg-green-400' },
  { id: 'medium', label: 'Medium', description: 'Balanced', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', indicator: 'bg-yellow-400' },
  { id: 'high', label: 'High', description: 'Smallest size', color: 'bg-red-500/20 text-red-400 border-red-500/30', indicator: 'bg-red-400' },
] as const

export default function CompressPdf() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [file, setFile] = useState<File | null>(null)
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [targetSize, setTargetSize] = useState('')
  const [loading, setLoading] = useState(false)
  const [compressedResult, setCompressedResult] = useState<{ blob: Blob; originalSize: number; compressedSize: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file')
      return
    }
    setFile(f)
    setCompressedResult(null)
  }, [])

  const handlePickerTrigger = useCallback(async () => {
    try {
      const picked = await pickSinglePdf()
      if (picked) handleFile(picked)
    } catch (err) {
      console.error('File picker error:', err)
    }
  }, [handleFile])

  const handleCompress = useCallback(async () => {
    if (loading) return
    if (!file) {
      toast.error('Please select a PDF file first')
      return
    }
    setLoading(true)
    try {
      // Load and optimize PDF client-side using pdf-lib (Offline / Independent of /api routes)
      const arrayBuffer = await file.arrayBuffer()
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      
      // Strip metadata depending on compression level
      if (quality === 'medium' || quality === 'high') {
        pdfDoc.setTitle('')
        pdfDoc.setAuthor('')
        pdfDoc.setSubject('')
        pdfDoc.setKeywords([])
        pdfDoc.setProducer('')
        pdfDoc.setCreator('')
      }
      if (quality === 'high') {
        pdfDoc.setCreationDate(new Date(0))
        pdfDoc.setModificationDate(new Date(0))
      }
      
      // Re-save applying stream compression
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true })
      
      // Keep smaller copy
      const finalBytes = compressedBytes.length < arrayBuffer.byteLength ? compressedBytes : new Uint8Array(arrayBuffer)
      const blob = new Blob([finalBytes], { type: 'application/pdf' })
      
      setCompressedResult({ blob, originalSize: file.size, compressedSize: blob.size })
      
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        addFile({
          id: crypto.randomUUID(),
          name: `compressed_${file.name}`,
          type: 'pdf',
          size: blob.size,
          createdAt: new Date(),
          category: ['recent'],
          favorite: false,
          dataUrl: dataUrl,
        })
        toast.success('PDF compressed successfully!')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      console.error('Compression failed:', err)
      toast.error('Failed to compress PDF')
    } finally {
      setLoading(false)
    }
  }, [file, quality, addFile, showAdAfterSuccess])

  const handleDownload = useCallback(async () => {
    if (!compressedResult || !file) return
    try {
      await downloadFile(compressedResult.blob, `compressed_${file.name}`)
      toast.success('Saved to Documents successfully!')
      showAdAfterSuccess()
    } catch {
      toast.error('Failed to download/save PDF')
    }
  }, [compressedResult, file, showAdAfterSuccess])

  const handleShare = useCallback(async () => {
    if (!compressedResult || !file) return
    try {
      await shareFile(compressedResult.blob, `compressed_${file.name}`)
    } catch (err: any) {
      if (err.message && !err.message.includes('not supported')) {
        toast.error('Failed to share PDF')
      }
    }
  }, [compressedResult, file])

  const handleOpen = useCallback(async () => {
    if (!compressedResult || !file) return
    try {
      await openFile(compressedResult.blob, `compressed_${file.name}`)
    } catch {
      toast.error('Failed to open PDF')
    }
  }, [compressedResult, file])

  const reduction = compressedResult
    ? Math.round(((compressedResult.originalSize - compressedResult.compressedSize) / compressedResult.originalSize) * 100)
    : 0

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Minimize2 className="h-5 w-5 text-red-400" />
        <h2 className="text-lg font-semibold gradient-text">Compress PDF</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={handlePickerTrigger}
          className={`glass-card-hover p-8 flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed transition-colors ${
            dragOver ? 'border-primary bg-primary/10' : 'border-glass-border'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <Upload className="h-7 w-7 text-red-400" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Drag & drop PDF or <span className="text-primary font-medium">tap to select PDF</span>
          </p>
        </motion.div>

        {/* Selected File */}
        {file && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">Original: {formatSize(file.size)}</p>
            </div>
            <button onClick={() => { setFile(null); setCompressedResult(null) }} className="p-1.5 rounded-lg hover:bg-white/5 shrink-0">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </motion.div>
        )}

        {/* Compression Level */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Compression Level</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {compressionLevels.map((level) => (
              <button
                key={level.id}
                onClick={() => setQuality(level.id)}
                className={`p-3 rounded-xl text-center transition-all border ${
                  quality === level.id
                    ? `${level.color} border-current electric-glow-sm`
                    : 'glass-input text-muted-foreground hover:border-primary/30'
                }`}
              >
                <div className={`w-3 h-3 rounded-full mx-auto mb-1.5 ${level.indicator}`} />
                <p className="text-xs font-semibold">{level.label}</p>
                <p className="text-[10px] opacity-70">{level.description}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Target Size */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 space-y-2">
          <Label className="text-xs text-muted-foreground">Custom Target Size (optional)</Label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={targetSize}
              onChange={(e) => setTargetSize(e.target.value)}
              placeholder="e.g., 1"
              className="flex-1 glass-input px-3 py-2 text-sm rounded-xl border-0"
            />
            <span className="text-sm text-muted-foreground">MB</span>
          </div>
        </motion.div>

        {/* Compression Result */}
        {compressedResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
            <p className="text-sm font-semibold text-green-400">Compression Complete!</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Original</p>
                <p className="text-sm font-semibold">{formatSize(compressedResult.originalSize)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Compressed</p>
                <p className="text-sm font-semibold text-green-400">{formatSize(compressedResult.compressedSize)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Saved</p>
                <p className="text-sm font-semibold text-primary">{reduction > 0 ? reduction : 0}%</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownload} className="flex-1 text-xs" size="sm">
                <Download className="h-3 w-3 mr-1" /> Save File
              </Button>
              <Button onClick={handleOpen} className="flex-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white" size="sm">
                <Eye className="h-3 w-3 mr-1" /> Open
              </Button>
              <Button onClick={handleShare} variant="outline" size="sm" className="flex-1 text-xs glass-card-hover border-glass-border">
                <Share2 className="h-3 w-3 mr-1" /> Share
              </Button>
            </div>
          </motion.div>
        )}

        {/* Compress Button */}
        <Button
          onClick={handleCompress}
          disabled={loading || !file}
          className="w-full electric-glow bg-primary hover:bg-primary/90 text-primary-foreground h-11"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Minimize2 className="h-4 w-4 mr-2" />}
          Compress PDF
        </Button>
      </div>
    </div>
  )
}
