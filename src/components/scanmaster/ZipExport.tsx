'use client'

import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Download,
  Upload,
  FileArchive,
  FileText,
  CheckSquare,
  Square,
  X,
} from 'lucide-react'
import { ToolIcon } from './ToolCards'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { downloadFile } from '@/lib/capacitor-fs'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'

interface FileItem {
  id: string
  file: File
  name: string
  size: number
  type: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ZipExport() {
  const { goBack, addFile, files: storedFiles } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([])
  const [storedSelections, setStoredSelections] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newItems: FileItem[] = Array.from(fileList).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
    }))
    setSelectedFiles((prev) => [...prev, ...newItems])
    toast.success(`${newItems.length} file(s) added`)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const removeFile = useCallback((id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedFiles.length === 0 && storedSelections.size === 0) {
      // Select all
      setSelectedFiles((prev) => prev) // Uploaded files are already selected
      setStoredSelections(new Set(storedFiles.map((f) => f.id)))
    } else {
      setStoredSelections(new Set())
    }
  }, [selectedFiles, storedSelections, storedFiles])

  const deselectAll = useCallback(() => {
    setSelectedFiles([])
    setStoredSelections(new Set())
  }, [])

  const toggleStoredFile = useCallback((id: string) => {
    setStoredSelections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleExport = useCallback(async () => {
    if (loading) return
    const totalSelected = selectedFiles.length + storedSelections.size
    if (totalSelected === 0) {
      toast.error('Please select at least one file')
      return
    }
    setLoading(true)
    try {
      // Client-side ZIP with JSZip (Offline / handles uploaded + stored files / Independent of /api routes)
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      // Add uploaded files (File/Blob objects)
      for (const f of selectedFiles) {
        zip.file(f.name, f.file)
      }

      // Add stored files (base64 data URLs)
      for (const f of storedFiles) {
        if (storedSelections.has(f.id) && f.dataUrl) {
          const base64 = f.dataUrl.split(',')[1]
          if (base64) {
            zip.file(f.name, base64, { base64: true })
          }
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      await downloadFile(blob, 'export.zip')
      addFile({
        id: crypto.randomUUID(),
        name: 'export.zip',
        type: 'zip',
        size: blob.size,
        createdAt: new Date(),
        category: ['recent', 'zip'],
        favorite: false,
      })
      toast.success('ZIP exported successfully!')
      // Show interstitial ad after successful export
      showAdAfterSuccess()
    } catch {
      toast.error('Failed to export ZIP')
    } finally {
      setLoading(false)
    }
  }, [selectedFiles, storedSelections, storedFiles, addFile, showAdAfterSuccess])

  const totalSelected = selectedFiles.length + storedSelections.size

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <ToolIcon toolId="zip-export" size="sm" />
      <h2 className="text-lg font-semibold gradient-text">ZIP Export</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-bottom">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-card-hover p-8 flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed transition-colors ${
            dragOver ? 'border-electric bg-electric/10' : 'border-glass-border'
          }`}
        >
          <div className="h-16 w-16 rounded-full bg-electric/20 flex items-center justify-center">
            <Upload className="h-8 w-8 text-electric" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Add files or <span className="text-electric font-medium">click to browse</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="hidden"
          />
        </motion.div>

        {/* Select Controls */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleSelectAll} className="glass-card-hover border-glass-border gap-1">
            <CheckSquare className="h-3 w-3" />
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll} className="glass-card-hover border-glass-border gap-1">
            <Square className="h-3 w-3" />
            Deselect All
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {totalSelected} selected
          </span>
        </motion.div>

        {/* Uploaded Files */}
        <AnimatePresence>
          {selectedFiles.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 space-y-2">
              <Label className="text-sm text-muted-foreground">Uploaded Files</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {selectedFiles.map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-3 glass-card p-2"
                  >
                    <div className="h-8 w-8 rounded bg-electric/20 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-electric" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => removeFile(f.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stored Files */}
        {storedFiles.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 space-y-2">
            <Label className="text-sm text-muted-foreground">Stored Files</Label>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {storedFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 glass-card p-2">
                  <Checkbox
                    checked={storedSelections.has(f.id)}
                    onCheckedChange={() => toggleStoredFile(f.id)}
                  />
                  <div className="h-8 w-8 rounded bg-electric/20 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-electric" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {totalSelected === 0 && storedFiles.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 text-center">
            <FileArchive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No files selected yet.</p>
            <p className="text-xs text-muted-foreground">Upload files or select from stored files to create a ZIP.</p>
          </motion.div>
        )}

        {/* Export Button */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="pb-4">
          <Button
            onClick={handleExport}
            disabled={loading || totalSelected === 0}
            className="w-full electric-glow bg-electric hover:bg-electric/90 text-electric-foreground h-12 text-base"
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-5 w-5 border-2 border-current border-t-transparent rounded-full"
              />
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Export as ZIP ({totalSelected} file{totalSelected !== 1 ? 's' : ''})
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
