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
  GripVertical,
  PenTool,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

// ─── Types ───────────────────────────────────────────────────────────────────

type ToolMode = 'select' | 'text' | 'pen' | 'highlighter' | 'eraser' | 'image' | 'signature' | 'shape'

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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function cloneAnnotations(annotations: Annotation[]): Annotation[] {
  return JSON.parse(JSON.stringify(annotations))
}

function clonePages(pages: PageInfo[]): PageInfo[] {
  return JSON.parse(JSON.stringify(pages))
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

  // ── Tools ──
  const [activeTool, setActiveTool] = useState<ToolMode>('select')
  const [strokeColor, setStrokeColor] = useState('#ffffff')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [fontSize, setFontSize] = useState(18)
  const [textColor, setTextColor] = useState('#ffffff')
  const [textValue, setTextValue] = useState('')
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle')
  const [highlightColor, setHighlightColor] = useState('#eab308')

  // ── Annotations ──
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([])
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([])

  // ── Drawing state ──
  const [isDrawing, setIsDrawing] = useState(false)
  const currentStrokeRef = useRef<Point[]>([])
  const drawStartRef = useRef<Point | null>(null)

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
      if (selected?.type === 'application/pdf') {
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
          ctx.strokeRect(sx, sy, sw, sh)
        } else if (ann.shapeType === 'circle') {
          ctx.beginPath()
          ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2)
          ctx.stroke()
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

      if (activeTool === 'shape' && drawStartRef.current) {
        // Shape preview
        const start = drawStartRef.current
        const end = pts[pts.length - 1]
        const sx = (Math.min(start.x, end.x) / 100) * cw
        const sy = (Math.min(start.y, end.y) / 100) * ch
        const sw = (Math.abs(end.x - start.x) / 100) * cw
        const sh = (Math.abs(end.y - start.y) / 100) * ch
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

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => redrawCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [redrawCanvas])

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
      } else if (activeTool === 'shape') {
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
      } else if (activeTool === 'shape' && drawStartRef.current) {
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
      }

      setIsDrawing(false)
      currentStrokeRef.current = []
      drawStartRef.current = null
    },
    [isDrawing, activeTool, getCanvasPoint, currentPage, pushHistory, strokeColor, strokeWidth, highlightColor, shapeType]
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
      },
    ])
    setTextValue('')
    setPlacingText(false)
    setTextPlacePos(null)
    toast.success('Text added')
  }, [textValue, textPlacePos, currentPage, fontSize, textColor, pushHistory])

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

      const response = await fetchWithTimeout('/api/pdf/editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          annotations: payloadAnnotations,
          pageRotations: pages.map((p) => p.rotation),
          deletedPages: [],
        }),
      }, 15000)
      const blob = await response.blob()
      const filename = `edited-${file.name}`
      downloadBlob(blob, filename)
      addFile({
        id: genId(),
        name: filename,
        type: 'pdf',
        size: blob.size,
        createdAt: new Date(),
        category: ['recent', 'edited'],
        favorite: false,
      })
      toast.success('PDF saved successfully!')
      // Show interstitial ad after successful save/download
      showAdAfterSuccess()
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Failed to save PDF')
    } finally {
      setSaving(false)
    }
  }, [file, annotations, pages, addFile, showAdAfterSuccess])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ScanMaster PDF Editor',
          text: 'Edit PDFs with ease',
        })
        // Show interstitial ad after successful share
        showAdAfterSuccess()
      } catch {
        /* cancelled */
      }
    } else {
      toast.info('Share not supported on this browser')
    }
  }, [showAdAfterSuccess])

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
            onClick={() => fileInputRef.current?.click()}
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
          <FileText className="h-5 w-5 text-electric" />
          <h2 className="text-sm font-semibold gradient-text hidden sm:block">
            PDF Editor
          </h2>
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
          activeTool === 'highlighter') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-none border-0 border-b border-glass-border px-3 py-2 overflow-hidden"
          >
            <div className="flex items-center gap-3 flex-wrap">
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
              {/* PDF Content — iframe for actual PDF rendering */}
              {pdfUrl && !showPreview && (
                <iframe
                  ref={iframeRef}
                  src={`${pdfUrl}#page=${currentPage + 1}&toolbar=0&navpanes=0`}
                  className="absolute inset-0 w-full h-full rounded-lg"
                  style={{
                    pointerEvents: activeTool === 'select' ? 'auto' : 'none',
                  }}
                  title={`PDF Page ${currentPage + 1}`}
                />
              )}

              {/* Preview mode — full PDF viewer */}
              {pdfUrl && showPreview && (
                <iframe
                  src={`${pdfUrl}#page=${currentPage + 1}`}
                  className="absolute inset-0 w-full h-full rounded-lg"
                  title="PDF Preview"
                />
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
                    className="absolute z-20 select-none"
                    style={{
                      left: `${ann.x}%`,
                      top: `${ann.y}%`,
                      transform: 'translate(-50%, -50%)',
                      color: ann.color,
                      fontSize: `${ann.fontSize * (zoom / 100)}px`,
                      fontWeight: 500,
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      pointerEvents: 'none',
                    }}
                  >
                    {ann.content}
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
