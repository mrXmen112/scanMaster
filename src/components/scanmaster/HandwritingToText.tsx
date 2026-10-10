'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  FileText,
  FileImage,
  Copy,
  Check,
  CheckCircle,
  Loader2,
  Share2,
  Download,
  WifiOff,
  PenTool
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { pickImages, downloadFile, shareFile } from '@/lib/capacitor-fs'
import { generatePdfFromTextLocally } from '@/lib/pdf-generator'
import { buildApiUrl } from '@/lib/api-base-url'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

export default function HandwritingToText() {
  const { goBack, addFile } = useAppStore()
  const { user, accessToken } = useAuth()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [languageMode, setLanguageMode] = useState<'english' | 'hindi'>('english')
  const [transcribedText, setTranscribedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)

  const handlePickFile = async () => {
    try {
      const picked = await pickImages()
      if (picked && picked.length > 0) {
        setFile(picked[0])
        setTranscribedText('')
        setIsOfflineMode(false)
        
        const reader = new FileReader()
        reader.onload = () => setFilePreview(reader.result as string)
        reader.readAsDataURL(picked[0])
      }
    } catch {
      toast.error('Failed to pick document image.')
    }
  }

  const handleTranscribe = useCallback(async () => {
    if (!filePreview) return
    setLoading(true)
    setTranscribedText('')
    setIsOfflineMode(false)

    try {
      const secureUrl = buildApiUrl('/api/ai/handwriting')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      } else {
        if (typeof window !== 'undefined') {
          let devId = localStorage.getItem('scanmaster_device_id')
          if (!devId) {
            devId = crypto.randomUUID()
            localStorage.setItem('scanmaster_device_id', devId)
          }
          headers['x-device-id'] = devId
        }
      }

      const response = await fetchWithTimeout(secureUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image: filePreview,
          languageMode
        })
      }, 30000)

      if (!response.ok) {
        throw new Error('API server transcription failed.')
      }

      const data = await response.json()
      setTranscribedText(data.text)
      toast.success('Handwriting successfully transcribed!')
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.warn('Backend API handwriting transcription failed:', err)
      setIsOfflineMode(true)
      
      // Standalone Fallback: Show warning and let the user manually copy, type, or edit
      setTranscribedText(
        `[Offline Fallback - Reason: ${errMsg}]\n\n` +
        'Transcription service is offline. Handwritings cannot be scanned in offline mode.\n\n' +
        'Please enter or paste your notes here to edit, save, or share them locally.'
      )
      toast.error(`AI transcription failed (${errMsg}). Using offline text editor fallback.`)
    } finally {
      setLoading(false)
    }
  }, [filePreview, languageMode])

  const handleCopy = async () => {
    if (!transcribedText) return
    try {
      await navigator.clipboard.writeText(transcribedText)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy text.')
    }
  }

  const handleSaveAsTxt = async () => {
    if (!transcribedText || !file) return
    try {
      const blob = new Blob([transcribedText], { type: 'text/plain' })
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      await downloadFile(blob, `${originalName}_handwritten.txt`)
      toast.success('TXT file saved successfully!')
    } catch {
      toast.error('Failed to save file.')
    }
  }

  const handleSaveAsPdf = async () => {
    if (!transcribedText || !file) return
    setLoading(true)
    try {
      const blob = await generatePdfFromTextLocally({
        title: 'Handwriting Transcription',
        text: transcribedText,
        fontSize: 12,
        alignment: 'left',
        pageSize: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 }
      })
      setPdfBlob(blob)

      const originalName = file.name.replace(/\.[^/.]+$/, "")
      const newName = `${originalName}_handwritten.pdf`
      await downloadFile(blob, newName)

      // Add to files catalog
      const reader = new FileReader()
      reader.onloadend = () => {
        addFile({
          id: crypto.randomUUID(),
          name: newName,
          type: 'pdf',
          size: blob.size,
          createdAt: new Date(),
          category: ['recent'],
          favorite: false,
          dataUrl: reader.result as string
        })
        toast.success('Saved to Documents folder successfully!')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch {
      toast.error('Failed to save as PDF.')
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (!transcribedText || !file) return
    try {
      const targetBlob = pdfBlob || new Blob([transcribedText], { type: 'text/plain' })
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      const filename = pdfBlob ? `${originalName}_handwritten.pdf` : `${originalName}_handwritten.txt`
      await shareFile(targetBlob, filename)
    } catch (err: any) {
      if (err.message && !err.message.includes('cancel')) {
        toast.error('Failed to share transcript.')
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border shrink-0">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PenTool className="h-5 w-5 text-violet-400 animate-pulse" />
        <h2 className="text-lg font-semibold gradient-text">Handwriting to Text</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full safe-bottom">
        {/* Upload Zone */}
        {!file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-glass-border"
          >
            <div className="h-14 w-14 rounded-full bg-violet-500/10 flex items-center justify-center">
              <PenTool className="h-6 w-6 text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Handwriting OCR Engine</p>
              <p className="text-xs text-muted-foreground mt-1">Transcribe handwritten notes into editable, shareable documents</p>
            </div>
            <Button onClick={handlePickFile} className="bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-1.5 h-10 px-6 text-xs rounded-xl">
              <FileImage className="h-4 w-4" /> Pick Written Note Image
            </Button>
          </motion.div>
        )}

        {/* Selected Image workspace */}
        {file && (
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {filePreview ? (
                  <img src={filePreview} alt="Thumbnail" className="h-10 w-10 rounded-xl object-cover shrink-0 border border-glass-border" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                    <PenTool className="h-5 w-5 text-violet-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFile(null); setFilePreview(null); setTranscribedText(''); setPdfBlob(null) }}
                className="text-destructive text-xs hover:bg-destructive/10"
              >
                Change
              </Button>
            </motion.div>

            {/* Language selectors */}
            <div className="glass-card p-3.5 space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-semibold block">Select Handwriting Language</Label>
              <div className="flex gap-2">
                {[
                  { id: 'english' as const, label: 'English notes' },
                  { id: 'hindi' as const, label: 'Hindi / Mix notes' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setLanguageMode(mode.id)}
                    className={`flex-1 text-xs font-semibold py-2 px-3 rounded-lg border transition-all text-center ${
                      languageMode === mode.id
                        ? 'bg-violet-500/20 text-violet-400 border-violet-500/40 shadow-sm'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-muted-foreground'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transcription Trigger */}
            <Button
              onClick={handleTranscribe}
              disabled={loading || !filePreview}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-violet-600/20"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenTool className="h-4 w-4" />
              )}
              Transcribe Handwriting
            </Button>

            {/* Offline indicator if triggered */}
            <AnimatePresence>
              {isOfflineMode && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-amber-500/15 border border-amber-500/20 text-amber-200 rounded-xl flex items-start gap-2.5">
                  <WifiOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[10px] leading-normal font-medium">
                    <p className="font-semibold">Offline Fallback</p>
                    <p className="text-amber-300/80">AI server unreachable. Use this text editor to manually type, polished notes remain locally downloadable.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Editable transcription result */}
            {transcribedText && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <Label className="text-xs text-violet-400 font-semibold uppercase tracking-wider">Transcription Editor</Label>
                  <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8 hover:bg-white/10 text-muted-foreground">
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Textarea
                  value={transcribedText}
                  onChange={(e) => setTranscribedText(e.target.value)}
                  className="glass-input min-h-60 resize-y border-0 bg-transparent text-xs focus-visible:ring-0 leading-relaxed font-normal"
                />
              </motion.div>
            )}

            {/* Action buttons */}
            {transcribedText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleSaveAsTxt}
                  variant="outline"
                  className="glass-card-hover border-glass-border h-11 text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Download className="h-4 w-4 text-electric" /> Save as TXT
                </Button>
                <Button
                  onClick={handleSaveAsPdf}
                  disabled={loading}
                  variant="outline"
                  className="glass-card-hover border-glass-border h-11 text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-electric" />}
                  Save as PDF
                </Button>
                <Button
                  onClick={handleShare}
                  className="col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Share2 className="h-4 w-4" /> Share Notes
                </Button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
