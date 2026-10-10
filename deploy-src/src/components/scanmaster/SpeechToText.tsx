'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Download,
  Share2,
  Mic,
  MicOff,
  Pause,
  Play,
  Copy,
  FileText,
  Check,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { Capacitor } from '@capacitor/core'

const LANGUAGES = [
  { code: 'en-US', name: 'English' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'ur-PK', name: 'Urdu' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ta-IN', name: 'Tamil' },
]

import { downloadFile, shareFile } from '@/lib/capacitor-fs'
import { generatePdfFromTextLocally } from '@/lib/pdf-generator'

export default function SpeechToText() {
  const { goBack, setActiveView, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [language, setLanguage] = useState('en-US')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)
  const [copied, setCopied] = useState(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (Capacitor.isNativePlatform()) {
        SpeechRecognition.removeAllListeners()
        SpeechRecognition.stop().catch(() => {})
      }
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.error('Speech recognition engine is not configured for web.')
      return
    }

    try {
      const { available } = await SpeechRecognition.available()
      if (!available) {
        toast.error('Speech recognition engine is not configured.')
        return
      }

      const hasPerms = await SpeechRecognition.checkPermissions()
      if (hasPerms.speechRecognition !== 'granted') {
        const req = await SpeechRecognition.requestPermissions()
        if (req.speechRecognition !== 'granted') {
          toast.error('Microphone access denied. Please allow microphone permissions.')
          return
        }
      }

      await SpeechRecognition.start({
        language,
        maxResults: 2,
        prompt: 'Say something',
        partialResults: true,
        popup: false,
      })

      setIsRecording(true)
      setIsPaused(false)
      toast.success('Listening...')

      SpeechRecognition.addListener('partialResults', (data: any) => {
        if (data.matches && data.matches.length > 0) {
          setTranscript((prev) => {
            const lines = prev.split('\n')
            lines[lines.length - 1] = data.matches[0]
            return lines.join('\n')
          })
        }
      })
    } catch (e: any) {
      const msg = e?.message || 'Speech recognition failed or was cancelled.'
      toast.error(`Speech Error: ${msg}`)
      setIsRecording(false)
    }
  }, [language])

  const stopRecording = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await SpeechRecognition.stop()
        SpeechRecognition.removeAllListeners()
      } catch (e) {}
    }
    setIsRecording(false)
    setIsPaused(false)
    setTranscript((prev) => prev + '\n') // Newline for next recording
  }, [])

  const togglePause = useCallback(() => {
    // Capacitor SpeechRecognition plugin does not have a pause/resume feature out of the box.
    // We will just stop it for pause, and the user can start again.
    if (isRecording) {
      stopRecording()
      toast.info('Recording stopped')
    }
  }, [isRecording, stopRecording])

  const cancelRecording = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await SpeechRecognition.stop()
        SpeechRecognition.removeAllListeners()
      } catch (e) {}
    }
    setIsRecording(false)
    setIsPaused(false)
    toast.info('Recording canceled')
  }, [])

  const handleCopy = useCallback(async () => {
    if (!transcript) return
    try {
      await navigator.clipboard.writeText(transcript)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }, [transcript])

  const handleSaveAsPdf = useCallback(async () => {
    if (!transcript || savingPdf) return
    setSavingPdf(true)
    try {
      const blob = await generatePdfFromTextLocally({
        title: 'Speech Transcript',
        text: transcript,
        fontSize: 12,
        alignment: 'left',
        bold: false,
        italic: false,
        underline: false,
        pageSize: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      })
      
      const filename = 'speech_transcript.pdf'
      await downloadFile(blob, filename)
      
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
        toast.success('Saved as PDF!')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch (err: any) {
      toast.error(`Failed to save as PDF: ${err.message || err}`)
    } finally {
      setSavingPdf(false)
    }
  }, [transcript, addFile, showAdAfterSuccess, savingPdf])

  const handleShare = useCallback(async () => {
    if (!transcript) return
    try {
      const blob = new Blob([transcript], { type: 'text/plain' })
      await shareFile(blob, 'transcript.txt', 'ScanMaster Transcript')
      showAdAfterSuccess()
    } catch (err) {
      toast.info((err as Error).message)
    }
  }, [transcript, showAdAfterSuccess])

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Mic className="h-5 w-5 text-electric" />
        <h2 className="text-lg font-semibold gradient-text">Speech to Text</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Language Selector */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
          <Label className="text-sm text-muted-foreground">Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="glass-input w-full border-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Microphone Button */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex flex-col items-center gap-4 py-6">
          <div className="relative flex items-center justify-center py-4">
            {/* Double Glowing Concentric Rings for Recording State */}
            {isRecording && (
              <>
                <motion.div
                  className="absolute h-32 w-32 rounded-full bg-red-500/20 border border-red-500/35"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0.1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute h-28 w-28 rounded-full bg-red-500/30 border border-red-500/50"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0.2, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                />
              </>
            )}
            
            {/* Glow for idle mode */}
            {!isRecording && (
              <div className="absolute h-28 w-28 rounded-full bg-cyan-500/10 blur-xl animate-pulse" />
            )}

            <motion.button
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative h-24 w-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
                isRecording
                  ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_8px_32px_rgba(239,68,68,0.4)] border border-red-400/30'
                  : 'bg-gradient-to-br from-cyan-400 to-primary shadow-[0_8px_32px_rgba(6,182,212,0.4)] border border-[#00f0ff]/30'
              }`}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
            >
              {isRecording ? (
                <MicOff className="h-10 w-10 text-white" />
              ) : (
                <Mic className="h-10 w-10 text-[#070d1e]" />
              )}
            </motion.button>
          </div>

          <p className="text-sm text-muted-foreground">
            {isRecording ? (isPaused ? 'Paused' : 'Recording...') : 'Tap to start recording'}
          </p>

          {/* Pause/Resume & Cancel Actions */}
          {isRecording && (
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={togglePause}
                className="h-12 w-12 rounded-full glass-card-hover border-glass-border"
                title="Pause recording"
              >
                {isPaused ? <Play className="h-5 w-5 text-primary" /> : <Pause className="h-5 w-5 text-primary" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={cancelRecording}
                className="h-12 w-12 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                title="Cancel recording"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </motion.div>

        {/* Loading indicator */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 flex items-center justify-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="h-5 w-5 border-2 border-electric border-t-transparent rounded-full"
            />
            <span className="text-sm text-muted-foreground">Transcribing audio...</span>
          </motion.div>
        )}

        {/* Transcript */}
        {transcript && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Transcript</Label>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1">
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="glass-input min-h-40 resize-y border-0"
            />
          </motion.div>
        )}

        {/* Action Buttons */}
        {transcript && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-3 pb-4">
            <Button
              onClick={handleSaveAsPdf}
              disabled={savingPdf}
              variant="outline"
              className="w-full glass-card-hover border-glass-border"
            >
              {savingPdf ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Save as PDF
            </Button>
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
