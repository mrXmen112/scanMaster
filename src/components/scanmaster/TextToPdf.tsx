'use client'

import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Download, Share2, Eye, Loader2 } from 'lucide-react'
import { ToolIcon } from './ToolCards'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export default function TextToPdf() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [fontSize, setFontSize] = useState([14])
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left')
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [pageSize, setPageSize] = useState('A4')
  const [margins, setMargins] = useState({ top: 50, bottom: 50, left: 50, right: 50 })
  const [loading, setLoading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleGenerate = useCallback(async () => {
    if (loading) return
    if (!text.trim()) {
      toast.error('Please enter some text first')
      return
    }
    setLoading(true)
    try {
      const response = await fetchWithTimeout('/api/pdf/text-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          title: title || undefined,
          fontSize: fontSize[0],
          alignment,
          pageSize,
          margins,
          bold,
          italic,
          underline,
        }),
      }, 10000)
      const blob = await response.blob()
      const filename = title ? `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf` : 'document.pdf'
      downloadFile(blob, filename)
      addFile({
        id: crypto.randomUUID(),
        name: filename,
        type: 'pdf',
        size: blob.size,
        createdAt: new Date(),
        category: ['recent'],
        favorite: false,
      })
      toast.success('PDF created and downloaded!')
      // Show interstitial ad after successful download
      showAdAfterSuccess()
    } catch {
      toast.error('Failed to create PDF')
    } finally {
      setLoading(false)
    }
  }, [text, title, fontSize, alignment, pageSize, margins, bold, italic, underline, addFile, showAdAfterSuccess])

  const handlePreview = useCallback(() => {
    if (!text.trim()) {
      toast.error('Please enter some text first')
      return
    }
    const alignClass = alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left'
    const fontClass = `${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''}`
    const underlineClass = underline ? 'underline' : ''

    const pageW = pageSize === 'A4' ? 595 : pageSize === 'Letter' ? 612 : 612
    const pageH = pageSize === 'A4' ? 842 : pageSize === 'Letter' ? 792 : 1008
    const scale = 0.55

    setPreviewHtml(`
      <div style="width:${pageW * scale}px; min-height:${pageH * scale}px; background:white; color:black; padding:${margins.top * scale}px ${margins.right * scale}px ${margins.bottom * scale}px ${margins.left * scale}px; font-size:${fontSize[0] * scale}px; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.3);">
        ${title ? `<h1 style="font-size:${fontSize[0] * 1.5 * scale}px; font-weight:bold; margin-bottom:${fontSize[0] * scale}px; ${alignment === 'center' ? 'text-align:center' : alignment === 'right' ? 'text-align:right' : ''}">${title}</h1>` : ''}
        <div class="${alignClass} ${fontClass} ${underlineClass}" style="white-space:pre-wrap; word-wrap:break-word; line-height:1.5;">
${text}
        </div>
      </div>
    `)
    setPreviewing(true)
  }, [text, title, fontSize, alignment, pageSize, margins, bold, italic, underline])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ScanMaster PDF', text })
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      toast.info('Text copied to clipboard')
    }
  }, [text])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <ToolIcon toolId="text-to-pdf" size="sm" />
      <h2 className="text-lg font-semibold gradient-text">Text to PDF</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Title Input */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <Label className="text-sm text-muted-foreground">Document Title</Label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter document title..."
            className="w-full glass-input px-4 py-2.5 text-sm"
          />
        </motion.div>

        {/* Text Editor */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-2">
          <Label className="text-sm text-muted-foreground">Content</Label>
          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1 glass-card p-2">
            <button
              onClick={() => setBold(!bold)}
              className={`p-2 rounded-lg transition-colors ${bold ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              onClick={() => setItalic(!italic)}
              className={`p-2 rounded-lg transition-colors ${italic ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              onClick={() => setUnderline(!underline)}
              className={`p-2 rounded-lg transition-colors ${underline ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
            >
              <Underline className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-glass-border mx-1" />
            <button
              onClick={() => setAlignment('left')}
              className={`p-2 rounded-lg transition-colors ${alignment === 'left' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setAlignment('center')}
              className={`p-2 rounded-lg transition-colors ${alignment === 'center' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              onClick={() => setAlignment('right')}
              className={`p-2 rounded-lg transition-colors ${alignment === 'right' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
            >
              <AlignRight className="h-4 w-4" />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your text here..."
            className={`w-full glass-input px-4 py-3 text-sm min-h-[200px] resize-y ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''} ${underline ? 'underline' : ''}`}
            style={{ textAlign: alignment }}
          />
        </motion.div>

        {/* Settings Row */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-3">
          {/* Font Size */}
          <div className="glass-card p-3 space-y-2">
            <Label className="text-xs text-muted-foreground">Font Size: {fontSize[0]}px</Label>
            <Slider
              value={fontSize}
              onValueChange={setFontSize}
              min={8}
              max={72}
              step={1}
              className="w-full"
            />
          </div>

          {/* Page Size */}
          <div className="glass-card p-3 space-y-2">
            <Label className="text-xs text-muted-foreground">Page Size</Label>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger className="glass-input border-0 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Margin Controls */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Margins (px)</Label>
          <div className="grid grid-cols-4 gap-2">
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <div key={side} className="space-y-1">
                <label className="text-[10px] text-muted-foreground capitalize">{side}</label>
                <input
                  type="number"
                  value={margins[side]}
                  onChange={(e) => setMargins({ ...margins, [side]: parseInt(e.target.value) || 0 })}
                  className="w-full glass-input px-2 py-1 text-xs text-center"
                  min={0}
                  max={200}
                />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Preview Modal */}
        {previewing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">PDF Preview</Label>
              <Button variant="ghost" size="sm" onClick={() => setPreviewing(false)} className="text-xs">
                Close
              </Button>
            </div>
            <div className="overflow-auto max-h-96 flex justify-center" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handlePreview}
              variant="outline"
              disabled={!text.trim()}
              className="glass-card-hover border-glass-border"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={handleShare}
              variant="outline"
              disabled={!text.trim()}
              className="glass-card-hover border-glass-border"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading || !text.trim()}
            className="w-full electric-glow bg-primary hover:bg-primary/90 text-primary-foreground h-11"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Generate PDF
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
