'use client'

import {
  Camera,
  FileText,
  Edit,
  Image,
  Minimize2,
  Merge,
  Split,
  Languages,
  ScanText,
  Mic,
  FileArchive,
  Sparkles,
  ChevronRight,
  File,
  Crown,
  FilePlus,
  FolderOpen,
  HardDrive,
  Zap,
  Wrench,
} from 'lucide-react'
import { useAppStore, ToolView } from '@/store/useAppStore'
import { motion } from 'framer-motion'
import { useState, useMemo, memo, ElementType } from 'react'

const tools: {
  id: ToolView
  title: string
  description: string
  icon: ElementType
  color: string
  category: string
  featured?: boolean
}[] = [
  {
    id: 'scan-to-pdf',
    title: 'Scan to PDF',
    description: 'Scan documents with camera',
    icon: Camera,
    color: 'bg-blue-500/20 text-blue-500 dark:text-blue-400',
    category: 'Scan',
    featured: true,
  },
  {
    id: 'text-to-pdf',
    title: 'Text to PDF',
    description: 'Convert text to PDF',
    icon: FileText,
    color: 'bg-green-500/20 text-green-500 dark:text-green-400',
    category: 'Create',
  },
  {
    id: 'pdf-editor',
    title: 'PDF Editor',
    description: 'Edit and annotate PDFs',
    icon: Edit,
    color: 'bg-purple-500/20 text-purple-500 dark:text-purple-400',
    category: 'Edit',
    featured: true,
  },
  {
    id: 'image-to-pdf',
    title: 'Image to PDF',
    description: 'Convert images to PDF',
    icon: Image,
    color: 'bg-orange-500/20 text-orange-500 dark:text-orange-400',
    category: 'Create',
  },
  {
    id: 'compress-pdf',
    title: 'Compress PDF',
    description: 'Reduce PDF file size',
    icon: Minimize2,
    color: 'bg-red-500/20 text-red-500 dark:text-red-400',
    category: 'Edit',
  },
  {
    id: 'merge-pdf',
    title: 'Merge PDF',
    description: 'Combine multiple PDFs',
    icon: Merge,
    color: 'bg-cyan-500/20 text-cyan-500 dark:text-cyan-400',
    category: 'Edit',
  },
  {
    id: 'split-pdf',
    title: 'Split PDF',
    description: 'Split PDF into parts',
    icon: Split,
    color: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    category: 'Edit',
  },
  {
    id: 'translate',
    title: 'Translate',
    description: 'Translate text & docs',
    icon: Languages,
    color: 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-400',
    category: 'AI',
    featured: true,
  },
  {
    id: 'ocr',
    title: 'OCR to Text',
    description: 'Extract text from images',
    icon: ScanText,
    color: 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400',
    category: 'AI',
  },
  {
    id: 'speech-to-text',
    title: 'Speech to Text',
    description: 'Convert voice to text',
    icon: Mic,
    color: 'bg-pink-500/20 text-pink-500 dark:text-pink-400',
    category: 'AI',
  },
  {
    id: 'zip-export',
    title: 'ZIP Export',
    description: 'Export files as ZIP',
    icon: FileArchive,
    color: 'bg-teal-500/20 text-teal-500 dark:text-teal-400',
    category: 'Create',
  },
]

const categories = ['All', 'Scan', 'Create', 'Edit', 'AI']

export default memo(function Dashboard() {
  const { setActiveView, files = [] } = useAppStore()
  const [activeCategory, setActiveCategory] = useState('All')
  const recentFiles = Array.isArray(files) ? files.slice(0, 3) : []

  const filteredTools = useMemo(
    () =>
      activeCategory === 'All'
        ? tools
        : tools.filter((t) => t.category === activeCategory),
    [activeCategory]
  )

  const featuredTools = useMemo(() => tools.filter((t) => t.featured), [])

  const totalPdfs = files.filter((f) => f.type === 'pdf').length
  const totalFiles = files.length
  const totalSize = files.reduce((acc, f) => acc + f.size, 0)
  const storageUsed =
    totalSize >= 1024 * 1024
      ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
      : `${(totalSize / 1024).toFixed(1)} KB`

  const stats = [
    { label: 'PDFs', value: totalPdfs.toString(), icon: FilePlus, iconColor: 'text-blue-500 dark:text-blue-400' },
    { label: 'Files', value: totalFiles.toString(), icon: FolderOpen, iconColor: 'text-emerald-500 dark:text-emerald-400' },
    { label: 'Storage', value: storageUsed, icon: HardDrive, iconColor: 'text-purple-500 dark:text-purple-400' },
  ]

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Brand Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #0B1B3F 0%, #06102A 100%)',
              boxShadow: '0 2px 12px rgba(10, 132, 255, 0.2)',
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 40 40" fill="none">
              <path d="M10 6 L24 6 L30 12 L30 34 L10 34 Z" fill="white" />
              <path d="M24 6 L24 12 L30 12 Z" fill="#C8D0E0" />
              <path d="M14 18 L26 18" stroke="#B0BEC5" strokeWidth="2" strokeLinecap="round" />
              <path d="M14 22 L26 22" stroke="#B0BEC5" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 30 Q17 27 20 30 Q23 33 28 30" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-foreground">ScanMaster</h2>
        </div>
        <button
          onClick={() => setActiveView('tools')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Wrench className="h-3.5 w-3.5" />
          All Tools
        </button>
      </div>

      {/* Quick Scan - Primary Action */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setActiveView('scan-to-pdf')}
        className="w-full p-4 rounded-2xl flex items-center gap-4 text-left"
        style={{
          background: 'linear-gradient(135deg, #0B1B3F 0%, #0A84FF 100%)',
          boxShadow: '0 4px 24px rgba(10, 132, 255, 0.25)',
        }}
      >
        <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Camera className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white">Quick Scan</p>
          <p className="text-xs text-white/70 mt-0.5">Scan any document instantly</p>
        </div>
        <ChevronRight className="h-5 w-5 text-white/60 shrink-0" />
      </motion.button>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="glass-card p-3 flex flex-col items-center gap-1"
            >
              <Icon className={`h-4 w-4 ${stat.iconColor}`} />
              <p className="text-base font-bold text-foreground leading-none">
                {stat.value}
              </p>
              <p className="text-[10px] text-muted-foreground leading-none">
                {stat.label}
              </p>
            </motion.div>
          )
        })}
      </div>

      {/* Featured Tools */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Featured
          </h3>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {featuredTools.map((tool, i) => {
            const Icon = tool.icon
            return (
              <motion.button
                key={tool.id}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView(tool.id)}
                className="glass-card-hover p-3.5 flex-shrink-0 w-40 flex flex-col gap-2.5"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${tool.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">
                    {tool.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    {tool.description}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Recent Files */}
      {recentFiles.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Files
            </h3>
            <button
              onClick={() => setActiveView('files')}
              className="text-xs text-primary font-medium hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {recentFiles.map((file, index) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className="glass-card-hover p-3 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <File className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills + Tool Grid */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {filteredTools.map((tool) => {
            const Icon = tool.icon
            return (
              <motion.button
                key={tool.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView(tool.id)}
                className="glass-card-hover p-3.5 flex flex-col items-center gap-2.5 text-center"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${tool.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {tool.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    {tool.description}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Premium Upsell */}
      <motion.button
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setActiveView('premium')}
        className="w-full glass-card-hover p-4 flex items-center gap-3 border-primary/30"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
          <Crown className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Upgrade to Premium
          </p>
          <p className="text-xs text-muted-foreground">
            Unlock unlimited tools & AI features
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-primary shrink-0" />
      </motion.button>
    </div>
  )
})