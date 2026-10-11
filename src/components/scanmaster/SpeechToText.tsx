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
  Languages,
  FileText,
  Check,
} from 'lucide-react'
import { ToolIcon } from './ToolCards'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

const LANGUAGES = [
  { code: 'en-US', name: 'English' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'ur-PK', name: 'Urdu' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'bn-IN', name: 'Bengali' },
]

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setIsPaused(false)
      toast.success('Recording started')
    } catch {
      toast.error('Microphone access denied. Please allow microphone permissions.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setIsPaused(false)
  }, [])

  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return
    if (isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      toast.info('Recording resumed')
    } else {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      toast.info('Recording paused')
    }
  }, [isPaused])

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    if (loading) return
    setLoading(true)
    try {
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // remove data:audio/webm;base64, prefix
        }
        reader.readAsDataURL(audioBlob)
      })
      const audioBase64 = await base64Promise

      const response = await fetchWithTimeout('/api/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioBase64, language }),
      }, 15000)
      const data: { text?: string; transcription?: string; error?: string } = await response.json()
      const text = data.text || data.transcription || ''
      setTranscript((prev) => (prev ? prev + '\n' + text : text))
      toast.success('Transcription complete!')
    } catch (err) {
      const errMsg = (err as Error)?.message || ''
      if (errMsg.includes('temporarily unavailable')) {
        toast.error('AI service is temporarily unavailable. Please try again shortly.')
      } else {
        toast.error('Failed to transcribe audio')
      }
    } finally {
      setLoading(false)
    }
  }, [language])

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
      const response = await fetchWithTimeout('/api/pdf/text-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Speech Transcript',
          text: transcript,
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
      downloadFile(blob, 'transcript.pdf')
      addFile({
        id: crypto.randomUUID(),
        name: 'transcript.pdf',
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
  }, [transcript, addFile, showAdAfterSuccess])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ScanMaster Transcript', text: transcript })
        // Show interstitial ad after successful share
        showAdAfterSuccess()
      } catch { /* cancelled */ }
    } else {
      toast.info('Share not supported on this browser')
    }
  }, [transcript, showAdAfterSuccess])

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <ToolIcon toolId="speech-to-text" size="sm" />
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
          <div className="relative">
            {isRecording && (
              <motion.div
                className="absolute inset-0 rounded-full bg-electric/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <motion.button
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative h-24 w-24 rounded-full flex items-center justify-center transition-colors ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-electric hover:bg-electric/90'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              {isRecording ? (
                <MicOff className="h-10 w-10 text-white" />
              ) : (
                <Mic className="h-10 w-10 text-electric-foreground" />
              )}
            </motion.button>
          </div>

          <p className="text-sm text-muted-foreground">
            {isRecording ? (isPaused ? 'Paused' : 'Recording...') : 'Tap to start recording'}
          </p>

          {/* Pause/Resume */}
          {isRecording && (
            <Button
              variant="outline"
              size="icon"
              onClick={togglePause}
              className="h-12 w-12 rounded-full glass-card-hover border-glass-border"
            >
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </Button>
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
                  <FileText className="h-4 w-4 mr-2" />
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
