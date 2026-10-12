'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Languages,
  ArrowLeftRight,
  Copy,
  Check,
  FileText,
  Share2,
  Download,
  Loader2,
} from 'lucide-react'
import { ToolIcon } from './ToolCards'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { generatePdfFromTextLocally } from '@/lib/pdf-generator'
import { downloadFile } from '@/lib/capacitor-fs'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'ar', name: 'Arabic' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'bn', name: 'Bengali' },
]

export default function Translate() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('hi')
  const [inputText, setInputText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)

  const handleTranslate = useCallback(async () => {
    if (loading) return
    if (!inputText.trim()) {
      toast.error('Please enter text to translate')
      return
    }
    setLoading(true)
    setTranslatedText('')
    try {
      // Client-side translation via MyMemory free API (no key / CORS-open / Independent of /api routes)
      // MyMemory caps query length, so chunk long text at sentence boundaries.
      const chunks: string[] = []
      if (inputText.length > 450) {
        const sentences = inputText.match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g) || [inputText]
        let cur = ''
        for (const s of sentences) {
          if ((cur + s).length > 450 && cur) { chunks.push(cur.trim()); cur = s }
          else cur += s
        }
        if (cur.trim()) chunks.push(cur.trim())
      } else {
        chunks.push(inputText)
      }

      const parts: string[] = []
      for (const chunk of chunks) {
        const params = new URLSearchParams({ q: chunk, langpair: `${sourceLang}|${targetLang}` })
        const res = await fetchWithTimeout(`https://api.mymemory.translated.net/get?${params.toString()}`, {
          method: 'GET',
        }, 15000)
        const data: { responseData?: { translatedText?: string }; responseStatus?: number; responseDetails?: string } = await res.json()
        if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
          throw new Error(data.responseDetails || 'Translation failed')
        }
        parts.push(data.responseData.translatedText)
      }
      setTranslatedText(parts.join(' '))
      toast.success('Translation complete!')
    } catch (err) {
      const errMsg = (err as Error)?.message || ''
      if (errMsg.includes('temporarily unavailable')) {
        toast.error('AI service is temporarily unavailable. Please try again shortly.')
      } else {
        toast.error('Failed to translate text. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [inputText, sourceLang, targetLang])

  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setInputText(translatedText)
    setTranslatedText(inputText)
  }, [sourceLang, targetLang, inputText, translatedText])

  const handleCopy = useCallback(async () => {
    if (!translatedText) return
    try {
      await navigator.clipboard.writeText(translatedText)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }, [translatedText])

  const handleSaveAsPdf = useCallback(async () => {
    if (!translatedText || savingPdf) return
    setSavingPdf(true)
    try {
      const sourceName = LANGUAGES.find((l) => l.code === sourceLang)?.name
      const targetName = LANGUAGES.find((l) => l.code === targetLang)?.name
      // Client-side PDF export (Offline / Independent of /api routes)
      const blob = await generatePdfFromTextLocally({
        title: `Translation: ${sourceName} → ${targetName}`,
        text: translatedText,
        fontSize: 12,
        alignment: 'left',
        pageSize: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      })
      await downloadFile(blob, 'translation.pdf')
      addFile({
        id: crypto.randomUUID(),
        name: 'translation.pdf',
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
  }, [translatedText, sourceLang, targetLang, addFile, showAdAfterSuccess])

  const handleShare = useCallback(async () => {
    if (!translatedText) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ScanMaster Translation', text: translatedText })
        // Show interstitial ad after successful share
        showAdAfterSuccess()
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(translatedText)
      toast.info('Translation copied to clipboard')
      // Show interstitial ad after successful share (clipboard fallback)
      showAdAfterSuccess()
    }
  }, [translatedText, showAdAfterSuccess])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <ToolIcon toolId="translate" size="sm" />
      <h2 className="text-lg font-semibold gradient-text">Translate</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Language Selector */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="flex-1 glass-input px-3 py-2.5 text-sm rounded-xl"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-background text-foreground">
                {lang.name}
              </option>
            ))}
          </select>

          <motion.button
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={swapLanguages}
            className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"
          >
            <ArrowLeftRight className="h-4 w-4 text-primary" />
          </motion.button>

          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="flex-1 glass-input px-3 py-2.5 text-sm rounded-xl"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-background text-foreground">
                {lang.name}
              </option>
            ))}
          </select>
        </motion.div>

        {/* Input Text */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-2">
          <Label className="text-xs text-muted-foreground">Source Text</Label>
          <textarea
            className="w-full glass-input px-4 py-3 text-sm min-h-[140px] resize-none rounded-xl"
            placeholder="Enter text to translate..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground text-right">{inputText.length} characters</p>
        </motion.div>

        {/* Translate Button */}
        <Button
          onClick={handleTranslate}
          disabled={loading || !inputText.trim()}
          className="w-full electric-glow bg-primary hover:bg-primary/90 text-primary-foreground h-11"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Languages className="h-4 w-4 mr-2" />
          )}
          Translate
        </Button>

        {/* Translation Output */}
        {translatedText && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Translation ({LANGUAGES.find((l) => l.code === targetLang)?.name})
              </Label>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1">
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {translatedText}
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        {translatedText && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleSaveAsPdf}
                disabled={savingPdf}
                variant="outline"
                className="glass-card-hover border-glass-border"
              >
                {savingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Save as PDF
              </Button>
              <Button
                onClick={handleShare}
                variant="outline"
                className="glass-card-hover border-glass-border"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
