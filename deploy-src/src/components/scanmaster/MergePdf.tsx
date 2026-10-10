'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Merge,
  Upload,
  Download,
  Share2,
  X,
  ChevronUp,
  ChevronDown,
  FileText,
  Loader2,
  GripVertical,
  Eye,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'
import { downloadFile, shareFile, openFile, pickMultiplePdfs } from '@/lib/capacitor-fs'

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
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null)

  const addPdf = useCallback((files: File[]) => {
    const validFiles = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
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
    setMergedBlob(null)
    toast.success(`${newPdfs.length} PDF(s) added`)
  }, [])

  const handlePickerTrigger = useCallback(async () => {
    try {
      const picked = await pickMultiplePdfs()
      if (picked && picked.length > 0) {
        addPdf(picked)
      }
    } catch (err) {
      console.error(err)
    }
  }, [addPdf])

  const removePdf = useCallback((id: string) => {
    setPdfs((prev) => prev.filter((p) => p.id !== id))
    setMergedBlob(null)
  }, [])

  const movePdf = useCallback((index: number, direction: 'up' | 'down') => {
    setPdfs((prev) => {
      const next = [...prev]
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= next.length) return prev
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
    setMergedBlob(null)
  }, [])

  const handleMerge = useCallback(async () => {
    if (loading) return
    if (pdfs.length < 2) {
      toast.error('Please select at least 2 PDF files.')
      return
    }
    setLoading(true)
    try {
      // Local client-side merge using pdf-lib (Offline / Robust / Independent of APIs)
      const { PDFDocument } = await import('pdf-lib')
      const mergedPdf = await PDFDocument.create()
      
      for (const item of pdfs) {
        const buffer = await item.file.arrayBuffer()
        const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true })
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        copiedPages.forEach((page) => mergedPdf.addPage(page))
      }
      
      const mergedBytes = await mergedPdf.save()
      const blob = new Blob([mergedBytes], { type: 'application/pdf' })
      setMergedBlob(blob)
      
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
        toast.success('PDFs merged successfully!')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      console.error('Merge error:', err)
      toast.error('Failed to merge PDFs')
    } finally {
      setLoading(false)
    }
  }, [pdfs, outputName, addFile, showAdAfterSuccess, loading])

  const handleDownload = useCallback(async () => {
    if (!mergedBlob) return
    const filename = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`
    try {
      await downloadFile(mergedBlob, filename)
      toast.success('Saved to Documents successfully!')
      showAdAfterSuccess()
    } catch {
      toast.error('Failed to save file')
    }
  }, [mergedBlob, outputName, showAdAfterSuccess])

  const handleShare = useCallback(async () => {
    if (!mergedBlob) return
    const filename = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`
    try {
      await shareFile(mergedBlob, filename)
    } catch (err: any) {
      if (err.message && !err.message.includes('not supported')) {
        toast.error('Failed to share PDF')
      }
    }
  }, [mergedBlob, outputName])

  const handleOpen = useCallback(async () => {
    if (!mergedBlob) return
    const filename = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`
    try {
      await openFile(mergedBlob, filename)
    } catch {
      toast.error('Failed to open PDF')
    }
  }, [mergedBlob, outputName])

  const totalSize = pdfs.reduce((acc, p) => acc + p.size, 0)

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Merge className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-semibold gradient-text">Merge PDF</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) addPdf(Array.from(e.dataTransfer.files)) }}
          onClick={handlePickerTrigger}
          className={`glass-card-hover p-6 flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed transition-colors ${
            dragOver ? 'border-primary bg-primary/10' : 'border-glass-border'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
            <Upload className="h-7 w-7 text-cyan-400" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Drag & drop PDFs or <span className="text-primary font-medium">tap to select PDF files</span>
          </p>
        </motion.div>

        {/* PDF List */}
        {pdfs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{pdfs.length} file(s) · {formatSize(totalSize)}</Label>
              <Button variant="ghost" size="sm" onClick={() => { setPdfs([]); setMergedBlob(null) }} className="text-xs text-destructive hover:bg-transparent">
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
              className="w-full glass-input px-4 py-2.5 text-sm rounded-xl border-0"
              placeholder="merged.pdf"
            />
          </motion.div>
        )}

        {/* Results view */}
        {mergedBlob && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
            <p className="text-sm font-semibold text-green-400">PDFs Merged Successfully!</p>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-cyan-400" />
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">{outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`}</p>
                <p className="text-xs text-muted-foreground">{formatSize(mergedBlob.size)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownload} className="flex-1 text-xs font-semibold h-9" size="sm">
                <Download className="h-3 w-3 mr-1" /> Save File
              </Button>
              <Button onClick={handleOpen} className="flex-1 text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white h-9" size="sm">
                <Eye className="h-3 w-3 mr-1" /> Open
              </Button>
              <Button onClick={handleShare} variant="outline" size="sm" className="flex-1 text-xs glass-card-hover border-glass-border h-9">
                <Share2 className="h-3 w-3 mr-1" /> Share
              </Button>
            </div>
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
