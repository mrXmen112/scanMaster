'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Image as ImageIcon,
  Edit,
  Type,
  Square,
  Circle,
  EyeOff,
  Trash2,
  Undo2,
  Redo2,
  Loader2,
  Share2,
  Download,
  CheckCircle,
  ArrowRight,
  Sparkles,
  PaintBucket,
  Move,
  X,
  GripHorizontal,
  Palette,
  Eraser,
  MousePointer2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { pickImages, downloadFile, shareFile } from '@/lib/capacitor-fs'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'
import { incrementUsage, isLimitReached, shouldWatermark, grantBonusUse } from '@/lib/usage-tracker'
import { applyImageWatermark } from '@/lib/watermark'
import AdGateModal from './AdGateModal'

type EditMode = 'select' | 'pen' | 'text' | 'rect' | 'circle' | 'arrow' | 'blur' | 'eraser' | 'ai-erase'

interface EditorPoint {
  x: number
  y: number
}

interface TextOverlay {
  id: string
  x: number
  y: number
  text: string
  color: string
  size: number
  font: string
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
        const idx = py * w + px
        visited[idx] = 1
        queue.push(idx)
      }
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const px = idx % w
    const py = Math.floor(idx / w)

    const neighbors = [
      [px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]
    ]

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      const nIdx = ny * w + nx
      if (visited[nIdx]) continue
      visited[nIdx] = 1

      let r = 0, g = 0, b = 0, count = 0
      const nn = [[nx - 1, ny], [nx + 1, ny], [nx, ny - 1], [nx, ny + 1], [nx - 1, ny - 1], [nx + 1, ny + 1]]
      for (const [nnx, nny] of nn) {
        if (nnx < 0 || nnx >= w || nny < 0 || nny >= h) continue
        const nni = nny * w + nnx
        if (visited[nni]) {
          const pi = nni * 4
          r += d[pi]; g += d[pi + 1]; b += d[pi + 2]; count++
        }
      }
      if (count > 0) {
        const pi = nIdx * 4
        d[pi] = r / count; d[pi + 1] = g / count; d[pi + 2] = b / count; d[pi + 3] = 255
      }
      queue.push(nIdx)
    }
  }

  ctx.putImageData(imgData, x, y)
}

