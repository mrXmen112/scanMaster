'use client'

import { useState, useMemo, useEffect, useCallback, useRef, memo, ElementType } from 'react'
import {
  Search,
  File,
  FileText,
  Image,
  Archive,
  Star,
  StarOff,
  Trash2,
  Share2,
  Info,
  Pencil,
  MoreVertical,
  FolderOpen,
  Clock,
  Scan,
  Edit,
  ArrowUpDown,
  Upload,
  Cloud,
  CloudOff,
  Loader2,
} from 'lucide-react'
import { useAppStore, FileCategory, StoredFile } from '@/store/useAppStore'
import { useAuth } from '@/contexts/AuthContext'
import { uploadFile, getUserFileRecords, deleteUserFileRecord, saveFileRecord } from '@/lib/supabase/storage'
import { deleteUserFile } from '@/lib/supabase/storage'
import { motion, AnimatePresence } from 'framer-motion'
import { useMounted } from '@/hooks/use-mounted'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'

const fileCategories: { id: FileCategory; label: string; icon: ElementType }[] = [
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'scanned', label: 'Scanned', icon: Scan },
  { id: 'edited', label: 'Edited', icon: Edit },
  { id: 'zip', label: 'ZIP', icon: Archive },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'trash', label: 'Trash', icon: Trash2 },
]

type SortOption = 'date' | 'name' | 'size'

function getFileIcon(type: StoredFile['type']) {
  switch (type) {
    case 'pdf': return FileText
    case 'image': return Image
    case 'zip': return Archive
    case 'text': return File
  }
}

