'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Bot,
  FileText,
  Copy,
  Check,
  CheckCircle,
  Loader2,
  Share2,
  Download,
  WifiOff,
  Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { pickSinglePdf, downloadFile, shareFile } from '@/lib/capacitor-fs'
import { generatePdfFromTextLocally } from '@/lib/pdf-generator'
import { buildApiUrl } from '@/lib/api-base-url'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

// Dynamic PDF.js loader
async function loadPdfJsScript(): Promise<any> {
  const win = window as any
  if (win.pdfjsLib) return win.pdfjsLib
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/libs/pdfjs/pdf.min.js'
    script.async = true
    script.onload = () => {
      const pdfjsLib = win.pdfjsLib
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/libs/pdfjs/pdf.worker.min.js'
        resolve(pdfjsLib)
      } else {
        reject(new Error('pdfjsLib not found'))
      }
    }
    script.onerror = () => {
      const cdnScript = document.createElement('script')
      cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js'
      cdnScript.async = true
      cdnScript.onload = () => {
        const pdfjsLib = win.pdfjsLib
        if (pdfjsLib) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
          resolve(pdfjsLib)
        } else {
          reject(new Error('pdfjsLib not found on CDN'))
        }
      }
      cdnScript.onerror = () => reject(new Error('PDF renderer failed to load.'))
      document.body.appendChild(cdnScript)
    }
    document.body.appendChild(script)
  })
}

// Robust, pure JS extractive summary NLP fallback
// Filters out common stop words, scores sentences by word frequency, and yields top sentences chronologically
function offlineExtractiveSummary(text: string, sentenceCount = 5): string {
  if (!text) return 'No text content available to summarize.'
  
  // Clean text and extract sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  if (sentences.length <= sentenceCount) {
    return sentences.map((s) => s.trim()).join(' ')
  }

  // Tokenize and count word frequencies (ignoring common english and hindi stop words)
  const stopWords = new Set([
    'the', 'and', 'a', 'to', 'of', 'in', 'i', 'is', 'that', 'it', 'on', 'you', 'this', 'for', 'with', 'was', 'as', 'at', 'by', 'an', 'be', 'or', 'are', 'from',
    'à¤•à¥€', 'à¤•à¤¾', 'à¤•à¥‡', 'à¤®à¥‡à¤‚', 'à¤¹à¥ˆ', 'à¤¹à¥ˆà¤‚', 'à¤”à¤°', 'à¤¸à¥‡', 'à¤•à¥‹', 'à¤¯à¤¹', 'à¤µà¤¹', 'à¤­à¥€', 'à¤ªà¤°', 'à¤•à¤°', 'à¤¹à¥‹', 'à¤¤à¥‹', 'à¤¥à¥€', 'à¤¥à¤¾', 'à¤¦à¤¿à¤¯à¤¾', 'à¤—à¤¯à¤¾', 'à¤¹à¥à¤†'
  ])

  const words = text.toLowerCase().match(/\b\w+\b/g) || []
  const wordFreqs: Record<string, number> = {}
  
  words.forEach((w) => {
    if (!stopWords.has(w) && w.length > 2) {
      wordFreqs[w] = (wordFreqs[w] || 0) + 1
    }
  })

  // Score sentences based on word frequencies
  const scoredSentences = sentences.map((sentence, idx) => {
    const sWords = sentence.toLowerCase().match(/\b\w+\b/g) || []
    let score = 0
    sWords.forEach((w) => {
      if (wordFreqs[w]) {
        score += wordFreqs[w]
      }
    })
    
    // Position-based scoring boost (sentences at the beginning/end of document)
    if (idx < 2 || idx > sentences.length - 3) {
      score *= 1.3
    }
    
    return { text: sentence.trim(), score, index: idx }
  })

  // Sort by score and extract the top N sentences
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, sentenceCount)
    // Sort back to their original index for logical chronological reading
    .sort((a, b) => a.index - b.index)

  return topSentences.map((s) => s.text).join(' \n\n')
}

type SummaryMode = 'short' | 'detailed' | 'key-points' | 'action-items' | 'names-dates' | 'student-notes'