export default function ScreenshotEditor() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<EditMode>('select')
  const [strokeColor, setStrokeColor] = useState('#ff0000')
  const [strokeWidth, setStrokeWidth] = useState(4)

  const [history, setHistory] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])

  const [texts, setTexts] = useState<TextOverlay[]>([])
  const [activeTextId, setActiveTextId] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [textFont, setTextFont] = useState('Arial')
  const [erasingLoading, setErasingLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [editedImage, setEditedImage] = useState<string | null>(null)
  const [editedName, setEditedName] = useState('')
  const [showAdGate, setShowAdGate] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const drawStartRef = useRef<EditorPoint | null>(null)
  const penPointsRef = useRef<EditorPoint[]>([])
  const imageObjRef = useRef<HTMLImageElement | null>(null)

  const handlePickFile = async () => {
    try {
      const picked = await pickImages()
      if (picked && picked.length > 0) {
        setFile(picked[0])
        setSuccess(false)
        setEditedImage(null)
        setTexts([])
        setHistory([])
        setRedoStack([])
        const reader = new FileReader()
        reader.onload = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(picked[0])
      }
    } catch {
      toast.error('Failed to pick screenshot.')
    }
  }

  useEffect(() => {
    if (!imagePreview) return
    const img = new Image()
    img.onload = () => {
      imageObjRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return
      const maxW = 800
      const scale = Math.min(1, maxW / img.naturalWidth)
      canvas.width = img.naturalWidth * scale
      canvas.height = img.naturalHeight * scale
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setHistory([canvas.toDataURL('image/jpeg')])
      }
    }
    img.src = imagePreview
  }, [imagePreview])

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const state = canvas.toDataURL('image/jpeg')
    setHistory((prev) => [...prev, state])
    setRedoStack([])
  }, [])

  const handleUndo = useCallback(() => {
    if (history.length <= 1) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const current = history[history.length - 1]
    const previous = history[history.length - 2]
    setHistory((prev) => prev.slice(0, -1))
    setRedoStack((prev) => [...prev, current])
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = previous
  }, [history])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, -1))
    setHistory((prev) => [...prev, next])
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = next
  }, [redoStack])

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): EditorPoint => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    }
  }

  const handleTextEdit = (id: string) => {
    const t = texts.find(t => t.id === id)
    if (!t) return
    setActiveTextId(id)
    setInputText(t.text)
    setStrokeColor(t.color)
  }

  const handleTextDelete = (id: string) => {
    setTexts((prev) => prev.filter(t => t.id !== id))
    if (activeTextId === id) {
      setActiveTextId(null)
      setInputText('')
    }
  }

  const handleTextDragStart = useCallback((e: React.PointerEvent, id: string) => {
    if (activeMode !== 'select') return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const textEl = texts.find(t => t.id === id)
    if (!textEl) return
    const startTextX = textEl.x
    const startTextY = textEl.y

    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startMouseX) / rect.width) * canvas.width
      const dy = ((ev.clientY - startMouseY) / rect.height) * canvas.height
      setTexts((prev) =>
        prev.map((t) => t.id === id ? { ...t, x: startTextX + dx, y: startTextY + dy } : t)
      )
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [activeMode, texts])

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeMode === 'select') return
    const coords = getCanvasCoords(e)
    isDrawingRef.current = true
    drawStartRef.current = coords
    penPointsRef.current = [coords]

    if (activeMode === 'text') {
      const newText: TextOverlay = {
        id: crypto.randomUUID(),
        x: coords.x,
        y: coords.y,
        text: 'Type here',
        color: strokeColor,
        size: 18,
        font: textFont
      }
      setTexts((prev) => [...prev, newText])
      setActiveTextId(newText.id)
      setInputText('Type here')
      setActiveMode('select')
      isDrawingRef.current = false
    }
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !drawStartRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const coords = getCanvasCoords(e)

    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      ctx.strokeStyle = strokeColor
      ctx.fillStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const start = drawStartRef.current!

      if (activeMode === 'pen') {
        penPointsRef.current.push(coords)
        ctx.beginPath()
        ctx.moveTo(penPointsRef.current[0].x, penPointsRef.current[0].y)
        for (let i = 1; i < penPointsRef.current.length; i++) {
          ctx.lineTo(penPointsRef.current[i].x, penPointsRef.current[i].y)
        }
        ctx.stroke()
      } else if (activeMode === 'rect') {
        ctx.strokeRect(start.x, start.y, coords.x - start.x, coords.y - start.y)
      } else if (activeMode === 'circle') {
        ctx.beginPath()
        const rX = Math.abs(coords.x - start.x) / 2
        const rY = Math.abs(coords.y - start.y) / 2
        ctx.ellipse(start.x + (coords.x - start.x) / 2, start.y + (coords.y - start.y) / 2, rX, rY, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else if (activeMode === 'arrow') {
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(coords.x, coords.y)
        ctx.stroke()
        const angle = Math.atan2(coords.y - start.y, coords.x - start.x)
        ctx.beginPath()
        ctx.moveTo(coords.x, coords.y)
        ctx.lineTo(coords.x - 12 * Math.cos(angle - Math.PI / 6), coords.y - 12 * Math.sin(angle - Math.PI / 6))
        ctx.lineTo(coords.x - 12 * Math.cos(angle + Math.PI / 6), coords.y - 12 * Math.sin(angle + Math.PI / 6))
        ctx.closePath()
        ctx.fill()
      } else if (activeMode === 'blur') {
        ctx.fillStyle = 'rgba(100,100,100,0.5)'
        ctx.fillRect(start.x, start.y, coords.x - start.x, coords.y - start.y)
      } else if (activeMode === 'eraser') {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = strokeWidth * 2
        penPointsRef.current.push(coords)
        ctx.beginPath()
        ctx.moveTo(penPointsRef.current[0].x, penPointsRef.current[0].y)
        for (let i = 1; i < penPointsRef.current.length; i++) {
          ctx.lineTo(penPointsRef.current[i].x, penPointsRef.current[i].y)
        }
        ctx.stroke()
      } else if (activeMode === 'ai-erase') {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.25)'
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.fillRect(start.x, start.y, coords.x - start.x, coords.y - start.y)
        ctx.strokeRect(start.x, start.y, coords.x - start.x, coords.y - start.y)
      }
    }
    img.src = history[history.length - 1]
  }

  const performAiErase = async (start: EditorPoint, coords: EditorPoint) => {
    setErasingLoading(true)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) { setErasingLoading(false); return }

    const x = Math.min(start.x, coords.x)
    const y = Math.min(start.y, coords.y)
    const w = Math.abs(coords.x - start.x)
    const h = Math.abs(coords.y - start.y)

    if (w < 5 || h < 5) {
      toast.error('Please select a larger area')
      setErasingLoading(false)
      return
    }

    smartFillRegion(ctx, x, y, w, h)
    pushHistory()

    try {
      const regionData = ctx.getImageData(x, y, w, h)
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = w
      tempCanvas.height = h
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        tempCtx.putImageData(regionData, 0, 0)
        const regionBase64 = tempCanvas.toDataURL('image/jpeg', 0.8)

        const res = await fetch('/api/ai/text-erase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: regionBase64, region: { x, y, w, h } })
        })

        if (res.ok) {
          const data = await res.json()
          if (data.analysis) {
            console.log('[AI Erase]', data.analysis)
          }
        }
      }
    } catch (err) {
      console.warn('[AI Erase] enhancement failed, smart fill applied', err)
    }

    setErasingLoading(false)
    toast.success('Text erased successfully')
  }

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const coords = getCanvasCoords(e)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const start = drawStartRef.current!

    if (activeMode === 'blur') {
      const x = Math.min(start.x, coords.x)
      const y = Math.min(start.y, coords.y)
      const w = Math.abs(coords.x - start.x)
      const h = Math.abs(coords.y - start.y)
      if (w > 4 && h > 4) {
        const imgData = ctx.getImageData(x, y, w, h)
        const d = imgData.data
        const size = 12
        for (let py = 0; py < h; py += size) {
          for (let px = 0; px < w; px += size) {
            let r = 0, g = 0, b = 0, count = 0
            for (let dy = 0; dy < size && py + dy < h; dy++) {
              for (let dx = 0; dx < size && px + dx < w; dx++) {
                const idx = ((py + dy) * w + (px + dx)) * 4
                r += d[idx]; g += d[idx + 1]; b += d[idx + 2]; count++
              }
            }
            const avgR = r / count; const avgG = g / count; const avgB = b / count
            for (let dy = 0; dy < size && py + dy < h; dy++) {
              for (let dx = 0; dx < size && px + dx < w; dx++) {
                const idx = ((py + dy) * w + (px + dx)) * 4
                d[idx] = avgR; d[idx + 1] = avgG; d[idx + 2] = avgB
              }
            }
          }
        }
        ctx.putImageData(imgData, x, y)
      }
      pushHistory()
    } else if (activeMode === 'ai-erase') {
      performAiErase(start, coords)
    } else {
      pushHistory()
    }
  }

  const finalizeTextsOnCanvas = (canvasElement: HTMLCanvasElement) => {
    const ctx = canvasElement.getContext('2d')
    if (!ctx) return
    texts.forEach((t) => {
      ctx.fillStyle = t.color
      ctx.font = `bold ${t.size}px ${t.font}`
      ctx.textBaseline = 'top'
      ctx.fillText(t.text, t.x, t.y)
    })
  }

  const handleSave = async () => {
    if (!file || !canvasRef.current) return
    if (isLimitReached('screenshot-editor')) {
      setShowAdGate(true)
      return
    }
    setLoading(true)
    try {
      const clone = document.createElement('canvas')
      clone.width = canvasRef.current.width
      clone.height = canvasRef.current.height
      const cloneCtx = clone.getContext('2d')
      if (!cloneCtx) { setLoading(false); return }
      const img = new Image()
      img.onload = async () => {
        cloneCtx.drawImage(img, 0, 0)
        finalizeTextsOnCanvas(clone)
        let resultDataUrl = clone.toDataURL('image/jpeg', 0.95)

        if (shouldWatermark('screenshot-editor')) {
          resultDataUrl = await applyImageWatermark(resultDataUrl)
        }

        setEditedImage(resultDataUrl)
        const originalName = file.name.replace(/\.[^/.]+$/, "")
        const newName = `${originalName}_edited.jpg`
        setEditedName(newName)
        addFile({
          id: crypto.randomUUID(),
          name: newName,
          type: 'image',
          size: Math.round(resultDataUrl.length * 0.75),
          createdAt: new Date(),
          category: ['recent', 'edited'],
          favorite: false,
          dataUrl: resultDataUrl
        })
        incrementUsage('screenshot-editor')
        setSuccess(true)
        toast.success('Screenshot edited and saved!')
        showAdAfterSuccess()
        setLoading(false)
      }
      img.src = canvasRef.current.toDataURL('image/jpeg')
    } catch {
      toast.error('Failed to export edited screenshot.')
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!editedImage) return
    try {
      const base64 = editedImage.split(',')[1]
      const raw = atob(base64)
      const length = raw.length
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) bytes[i] = raw.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/jpeg' })
      await downloadFile(blob, editedName)
      toast.success('Saved to Documents successfully!')
    } catch {
      toast.error('Failed to download screenshot.')
    }
  }

  const handleShare = async () => {
    if (!editedImage) return
    try {
      const base64 = editedImage.split(',')[1]
      const raw = atob(base64)
      const length = raw.length
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) bytes[i] = raw.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/jpeg' })
      await shareFile(blob, editedName, 'Share Edited Screenshot')
    } catch (err: any) {
      if (err.message && !err.message.includes('cancel')) {
        toast.error('Failed to share screenshot.')
      }
    }
  }

  const handleUpdateText = () => {
    if (!activeTextId || !inputText.trim()) return
    setTexts((prev) =>
      prev.map((t) => t.id === activeTextId
        ? { ...t, text: inputText, color: strokeColor, font: textFont }
        : t
      )
    )
    setActiveTextId(null)
    setInputText('')
  }

  const tools = [
    { id: 'select' as EditMode, icon: MousePointer2, label: 'Select' },
    { id: 'pen' as EditMode, icon: Edit, label: 'Pen' },
    { id: 'text' as EditMode, icon: Type, label: 'Text' },
    { id: 'rect' as EditMode, icon: Square, label: 'Rect' },
    { id: 'circle' as EditMode, icon: Circle, label: 'Circle' },
    { id: 'arrow' as EditMode, icon: ArrowRight, label: 'Arrow' },
    { id: 'blur' as EditMode, icon: EyeOff, label: 'Blur' },
    { id: 'eraser' as EditMode, icon: Eraser, label: 'Erase' },
    { id: 'ai-erase' as EditMode, icon: PaintBucket, label: 'AI Erase' },
  ]

  return (
    <div className="flex flex-col h-full bg-mesh">
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border shrink-0">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <ImageIcon className="h-5 w-5 text-sky-400 animate-pulse" />
        <h2 className="text-lg font-semibold gradient-text">Screenshot Editor</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full safe-bottom">
        {!file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-glass-border"
          >
            <div className="h-14 w-14 rounded-full bg-sky-500/10 flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-sky-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Markup & Edit Screenshots</p>
              <p className="text-xs text-muted-foreground mt-1">Draw, add text, blur, or AI erase text from screenshots</p>
            </div>
            <Button onClick={handlePickFile} className="bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-1.5 h-10 px-6 text-xs rounded-xl">
              <ImageIcon className="h-4 w-4" /> Pick Screenshot Image
            </Button>
          </motion.div>
        )}

        {file && !success && (
          <div className="space-y-4">
            <div className="glass-card p-2 flex justify-between items-center">
              <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-lg p-0.5">
                <Button variant="ghost" size="icon" onClick={handleUndo} disabled={history.length <= 1} className="h-8 w-8 text-foreground">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleRedo} disabled={redoStack.length === 0} className="h-8 w-8 text-foreground">
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="w-7 h-7 rounded border border-glass-border bg-transparent cursor-pointer"
                  title="Color Picker"
                />
                <select
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                  className="glass-input text-[11px] h-7 px-1.5 rounded-lg font-semibold bg-transparent"
                >
                  <option value={2} className="bg-background text-foreground">Thin</option>
                  <option value={4} className="bg-background text-foreground">Medium</option>
                  <option value={8} className="bg-background text-foreground">Thick</option>
                </select>
              </div>
            </div>

            <div className="glass-card p-2.5 flex flex-wrap gap-2 justify-center">
              {tools.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setActiveMode(m.id); setActiveTextId(null) }}
                  className={`text-[10px] font-semibold py-1 px-2.5 rounded-lg border flex items-center gap-1 transition-all ${
                    activeMode === m.id
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sm shadow-sky-500/15'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 text-muted-foreground'
                  }`}
                >
                  <m.icon className="h-3 w-3" /> {m.label}
                </button>
              ))}
            </div>

            {activeTextId && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter text..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="flex-1 glass-input px-3 h-9 text-xs rounded-xl"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateText() }}
                  />
                  <Button onClick={handleUpdateText} className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-9 rounded-xl px-3">
                    Update
                  </Button>
                  <Button onClick={() => { setActiveTextId(null); setInputText('') }} variant="outline" className="border-glass-border h-9 w-9 p-0 rounded-xl">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={textFont}
                    onChange={(e) => setTextFont(e.target.value)}
                    className="glass-input text-[10px] h-7 px-1.5 rounded-lg bg-transparent flex-1"
                  >
                    <option className="bg-background">Arial</option>
                    <option className="bg-background">Helvetica</option>
                    <option className="bg-background">Times New Roman</option>
                    <option className="bg-background">Courier New</option>
                    <option className="bg-background">Georgia</option>
                    <option className="bg-background">Verdana</option>
                    <option className="bg-background">Impact</option>
                  </select>
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="w-7 h-7 rounded border border-glass-border bg-transparent cursor-pointer shrink-0"
                    title="Text Color"
                  />
                </div>
              </motion.div>
            )}

            <div className="relative w-full flex justify-center bg-slate-950/60 rounded-2xl p-4 border border-glass-border overflow-hidden">
              <div className="relative max-w-full">
                <canvas
                  ref={canvasRef}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className={`max-w-full rounded border border-glass-border shadow-2xl ${
                    activeMode === 'select' ? 'cursor-default' : 'cursor-crosshair touch-none'
                  }`}
                />

                {erasingLoading && (
                  <div className="absolute inset-0 bg-black/30 rounded flex items-center justify-center z-40">
                    <div className="flex items-center gap-2 bg-background/80 px-4 py-2 rounded-xl">
                      <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                      <span className="text-xs font-medium">Erasing text...</span>
                    </div>
                  </div>
                )}

                {texts.map((t) => (
                  <div
                    key={t.id}
                    className={`absolute select-none ${
                      activeMode === 'select' ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
                    }`}
                    style={{
                      left: `${(t.x / (canvasRef.current?.width || 1)) * 100}%`,
                      top: `${(t.y / (canvasRef.current?.height || 1)) * 100}%`,
                      color: t.color,
                      fontSize: `${t.size * 0.75}px`,
                      fontFamily: t.font,
                      fontWeight: 'bold',
                      zIndex: 35,
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                    }}
                    onPointerDown={(e) => handleTextDragStart(e, t.id)}
                    onDoubleClick={() => handleTextEdit(t.id)}
                  >
                    <span className="relative group">
                      {t.text}
                      {(activeMode === 'select') && (
                        <span className="absolute -top-1 -right-1 translate-x-full -translate-y-full flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(ev) => { ev.stopPropagation(); handleTextEdit(t.id) }}
                            className="bg-sky-500 text-white p-0.5 rounded text-[8px] hover:bg-sky-600"
                          >
                            <Edit className="h-2.5 w-2.5" />
                          </button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); handleTextDelete(t.id) }}
                            className="bg-red-500 text-white p-0.5 rounded text-[8px] hover:bg-red-600"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handlePickFile} variant="outline" className="flex-1 border-glass-border h-11 text-xs rounded-xl">
                Discard Image
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-sky-600/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Save Edited Screenshot
              </Button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {success && editedImage && (
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
                <h3 className="text-base font-bold text-foreground">Markup Saved Successfully</h3>
                <p className="text-xs text-muted-foreground mt-1">Edited screenshot added inside Files category</p>
                <p className="text-xs font-semibold font-mono text-electric mt-2 truncate px-4">{editedName}</p>
              </div>
              <div className="rounded-xl overflow-hidden border border-glass-border max-w-[200px] mx-auto shadow-lg bg-slate-900 p-1">
                <img src={editedImage} alt="Edited View" className="w-full h-auto object-contain rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button onClick={handleDownload} variant="outline" className="glass-card-hover border-glass-border text-xs rounded-xl h-10 flex items-center justify-center gap-1.5">
                  <Download className="h-4 w-4 text-electric" /> Save to Device
                </Button>
                <Button onClick={handleShare} variant="outline" className="glass-card-hover border-glass-border text-xs rounded-xl h-10 flex items-center justify-center gap-1.5">
                  <Share2 className="h-4 w-4 text-indigo-400" /> Share Screenshot
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setFile(null); setImagePreview(null); setEditedImage(null); setSuccess(false)
                }}
                className="text-xs text-muted-foreground w-full py-2 hover:bg-white/5"
              >
                Edit Another Screenshot
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AdGateModal
        open={showAdGate}
        feature="Screenshot Editor"
        onWatchAd={() => { grantBonusUse('screenshot-editor'); setShowAdGate(false); toast.success('One more use granted!') }}
        onClose={() => setShowAdGate(false)}
      />
    </div>
  )
}
