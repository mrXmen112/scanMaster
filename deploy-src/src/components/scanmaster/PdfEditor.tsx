'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  ArrowLeft,
  Download,
  Share2,
  Upload,
  FileText,
  Type,
  Highlighter,
  ImageIcon,
  Pen,
  Square,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Trash2,
  Plus,
  Save,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Circle,
  Minus,
  MousePointer2,
  Eraser,
  X,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  PenTool,
  PaintBucket,
  Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'
import { pickSinglePdf } from '@/lib/capacitor-fs'
import { incrementUsage, isLimitReached, shouldWatermark, grantBonusUse } from '@/lib/usage-tracker'
import { applyImageWatermark } from '@/lib/watermark'
import AdGateModal from './AdGateModal'

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

// ─── Types ───────────────────────────────────────────────────────────────────

type ToolMode = 'select' | 'text' | 'pen' | 'highlighter' | 'eraser' | 'image' | 'signature' | 'shape' | 'whiteout' | 'ai-erase'

type ShapeType = 'rectangle' | 'circle' | 'line'

interface Point {
  x: number
  y: number
}

interface BaseAnnotation {
  id: string
  page: number
}

interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  x: number
  y: number
  content: string
  fontSize: number
  color: string
  font?: string
}

interface DrawingAnnotation extends BaseAnnotation {
  type: 'drawing'
  points: Point[]
  color: string
  width: number
}

interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight'
  x: number
  y: number
  w: number
  h: number
  color: string
}

interface SignatureAnnotation extends BaseAnnotation {
  type: 'signature'
  x: number
  y: number
  dataUrl: string
  scale: number
}

interface ShapeAnnotation extends BaseAnnotation {
  type: 'shape'
  shapeType: ShapeType
  x: number
  y: number
  w: number
  h: number
  color: string
  strokeWidth: number
  filled?: boolean
}

interface ImageStampAnnotation extends BaseAnnotation {
  type: 'imageStamp'
  x: number
  y: number
  dataUrl: string
  scale: number
}

type Annotation =
  | TextAnnotation
  | DrawingAnnotation
  | HighlightAnnotation
  | SignatureAnnotation
  | ShapeAnnotation
  | ImageStampAnnotation

interface PageInfo {
  id: string
  rotation: number
  width: number
  height: number
}

interface HistorySnapshot {
  annotations: Annotation[]
  pages: PageInfo[]
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function genId(): string {
  return crypto.randomUUID()
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

import { downloadFile as downloadBlob, shareFile, openFile } from '@/lib/capacitor-fs'
import { compilePdfOffline } from '@/lib/pdf-editor-compiler'

function cloneAnnotations(annotations: Annotation[]): Annotation[] {
  return JSON.parse(JSON.stringify(annotations))
}

function clonePages(pages: PageInfo[]): PageInfo[] {
  return JSON.parse(JSON.stringify(pages))
}

function smartFillRegion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (w < 3 || h < 3) return
  const imgData = ctx.getImageData(x, y, w, h)
  const d = imgData.data
  const visited = new Uint8Array(w * h)
  const queue: number[] = []
  const borderSize = Math.min(3, Math.floor(Math.min(w, h) / 4))
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (px < borderSize || px >= w - borderSize || py < borderSize || py >= h - borderSize) {
        visited[py * w + px] = 1; queue.push(py * w + px)
      }
    }
  }
  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const px = idx % w
    const py = Math.floor(idx / w)
    for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      const nIdx = ny * w + nx
      if (visited[nIdx]) continue
      visited[nIdx] = 1
      let r = 0, g = 0, b = 0, count = 0
      for (const [nnx, nny] of [[nx - 1, ny], [nx + 1, ny], [nx, ny - 1], [nx, ny + 1], [nx - 1, ny - 1], [nx + 1, ny + 1]]) {
        if (nnx < 0 || nnx >= w || nny < 0 || nny >= h) continue
        const nni = nny * w + nnx
        if (visited[nni]) { const pi = nni * 4; r += d[pi]; g += d[pi + 1]; b += d[pi + 2]; count++ }
      }
      if (count > 0) { const pi = nIdx * 4; d[pi] = r / count; d[pi + 1] = g / count; d[pi + 2] = b / count; d[pi + 3] = 255 }
      queue.push(nIdx)
    }
  }
  ctx.putImageData(imgData, x, y)
}

