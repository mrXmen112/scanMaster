'use client'

import { useState, useCallback } from 'react'
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
  FileText,
  Check,
  Eye,
  X,
  FileImage,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { buildApiUrl } from '@/lib/api-base-url'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'
import { downloadFile, shareFile, openFile, pickSinglePdf, pickImages } from '@/lib/capacitor-fs'
import { generatePdfFromTextLocally } from '@/lib/pdf-generator'
import { useAuth } from '@/contexts/AuthContext'

// Dynamic PDF.js loader
function loadPdfJsScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is undefined'))
      return
    }
    const win = window as any
    if (win.pdfjsLib) {
      resolve(win.pdfjsLib)
      return
    }

    const script = document.createElement('script')
    script.src = '/libs/pdfjs/pdf.min.js'
    script.async = true
    script.onload = () => {
      const pdfjsLib = win.pdfjsLib
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/libs/pdfjs/pdf.worker.min.js'
        resolve(pdfjsLib)
      } else {
        reject(new Error('pdfjsLib not found on window'))
      }
    }
    script.onerror = () => {
      console.warn('Failed to load local PDF.js, trying CDN fallback...')
      const cdnScript = document.createElement('script')
      cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js'
      cdnScript.async = true
      cdnScript.onload = () => {
        const pdfjsLib = win.pdfjsLib
        if (pdfjsLib) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
          resolve(pdfjsLib)
        } else {
          reject(new Error('pdfjsLib not found on window after CDN load'))
        }
      }
      cdnScript.onerror = () => {
        reject(new Error('PDF renderer failed to load. Please check internet or open native preview.'))
      }
      document.body.appendChild(cdnScript)
    }
    document.body.appendChild(script)
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function OcrTool() {
  const { goBack, setActiveView, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [copied, setCopied] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)

  const handleFile = useCallback(async (f: File) => {
    const isValid = f.type.startsWith('image/') || f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    if (!isValid) {
      toast.error('Please upload an image or PDF file')
      return
    }
    setFile(f)
    setExtractedText('')
    setPdfBlob(null)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }, [])

  const handlePickPdf = async () => {
    try {
      const picked = await pickSinglePdf()
      if (picked) handleFile(picked)
    } catch (err) {
      console.error(err)
    }
  }

  const handlePickImage = async () => {
    try {
      const picked = await pickImages()
      if (picked && picked.length > 0) handleFile(picked[0])
    } catch (err) {
      console.error(err)
    }
  }

  const handleExtract = useCallback(async () => {
    if (loading) return
    if (!file) {
      toast.error('Please upload a file first')
      return
    }
    setLoading(true)
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      
      if (isPdf) {
        try {
          const pdfjs = await loadPdfJsScript()
          const arrayBuffer = await file.arrayBuffer()
          const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

          let fullText = ''
          for (let i = 1; i <= pdfjsDoc.numPages; i++) {
            const page = await pdfjsDoc.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items.map((item: any) => item.str).join(' ')
            if (pageText.trim()) {
              fullText += `--- Page ${i} ---\n${pageText}\n\n`
            }
          }

          if (!fullText.trim()) {
            const scannedMsg = 'This PDF appears to be scanned. Please upload the page as an image for OCR.'
            toast.error(scannedMsg)
            setExtractedText(scannedMsg)
          } else {
            setExtractedText(fullText.trim())
            toast.success('Text extracted from PDF successfully!')
          }
        } catch (err: any) {
          console.error('PDF extraction error:', err)
          toast.error(err.message || 'Failed to extract text from PDF.')
        }
      } else {
        // Image OCR using secure Backend Gemini Vision
        const base64 = await fileToBase64(file)
        
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (user?.id) {
          headers['x-user-id'] = user.id
          headers['x-user-tier'] = (user.profile?.tier as string) === 'premium' ? 'premium' : 'free'
        }

        const response = await fetchWithTimeout(buildApiUrl('/api/ai/handwriting'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            image: base64,
            languageMode: 'english'
          })
        }, 30000);

        const data = await response.json();
        if (!response.ok || !data.text) {
          throw new Error(data.error || 'Failed to extract text from image');
        }

        setExtractedText(data.text)
        toast.success('Text extracted using secure Vision OCR!')
      }
    } catch (err: any) {
      console.error('OCR error:', err)
      toast.error(err.message || 'OCR extraction failed.')
    } finally {
      setLoading(false)
    }
  }, [file, loading])

  const handleSaveAsTxt = useCallback(async () => {
    if (!extractedText) return
    try {
      const blob = new Blob([extractedText], { type: 'text/plain' })
      await downloadFile(blob, 'ocr-extract.txt')
      toast.success('TXT file saved successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save TXT file')
    }
  }, [extractedText])

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
      const blob = await generatePdfFromTextLocally({
        title: 'OCR Extract',
        text: extractedText,
        fontSize: 12,
        alignment: 'left',
        bold: false,
        italic: false,
        underline: false,
        pageSize: 'A4',
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
      })
      
      setPdfBlob(blob)
      await downloadFile(blob, 'ocr-extract.pdf')
      
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        addFile({
          id: crypto.randomUUID(),
          name: 'ocr-extract.pdf',
          type: 'pdf',
          size: blob.size,
          createdAt: new Date(),
          category: ['recent'],
          favorite: false,
          dataUrl: dataUrl,
        })
        toast.success('Saved to Documents successfully!')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      console.error(err)
      toast.error('Failed to save as PDF')
    } finally {
      setSavingPdf(false)
    }
  }, [extractedText, addFile, showAdAfterSuccess, savingPdf])

  const handleShare = useCallback(async () => {
    if (!extractedText) return
    try {
      const targetBlob = pdfBlob || new Blob([extractedText], { type: 'text/plain' })
      const filename = pdfBlob ? 'ocr-extract.pdf' : 'ocr-extract.txt'
      await shareFile(targetBlob, filename)
    } catch (err: any) {
      if (err.message && !err.message.includes('not supported')) {
        toast.error('Failed to share')
      }
    }
  }, [extractedText, pdfBlob])

  const handleOpenPdf = useCallback(async () => {
    if (!pdfBlob) return
    try {
      await openFile(pdfBlob, 'ocr-extract.pdf')
    } catch {
      toast.error('Failed to open PDF')
    }
  }, [pdfBlob])

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
        {/* Upload Zone with Dual Beautiful Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-glass-border"
        >
          <div className="h-14 w-14 rounded-full bg-electric/20 flex items-center justify-center">
            <Upload className="h-6 w-6 text-electric" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Upload File to Extract Text</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP or PDF formats supported</p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <Button onClick={handlePickPdf} className="flex-1 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5 h-10 text-xs">
              <FileText className="h-4 w-4" /> Pick PDF
            </Button>
            <Button onClick={handlePickImage} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-1.5 h-10 text-xs">
              <FileImage className="h-4 w-4" /> Pick Image
            </Button>
          </div>
        </motion.div>

        {/* File Preview */}
        {file && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Uploaded File</Label>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreview(null); setExtractedText(''); setPdfBlob(null) }} className="text-destructive hover:text-destructive h-7">
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
              className="glass-input min-h-40 resize-y border-0 bg-transparent text-sm focus-visible:ring-0"
            />
          </motion.div>
        )}

        {/* Action Buttons */}
        {extractedText && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleSaveAsTxt}
                variant="outline"
                className="glass-card-hover border-glass-border h-10 text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="h-4 w-4 text-electric" />
                Save as TXT
              </Button>
              <Button
                onClick={handleSaveAsPdf}
                disabled={savingPdf}
                variant="outline"
                className="glass-card-hover border-glass-border h-10 text-xs flex items-center justify-center gap-1.5"
              >
                {savingPdf ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-electric" />
                )}
                Convert to PDF
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleShare}
                variant="outline"
                className="glass-card-hover border-glass-border h-10 text-xs"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>

            {pdfBlob && (
              <Button
                onClick={handleOpenPdf}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-10 text-xs"
              >
                <Eye className="h-4 w-4 mr-2" />
                Open Converted PDF
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