function getFileIconColor(type: StoredFile['type']) {
  switch (type) {
    case 'pdf': return 'bg-red-500/20 text-red-400'
    case 'image': return 'bg-orange-500/20 text-orange-400'
    case 'zip': return 'bg-teal-500/20 text-teal-400'
    case 'text': return 'bg-green-500/20 text-green-400'
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: Date, mounted: boolean) {
  if (!mounted) return '...'
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export default memo(function FileManager() {
  const { files, removeFile, toggleFavorite, renameFile, addFile } = useAppStore()
  const { user, configured } = useAuth()
  const mounted = useMounted()
  const [activeCategory, setActiveCategory] = useState<FileCategory>('recent')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 250)
  const [sortOption, setSortOption] = useState<SortOption>('date')
  const [contextMenuFile, setContextMenuFile] = useState<string | null>(null)
  const [renamingFile, setRenamingFile] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [uploading, setUploading] = useState(false)
  const [cloudFiles, setCloudFiles] = useState<Array<{
    id: string
    file_name: string
    file_url: string
    file_size: number
    file_type: string
    created_at: string
  }>>([])
  const [loadingCloud, setLoadingCloud] = useState(false)

  // Load cloud files when user is authenticated.
  // Uses user.id (not the user object) as the effective dependency,
  // so token refreshes (which create new user object references)
  // don't re-trigger the load. A ref tracks which userId we've loaded.
  const loadedUserIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!user || !configured) return
    // Only load once per user ID (prevents re-fetch on token refresh)
    if (loadedUserIdRef.current === user.id) return
    loadedUserIdRef.current = user.id

    let cancelled = false
    const loadCloudFiles = async () => {
      try {
        const records = await getUserFileRecords(user.id)
        if (!cancelled) {
          setCloudFiles(records || [])
        }
      } catch (err) {
        console.error('[FileManager] Load cloud files error:', err)
      } finally {
        if (!cancelled) {
          setLoadingCloud(false)
        }
      }
    }

    setLoadingCloud(true)
    loadCloudFiles()

    return () => { cancelled = true }
  }, [user, configured])

  const mountedRef = useRef(true)
  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const handleUpload = useCallback(async () => {
    if (!user || !configured) {
      toast.error('Please sign in to upload files')
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.doc,.docx'
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files
      if (!fileList || fileList.length === 0) return

      setUploading(true)
      for (const file of Array.from(fileList)) {
        try {
          const result = await uploadFile(user.id, file)
          if (!mountedRef.current) return
          if (result) {
            // Save record to database
            const fileType = file.type.includes('pdf') ? 'pdf' :
              file.type.includes('image') ? 'image' :
              file.type.includes('zip') ? 'zip' : 'text'
            await saveFileRecord(user.id, file.name, result.path, result.url, file.size, fileType)

            if (!mountedRef.current) return

            // Also add to local store
            addFile({
              id: crypto.randomUUID(),
              name: file.name,
              type: fileType,
              size: file.size,
              createdAt: new Date(),
              category: ['recent', 'scanned'],
              favorite: false,
            })

            toast.success(`${file.name} uploaded`)
          }
        } catch (err) {
          console.error('[FileManager] Upload error:', err)
          if (!mountedRef.current) return
          toast.error(`Failed to upload ${file.name}`)
        }
      }
      if (!mountedRef.current) return
      setUploading(false)

      // Refresh cloud files
      const records = await getUserFileRecords(user.id)
      if (mountedRef.current) {
        setCloudFiles(records || [])
      }
    }
    input.click()
  }, [user, configured, addFile])

  const handleDeleteCloudFile = useCallback(async (fileId: string, fileName: string) => {
    if (!user || !configured) return

    try {
      await deleteUserFile(user.id, fileName)
      await deleteUserFileRecord(user.id, fileId)
      setCloudFiles((prev) => prev.filter((f) => f.id !== fileId))
      toast.success('File deleted')
    } catch (err) {
      console.error('[FileManager] Delete error:', err)
      toast.error('Failed to delete file')
    }
  }, [user, configured])

  const filteredFiles = useMemo(() => {
    let result = [...files]

    // Filter by category
    if (activeCategory === 'favorites') {
      result = result.filter((f) => f.favorite)
    } else if (activeCategory !== 'recent') {
      result = result.filter((f) => f.category.includes(activeCategory))
    }

    // Filter by search
    if (debouncedSearch) {
      result = result.filter((f) =>
        f.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'name': return a.name.localeCompare(b.name)
        case 'size': return b.size - a.size
        case 'date':
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

    return result
  }, [files, activeCategory, debouncedSearch, sortOption])

  const handleRename = (id: string) => {
    if (renameValue.trim()) {
      renameFile(id, renameValue.trim())
    }
    setRenamingFile(null)
    setRenameValue('')
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Cloud status + Upload button */}
      <div className="flex items-center gap-2">
        {user && configured ? (
          loadingCloud ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex-1">
              <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
              <span className="text-[11px] text-blue-400 font-medium">Loading...</span>
            </div>
          ) : cloudFiles.length > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-1">
              <Cloud className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">Cloud synced</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex-1">
              <Cloud className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[11px] text-blue-400 font-medium">Connected</span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex-1">
            <CloudOff className="h-3.5 w-3.5 text-yellow-400" />
            <span className="text-[11px] text-yellow-400 font-medium">Local only</span>
          </div>
        )}
        {user && configured && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-colors min-h-[36px]"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full glass-input pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {fileCategories.map((cat) => {
          const Icon = cat.icon
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'glass-card text-muted-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Sort Options */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex gap-1">
          {(['date', 'name', 'size'] as SortOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortOption(opt)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                sortOption === opt
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Cloud Files Section */}
      {user && configured && cloudFiles.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Cloud Files
          </h3>
          <div className="space-y-2">
            {cloudFiles.map((cf) => (
              <motion.div
                key={cf.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card-hover p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-400">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {cf.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(cf.file_size)} · Cloud
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteCloudFile(cf.id, cf.file_name)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                    aria-label="Delete cloud file"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Local File List */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Local Files
        </h3>
        <div className="space-y-2 max-h-[calc(100vh-32rem)] overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {filteredFiles.length > 0 ? (
              filteredFiles.map((file) => {
                const Icon = getFileIcon(file.type)
                const iconColor = getFileIconColor(file.type)
                return (
                  <motion.div
                    key={file.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="glass-card-hover p-3 relative"
                  >
                    {renamingFile === file.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(file.id)
                            if (e.key === 'Escape') setRenamingFile(null)
                          }}
                          autoFocus
                          className="glass-input flex-1 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => handleRename(file.id)}
                          className="text-xs text-primary font-medium"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)} · {formatDate(file.createdAt, mounted)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleFavorite(file.id)}
                            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                            aria-label={file.favorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {file.favorite ? (
                              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            ) : (
                              <StarOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setContextMenuFile(
                                contextMenuFile === file.id ? null : file.id
                              )
                            }
                            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                            aria-label="More options"
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Context Menu */}
                    <AnimatePresence>
                      {contextMenuFile === file.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -5 }}
                          className="absolute right-3 top-12 glass-card p-1 z-20 min-w-[140px]"
                        >
                          <button
                            onClick={() => {
                              setRenameValue(file.name)
                              setRenamingFile(file.id)
                              setContextMenuFile(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Rename
                          </button>
                          <button
                            onClick={() => {
                              toggleFavorite(file.id)
                              setContextMenuFile(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Star className="h-3.5 w-3.5" />
                            {file.favorite ? 'Unfavorite' : 'Favorite'}
                          </button>
                          <button
                            onClick={() => setContextMenuFile(null)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            Share
                          </button>
                          <button
                            onClick={() => setContextMenuFile(null)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Info className="h-3.5 w-3.5" />
                            Details
                          </button>
                          <hr className="border-glass-border my-1" />
                          <button
                            onClick={() => {
                              removeFile(file.id)
                              setContextMenuFile(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-8 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <FolderOpen className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">Your workspace is ready</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  {searchQuery
                    ? 'No files match your search'
                    : 'Scan a document or upload files to get started'}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setActiveView('scan-to-pdf')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Scan className="h-3.5 w-3.5" />
                    Scan Document
                  </button>
                  {user && configured && (
                    <button
                      onClick={handleUpload}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload File
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
})
