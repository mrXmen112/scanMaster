'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Lock,
  FileText,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Share2,
  Download,
  AlertCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { pickSinglePdf, downloadFile, shareFile } from '@/lib/capacitor-fs'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

export default function PasswordProtect() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [protectedBlob, setProtectedBlob] = useState<Blob | null>(null)
  const [protectedName, setProtectedName] = useState('')

  const handlePickFile = async () => {
    try {
      const picked = await pickSinglePdf()
      if (picked) {
        setFile(picked)
        setSuccess(false)
        setProtectedBlob(null)
      }
    } catch (err) {
      toast.error('Failed to pick PDF file.')
    }
  }

  const handleEncrypt = useCallback(async () => {
    if (!file) {
      toast.error('Please upload a PDF file first.')
      return
    }
    if (!password) {
      toast.error('Please enter a password.')
      return
    }
    if (password.length < 4) {
      toast.error('Password must be at least 4 characters long.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      // Dynamic import to keep build bundle safe in SSR
      const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite')
      
      const fileBytes = new Uint8Array(await file.arrayBuffer())
      const encryptedBytes = await encryptPDF(fileBytes, password)
      
      const blob = new Blob([encryptedBytes], { type: 'application/pdf' })
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      const newName = `${originalName}_protected.pdf`
      
      setProtectedBlob(blob)
      setProtectedName(newName)

      // Convert encrypted bytes to base64 DataURL for Zustand storage
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        addFile({
          id: crypto.randomUUID(),
          name: newName,
          type: 'pdf',
          size: blob.size,
          createdAt: new Date(),
          category: ['recent'],
          favorite: false,
          dataUrl: dataUrl
        })
        setSuccess(true)
        toast.success('PDF successfully password protected!')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch (err: any) {
      console.error('PDF Encryption Error:', err)
      toast.error(err.message || 'Encryption failed. Please check file and try again.')
    } finally {
      setLoading(false)
    }
  }, [file, password, confirmPassword, addFile, showAdAfterSuccess])

  const handleDownload = async () => {
    if (!protectedBlob || !protectedName) return
    try {
      await downloadFile(protectedBlob, protectedName)
      toast.success('File saved to Documents folder successfully!')
    } catch (err) {
      toast.error('Failed to download encrypted PDF.')
    }
  }

  const handleShare = async () => {
    if (!protectedBlob || !protectedName) return
    try {
      await shareFile(protectedBlob, protectedName, 'Share Protected PDF')
    } catch (err: any) {
      if (err.message && !err.message.includes('cancel')) {
        toast.error('Failed to share file.')
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-mesh pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Lock className="h-5 w-5 text-red-500 animate-pulse" />
        <h2 className="text-lg font-semibold gradient-text">Password Protect</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 safe-bottom max-w-lg mx-auto w-full">
        {/* Step 1: Upload or file display */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-glass-border"
        >
          <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Lock Your PDF Document</p>
            <p className="text-xs text-muted-foreground mt-1">Encrypt PDF offline so a password is required to open it</p>
          </div>
          <Button onClick={handlePickFile} className="bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5 h-10 px-6 text-xs rounded-xl">
            <FileText className="h-4 w-4" /> Pick PDF File
          </Button>
        </motion.div>

        {/* Selected File Details */}
        {file && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {!success && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFile(null); setSuccess(false); setProtectedBlob(null) }}
                className="text-destructive text-xs hover:bg-destructive/10"
              >
                Remove
              </Button>
            )}
          </motion.div>
        )}

        {/* Password Forms */}
        {file && !success && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 space-y-4"
          >
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-semibold">Choose PDF Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input pr-10 rounded-xl py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">Minimum 4 characters. Keep this password safe.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-semibold">Confirm Password</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="glass-input rounded-xl py-2 text-sm"
              />
            </div>

            <Button
              onClick={handleEncrypt}
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-red-600 hover:bg-red-700 text-white h-11 text-sm font-semibold rounded-xl mt-2 flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/20"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Encrypt PDF File
            </Button>
          </motion.div>
        )}

        {/* Success Dialog Block */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card p-6 text-center space-y-4 border-green-500/20"
            >
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto text-green-500">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">File Protected Successfully</h3>
                <p className="text-xs text-muted-foreground mt-1">New locked file has been registered inside Files</p>
                <p className="text-xs font-semibold font-mono text-electric mt-2 truncate px-4">{protectedName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="glass-card-hover border-glass-border text-xs rounded-xl h-10 flex items-center justify-center gap-1.5"
                >
                  <Download className="h-4 w-4 text-electric" /> Save to Device
                </Button>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="glass-card-hover border-glass-border text-xs rounded-xl h-10 flex items-center justify-center gap-1.5"
                >
                  <Share2 className="h-4 w-4 text-indigo-400" /> Share Protected
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setFile(null)
                  setPassword('')
                  setConfirmPassword('')
                  setSuccess(false)
                  setProtectedBlob(null)
                }}
                className="text-xs text-muted-foreground w-full py-2 hover:bg-white/5"
              >
                Protect Another PDF
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
