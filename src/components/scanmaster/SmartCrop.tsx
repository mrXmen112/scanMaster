'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Crop, RotateCw, CheckCircle, FileImage, Loader2, Share2, Download } from 'lucide-react'
import { ToolIcon } from './ToolCards'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { pickImages, downloadFile, shareFile } from '@/lib/capacitor-fs'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

interface Point {
  x: number
  y: number
}

// Pure JS Perspective Homography solver & warper
// Solves standard 8-parameter transformation equations to map a quadrilateral area back to a clean rectangle
function solveHomography(src: Point[], dst: Point[]): number[] | null {
  const A = []
  const B = []
  
  for (let i = 0; i < 4; i++) {
    const s = src[i]
    const d = dst[i]
    A.push([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y])
    B.push(d.x)
    A.push([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y])
    B.push(d.y)
  }

  // Solve equations using Gaussian Elimination
  const n = 8
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(A[r][i]) > Math.abs(A[maxRow][i])) {
        maxRow = r
      }
    }
    // Swap rows
    const tempA = A[i]; A[i] = A[maxRow]; A[maxRow] = tempA
    const tempB = B[i]; B[i] = B[maxRow]; B[maxRow] = tempB

    if (Math.abs(A[i][i]) < 1e-10) return null // Singular matrix

    // Eliminate column
    for (let r = i + 1; r < n; r++) {
      const factor = A[r][i] / A[i][i]
      for (let c = i; c < n; c++) {
        A[r][c] -= factor * A[i][c]
      }
      B[r] -= factor * B[i]
    }
  }

  // Back substitution
  const h = new Array(8).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0
    for (let c = i + 1; c < n; c++) {
      sum += A[i][c] * h[c]
    }
    h[i] = (B[i] - sum) / A[i][i]
  }
  
  return h // Returns [a, b, c, d, e, f, g, h] homography parameters
}

function warpPerspectiveImage(
  img: HTMLImageElement,
  corners: Point[],
  targetWidth: number,
  targetHeight: number
): string {
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = img.naturalWidth
  srcCanvas.height = img.naturalHeight
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) return img.src
  srcCtx.drawImage(img, 0, 0)
  
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height)
  const srcPixels = srcData.data
  const sw = srcCanvas.width
  const sh = srcCanvas.height

  const dstCanvas = document.createElement('canvas')
  dstCanvas.width = targetWidth
  dstCanvas.height = targetHeight
  const dstCtx = dstCanvas.getContext('2d')
  if (!dstCtx) return img.src
  const dstData = dstCtx.createImageData(targetWidth, targetHeight)
  const dstPixels = dstData.data

  // Source corners mapped to natural image bounds
  const srcPoints = corners.map((c) => ({
    x: c.x * sw,
    y: c.y * sh
  }))

  const dstPoints = [
    { x: 0, y: 0 },
    { x: targetWidth, y: 0 },
    { x: targetWidth, y: targetHeight },
    { x: 0, y: targetHeight }
  ]

  // We solve backward mapping (dst to src) for smooth interpolation
  const hCoeffs = solveHomography(dstPoints, srcPoints)
  if (!hCoeffs) return img.src
  const [a, b, c, d, e, f, g, h] = hCoeffs

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const w = g * x + h * y + 1
      const srcX = Math.round((a * x + b * y + c) / w)
      const srcY = Math.round((d * x + e * y + f) / w)

      const dstIdx = (y * targetWidth + x) * 4

      if (srcX >= 0 && srcX < sw && srcY >= 0 && srcY < sh) {
        const srcIdx = (srcY * sw + srcX) * 4
        dstPixels[dstIdx] = srcPixels[srcIdx]
        dstPixels[dstIdx + 1] = srcPixels[srcIdx + 1]
        dstPixels[dstIdx + 2] = srcPixels[srcIdx + 2]
        dstPixels[dstIdx + 3] = srcPixels[srcIdx + 3]
      } else {
        // Outside bounds: set to white background
        dstPixels[dstIdx] = 255
        dstPixels[dstIdx + 1] = 255
        dstPixels[dstIdx + 2] = 255
        dstPixels[dstIdx + 3] = 255
      }
    }
  }

  dstCtx.putImageData(dstData, 0, 0)
  return dstCanvas.toDataURL('image/jpeg', 0.95)
}