export default function AiSummary() {
  const { goBack, addFile } = useAppStore()
  const { user, accessToken } = useAuth()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [file, setFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [activeMode, setActiveMode] = useState<SummaryMode>('short')
  const [summaryResult, setSummaryResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [copied, setCopied] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)

  const handlePickFile = async () => {
    try {
      const picked = await pickSinglePdf()
      if (picked) {
        setFile(picked)
        setSummaryResult('')
        setExtractedText('')
        setIsOfflineMode(false)
        extractText(picked)
      }
    } catch {
      toast.error('Failed to pick PDF.')
    }
  }

  // Extract Text using PDF.js
  const extractText = async (pdfFile: File) => {
    setLoading(true)
    try {
      const pdfjs = await loadPdfJsScript()
      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

      let fullText = ''
      const maxPages = Math.min(15, pdfDoc.numPages) // safety cap to prevent freeze
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdfDoc.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        if (pageText.trim()) {
          fullText += `${pageText}\n`
        }
      }

      if (!fullText.trim()) {
        toast.error('This PDF has no selectable text. Extracted text will be empty.')
      }
      setExtractedText(fullText.trim())
    } catch (err) {
      toast.error('Failed to parse text from PDF.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateSummary = async () => {
    if (!extractedText.trim()) {
      toast.error('No text content available to summarize.')
      return
    }

    setLoading(true)
    setSummaryResult('')
    setIsOfflineMode(false)

    try {
      const secureUrl = buildApiUrl('/api/ai/summary')
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
          text: extractedText.slice(0, 15000), // safety length truncation
          mode: activeMode
        })
      }, 30000)

      if (!response.ok) {
        throw new Error('API server returned error.')
      }

      const data = await response.json()
      setSummaryResult(data.summary)
      toast.success('AI summary generated successfully!')
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.warn('Backend API summary failed, falling back to local NLP summarizer:', err)
      
      // Standalone/Offline Fallback Extractive Summary
      setIsOfflineMode(true)
      const offlineSummary = offlineExtractiveSummary(
        extractedText,
        activeMode === 'short' ? 3 : activeMode === 'detailed' ? 7 : 5
      )
      
      const offlineHeading = `[Offline Extractive Fallback - Reason: ${errMsg}]\n\n`
      setSummaryResult(offlineHeading + offlineSummary)
      toast.info(`AI summary failed (${errMsg}). Local NLP summary generated.`)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!summaryResult) return
    try {
      await navigator.clipboard.writeText(summaryResult)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy text.')
    }
  }

  const handleSaveAsTxt = async () => {
    if (!summaryResult || !file) return
    try {
      const blob = new Blob([summaryResult], { type: 'text/plain' })
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      await downloadFile(blob, `${originalName}_summary.txt`)
      toast.success('TXT file saved successfully!')
    } catch {
      toast.error('Failed to save file.')
    }
  }

  const handleSaveAsPdf = async () => {
    if (!summaryResult || !file) return
    setLoading(true)
    try {
      const blob = await generatePdfFromTextLocally({
        title: 'Document AI Summary',
        text: summaryResult,
        fontSize: 12,
        alignment: 'left',
        pageSize: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 }
      })
      setPdfBlob(blob)
      
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      const newName = `${originalName}_summary.pdf`
      
      await downloadFile(blob, newName)

      // Save into App files Zustand catalog
      const reader = new FileReader()
      reader.onloadend = () => {
        addFile({
          id: crypto.randomUUID(),
          name: newName,
          type: 'pdf',
          size: blob.size,
          createdAt: new Date(),
          category: ['recent', 'edited'],
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
    if (!summaryResult || !file) return
    try {
      const targetBlob = pdfBlob || new Blob([summaryResult], { type: 'text/plain' })
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      const filename = pdfBlob ? `${originalName}_summary.pdf` : `${originalName}_summary.txt`
      await shareFile(targetBlob, filename)
    } catch (err: any) {
      if (err.message && !err.message.includes('cancel')) {
        toast.error('Failed to share summary.')
      }
    }
  }

  const summaryModes = [
    { id: 'short' as const, label: 'Short' },
    { id: 'detailed' as const, label: 'Detailed' },
    { id: 'key-points' as const, label: 'Key Points' },
    { id: 'action-items' as const, label: 'Action Items' },
    { id: 'names-dates' as const, label: 'Names & Dates' },
    { id: 'student-notes' as const, label: 'Study Notes' }
  ]

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border shrink-0">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Bot className="h-5 w-5 text-emerald-400 animate-pulse" />
        <h2 className="text-lg font-semibold gradient-text">AI Document Summary</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full safe-bottom">
        {/* Upload Zone */}
        {!file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-glass-border"
          >
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Bot className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">AI Summarizer Engine</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a PDF to parse text and generate multi-mode study/action notes</p>
            </div>
            <Button onClick={handlePickFile} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 h-10 px-6 text-xs rounded-xl animate-pulse">
              <FileText className="h-4 w-4" /> Pick PDF Document
            </Button>
          </motion.div>
        )}

        {/* Workspace panel */}
        {file && (
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFile(null); setExtractedText(''); setSummaryResult(''); setPdfBlob(null) }}
                className="text-destructive text-xs hover:bg-destructive/10"
              >
                Change
              </Button>
            </motion.div>

            {/* Mode selection Grid */}
            <div className="glass-card p-3.5 space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-semibold block">Select Summary Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                {summaryModes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveMode(m.id)}
                    className={`text-[10px] font-semibold py-2 px-1 rounded-lg border transition-all truncate text-center ${
                      activeMode === m.id
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-muted-foreground'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Trigger */}
            <Button
              onClick={handleGenerateSummary}
              disabled={loading || !extractedText}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              Summarize Document
            </Button>

            {/* Offline Alert if Fallback was triggered */}
            <AnimatePresence>
              {isOfflineMode && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-amber-500/15 border border-amber-500/20 text-amber-200 rounded-xl flex items-start gap-2.5">
                  <WifiOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[10px] leading-normal font-medium">
                    <p className="font-semibold">Offline Mode</p>
                    <p className="text-amber-300/80">AI server unreachable. Generated summary is a local NLP extractive key-point sequence.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Output Result */}
            {summaryResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <Label className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">AI Summary Output</Label>
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 gap-1.5 hover:bg-white/10">
                    {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <Textarea
                  value={summaryResult}
                  onChange={(e) => setSummaryResult(e.target.value)}
                  className="glass-input min-h-60 resize-y border-0 bg-transparent text-xs focus-visible:ring-0 leading-relaxed font-normal"
                />
              </motion.div>
            )}

            {/* Success Actions */}
            {summaryResult && (
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
                  <Share2 className="h-4 w-4" /> Share Summary
                </Button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
