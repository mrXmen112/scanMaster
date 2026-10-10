'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  ArrowLeft,
  PenTool,
  FileText,
  Trash2,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Share2,
  Download,
  ImagePlus
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { pickSinglePdf, downloadFile, shareFile } from '@/lib/capacitor-fs'
import { compilePdfOffline } from '@/lib/pdf-editor-compiler'
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

interface SignatureAnnotation {
  id: string
  page: number
  x: number
  y: number
  scale: number
  dataUrl: string
}

export default function ESignature() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [file, setFile] = useState<File | null>(null)
  
  // PDF Rendering States
  const [pdfjsDoc, setPdfjsDoc] = useState<any>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [pdfjsError, setPdfjsError] = useState<string | null>(null)
  const [pdfjsLoading, setPdfjsLoading] = useState(false)

  // Drawing Pad States
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null)
  const [placedSig, setPlacedSig] = useState<SignatureAnnotation | null>(null)
  const [pageAnnotations, setPageAnnotations] = useState<SignatureAnnotation[]>([])

  // Layout Placement States
  const [sigScale, setSigScale] = useState(1.0)
  const [dragPosition, setDragPosition] = useState({ x: 40, y: 40 })

  // Saving States
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [signedBlob, setSignedBlob] = useState<Blob | null>(null)
  const [signedName, setSignedName] = useState('')

  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pageContainerRef = useRef<HTMLDivElement | null>(null)
  const padCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const renderTaskRef = useRef<any>(null)

  // File Picker
  const handlePickFile = async () => {
    try {
      const picked = await pickSinglePdf()
      if (picked) {
        setFile(picked)
        setSuccess(false)
        setSignedBlob(null)
        setPageAnnotations([])
        setPlacedSig(null)
        setSigDataUrl(null)
        setCurrentPage(0)
        loadPdfDocument(picked)
      }
    } catch (err) {
      toast.error('Failed to pick PDF.')
    }
  }

  // Load PDF Document
  const loadPdfDocument = async (pdfFile: File) => {
    setPdfjsLoading(true)
    setPdfjsError(null)
    try {
      const pdfjs = await loadPdfJsScript()
      const arrayBuffer = await pdfFile.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
      setPdfjsDoc(doc)
      setNumPages(doc.numPages)
    } catch (err: any) {
      console.error(err)
      setPdfjsError('Failed to load PDF. Please make sure it is a valid PDF.')
    } finally {
      setPdfjsLoading(false)
    }
  };

  // Render Page
  const renderPage = useCallback(async () => {
    if (!pdfCanvasRef.current || !pdfjsDoc) return
    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }

      const page = await pdfjsDoc.getPage(currentPage + 1)
      const canvas = pdfCanvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const container = pageContainerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()

      const baseViewport = page.getViewport({ scale: 1 })
      const scale = rect.width / baseViewport.width
      const viewport = page.getViewport({ scale: scale * dpr })

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = '100%'
      canvas.style.height = '100%'

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      }

      const renderTask = page.render(renderContext)
      renderTaskRef.current = renderTask
      await renderTask.promise
      renderTaskRef.current = null
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('PDF rendering failed:', err)
      }
    }
  }, [pdfjsDoc, currentPage])

  useEffect(() => {
    if (pdfjsDoc) {
      renderPage()
    }
  }, [pdfjsDoc, currentPage, renderPage])

  // Canvas resize handler
  useEffect(() => {
    const handleResize = () => {
      if (pdfjsDoc) renderPage()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [pdfjsDoc, renderPage])

  // Drawing Pad Logic
  const initPadCanvas = () => {
    const canvas = padCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(2, 2)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }

  useEffect(() => {
    if (showSignaturePad) {
      setTimeout(() => initPadCanvas(), 150)
    }
  }, [showSignaturePad])

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = padCanvasRef.current
    if (!canvas) return
    isDrawingRef.current = true
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    }
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = padCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    isDrawingRef.current = false
  }

  const clearSignaturePad = () => {
    const canvas = padCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const saveSignaturePad = () => {
    const canvas = padCanvasRef.current
    if (!canvas) return
    
    // Create a temporary canvas to trim white margins
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Crop blank areas if needed, or simply extract transparent PNG
    const dataUrl = canvas.toDataURL('image/png')
    setSigDataUrl(dataUrl)
    setShowSignaturePad(false)
    
    // Create placed signature state
    setPlacedSig({
      id: crypto.randomUUID(),
      page: currentPage,
      x: 35,
      y: 40,
      scale: 1.0,
      dataUrl
    })
    setDragPosition({ x: 35, y: 40 })
    setSigScale(1.0)
    toast.success('Signature captured!')
  }

  // Upload image fallback
  const handleUploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setSigDataUrl(dataUrl)
      setShowSignaturePad(false)
      setPlacedSig({
        id: crypto.randomUUID(),
        page: currentPage,
        x: 35,
        y: 40,
        scale: 1.0,
        dataUrl
      })
      setDragPosition({ x: 35, y: 40 })
      setSigScale(1.0)
      toast.success('Signature uploaded!')
    }
    reader.readAsDataURL(file)
  }

  // Place signature permanently on the page
  const applySignaturePlacement = () => {
    if (!placedSig) return
    const sigToSave: SignatureAnnotation = {
      ...placedSig,
      page: currentPage,
      x: dragPosition.x,
      y: dragPosition.y,
      scale: sigScale
    }
    setPageAnnotations((prev) => [...prev, sigToSave])
    setPlacedSig(null)
    setSigDataUrl(null)
    toast.success('Signature applied to this page!')
  }

  // Save the full PDF
  const handleSavePdf = async () => {
    if (!file) return
    if (pageAnnotations.length === 0 && !placedSig) {
      toast.error('Please place and apply a signature first.')
      return
    }

    setLoading(true)
    try {
      // Map annotations
      const allSigs = [...pageAnnotations]
      if (placedSig) {
        allSigs.push({
          ...placedSig,
          page: currentPage,
          x: dragPosition.x,
          y: dragPosition.y,
          scale: sigScale
        })
      }

      const payloadAnnotations = allSigs.map((sig) => ({
        type: 'signature',
        page: sig.page,
        x: sig.x,
        y: sig.y,
        scale: sig.scale,
        dataUrl: sig.dataUrl
      }))

      // Rotation settings (default to 0 for all pages)
      const rotations = Array.from({ length: numPages }, () => 0)

      const blob = await compilePdfOffline(file, payloadAnnotations, rotations)
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      const newName = `${originalName}_signed.pdf`

      setSignedBlob(blob)
      setSignedName(newName)

      // Convert to DataURL for Zustand
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
        setSuccess(true)
        toast.success('PDF signed and saved successfully!')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to sign PDF.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!signedBlob || !signedName) return
    try {
      await downloadFile(signedBlob, signedName)
      toast.success('Signed PDF saved successfully!')
    } catch {
      toast.error('Failed to download PDF.')
    }
  }

  const handleShare = async () => {
    if (!signedBlob || !signedName) return
    try {
      await shareFile(signedBlob, signedName, 'Share Signed PDF')
    } catch (err: any) {
      if (err.message && !err.message.includes('cancel')) {
        toast.error('Failed to share PDF.')
      }
    }
  }

  // Handle Drag calculations
  const handleDragEnd = (e: any, info: any) => {
    const container = pageContainerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    
    // Convert pixels to percentage coordinates on the PDF page
    const deltaX = (info.offset.x / containerRect.width) * 100
    const deltaY = (info.offset.y / containerRect.height) * 100

    setDragPosition((prev) => ({
      x: Math.max(0, Math.min(80, prev.x + deltaX)),
      y: Math.max(0, Math.min(85, prev.y + deltaY))
    }))
  }

  return (
    <div className="flex flex-col h-full bg-mesh pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border shrink-0">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PenTool className="h-5 w-5 text-rose-500 animate-pulse" />
        <h2 className="text-lg font-semibold gradient-text">E-Signature Tool</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full safe-bottom">
        {/* Upload Zone */}
        {!file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-glass-border"
          >
            <div className="h-14 w-14 rounded-full bg-rose-500/10 flex items-center justify-center">
              <PenTool className="h-6 w-6 text-rose-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Sign Your PDF Document</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a PDF to place a vector signature or image stamps</p>
            </div>
            <Button onClick={handlePickFile} className="bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-1.5 h-10 px-6 text-xs rounded-xl">
              <FileText className="h-4 w-4" /> Pick PDF File
            </Button>
          </motion.div>
        )}

        {/* Workspace Renderer */}
        {file && !success && (
          <div className="space-y-4">
            {/* Toolbar controls */}
            <div className="glass-card p-3.5 flex flex-wrap gap-2.5 items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowSignaturePad(true)}
                  className="bg-primary/20 hover:bg-primary/30 text-primary hover:text-primary text-xs h-9 py-0.5 px-3 rounded-xl border border-primary/20 flex items-center gap-1"
                >
                  <PenTool className="h-3.5 w-3.5" /> Draw Signature
                </Button>
                
                <label className="bg-white/5 hover:bg-white/10 text-foreground text-xs h-9 py-2 px-3 rounded-xl border border-white/10 flex items-center gap-1 cursor-pointer select-none">
                  <ImagePlus className="h-3.5 w-3.5" /> Upload Image
                  <input type="file" accept="image/png,image/jpeg" onChange={handleUploadSignature} className="hidden" />
                </label>
              </div>

              {/* Page Controls */}
              {numPages > 1 && (
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="h-8 w-8 text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs px-2 font-mono">
                    {currentPage + 1} / {numPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentPage === numPages - 1}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="h-8 w-8 text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Signature Scaling Panel if placed */}
            {placedSig && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="glass-card p-4 space-y-3"
              >
                <div className="flex justify-between text-xs font-semibold">
                  <span>Signature Scale</span>
                  <span className="text-rose-400 font-mono">{(sigScale * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[sigScale]}
                  min={0.3}
                  max={2.0}
                  step={0.05}
                  onValueChange={(val) => setSigScale(val[0])}
                  className="py-2"
                />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    onClick={applySignaturePlacement}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" /> Apply Placement
                  </Button>
                  <Button
                    onClick={() => { setPlacedSig(null); setSigDataUrl(null) }}
                    variant="outline"
                    className="border-glass-border hover:bg-white/5 text-xs h-9 rounded-xl text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Discard
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Main Render Viewport */}
            {pdfjsLoading ? (
              <div className="glass-card p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground animate-pulse">Loading pages...</p>
              </div>
            ) : pdfjsError ? (
              <div className="glass-card p-8 text-center text-xs text-red-400 font-medium">
                {pdfjsError}
              </div>
            ) : (
              <div className="relative w-full flex justify-center bg-slate-950/60 rounded-2xl p-4 border border-glass-border overflow-hidden">
                <div
                  ref={pageContainerRef}
                  className="relative bg-white rounded-lg shadow-2xl max-w-full overflow-hidden select-none"
                  style={{
                    width: '100%',
                    aspectRatio: '210/297'
                  }}
                >
                  {/* Background PDF.js Canvas */}
                  <canvas ref={pdfCanvasRef} className="absolute inset-0 w-full h-full" />

                  {/* Render already-applied signatures on this page */}
                  {pageAnnotations
                    .filter((sig) => sig.page === currentPage)
                    .map((sig) => (
                      <div
                        key={sig.id}
                        className="absolute pointer-events-none select-none border border-transparent"
                        style={{
                          left: `${sig.x}%`,
                          top: `${sig.y}%`,
                          width: `${25 * sig.scale}%`,
                          transform: 'translate(0, 0)'
                        }}
                      >
                        <img src={sig.dataUrl} alt="Applied Signature" className="w-full h-auto object-contain" />
                      </div>
                    ))}

                  {/* Draggable Active Signature Image */}
                  {placedSig && (
                    <motion.div
                      drag
                      dragMomentum={false}
                      dragElastic={0}
                      dragConstraints={pageContainerRef}
                      onDragEnd={handleDragEnd}
                      className="absolute border-2 border-dashed border-rose-500 bg-rose-500/5 cursor-move flex items-center justify-center p-1 rounded group"
                      style={{
                        left: `${dragPosition.x}%`,
                        top: `${dragPosition.y}%`,
                        width: `${25 * sigScale}%`,
                        zIndex: 30
                      }}
                    >
                      <img src={sigDataUrl!} alt="Signature Stamp" className="w-full h-auto object-contain pointer-events-none" />
                      <div className="absolute -top-6 bg-rose-600 text-white text-[9px] font-semibold py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        Drag me
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handlePickFile}
                variant="outline"
                className="flex-1 glass-card-hover border-glass-border h-11 text-xs rounded-xl"
              >
                Change File
              </Button>
              <Button
                onClick={handleSavePdf}
                disabled={loading || (pageAnnotations.length === 0 && !placedSig)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Signed PDF
              </Button>
            </div>
          </div>
        )}

        {/* Smooth Drawing Canvas Pad Overlay */}
        <AnimatePresence>
          {showSignaturePad && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="glass-card w-full max-w-sm p-5 space-y-4 border-rose-500/20"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1">
                    <PenTool className="h-4 w-4 text-rose-500" /> Draw Signature
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowSignaturePad(false)} className="h-7 w-7 text-muted-foreground">
                    ✕
                  </Button>
                </div>

                <div className="border border-glass-border bg-white rounded-xl overflow-hidden h-44 relative">
                  <canvas
                    ref={padCanvasRef}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    className="w-full h-full cursor-crosshair touch-none"
                  />
                  <div className="absolute bottom-2 left-2 text-[9px] text-slate-400 font-medium pointer-events-none">
                    Use touch or pen to sign here
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={clearSignaturePad}
                    variant="outline"
                    className="flex-1 border-glass-border text-xs rounded-xl h-10 hover:bg-white/5"
                  >
                    Clear Canvas
                  </Button>
                  <Button
                    onClick={saveSignaturePad}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl h-10"
                  >
                    Capture Pad
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Dialog */}
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
                <h3 className="text-base font-bold text-foreground">File Signed Successfully</h3>
                <p className="text-xs text-muted-foreground mt-1">Your new signed document is ready in the Files directory</p>
                <p className="text-xs font-semibold font-mono text-electric mt-2 truncate px-4">{signedName}</p>
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
                  <Share2 className="h-4 w-4 text-indigo-400" /> Share Document
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setFile(null)
                  setSuccess(false)
                  setSignedBlob(null)
                  setPageAnnotations([])
                  setPlacedSig(null)
                }}
                className="text-xs text-muted-foreground w-full py-2 hover:bg-white/5"
              >
                Sign Another Document
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
