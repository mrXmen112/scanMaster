'use client'

import { useMemo, useState, memo } from 'react'
import { motion } from 'framer-motion'
import {
  Camera,
  ChevronRight,
  File,
  FilePlus,
  FolderOpen,
  HardDrive,
  Zap,
  Wrench,
} from 'lucide-react'

import { useAppStore } from '@/store/useAppStore'
import {
  TOOLS,
  TOOL_CATEGORIES,
  FEATURED_TOOLS,
  APP_NAME,
} from '@/lib/tools'
import { ToolCard, ToolTile } from './ToolCards'

export default memo(function Dashboard() {
  const { setActiveView, files = [] } = useAppStore()
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const recentFiles = Array.isArray(files) ? files.slice(0, 3) : []

  const filteredTools = useMemo(
    () =>
      activeCategory === 'All'
        ? TOOLS
        : TOOLS.filter((t) => t.category === activeCategory),
    [activeCategory]
  )

  const totalPdfs = files.filter((f) => f.type === 'pdf').length
  const totalSize = files.reduce((acc, f) => acc + f.size, 0)
  const storageUsed =
    totalSize >= 1024 * 1024
      ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
      : `${(totalSize / 1024).toFixed(1)} KB`

  const stats = [
    { label: 'PDFs', value: String(totalPdfs), icon: FilePlus },
    { label: 'Files', value: String(files.length), icon: FolderOpen },
    { label: 'Storage', value: storageUsed, icon: HardDrive },
  ]

  return (
    <div className="space-y-4 px-4 py-4">
      {/* Brand header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tool-surface">
            <Camera className="h-4 w-4 text-tool-surface-fg" strokeWidth={2} aria-hidden />
          </div>
          <h2 className="text-lg font-bold text-foreground">{APP_NAME}</h2>
        </div>
        <button
          onClick={() => setActiveView('tools')}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-primary transition-colors hover:bg-accent"
        >
          <Wrench className="h-3.5 w-3.5" aria-hidden />
          All Tools
        </button>
      </div>

      {/* Primary action */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setActiveView('scan-to-pdf')}
        className="flex w-full items-center gap-4 rounded-2xl p-4 text-left"
        style={{
          background: 'linear-gradient(135deg, #0A84FF 0%, #00BDEB 100%)',
          boxShadow: '0 4px 18px rgba(10,132,255,0.22)',
        }}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Camera className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-white">Quick Scan</p>
          <p className="mt-0.5 text-xs text-white/85">Scan any document instantly</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/80" aria-hidden />
      </motion.button>

      {/* Workspace stats â€” all values derived from real stored files */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              className="glass-card flex flex-col items-center gap-1 p-3"
            >
              <Icon className="h-4 w-4 text-tool-surface-fg" strokeWidth={1.9} aria-hidden />
              <p className="text-base font-bold leading-none text-foreground">{stat.value}</p>
              <p className="text-[10px] leading-none text-muted-foreground">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Featured tools */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Featured
          </h3>
        </div>
        <div className="scrollbar-none flex gap-2.5 overflow-x-auto pb-1">
          {FEATURED_TOOLS.map((tool, i) => (
            <motion.button
              key={tool.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.06 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveView(tool.id)}
              className="glass-card-hover flex w-40 flex-shrink-0 flex-col gap-2.5 p-3.5 text-left"
              aria-label={tool.title}
            >
              <ToolTile toolId={tool.id} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{tool.title}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {tool.description}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent files */}
      {recentFiles.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Files
            </h3>
            <button
              onClick={() => setActiveView('files')}
              className="text-xs font-medium text-primary hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {recentFiles.map((file) => (
              <div key={file.id} className="glass-card-hover flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tool-surface">
                  <File className="h-4 w-4 text-tool-surface-fg" strokeWidth={1.9} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All tools */}
      <div>
        <div className="scrollbar-none mb-3 flex gap-2 overflow-x-auto pb-1">
          {TOOL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {filteredTools.map((tool, i) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              index={i}
              onSelect={(id) => setActiveView(id as never)}
            />
          ))}
        </div>
      </div>

    </div>
  )
})