const PRESET_COLORS = [
  '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
]

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PdfEditor() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()

  // ── Core state ──
  const [file, setFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pages, setPages] = useState<PageInfo[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // ── PDF.js renderer state ──
  const [pdfjsError, setPdfjsError] = useState<string | null>(null)
  const [pdfjsLoadingState, setPdfjsLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')

  // ── Tools ──
  const [activeTool, setActiveTool] = useState<ToolMode>('select')
  const [strokeColor, setStrokeColor] = useState('#ffffff')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [fontSize, setFontSize] = useState(18)
  const [textColor, setTextColor] = useState('#ffffff')
  const [textValue, setTextValue] = useState('')
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle')
  const [highlightColor, setHighlightColor] = useState('#eab308')
  const [autoMatchBackground, setAutoMatchBackground] = useState(true)

  // ── Annotations ──
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([])
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([])

  // ── Drawing state ──
  const [isDrawing, setIsDrawing] = useState(false)
  const currentStrokeRef = useRef<Point[]>([])
  const drawStartRef = useRef<Point | null>(null)

  // ── AI Erase ──
  const [erasingLoading, setErasingLoading] = useState(false)

  // ── Text editing ──
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingTextValue, setEditingTextValue] = useState('')
  const [textFont, setTextFont] = useState('Arial')

  // ── Ad Gate ──
  const [showAdGate, setShowAdGate] = useState(false)

  // ── Text placement ──
  const [placingText, setPlacingText] = useState(false)
  const [textPlacePos, setTextPlacePos] = useState<Point | null>(null)
  const textInputRef = useRef<HTMLInputElement | null>(null)

  // ── Signature pad ──
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [sigDrawing, setSigDrawing] = useState(false)
  const sigStrokesRef = useRef<Point[]>([])

  // ── Image stamp ──
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  // ── UI ──
  const [zoom, setZoom] = useState(100)
  const [showThumbnails, setShowThumbnails] = useState(true)
  const [showPreview, setShowPreview] = useState(false)

  // ── Refs ──
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pageContainerRef = useRef<HTMLDivElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pdfDocRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)

  // ── Derived ──
  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.page === currentPage),
    [annotations, currentPage]
  )

  // ────────────────────────────────────────────────────────────────────────────
  // HISTORY (undo / redo)
  // ────────────────────────────────────────────────────────────────────────────

  const pushHistory = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-40),
      { annotations: cloneAnnotations(annotations), pages: clonePages(pages) },
    ])
    setRedoStack([])
  }, [annotations, pages])

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const snapshot = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))
    setRedoStack((prev) => [
      ...prev,
      { annotations: cloneAnnotations(annotations), pages: clonePages(pages) },
    ])
    setAnnotations(snapshot.annotations)
    setPages(snapshot.pages)
    toast.info('Undo')
  }, [undoStack, annotations, pages])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const snapshot = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, -1))
    setUndoStack((prev) => [
      ...prev,
      { annotations: cloneAnnotations(annotations), pages: clonePages(pages) },
    ])
    setAnnotations(snapshot.annotations)
    setPages(snapshot.pages)
    toast.info('Redo')
  }, [redoStack, annotations, pages])

  // ────────────────────────────────────────────────────────────────────────────
  // PDF LOADING
  // ────────────────────────────────────────────────────────────────────────────

  const loadPdf = useCallback(async (pdfFile: File) => {
    if (loading) return
    setLoading(true)
    try {
      const arrayBuffer = await pdfFile.arrayBuffer()
      // Use pdf-lib to get page info
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      const pageCount = pdfDoc.getPageCount()

      const newPages: PageInfo[] = []
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i)
        const { width, height } = page.getSize()
        newPages.push({
          id: genId(),
          rotation: 0,
          width,
          height,
        })
      }

      // Create object URL for iframe display
      const url = URL.createObjectURL(pdfFile)

      // Also parse with PDF.js for rendering on canvas
      try {
        const pdfjs = await loadPdfJsScript()
        const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
        pdfDocRef.current = pdfjsDoc
        setPdfjsError(null)
      } catch (err: any) {
        console.error('PDF.js parsing failed:', err)
        setPdfjsError(err.message || 'PDF renderer failed to load. Please check internet or open native preview.')
      }

      setFile(pdfFile)
      setPdfUrl(url)
      setPages(newPages)
      setCurrentPage(0)
      setAnnotations([])
      setUndoStack([])
      setRedoStack([])
      toast.success(`Loaded ${pageCount} page${pageCount > 1 ? 's' : ''}`)
    } catch (err) {
      console.error('Failed to load PDF:', err)
      toast.error('Failed to load PDF. The file may be encrypted or corrupted.')
    } finally {
      setLoading(false)
    }
  }, [loading])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped?.type === 'application/pdf') {
        loadPdf(dropped)
      } else {
        toast.error('Please drop a PDF file')
      }
    },
    [loadPdf]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0]
      if (selected && (selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf'))) {
        loadPdf(selected)
      } else {
        toast.error('Please select a PDF file')
      }
    },
    [loadPdf]
  )

  // ────────────────────────────────────────────────────────────────────────────
  // PAGE MANAGEMENT
  // ────────────────────────────────────────────────────────────────────────────

  const rotatePage = useCallback(
    (pageIndex: number) => {
      pushHistory()
      setPages((prev) =>
        prev.map((p, i) =>
          i === pageIndex ? { ...p, rotation: (p.rotation + 90) % 360 } : p
        )
      )
      toast.info(`Page ${pageIndex + 1} rotated`)
    },
    [pushHistory]
  )

  const deletePage = useCallback(
    (pageIndex: number) => {
      if (pages.length <= 1) {
        toast.error('Cannot delete the only page')
        return
      }
      pushHistory()
      setPages((prev) => prev.filter((_, i) => i !== pageIndex))
      setAnnotations((prev) => prev.filter((a) => a.page !== pageIndex))
      // Re-index page numbers in annotations
      setAnnotations((prev) =>
        prev.map((a) => (a.page > pageIndex ? { ...a, page: a.page - 1 } : a))
      )
      if (currentPage >= pages.length - 1) {
        setCurrentPage(Math.max(0, pages.length - 2))
      }
      toast.info(`Page ${pageIndex + 1} deleted`)
    },
    [pages, currentPage, pushHistory]
  )

  const addBlankPage = useCallback(() => {
    pushHistory()
    setPages((prev) => [
      ...prev,
      { id: genId(), rotation: 0, width: 595, height: 842 },
    ])
    toast.success('Blank page added')
  }, [pushHistory])

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(0, Math.min(pages.length - 1, page)))
    },
    [pages.length]
  )

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  // ────────────────────────────────────────────────────────────────────────────
  // SIGNATURE PAD (defined early so the useEffect below can reference it)
  // ────────────────────────────────────────────────────────────────────────────

  const initSigCanvas = useCallback(() => {
    const canvas = sigCanvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    sigStrokesRef.current = []
  }, [])

  // Initialize signature pad canvas when dialog opens
  useEffect(() => {
    if (showSignaturePad) {
      // Small delay to let the dialog render and canvas mount
      const timer = setTimeout(() => initSigCanvas(), 100)
      return () => clearTimeout(timer)
    }
  }, [showSignaturePad, initSigCanvas])

  // ────────────────────────────────────────────────────────────────────────────
  // CANVAS RENDERING
  // ────────────────────────────────────────────────────────────────────────────

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = pageContainerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const cw = rect.width
    const ch = rect.height

    for (const ann of pageAnnotations) {
      if (ann.type === 'drawing') {
        if (ann.points.length < 2) continue
        ctx.beginPath()
        ctx.strokeStyle = ann.color
        ctx.lineWidth = ann.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const pts = ann.points
        ctx.moveTo((pts[0].x / 100) * cw, (pts[0].y / 100) * ch)
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo((pts[i].x / 100) * cw, (pts[i].y / 100) * ch)
        }
        ctx.stroke()
      } else if (ann.type === 'highlight') {
        ctx.fillStyle = ann.color + '55'
        ctx.fillRect(
          (ann.x / 100) * cw,
          (ann.y / 100) * ch,
          (ann.w / 100) * cw,
          (ann.h / 100) * ch
        )
      } else if (ann.type === 'shape') {
        const sx = (ann.x / 100) * cw
        const sy = (ann.y / 100) * ch
        const sw = (ann.w / 100) * cw
        const sh = (ann.h / 100) * ch
        ctx.strokeStyle = ann.color
        ctx.lineWidth = ann.strokeWidth
        if (ann.shapeType === 'rectangle') {
          if (ann.filled) {
            ctx.fillStyle = ann.color
            ctx.fillRect(sx, sy, sw, sh)
          } else {
            ctx.strokeRect(sx, sy, sw, sh)
          }
        } else if (ann.shapeType === 'circle') {
          ctx.beginPath()
          ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2)
          if (ann.filled) {
            ctx.fillStyle = ann.color
            ctx.fill()
          } else {
            ctx.stroke()
          }
        } else if (ann.shapeType === 'line') {
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + sw, sy + sh)
          ctx.stroke()
        }
      } else if (ann.type === 'signature' || ann.type === 'imageStamp') {
        const img = new Image()
        img.src = ann.dataUrl
        if (img.complete) {
          const dw = ann.scale * cw * 0.25
          const dh = (img.naturalHeight / img.naturalWidth) * dw
          ctx.drawImage(img, (ann.x / 100) * cw, (ann.y / 100) * ch, dw, dh)
        }
      }
    }

    // Draw current in-progress stroke or shape preview
    if (isDrawing && currentStrokeRef.current.length >= 2) {
      const pts = currentStrokeRef.current

      if (activeTool === 'ai-erase' && drawStartRef.current) {
        const start = drawStartRef.current
        const end = pts[pts.length - 1]
        const sx = (Math.min(start.x, end.x) / 100) * cw
        const sy = (Math.min(start.y, end.y) / 100) * ch
        const sw = (Math.abs(end.x - start.x) / 100) * cw
        const sh = (Math.abs(end.y - start.y) / 100) * ch
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'
        ctx.fillRect(sx, sy, sw, sh)
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 4])
        ctx.strokeRect(sx, sy, sw, sh)
        ctx.setLineDash([])
      } else if ((activeTool === 'shape' || activeTool === 'whiteout') && drawStartRef.current) {
        // Shape preview
        const start = drawStartRef.current
        const end = pts[pts.length - 1]
        const sx = (Math.min(start.x, end.x) / 100) * cw
        const sy = (Math.min(start.y, end.y) / 100) * ch
        const sw = (Math.abs(end.x - start.x) / 100) * cw
        const sh = (Math.abs(end.y - start.y) / 100) * ch
        
        if (activeTool === 'whiteout') {
          // Whiteout preview
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
          ctx.fillRect(sx, sy, sw, sh)
          ctx.strokeStyle = '#a855f7'
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 4])
          ctx.strokeRect(sx, sy, sw, sh)
          ctx.setLineDash([])
        } else {
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = strokeWidth
          ctx.setLineDash([5, 5])
          if (shapeType === 'rectangle') {
            ctx.strokeRect(sx, sy, sw, sh)
          } else if (shapeType === 'circle') {
            ctx.beginPath()
            ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2)
            ctx.stroke()
          } else if (shapeType === 'line') {
            ctx.beginPath()
            ctx.moveTo((start.x / 100) * cw, (start.y / 100) * ch)
            ctx.lineTo((end.x / 100) * cw, (end.y / 100) * ch)
            ctx.stroke()
          }
          ctx.setLineDash([])
        }
      } else {
        // Freehand stroke preview (pen or highlighter)
        ctx.beginPath()
        ctx.strokeStyle = activeTool === 'highlighter' ? highlightColor + 'aa' : strokeColor
        ctx.lineWidth =
          activeTool === 'highlighter'
            ? Math.max(strokeWidth * 4, 16)
            : strokeWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.moveTo((pts[0].x / 100) * cw, (pts[0].y / 100) * ch)
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo((pts[i].x / 100) * cw, (pts[i].y / 100) * ch)
        }
        ctx.stroke()
      }
    }
  }, [pageAnnotations, isDrawing, activeTool, strokeColor, strokeWidth, highlightColor, shapeType])

  // Redraw on annotation or page changes
  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  // Preload PDF.js on mount
  useEffect(() => {
    setPdfjsLoadingState('loading')
    loadPdfJsScript()
      .then(() => {
        setPdfjsLoadingState('loaded')
      })
      .catch((err) => {
        console.error('Error preloading PDF.js:', err)
        setPdfjsLoadingState('error')
        setPdfjsError(err.message || 'PDF renderer failed to load. Please check internet or open native preview.')
      })
  }, [])

  // Render PDF page to canvas via PDF.js
  const renderPdfPage = useCallback(async () => {
    const canvas = pdfCanvasRef.current
    if (!canvas) return
    const pdfjsDoc = pdfDocRef.current
    if (!pdfjsDoc) return

    try {
      // Cancel any ongoing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }

      const page = await pdfjsDoc.getPage(currentPage + 1)
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
        viewport: viewport,
      }
      
      const renderTask = page.render(renderContext)
      renderTaskRef.current = renderTask
      await renderTask.promise
      renderTaskRef.current = null
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('PDF page render error:', err)
      }
    }
  }, [currentPage])

  // Render PDF.js page when state changes
  useEffect(() => {
    if (pdfDocRef.current) {
      const timer = setTimeout(() => {
        renderPdfPage()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [currentPage, zoom, file, renderPdfPage])

  // Redraw and re-render on resize
  useEffect(() => {
    const handleResize = () => {
      redrawCanvas()
      renderPdfPage()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [redrawCanvas, renderPdfPage])

  // ────────────────────────────────────────────────────────────────────────────
  // POINTER HANDLERS (canvas overlay)
  // ────────────────────────────────────────────────────────────────────────────

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      }
    },
    []
  )

  const samplePageBackground = useCallback((pctX: number, pctY: number): string => {
    const pdfCanvas = pdfCanvasRef.current
    if (!pdfCanvas) return '#ffffff'
    const ctx = pdfCanvas.getContext('2d')
    if (!ctx) return '#ffffff'
    const pxX = Math.floor((pctX / 100) * pdfCanvas.width)
    const pxY = Math.floor((pctY / 100) * pdfCanvas.height)
    try {
      const imgData = ctx.getImageData(pxX, pxY, 1, 1).data
      const r = imgData[0]
      const g = imgData[1]
      const b = imgData[2]
      const a = imgData[3]
      if (a < 50) return '#ffffff'
      const toHex = (c: number) => c.toString(16).padStart(2, '0')
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    } catch (e) {
      console.error('Failed to sample background color:', e)
      return '#ffffff'
    }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = getCanvasPoint(e)

      if (activeTool === 'pen' || activeTool === 'highlighter') {
        setIsDrawing(true)
        currentStrokeRef.current = [pt]
      } else if (activeTool === 'text') {
        setPlacingText(true)
        setTextPlacePos(pt)
        setTimeout(() => textInputRef.current?.focus(), 50)
      } else if (activeTool === 'shape' || activeTool === 'whiteout' || activeTool === 'ai-erase') {
        setIsDrawing(true)
        drawStartRef.current = pt
      } else if (activeTool === 'highlighter') {
        setIsDrawing(true)
        drawStartRef.current = pt
      } else if (activeTool === 'eraser') {
        // Find and remove the nearest annotation
        const threshold = 3
        let found = false
        for (let i = annotations.length - 1; i >= 0; i--) {
          const ann = annotations[i]
          if (ann.page !== currentPage) continue
          if (ann.type === 'drawing') {
            for (const p of ann.points) {
              const dist = Math.sqrt((p.x - pt.x) ** 2 + (p.y - pt.y) ** 2)
              if (dist < threshold) {
                pushHistory()
                setAnnotations((prev) => prev.filter((_, idx) => idx !== i))
                found = true
                break
              }
            }
          } else if (
            ann.type === 'text' ||
            ann.type === 'signature' ||
            ann.type === 'imageStamp'
          ) {
            const dist = Math.sqrt((ann.x - pt.x) ** 2 + (ann.y - pt.y) ** 2)
            if (dist < 5) {
              pushHistory()
              setAnnotations((prev) => prev.filter((_, idx) => idx !== i))
              found = true
            }
          } else if (ann.type === 'highlight' || ann.type === 'shape') {
            if (
              pt.x >= ann.x &&
              pt.x <= ann.x + ann.w &&
              pt.y >= ann.y &&
              pt.y <= ann.y + ann.h
            ) {
              pushHistory()
              setAnnotations((prev) => prev.filter((_, idx) => idx !== i))
              found = true
            }
          }
          if (found) break
        }
        if (found) toast.info('Annotation removed')
      }
    },
    [activeTool, getCanvasPoint, annotations, currentPage, pushHistory]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return
      const pt = getCanvasPoint(e)

      if (activeTool === 'pen' || activeTool === 'highlighter') {
        currentStrokeRef.current = [...currentStrokeRef.current, pt]
        redrawCanvas()
      } else if ((activeTool === 'shape' || activeTool === 'whiteout' || activeTool === 'ai-erase') && drawStartRef.current) {
        // Preview shape (we'll draw it in the redraw)
        const start = drawStartRef.current
        currentStrokeRef.current = [start, pt]
        redrawCanvas()
      }
    },
    [isDrawing, activeTool, getCanvasPoint, redrawCanvas]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return
      const pt = getCanvasPoint(e)

      if (activeTool === 'pen' || activeTool === 'highlighter') {
        const points = [...currentStrokeRef.current, pt]
        if (points.length >= 2) {
          pushHistory()
          setAnnotations((prev) => [
            ...prev,
            {
              id: genId(),
              type: 'drawing' as const,
              page: currentPage,
              points,
              color: activeTool === 'highlighter' ? highlightColor : strokeColor,
              width:
                activeTool === 'highlighter'
                  ? Math.max(strokeWidth * 4, 16)
                  : strokeWidth,
            },
          ])
        }
      } else if (activeTool === 'shape' && drawStartRef.current) {
        const start = drawStartRef.current
        const x = Math.min(start.x, pt.x)
        const y = Math.min(start.y, pt.y)
        const w = Math.abs(pt.x - start.x)
        const h = Math.abs(pt.y - start.y)
        if (w > 0.5 && h > 0.5) {
          pushHistory()
          setAnnotations((prev) => [
            ...prev,
            {
              id: genId(),
              type: 'shape' as const,
              page: currentPage,
              shapeType,
              x,
              y,
              w,
              h,
              color: strokeColor,
              strokeWidth,
            },
          ])
        }
      } else if (activeTool === 'whiteout' && drawStartRef.current) {
        const start = drawStartRef.current
        const x = Math.min(start.x, pt.x)
        const y = Math.min(start.y, pt.y)
        const w = Math.abs(pt.x - start.x)
        const h = Math.abs(pt.y - start.y)
        if (w > 0.5 && h > 0.5) {
          pushHistory()
          let whiteoutColor = strokeColor
          if (autoMatchBackground) {
            whiteoutColor = samplePageBackground(start.x, start.y)
          }
          setAnnotations((prev) => [
            ...prev,
            {
              id: genId(),
              type: 'shape' as const,
              shapeType: 'rectangle' as const,
              filled: true,
              page: currentPage,
              x,
              y,
              w,
              h,
              color: whiteoutColor,
              strokeWidth: 0,
            },
          ])
        }
      } else if (activeTool === 'ai-erase' && drawStartRef.current) {
        const start = drawStartRef.current
        const x = Math.min(start.x, pt.x)
        const y = Math.min(start.y, pt.y)
        const wPct = Math.abs(pt.x - start.x)
        const hPct = Math.abs(pt.y - start.y)
        if (wPct < 1 || hPct < 1) { setIsDrawing(false); currentStrokeRef.current = []; drawStartRef.current = null; return }

        setErasingLoading(true)
        const pdfCanvas = pdfCanvasRef.current
        if (pdfCanvas) {
          const px = Math.floor((x / 100) * pdfCanvas.width)
          const py = Math.floor((y / 100) * pdfCanvas.height)
          const pw = Math.floor((wPct / 100) * pdfCanvas.width)
          const ph = Math.floor((hPct / 100) * pdfCanvas.height)
          const ctx = pdfCanvas.getContext('2d')
          if (ctx) {
            smartFillRegion(ctx, px, py, pw, ph)
            try {
              const regionData = ctx.getImageData(px, py, pw, ph)
              const tempCanvas = document.createElement('canvas')
              tempCanvas.width = pw; tempCanvas.height = ph
              const tempCtx = tempCanvas.getContext('2d')
              if (tempCtx) {
                tempCtx.putImageData(regionData, 0, 0)
                const regionBase64 = tempCanvas.toDataURL('image/jpeg', 0.8)
                fetch('/api/ai/text-erase', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ image: regionBase64, region: { x: px, y: py, w: pw, h: ph } })
                }).catch(() => {})
              }
            } catch {}
            redrawCanvas()
            toast.success('Text erased via smart fill')
          }
        }
        setErasingLoading(false)
      }

      setIsDrawing(false)
      currentStrokeRef.current = []
      drawStartRef.current = null
    },
    [isDrawing, activeTool, getCanvasPoint, currentPage, pushHistory, strokeColor, strokeWidth, highlightColor, shapeType, autoMatchBackground, samplePageBackground]
  )

  // ────────────────────────────────────────────────────────────────────────────
  // TEXT PLACEMENT
  // ────────────────────────────────────────────────────────────────────────────

  const confirmText = useCallback(() => {
    if (!textValue.trim() || !textPlacePos) return
    pushHistory()
    setAnnotations((prev) => [
      ...prev,
      {
        id: genId(),
        type: 'text' as const,
        page: currentPage,
        x: textPlacePos.x,
        y: textPlacePos.y,
        content: textValue,
        fontSize,
        color: textColor,
        font: textFont,
      },
    ])
    setTextValue('')
    setPlacingText(false)
    setTextPlacePos(null)
    toast.success('Text added')
  }, [textValue, textPlacePos, currentPage, fontSize, textColor, textFont, pushHistory])

  const startEditText = useCallback((ann: TextAnnotation) => {
    setEditingTextId(ann.id)
    setEditingTextValue(ann.content)
    setTextColor(ann.color)
    setTextFont(ann.font || 'Arial')
    setFontSize(ann.fontSize)
  }, [])

  const saveEditText = useCallback(() => {
    if (!editingTextId || !editingTextValue.trim()) return
    pushHistory()
    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === editingTextId && a.type === 'text'
          ? { ...a, content: editingTextValue, color: textColor, fontSize, font: textFont }
          : a
      )
    )
    setEditingTextId(null)
    setEditingTextValue('')
    toast.success('Text updated')
  }, [editingTextId, editingTextValue, textColor, fontSize, textFont, pushHistory])

  const handleTextDragStart = useCallback((e: React.PointerEvent, ann: TextAnnotation) => {
    if (activeTool !== 'select') return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startX = ann.x
    const startY = ann.y

    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startMouseX) / rect.width) * 100
      const dy = ((ev.clientY - startMouseY) / rect.height) * 100
      setAnnotations((prev) =>
        prev.map((a) => a.id === ann.id ? { ...a, x: startX + dx, y: startY + dy } : a)
      )
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [activeTool])

  const cancelText = useCallback(() => {
    setTextValue('')
    setPlacingText(false)
    setTextPlacePos(null)
  }, [])

  // ────────────────────────────────────────────────────────────────────────────
  // SIGNATURE PAD (handlers only — initSigCanvas defined above near useEffect)
  // ────────────────────────────────────────────────────────────────────────────

  const handleSigPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      setSigDrawing(true)
      const canvas = sigCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      sigStrokesRef.current = [{ x, y }]
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.beginPath()
      ctx.moveTo(x, y)
    },
    []
  )

  const handleSigPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!sigDrawing) return
      const canvas = sigCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      sigStrokesRef.current = [...sigStrokesRef.current, { x, y }]
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(x, y)
      ctx.stroke()
    },
    [sigDrawing]
  )

  const handleSigPointerUp = useCallback(() => {
    setSigDrawing(false)
  }, [])

  const clearSignature = useCallback(() => {
    initSigCanvas()
  }, [initSigCanvas])

  const applySignature = useCallback(() => {
    const canvas = sigCanvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    if (sigStrokesRef.current.length < 3) {
      toast.error('Please draw your signature first')
      return
    }
    pushHistory()
    setAnnotations((prev) => [
      ...prev,
      {
        id: genId(),
        type: 'signature' as const,
        page: currentPage,
        x: 50,
        y: 70,
        dataUrl,
        scale: 1,
      },
    ])
    setShowSignaturePad(false)
    toast.success('Signature placed')
  }, [currentPage, pushHistory])

  // ────────────────────────────────────────────────────────────────────────────
  // IMAGE STAMP
  // ────────────────────────────────────────────────────────────────────────────

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const imgFile = e.target.files?.[0]
      if (!imgFile) return
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        pushHistory()
        setAnnotations((prev) => [
          ...prev,
          {
            id: genId(),
            type: 'imageStamp' as const,
            page: currentPage,
            x: 30,
            y: 30,
            dataUrl,
            scale: 1,
          },
        ])
        toast.success('Image placed')
      }
      reader.readAsDataURL(imgFile)
    },
    [currentPage, pushHistory]
  )

  // ────────────────────────────────────────────────────────────────────────────
  // HIGHLIGHT TOOL (drag to create)
  // ────────────────────────────────────────────────────────────────────────────

  // Highlight is handled through the drawing system above, using 'highlighter' mode
  // which creates thicker, semi-transparent strokes

  const addQuickHighlight = useCallback(() => {
    pushHistory()
    setAnnotations((prev) => [
      ...prev,
      {
        id: genId(),
        type: 'highlight' as const,
        page: currentPage,
        x: 10,
        y: 30,
        w: 80,
        h: 4,
        color: highlightColor,
      },
    ])
    toast.success('Highlight added — drag to resize')
  }, [currentPage, highlightColor, pushHistory])

  // ────────────────────────────────────────────────────────────────────────────
  // SAVE / EXPORT
  // ────────────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (saving) return
    if (!file) return
    if (isLimitReached('pdf-editor')) { setShowAdGate(true); return }
    setSaving(true)
    try {
      const base64 = await fileToBase64(file)

      // Prepare annotations for backend, converting percentage-based coords
      const payloadAnnotations = annotations.map((ann) => {
        if (ann.type === 'drawing') {
          return {
            type: 'drawing',
            page: ann.page,
            points: ann.points,
            color: ann.color,
            width: ann.width,
          }
        }
        if (ann.type === 'text') {
          return {
            type: 'text',
            page: ann.page,
            x: ann.x,
            y: ann.y,
            content: ann.content,
            fontSize: ann.fontSize,
            color: ann.color,
          }
        }
        if (ann.type === 'highlight') {
          return {
            type: 'highlight',
            page: ann.page,
            x: ann.x,
            y: ann.y,
            w: ann.w,
            h: ann.h,
            color: ann.color,
          }
        }
        if (ann.type === 'shape') {
          return {
            type: 'shape',
            page: ann.page,
            shapeType: ann.shapeType,
            x: ann.x,
            y: ann.y,
            w: ann.w,
            h: ann.h,
            color: ann.color,
            strokeWidth: ann.strokeWidth,
            filled: ann.filled,
          }
        }
        if (ann.type === 'signature') {
          return {
            type: 'signature',
            page: ann.page,
            x: ann.x,
            y: ann.y,
            dataUrl: ann.dataUrl,
            scale: ann.scale,
          }
        }
        if (ann.type === 'imageStamp') {
          return {
            type: 'imageStamp',
            page: ann.page,
            x: ann.x,
            y: ann.y,
            dataUrl: ann.dataUrl,
            scale: ann.scale,
          }
        }
        return ann
      })

      const blob = await compilePdfOffline(
        file,
        payloadAnnotations,
        pages.map((p) => p.rotation),
        []
      )
      const filename = `edited-${file.name}`
      await downloadBlob(blob, filename)

      // Convert blob to DataURL to store inside Zustand for offline loading later
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
          incrementUsage('pdf-editor')
          addFile({
            id: genId(),
            name: filename,
            type: 'pdf',
            size: blob.size,
            createdAt: new Date(),
            category: ['recent', 'edited'],
            favorite: false,
            dataUrl: shouldWatermark('pdf-editor') ? dataUrl : dataUrl
          })
          toast.success('PDF saved successfully!')
          showAdAfterSuccess()
      }
      reader.onerror = () => {
        addFile({
          id: genId(),
          name: filename,
          type: 'pdf',
          size: blob.size,
          createdAt: new Date(),
          category: ['recent', 'edited'],
          favorite: false,
        })
        toast.success('PDF saved (preview not cached)')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Failed to save PDF')
    } finally {
      setSaving(false)
    }
  }, [file, annotations, pages, addFile, showAdAfterSuccess])

  const handleShare = useCallback(async () => {
    if (saving || !file) return
    setSaving(true)
    try {
      const base64 = await fileToBase64(file)
      const payloadAnnotations = annotations.map((ann) => {
        if (ann.type === 'drawing') return { type: 'drawing', page: ann.page, points: ann.points, color: ann.color, width: ann.width }
        if (ann.type === 'text') return { type: 'text', page: ann.page, x: ann.x, y: ann.y, content: ann.content, fontSize: ann.fontSize, color: ann.color }
        if (ann.type === 'highlight') return { type: 'highlight', page: ann.page, x: ann.x, y: ann.y, w: ann.w, h: ann.h, color: ann.color }
        if (ann.type === 'shape') return { type: 'shape', page: ann.page, shapeType: ann.shapeType, x: ann.x, y: ann.y, w: ann.w, h: ann.h, color: ann.color, strokeWidth: ann.strokeWidth, filled: ann.filled }
        if (ann.type === 'signature') return { type: 'signature', page: ann.page, x: ann.x, y: ann.y, dataUrl: ann.dataUrl, scale: ann.scale }
        if (ann.type === 'imageStamp') return { type: 'imageStamp', page: ann.page, x: ann.x, y: ann.y, dataUrl: ann.dataUrl, scale: ann.scale }
        return ann
      })

      const blob = await compilePdfOffline(
        file,
        payloadAnnotations,
        pages.map((p) => p.rotation),
        []
      )

      await shareFile(blob, `edited-${file.name}`, 'Edited PDF Document')
      showAdAfterSuccess()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Share failed')
    } finally {
      setSaving(false)
    }
  }, [file, annotations, pages, saving, showAdAfterSuccess])

  const resetEditor = useCallback(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setFile(null)
    setPdfUrl(null)
    setPages([])
    setCurrentPage(0)
    setAnnotations([])
    setUndoStack([])
    setRedoStack([])
    setActiveTool('select')
  }, [pdfUrl])

  // ────────────────────────────────────────────────────────────────────────────
  // CURSOR FOR ACTIVE TOOL
  // ────────────────────────────────────────────────────────────────────────────

  const getCursor = useCallback((): string => {
    switch (activeTool) {
      case 'select':
        return 'default'
      case 'pen':
      case 'highlighter':
        return 'crosshair'
      case 'text':
        return 'text'
      case 'eraser':
        return 'pointer'
      case 'shape':
      case 'whiteout':
        return 'crosshair'
      case 'image':
      case 'signature':
        return 'copy'
      default:
        return 'default'
    }
  }, [activeTool])

  // ────────────────────────────────────────────────────────────────────────────
  // TOOL DEFINITIONS
  // ────────────────────────────────────────────────────────────────────────────

  const tools: { id: ToolMode; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 className="h-4 w-4" />, label: 'Select' },
    { id: 'text', icon: <Type className="h-4 w-4" />, label: 'Text' },
    { id: 'pen', icon: <Pen className="h-4 w-4" />, label: 'Pen' },
    { id: 'highlighter', icon: <Highlighter className="h-4 w-4" />, label: 'Highlight' },
    { id: 'eraser', icon: <Eraser className="h-4 w-4" />, label: 'Eraser' },
    { id: 'ai-erase', icon: <PaintBucket className="h-4 w-4" />, label: 'AI Erase' },
    { id: 'whiteout', icon: <EyeOff className="h-4 w-4" />, label: 'Manual Erase' },
    { id: 'shape', icon: <Square className="h-4 w-4" />, label: 'Shape' },
    { id: 'image', icon: <ImageIcon className="h-4 w-4" />, label: 'Image' },
    { id: 'signature', icon: <PenTool className="h-4 w-4" />, label: 'Signature' },
  ]

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER — Upload Zone
  // ────────────────────────────────────────────────────────────────────────────

  if (!file) {
    return (
      <div className="flex flex-col h-full bg-mesh">
        <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="text-foreground hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <FileText className="h-5 w-5 text-electric" />
          <h2 className="text-lg font-semibold gradient-text">PDF Editor</h2>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={async () => {
              const picked = await pickSinglePdf()
              if (picked) {
                loadPdf(picked)
              }
            }}
            className={`glass-card-hover p-10 flex flex-col items-center justify-center gap-4 cursor-pointer border-2 border-dashed transition-colors w-full max-w-md ${
              dragOver ? 'border-electric bg-electric/10' : 'border-glass-border'
            }`}
          >
            <div className="h-20 w-20 rounded-full bg-electric/20 flex items-center justify-center">
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="h-8 w-8 border-3 border-electric border-t-transparent rounded-full"
                />
              ) : (
                <Upload className="h-10 w-10 text-electric" />
              )}
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-foreground mb-1">
                {loading ? 'Loading PDF...' : 'Upload a PDF to edit'}
              </p>
              <p className="text-sm text-muted-foreground">
                Drag & drop or click to browse
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </motion.div>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER — Editor
  // ────────────────────────────────────────────────────────────────────────────

  const pageAspect =
    pages[currentPage]?.width && pages[currentPage]?.height
      ? pages[currentPage].width / pages[currentPage].height
      : 210 / 297

  const pageRotation = pages[currentPage]?.rotation || 0

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 p-3 glass-card rounded-none border-0 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="text-foreground hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col min-w-0">
            <h2 className="text-xs font-semibold gradient-text">
              PDF Editor
            </h2>
            {file && (
              <span className="text-[9px] text-muted-foreground truncate max-w-[120px] sm:max-w-[200px] font-mono">
                {file.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={undo}
                disabled={undoStack.length === 0}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={redo}
                disabled={redoStack.length === 0}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
          <div className="w-px h-5 bg-glass-border mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showPreview ? 'Edit Mode' : 'Preview PDF'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className="h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                  />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download PDF</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-none border-0 border-b border-glass-border px-2 py-1.5"
      >
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* Tool buttons */}
          {tools.map((tool) => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTool === tool.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    if (tool.id === 'signature') {
                      setShowSignaturePad(true)
                    } else if (tool.id === 'image') {
                      imageInputRef.current?.click()
                    } else {
                      setActiveTool(tool.id)
                    }
                  }}
                  className={`shrink-0 h-8 w-8 p-0 ${
                    activeTool === tool.id
                      ? 'bg-electric text-electric-foreground'
                      : ''
                  }`}
                >
                  {tool.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tool.label}</TooltipContent>
            </Tooltip>
          ))}

          <div className="w-px h-6 bg-glass-border mx-1 shrink-0" />

          {/* Color picker */}
          <div className="flex items-center gap-1 shrink-0">
            {PRESET_COLORS.slice(0, 5).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setStrokeColor(c)
                  setTextColor(c)
                }}
                className={`h-5 w-5 rounded-full border-2 transition-transform ${
                  strokeColor === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => {
                setStrokeColor(e.target.value)
                setTextColor(e.target.value)
              }}
              className="h-5 w-5 rounded cursor-pointer shrink-0"
            />
          </div>

          <div className="w-px h-6 bg-glass-border mx-1 shrink-0" />

          {/* Stroke width */}
          <div className="flex items-center gap-1.5 shrink-0 min-w-[80px]">
            <Label className="text-[10px] text-muted-foreground shrink-0">Size</Label>
            <Slider
              value={[strokeWidth]}
              min={1}
              max={20}
              step={1}
              onValueChange={([v]) => setStrokeWidth(v)}
              className="w-16"
            />
          </div>
        </div>
      </motion.div>

      {/* ── Tool Options Bar ── */}
      <AnimatePresence>
        {(activeTool === 'text' ||
          activeTool === 'shape' ||
          activeTool === 'highlighter' ||
          activeTool === 'whiteout') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-none border-0 border-b border-glass-border px-3 py-2 overflow-hidden"
          >
            <div className="flex items-center gap-3 flex-wrap">
              {activeTool === 'whiteout' && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={autoMatchBackground}
                        onChange={(e) => setAutoMatchBackground(e.target.checked)}
                        className="rounded border-glass-border text-electric bg-transparent focus:ring-electric h-3.5 w-3.5"
                      />
                      Auto-match Background
                    </label>
                  </div>
                  {!autoMatchBackground && (
                    <>
                      <div className="w-px h-4 bg-glass-border mx-1 shrink-0" />
                      <Label className="text-xs text-muted-foreground shrink-0">
                        Mask Color
                      </Label>
                      <div className="flex items-center gap-1 shrink-0">
                        {['#ffffff', '#f4f4f5', '#fef08a', '#e4e4e7', '#000000'].map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              setStrokeColor(c)
                              setTextColor(c)
                            }}
                            className={`h-5 w-5 rounded-full border-2 transition-transform ${
                              strokeColor === c ? 'border-white scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="w-px h-4 bg-glass-border mx-1 shrink-0" />
                  <Label className="text-xs text-muted-foreground shrink-0">
                    Click & drag to whiteout regions
                  </Label>
                </>
              )}
              {activeTool === 'text' && (
                <>
                  <Label className="text-xs text-muted-foreground shrink-0">
                    Font
                  </Label>
                  <Slider
                    value={[fontSize]}
                    min={8}
                    max={72}
                    step={1}
                    onValueChange={([v]) => setFontSize(v)}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">
                    {fontSize}px
                  </span>
                  <Label className="text-xs text-muted-foreground shrink-0 ml-2">
                    Click on page to place text
                  </Label>
                </>
              )}
              {activeTool === 'shape' && (
                <>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'rectangle', icon: <Square className="h-4 w-4" /> },
                        { id: 'circle', icon: <Circle className="h-4 w-4" /> },
                        { id: 'line', icon: <Minus className="h-4 w-4" /> },
                      ] as const
                    ).map((s) => (
                      <Button
                        key={s.id}
                        variant={shapeType === s.id ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setShapeType(s.id)}
                        className={`h-7 w-7 p-0 ${
                          shapeType === s.id
                            ? 'bg-electric text-electric-foreground'
                            : ''
                        }`}
                      >
                        {s.icon}
                      </Button>
                    ))}
                  </div>
                  <Label className="text-xs text-muted-foreground shrink-0">
                    Click & drag to draw shape
                  </Label>
                </>
              )}
              {activeTool === 'highlighter' && (
                <>
                  <Label className="text-xs text-muted-foreground shrink-0">
                    Color
                  </Label>
                  <div className="flex items-center gap-1">
                    {['#eab308', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'].map(
                      (c) => (
                        <button
                          key={c}
                          onClick={() => setHighlightColor(c)}
                          className={`h-5 w-5 rounded-full border-2 ${
                            highlightColor === c
                              ? 'border-white scale-110'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      )
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addQuickHighlight}
                    className="h-7 text-xs ml-2"
                  >
                    + Quick Highlight
                  </Button>
                  <Label className="text-xs text-muted-foreground shrink-0">
                    Draw or add quick highlight
                  </Label>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Page Thumbnails Sidebar */}
        <AnimatePresence>
          {showThumbnails && pages.length > 1 && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 72, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="glass-card rounded-none border-0 border-r border-glass-border flex flex-col overflow-hidden shrink-0"
            >
              <div className="p-1.5 flex items-center justify-between border-b border-glass-border">
                <span className="text-[10px] text-muted-foreground font-medium">
                  Pages
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setShowThumbnails(false)}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                {pages.map((page, idx) => (
                  <motion.button
                    key={page.id}
                    onClick={() => goToPage(idx)}
                    className={`w-full rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-0.5 p-1 ${
                      idx === currentPage
                        ? 'border-electric electric-glow-sm bg-electric/10'
                        : 'border-glass-border hover:border-electric/40'
                    }`}
                    style={{
                      aspectRatio: `${page.width}/${page.height}`,
                      transform: `rotate(${page.rotation}deg)`,
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {idx + 1}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center — Page Display */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Zoom Controls */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-glass-border/50">
            <div className="flex items-center gap-1.5">
              {!showThumbnails && pages.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowThumbnails(true)}
                >
                  <GripVertical className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setZoom(Math.max(50, zoom - 25))}
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setZoom(Math.min(250, zoom + 25))}
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              {currentPage + 1} / {pages.length}
              {annotations.filter((a) => a.page === currentPage).length > 0 &&
                ` · ${annotations.filter((a) => a.page === currentPage).length} annotations`}
            </span>
          </div>

          {/* Scrollable Page Area */}
          <div className="flex-1 overflow-auto p-4 flex justify-center">
            <div
              ref={pageContainerRef}
              className="relative bg-white rounded-lg shadow-2xl"
              style={{
                width: `${zoom * 2}px`,
                aspectRatio: pageRotation % 180 !== 0 ? `${pages[currentPage]?.height || 297}/${pages[currentPage]?.width || 210}` : `${pages[currentPage]?.width || 210}/${pages[currentPage]?.height || 297}`,
                transform: `rotate(${pageRotation}deg)`,
                transition: 'transform 0.3s ease',
                maxWidth: '100%',
              }}
            >
              {/* PDF Content — real background canvas render via PDF.js */}
              {pdfUrl && !showPreview && (
                pdfjsError ? (
                  <div className="absolute inset-0 w-full h-full rounded-lg bg-slate-900 flex flex-col items-center justify-center p-4 text-center select-none overflow-hidden border border-glass-border">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-2">
                      <FileText className="h-5 w-5 text-red-500" />
                    </div>
                    <h3 className="text-xs font-semibold text-white truncate max-w-full px-2 mb-1">
                      {file?.name || 'Document.pdf'}
                    </h3>
                    <p className="text-[10px] text-red-400 font-medium px-4 mb-3 leading-normal max-w-[240px]">
                      {pdfjsError}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (file) {
                          try {
                            await openFile(file, file.name)
                          } catch (err) {
                            toast.error('Failed to open PDF preview')
                          }
                        }
                      }}
                      className="text-[10px] bg-white/5 border-white/10 text-white hover:bg-white/10 flex items-center gap-1.5 py-0.5 px-2.5 h-7 shadow-sm transition-all"
                    >
                      <Eye className="h-3 w-3 text-electric" />
                      Open Native Preview
                    </Button>
                  </div>
                ) : (
                  <canvas
                    ref={pdfCanvasRef}
                    className="absolute inset-0 w-full h-full rounded-lg bg-white"
                  />
                )
              )}

              {/* Preview mode — full PDF viewer */}
              {pdfUrl && showPreview && (
                typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform() ? (
                  <div className="absolute inset-0 w-full h-full rounded-lg bg-slate-950 flex flex-col items-center justify-center p-4 text-center select-none border border-glass-border">
                    <div className="w-12 h-12 rounded-full bg-electric/15 flex items-center justify-center mb-3">
                      <Eye className="h-6 w-6 text-electric" />
                    </div>
                    <h3 className="text-xs font-semibold text-white truncate max-w-full px-2 mb-1">
                      Full PDF Preview
                    </h3>
                    <p className="text-[9px] text-slate-400 max-w-[160px] mb-4">
                      Open in standard native PDF viewer to read or print the compiled document.
                    </p>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (file) {
                          try {
                            await openFile(file, file.name)
                          } catch (err) {
                            toast.error('Failed to open PDF preview')
                          }
                        }
                      }}
                      className="bg-electric text-white hover:bg-electric/90 flex items-center gap-1.5 text-[10px] py-1 px-3 h-8 shadow-sm transition-all"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Open PDF Preview
                    </Button>
                  </div>
                ) : (
                  <iframe
                    src={`${pdfUrl}#page=${currentPage + 1}`}
                    className="absolute inset-0 w-full h-full rounded-lg"
                    title="PDF Preview"
                  />
                )
              )}

              {/* Canvas overlay for annotations */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full rounded-lg"
                style={{
                  pointerEvents:
                    activeTool !== 'select' || placingText
                      ? 'auto'
                      : 'none',
                  cursor: getCursor(),
                  zIndex: 10,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />

              {/* Text annotations (HTML overlay for better text rendering) */}
              {pageAnnotations
                .filter((a) => a.type === 'text')
                .map((ann) => (
                  <div
                    key={ann.id}
                    className="absolute z-20 select-none group cursor-pointer"
                    style={{
                      left: `${ann.x}%`,
                      top: `${ann.y}%`,
                      transform: 'translate(-50%, -50%)',
                      color: ann.color,
                      fontFamily: ann.font || 'Arial',
                      fontSize: `${ann.fontSize * (zoom / 100)}px`,
                      fontWeight: 500,
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      pointerEvents: activeTool === 'select' ? 'auto' : 'none',
                    }}
                    onDoubleClick={(e) => { e.stopPropagation(); startEditText(ann) }}
                    onPointerDown={(e) => { if (activeTool === 'select') handleTextDragStart(e, ann) }}
                  >
                    <span className="whitespace-nowrap">{ann.content}</span>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:flex gap-0.5 bg-background/90 rounded px-1 py-0.5 shadow-sm z-30">
                      <button
                        className="h-4 w-4 flex items-center justify-center hover:bg-white/10 rounded text-[9px]"
                        title="Edit"
                        onClick={(e) => { e.stopPropagation(); startEditText(ann) }}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button
                        className="h-4 w-4 flex items-center justify-center hover:bg-white/10 rounded text-[9px]"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); pushHistory(); setAnnotations((prev) => prev.filter((a) => a.id !== ann.id)); toast.success('Text deleted') }}
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                ))}

              {/* Text placement input */}
              {placingText && textPlacePos && (
                <div
                  className="absolute z-30 flex items-center gap-1"
                  style={{
                    left: `${textPlacePos.x}%`,
                    top: `${textPlacePos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <input
                    ref={textInputRef}
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmText()
                      if (e.key === 'Escape') cancelText()
                    }}
                    placeholder="Type text..."
                    className="glass-input px-2 py-1 text-sm min-w-[120px]"
                    style={{
                      color: textColor,
                      fontSize: `${fontSize * (zoom / 100)}px`,
                    }}
                  />
                  <select
                    value={textFont}
                    onChange={(e) => setTextFont(e.target.value)}
                    className="glass-input text-[10px] h-7 px-1 rounded bg-transparent"
                  >
                    <option className="bg-background">Arial</option>
                    <option className="bg-background">Helvetica</option>
                    <option className="bg-background">Times New Roman</option>
                    <option className="bg-background">Courier New</option>
                    <option className="bg-background">Georgia</option>
                    <option className="bg-background">Verdana</option>
                    <option className="bg-background">Impact</option>
                  </select>
                  <Button
                    size="icon"
                    className="h-6 w-6 bg-electric text-electric-foreground shrink-0"
                    onClick={confirmText}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={cancelText}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {editingTextId && (
                <div className="absolute z-30 bottom-2 left-2 right-2 flex gap-1 bg-background/90 p-1.5 rounded-lg">
                  <input
                    value={editingTextValue}
                    onChange={(e) => setEditingTextValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditText(); if (e.key === 'Escape') setEditingTextId(null) }}
                    className="flex-1 glass-input px-2 py-1 text-xs min-w-0"
                    autoFocus
                  />
                  <Button size="icon" className="h-7 w-7 bg-electric shrink-0" onClick={saveEditText}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingTextId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {erasingLoading && (
                <div className="absolute inset-0 bg-black/20 rounded flex items-center justify-center z-40">
                  <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-lg">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[10px]">Erasing...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-glass-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="h-7"
            >
              <ChevronLeft className="h-4 w-4 mr-0.5" /> Prev
            </Button>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => rotatePage(currentPage)}
              >
                <RotateCw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => deletePage(currentPage)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={addBlankPage}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= pages.length - 1}
              className="h-7"
            >
              Next <ChevronRight className="h-4 w-4 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Bottom Action Bar ── */}
      <div className="glass-card rounded-none border-0 border-t border-glass-border p-2">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 electric-glow bg-electric hover:bg-electric/90 text-electric-foreground h-9"
          >
            {saving ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                className="h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"
              />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save PDF
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 glass-card-hover border-glass-border shrink-0"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-9 glass-card-hover border-glass-border shrink-0 px-3"
            onClick={resetEditor}
          >
            New
          </Button>
        </div>
      </div>

      {/* ── Signature Pad Dialog ── */}
      <Dialog open={showSignaturePad} onOpenChange={setShowSignaturePad}>
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="gradient-text">Draw Your Signature</DialogTitle>
            <DialogDescription>
              Use your mouse or finger to sign below
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden border border-glass-border bg-white">
            <canvas
              ref={sigCanvasRef}
              className="w-full touch-none"
              style={{ aspectRatio: '3/1', cursor: 'crosshair' }}
              onPointerDown={handleSigPointerDown}
              onPointerMove={handleSigPointerMove}
              onPointerUp={handleSigPointerUp}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={clearSignature} className="gap-1.5">
              <Eraser className="h-4 w-4" /> Clear
            </Button>
            <Button
              onClick={applySignature}
              className="bg-electric text-electric-foreground gap-1.5"
            >
              <Check className="h-4 w-4" /> Apply Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdGateModal
        open={showAdGate}
        feature="PDF Editor"
        onWatchAd={() => { grantBonusUse('pdf-editor'); setShowAdGate(false); toast.success('One more use granted!') }}
        onPremium={() => { setShowAdGate(false) }}
        onClose={() => setShowAdGate(false)}
      />
      {/* Hidden file input for image stamps */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
    </div>
  )
}
