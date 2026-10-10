'use client'

import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Download,
  Share2,
  Upload,
  ScanText,
  Copy,
  Languages,
  FileText,
  Check,
  Eye,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function OcrTool() {
  const { goBack, setActiveView, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [loading, setLoading] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (f: File) => {
    const isValid = f.type.startsWith('image/') || f.type === 'application/pdf'
    if (!isValid) {
      toast.error('Please upload an image or PDF file')
      return
    }
    setFile(f)
    setExtractedText('')
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [handleFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) handleFile(selected)
  }, [handleFile])

  const handleExtract = useCallback(async () => {
    if (loading) return
    if (!file) {
      toast.error('Please upload a file first')
      return
    }
    setLoading(true)
    try {
      const base64 = await fileToBase64(file)
      const response = await fetchWithTimeout('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      }, 15000)
      const data: { text?: string; error?: string } = await response.json()
      setExtractedText(data.text || '')
      toast.success('Text extracted successfully!')
    } catch (err) {
      const errMsg = (err as Error)?.message || ''
      if (errMsg.includes('temporarily unavailable')) {
        toast.error('AI service is temporarily unavailable. Please try again shortly.')
      } else {
        toast.error('Failed to extract text')
      }
    } finally {
      setLoading(false)
    }
  }, [file])

  const handleCopy = useCallback(async () => {
    if (!extractedText) return
    try {
      await navigator.clipboard.writeText(extractedText)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }, [extractedText])

  const handleSaveAsPdf = useCallback(async () => {
    if (!extractedText || savingPdf) return
    setSavingPdf(true)
    try {
      const response = await fetchWithTimeout('/api/pdf/text-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'OCR Extract',
          text: extractedText,
          fontSize: 12,
          alignment: 'left',
          bold: false,
          italic: false,
          underline: false,
          pageSize: 'A4',
          margins: { top: 20, bottom: 20, left: 20, right: 20 },
        }),
      }, 10000)
      const blob = await response.blob()
      downloadFile(blob, 'ocr-extract.pdf')
      addFile({
        id: crypto.randomUUID(),
        name: 'ocr-extract.pdf',
        type: 'pdf',
        size: blob.size,
        createdAt: new Date(),
        category: ['recent'],
        favorite: false,
      })
      toast.success('Saved as PDF!')
      // Show interstitial ad after successful save/download
      showAdAfterSuccess()
    } catch {
      toast.error('Failed to save as PDF')
    } finally {
      setSavingPdf(false)
    }
  }, [extractedText, addFile, showAdAfterSuccess])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ScanMaster OCR', text: extractedText })
        // Show interstitial ad after successful share
        showAdAfterSuccess()
      } catch { /* cancelled */ }
    } else {
      toast.info('Share not supported on this browser')
    }
  }, [extractedText, showAdAfterSuccess])

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <ScanText className="h-5 w-5 text-electric" />
        <h2 className="text-lg font-semibold gradient-text">OCR - Extract Text</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-card-hover p-8 flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed transition-colors ${
            dragOver ? 'border-electric bg-electric/10' : 'border-glass-border'
          }`}
        >
          <div className="h-16 w-16 rounded-full bg-electric/20 flex items-center justify-center">
            <Upload className="h-8 w-8 text-electric" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Upload image or PDF to <span className="text-electric font-medium">extract text</span>
          </p>
          <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, PDF supported</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </motion.div>

        {/* File Preview */}
        {file && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Uploaded File</Label>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreview(null); setExtractedText('') }} className="text-destructive hover:text-destructive h-7">
                <X className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {preview ? (
                <img src={preview} alt="Preview" className="h-20 w-20 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-electric/20 flex items-center justify-center shrink-0">
                  <FileText className="h-8 w-8 text-electric" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </div>
            {preview && (
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => window.open(preview, '_blank')} className="glass-card-hover border-glass-border">
                  <Eye className="h-3 w-3 mr-1" /> View Full
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* Extract Button */}
        <Button
          onClick={handleExtract}
          disabled={loading || !file}
          className="w-full electric-glow bg-electric hover:bg-electric/90 text-electric-foreground h-11"
        >
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="h-5 w-5 border-2 border-current border-t-transparent rounded-full"
            />
          ) : (
            <>
              <ScanText className="h-4 w-4 mr-2" />
              Extract Text
            </>
          )}
        </Button>

        {/* Extracted Text */}
        {extractedText && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Extracted Text</Label>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1">
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
            <Textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              className="glass-input min-h-40 resize-y border-0"
            />
          </motion.div>
        )}

        {/* Action Buttons */}
        {extractedText && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setActiveView('translate')}
                variant="outline"
                className="glass-card-hover border-glass-border"
              >
                <Languages className="h-4 w-4 mr-2" />
                Translate
              </Button>
              <Button
                onClick={handleSaveAsPdf}
                disabled={savingPdf}
                variant="outline"
                className="glass-card-hover border-glass-border"
              >
                {savingPdf ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                  />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Save as PDF
              </Button>
            </div>
            <Button
              onClick={handleShare}
              variant="outline"
              className="w-full glass-card-hover border-glass-border"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
