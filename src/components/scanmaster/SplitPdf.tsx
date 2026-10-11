'use client'

import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Scissors, Upload, Download, X, FileText, Loader2, FileArchive } from 'lucide-react'
import { ToolIcon } from './ToolCards'
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SplitPdf() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [file, setFile] = useState<File | null>(null)
  const [pageRanges, setPageRanges] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') {
      toast.error('Please select a PDF file')
      return
    }
    setFile(f)
    setResultBlob(null)
  }, [])

  const handleSplit = useCallback(async () => {
    if (loading) return
    if (!file) {
      toast.error('Please select a PDF file first')
      return
    }
    if (!pageRanges.trim()) {
      toast.error('Please enter page ranges (e.g., 1-3, 5, 7-9)')
      return
    }
    setLoading(true)
    try {
      const base64 = await fileToBase64(file)
      const response = await fetchWithTimeout('/api/pdf/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: base64, pageRanges }),
      }, 15000)
      const blob = await response.blob()
      setResultBlob(blob)
      addFile({
        id: crypto.randomUUID(),
        name: `split_${file.name.replace('.pdf', '')}.zip`,
        type: 'zip',
        size: blob.size,
        createdAt: new Date(),
        category: ['recent'],
        favorite: false,
      })
      toast.success('PDF split successfully!')
      // Show interstitial ad after successful split
      showAdAfterSuccess()
    } catch {
      toast.error('Failed to split PDF. Check your page ranges.')
    } finally {
      setLoading(false)
    }
  }, [file, pageRanges, addFile, showAdAfterSuccess])

  const handleDownload = useCallback(() => {
    if (!resultBlob || !file) return
    downloadFile(resultBlob, `split_${file.name.replace('.pdf', '')}.zip`)
    // Show interstitial ad after successful download
    showAdAfterSuccess()
  }, [resultBlob, file, showAdAfterSuccess])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <ToolIcon toolId="split-pdf" size="sm" />
      <h2 className="text-lg font-semibold gradient-text">Split PDF</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-card-hover p-8 flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed transition-colors ${
            dragOver ? 'border-primary bg-primary/10' : 'border-glass-border'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 flex items-center justify-center">
            <Upload className="h-7 w-7 text-yellow-400" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Select PDF to split
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            className="hidden"
          />
        </motion.div>

        {/* Selected File */}
        {file && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/15 flex items-center justify-center">
              <FileText className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
            </div>
            <button onClick={() => { setFile(null); setResultBlob(null) }} className="p-1.5 rounded-lg hover:bg-white/5">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </motion.div>
        )}

        {/* Page Range Input */}
        {file && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Page Range</span>
            </div>
            <input
              type="text"
              value={pageRanges}
              onChange={(e) => setPageRanges(e.target.value)}
              placeholder="e.g., 1-3, 5, 7-9"
              className="w-full glass-input px-4 py-2.5 text-sm rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">
              Separate ranges with commas. Each range creates a separate PDF file.
            </p>
          </motion.div>
        )}

        {/* Result */}
        {resultBlob && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
            <p className="text-sm font-semibold text-green-400">Split Complete!</p>
            <div className="flex items-center gap-3">
              <FileArchive className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-sm font-medium">split_pages.zip</p>
                <p className="text-xs text-muted-foreground">{formatSize(resultBlob.size)}</p>
              </div>
            </div>
            <Button onClick={handleDownload} className="w-full" size="sm">
              <Download className="h-3 w-3 mr-1" /> Download ZIP
            </Button>
          </motion.div>
        )}

        {/* Split Button */}
        <Button
          onClick={handleSplit}
          disabled={loading || !file || !pageRanges.trim()}
          className="w-full electric-glow bg-primary hover:bg-primary/90 text-primary-foreground h-11"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Scissors className="h-4 w-4 mr-2" />}
          Split PDF
        </Button>
      </div>
    </div>
  )
}