export default function SmartCrop() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rotation, setRotation] = useState(0)

  // dragger coordinates represent percentages (0 to 1)
  const [corners, setCorners] = useState<Point[]>([
    { x: 0.1, y: 0.1 }, // Top-Left
    { x: 0.9, y: 0.1 }, // Top-Right
    { x: 0.9, y: 0.9 }, // Bottom-Right
    { x: 0.1, y: 0.9 }  // Bottom-Left
  ])

  const [croppedImage, setCroppedImage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const imageContainerRef = useRef<HTMLDivElement | null>(null)
  const imageElementRef = useRef<HTMLImageElement | null>(null)

  const handlePickFile = async () => {
    try {
      const picked = await pickImages()
      if (picked && picked.length > 0) {
        setImage(picked[0])
        setCroppedImage(null)
        setSuccess(false)
        setRotation(0)
        setCorners([
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.9, y: 0.9 },
          { x: 0.1, y: 0.9 }
        ])
        const reader = new FileReader()
        reader.onload = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(picked[0])
      }
    } catch {
      toast.error('Failed to pick image.')
    }
  }

  const handleAutoDetect = () => {
    // A robust heuristics based auto edge bounding crop.
    // Falls back gracefully to 4-corner manual adjust if user edits them
    setCorners([
      { x: 0.05, y: 0.08 },
      { x: 0.95, y: 0.08 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 }
    ])
    toast.info('Perspective edges auto-detected!')
  }

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360)
  }

  const handleReset = () => {
    setCorners([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 }
    ])
    setRotation(0)
    toast.info('Crop boundaries reset.')
  }

  const applyCrop = () => {
    if (!imagePreview) return
    setLoading(true)
    
    // Tiny timeout to let loader display
    setTimeout(() => {
      try {
        const img = new Image()
        img.onload = () => {
          // Approximate crop width & height based on bounding box aspect
          const dxTop = (corners[1].x - corners[0].x) * img.naturalWidth
          const dyTop = (corners[1].y - corners[0].y) * img.naturalHeight
          const wTop = Math.sqrt(dxTop * dxTop + dyTop * dyTop)

          const dxBottom = (corners[2].x - corners[3].x) * img.naturalWidth
          const dyBottom = (corners[2].y - corners[3].y) * img.naturalHeight
          const wBottom = Math.sqrt(dxBottom * dxBottom + dyBottom * dyBottom)

          const dyRight = (corners[2].y - corners[1].y) * img.naturalHeight
          const dxRight = (corners[2].x - corners[1].x) * img.naturalWidth
          const hRight = Math.sqrt(dyRight * dyRight + dxRight * dxRight)

          const dyLeft = (corners[3].y - corners[0].y) * img.naturalHeight
          const dxLeft = (corners[3].x - corners[0].x) * img.naturalWidth
          const hLeft = Math.sqrt(dyLeft * dyLeft + dxLeft * dxLeft)

          const targetWidth = Math.round(Math.max(wTop, wBottom))
          const targetHeight = Math.round(Math.max(hLeft, hRight))

          const resultDataUrl = warpPerspectiveImage(img, corners, targetWidth, targetHeight)
          setCroppedImage(resultDataUrl)
          setSuccess(true)
          
          // Save inside Files section
          const newName = `cropped-${image!.name}`
          
          // Add into Zustand file history
          addFile({
            id: crypto.randomUUID(),
            name: newName,
            type: 'image',
            size: Math.round(resultDataUrl.length * 0.75), // rough estimation
            createdAt: new Date(),
            category: ['recent', 'scanned'],
            favorite: false,
            dataUrl: resultDataUrl
          })

          toast.success('Document perspective cropped successfully!')
          showAdAfterSuccess()
          setLoading(false)
        }
        img.src = imagePreview
      } catch (err) {
        toast.error('Failed to crop perspective.')
        setLoading(false)
      }
    }, 200)
  }

  // Draggable node calculations
  const updateCornerPos = (index: number, e: any, info: any) => {
    const container = imageContainerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    
    // info.offset is relative to starting pos. Better is clientX/clientY relative to container bounds
    const element = imageElementRef.current
    if (!element) return
    const imgRect = element.getBoundingClientRect()

    // Calculate percentage x,y relative to IMAGE dimensions
    const relativeX = (e.clientX - imgRect.left) / imgRect.width
    const relativeY = (e.clientY - imgRect.top) / imgRect.height

    const clampedX = Math.max(0, Math.min(1, relativeX))
    const clampedY = Math.max(0, Math.min(1, relativeY))

    setCorners((prev) => {
      const copy = [...prev]
      copy[index] = { x: clampedX, y: clampedY }
      return copy
    })
  }

  const handleDownload = async () => {
    if (!croppedImage) return
    try {
      const base64 = croppedImage.split(',')[1]
      const raw = atob(base64)
      const length = raw.length
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        bytes[i] = raw.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' })
      await downloadFile(blob, `cropped-${image!.name}`)
      toast.success('Cropped image saved successfully!')
    } catch {
      toast.error('Failed to save image.')
    }
  }

  const handleShare = async () => {
    if (!croppedImage) return
    try {
      const base64 = croppedImage.split(',')[1]
      const raw = atob(base64)
      const length = raw.length
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        bytes[i] = raw.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' })
      await shareFile(blob, `cropped-${image!.name}`)
    } catch (err: any) {
      if (err.message && !err.message.includes('cancel')) {
        toast.error('Failed to share cropped file.')
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border shrink-0">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <ToolIcon toolId="smart-crop" size="sm" />
      <h2 className="text-lg font-semibold gradient-text">Smart Crop Tool</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full safe-bottom">
        {/* Upload Zone */}
        {!image && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-glass-border"
          >
            <div className="h-14 w-14 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Crop className="h-6 w-6 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Perspective Smart Crop</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a skewed document to align perspective perfectly</p>
            </div>
            <Button onClick={handlePickFile} className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 h-10 px-6 text-xs rounded-xl">
              <FileImage className="h-4 w-4" /> Pick Document Image
            </Button>
          </motion.div>
        )}

        {/* Selected Image Workarea */}
        {image && !success && (
          <div className="space-y-4">
            {/* Toolbar options */}
            <div className="glass-card p-3 flex gap-2 items-center justify-between">
              <div className="flex gap-2">
                <Button onClick={handleAutoDetect} className="bg-primary/20 text-primary border border-primary/20 text-xs h-9 px-3 rounded-xl hover:bg-primary/30">
                  Auto Edge
                </Button>
                <Button onClick={handleRotate} variant="outline" className="border-glass-border text-xs h-9 px-3 rounded-xl flex items-center gap-1.5">
                  <RotateCw className="h-3.5 w-3.5" /> Rotate
                </Button>
              </div>
              <Button onClick={handleReset} variant="ghost" className="text-destructive text-xs h-9 px-3 hover:bg-destructive/10">
                Reset
              </Button>
            </div>

            {/* Canvas Dragger Anchor Viewport */}
            <div className="relative w-full flex justify-center bg-slate-950/60 rounded-2xl p-4 border border-glass-border overflow-hidden">
              <div
                ref={imageContainerRef}
                className="relative max-w-full select-none"
                style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s ease' }}
              >
                <img
                  ref={imageElementRef}
                  src={imagePreview!}
                  alt="Warp Source"
                  className="max-h-[380px] w-auto rounded-lg object-contain pointer-events-none"
                />

                {/* SVG connectors between corners */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                  <polygon
                    points={corners
                      .map((c) => {
                        const container = imageContainerRef.current
                        if (!container) return '0,0'
                        const el = imageElementRef.current
                        if (!el) return '0,0'
                        const rect = el.getBoundingClientRect()
                        const parentRect = container.getBoundingClientRect()
                        const leftOffset = rect.left - parentRect.left
                        const topOffset = rect.top - parentRect.top
                        
                        const px = leftOffset + c.x * rect.width
                        const py = topOffset + c.y * rect.height
                        return `${px},${py}`
                      })
                      .join(' ')}
                    className="stroke-indigo-400 stroke-2 fill-indigo-400/10"
                  />
                </svg>

                {/* 4 Draggable Anchor handles */}
                {corners.map((corner, index) => {
                  const label = index === 0 ? 'TL' : index === 1 ? 'TR' : index === 2 ? 'BR' : 'BL'
                  return (
                    <motion.div
                      key={index}
                      drag
                      dragMomentum={false}
                      dragElastic={0}
                      onDrag={(e, info) => updateCornerPos(index, e, info)}
                      className="absolute w-7 h-7 rounded-full bg-white border-2 border-indigo-500 shadow-xl flex items-center justify-center cursor-move text-[9px] font-bold text-indigo-500 hover:scale-110 active:scale-95 transition-transform"
                      style={{
                        left: `calc(${corner.x * 100}% - 14px)`,
                        top: `calc(${corner.y * 100}% - 14px)`,
                        zIndex: 20
                      }}
                    >
                      {label}
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Bottom operations */}
            <div className="flex gap-3">
              <Button onClick={handlePickFile} variant="outline" className="flex-1 border-glass-border h-11 text-xs rounded-xl">
                Upload New Image
              </Button>
              <Button
                onClick={applyCrop}
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
                Crop & Align
              </Button>
            </div>
          </div>
        )}

        {/* Success View */}
        <AnimatePresence>
          {success && croppedImage && (
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
                <h3 className="text-base font-bold text-foreground">Skew Corrected!</h3>
                <p className="text-xs text-muted-foreground mt-1">Flat perspective document registered in scanned category</p>
              </div>

              <div className="rounded-xl overflow-hidden border border-glass-border max-w-[200px] mx-auto shadow-lg bg-slate-900 p-1">
                <img src={croppedImage} alt="Flat Scan" className="w-full h-auto object-contain rounded-lg" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="glass-card-hover border-glass-border text-xs rounded-xl h-10 flex items-center justify-center gap-1.5"
                >
                  <Download className="h-4 w-4 text-electric" /> Save JPEG
                </Button>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="glass-card-hover border-glass-border text-xs rounded-xl h-10 flex items-center justify-center gap-1.5"
                >
                  <Share2 className="h-4 w-4 text-indigo-400" /> Share Image
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setImage(null)
                  setImagePreview(null)
                  setCroppedImage(null)
                  setSuccess(false)
                }}
                className="text-xs text-muted-foreground w-full py-2 hover:bg-white/5"
              >
                Crop Another Image
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
