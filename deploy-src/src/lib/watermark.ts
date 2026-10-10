const WATERMARK_TEXT = 'ScanMaster AI'
const WATERMARK_COLOR = 'rgba(0, 0, 0, 0.12)'

export function applyImageWatermark(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      ctx.font = `bold ${Math.max(14, canvas.width * 0.04)}px Arial`
      ctx.fillStyle = WATERMARK_COLOR
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      ctx.translate(cx, cy)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText(WATERMARK_TEXT, 0, 0)
      ctx.fillText(WATERMARK_TEXT, 0, -canvas.height * 0.15)
      ctx.fillText(WATERMARK_TEXT, 0, canvas.height * 0.15)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.src = dataUrl
  })
}

export function shouldBlockAccess(feature: 'screenshot-editor' | 'handwriting' | 'password-protect' | 'pdf-editor'): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(`usage_${feature}`)
    if (!raw) return false
    const data = JSON.parse(raw)
    const today = new Date().toISOString().split('T')[0]
    if (data.date !== today) return false
    return data.count >= 3
  } catch {
    return false
  }
}
