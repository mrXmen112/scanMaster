'use client'

import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Merge, Upload, Download, X, ChevronUp, ChevronDown, FileText, Loader2, GripVertical } from 'lucide-react'
import { ToolIcon } from './ToolCards'
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface PdfItem {
  id: string
  file: File
  name: string
  size: number
}

export default function MergePdf() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [pdfs, setPdfs] = useState<PdfItem[]>([])
  const [outputName, setOutputName] = useState('merged.pdf')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addPdf = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles = fileArray.filter((f) => f.type === 'application/pdf')
    if (validFiles.length === 0) {
      toast.error('Please select PDF files')
      return
    }
    const newPdfs: PdfItem[] = validFiles.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
    }))
    setPdfs((prev) => [...prev, ...newPdfs])
    toast.success(`${newPdfs.length} PDF(s) added`)
  }, [])

  const removePdf = useCallback((id: string) => {
    setPdfs((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const movePdf = useCallback((index: number, direction: 'up' | 'down') => {
    setPdfs((prev) => {
      const next = [...prev]
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= next.length) return prev
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
  }, [])

  const handleMerge = useCallback(async () => {
    if (loading) return
    if (pdfs.length < 2) {
      toast.error('Please add at least 2 PDFs to merge')
      return
    }
    setLoading(true)
    try {
      const base64Pdfs = await Promise.all(pdfs.map((p) => fileToBase64(p.file)))
      const response = await fetchWithTimeout('/api/pdf/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfs: base64Pdfs }),
      }, 15000)
      const blob = await response.blob()
      downloadFile(blob, outputName)
      addFile({
        id: crypto.randomUUID(),
        name: outputName,
        type: 'pdf',
        size: blob.size,
        createdAt: new Date(),
        category: ['recent'],
        favorite: false,
      })
      toast.success('PDFs merged successfully!')
      // Show interstitial ad after successful merge
      showAdAfterSuccess()
    } catch {
      toast.error('Failed to merge PDFs')
    } finally {
      setLoading(false)
    }
  }, [pdfs, outputName, addFile, showAdAfterSuccess])

  const totalSize = pdfs.reduce((acc, p) => acc + p.size, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <ToolIcon toolId="merge-pdf" size="sm" />
      <h2 className="text-lg font-semibold gradient-text">Merge PDF</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) addPdf(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-card-hover p-6 flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed transition-colors ${
            dragOver ? 'border-primary bg-primary/10' : 'border-glass-border'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
            <Upload className="h-7 w-7 text-cyan-400" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Add PDF files to merge
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => e.target.files && addPdf(e.target.files)}
            className="hidden"
          />
        </motion.div>

        {/* PDF List */}
        {pdfs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{pdfs.length} file(s) Ã‚Â· {formatSize(totalSize)}</Label>
              <Button variant="ghost" size="sm" onClick={() => setPdfs([])} className="text-xs text-destructive">
                Clear All
              </Button>
            </div>
            <AnimatePresence>
              {pdfs.map((pdf, index) => (
                <motion.div
                  key={pdf.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="glass-card p-3 flex items-center gap-3"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {index + 1}
                  </span>
                  <FileText className="h-5 w-5 text-cyan-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pdf.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(pdf.size)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => movePdf(index, 'up')} disabled={index === 0} className="p-1 rounded hover:bg-white/5 disabled:opacity-30">
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => movePdf(index, 'down')} disabled={index === pdfs.length - 1} className="p-1 rounded hover:bg-white/5 disabled:opacity-30">
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => removePdf(pdf.id)} className="p-1 rounded hover:bg-white/5">
                      <X className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Output Name */}
        {pdfs.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <Label className="text-xs text-muted-foreground">Output Filename</Label>
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              className="w-full glass-input px-4 py-2.5 text-sm rounded-xl"
              placeholder="merged.pdf"
            />
          </motion.div>
        )}

        {/* Merge Button */}
        <Button
          onClick={handleMerge}
          disabled={loading || pdfs.length < 2}
          className="w-full electric-glow bg-primary hover:bg-primary/90 text-primary-foreground h-11"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Merge className="h-4 w-4 mr-2" />}
          Merge {pdfs.length} PDFs
        </Button>
      </div>
    </div>
  )
}
