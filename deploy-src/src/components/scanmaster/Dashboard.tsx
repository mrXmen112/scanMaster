'use client'

import {
  Camera,
  FileText,
  Edit,
  Image,
  Minimize2,
  Merge,
  Split,
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
  TrendingUp,
  Zap,
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
    color: 'bg-blue-500/15 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.1)]',
    category: 'Scan',
    featured: true,
  },
  {
    id: 'text-to-pdf',
    title: 'Text to PDF',
    description: 'Convert text to PDF',
    icon: FileText,
    color: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
    category: 'Create',
  },
  {
    id: 'pdf-editor',
    title: 'PDF Editor',
    description: 'Edit and annotate PDFs',
    icon: Edit,
    color: 'bg-purple-500/15 text-purple-400 border border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.1)]',
    category: 'Edit',
    featured: true,
  },
  {
    id: 'image-to-pdf',
    title: 'Image to PDF',
    description: 'Convert images to PDF',
    icon: Image,
    color: 'bg-sky-500/15 text-sky-400 border border-sky-500/20',
    category: 'Create',
  },
  {
    id: 'compress-pdf',
    title: 'Compress PDF',
    description: 'Reduce PDF file size',
    icon: Minimize2,
    color: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    category: 'Edit',
  },
  {
    id: 'merge-pdf',
    title: 'Merge PDF',
    description: 'Combine multiple PDFs',
    icon: Merge,
    color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    category: 'Edit',
  },
  {
    id: 'split-pdf',
    title: 'Split PDF',
    description: 'Split PDF into parts',
    icon: Split,
    color: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    category: 'Edit',
  },
  {
    id: 'ocr',
    title: 'OCR to Text',
    description: 'Extract text from images',
    icon: ScanText,
    color: 'bg-teal-500/15 text-teal-400 border border-teal-500/20',
    category: 'AI',
  },
  {
    id: 'speech-to-text',
    title: 'Speech to Text',
    description: 'Convert voice to text',
    icon: Mic,
    color: 'bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/20',
    category: 'AI',
  },
  {
    id: 'zip-export',
    title: 'ZIP Export',
    description: 'Export files as ZIP',
    icon: FileArchive,
    color: 'bg-teal-500/15 text-teal-400 border border-teal-500/20',
    category: 'Create',
  },
]

const categories = ['All', 'Scan', 'Create', 'Edit', 'AI']

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

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

  // Stats
  const totalPdfs = files.filter((f) => f.type === 'pdf').length
  const totalFiles = files.length
  const totalSize = files.reduce((acc, f) => acc + f.size, 0)
  const storageUsed =
    totalSize >= 1024 * 1024
      ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
      : `${(totalSize / 1024).toFixed(1)} KB`

  const stats = [
    { label: 'PDFs Created', value: totalPdfs.toString(), icon: FilePlus, iconColor: 'text-[#00f0ff] dark:text-[#00f0ff]', iconBg: 'bg-[#00f0ff]/15' },
    { label: 'Total Files', value: totalFiles.toString(), icon: FolderOpen, iconColor: 'text-emerald-400 dark:text-emerald-400', iconBg: 'bg-emerald-500/15' },
    { label: 'Storage', value: storageUsed, icon: HardDrive, iconColor: 'text-purple-400 dark:text-purple-400', iconBg: 'bg-purple-500/15' },
  ]

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Animated Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1c3f] via-[#091129] to-[#040817] border border-[#00f0ff]/20 p-6 shadow-2xl"
      >
        {/* Glow decorative graphics */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-[#00f0ff]/15 blur-3xl animate-pulse" />
        <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-primary/10 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 mb-1.5"
            >
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/35 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                PRO ACTIVE
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60 font-semibold">
                v1.0.0
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="text-2xl font-black tracking-tight text-white leading-tight"
            >
              Welcome to{' '}
              <span className="bg-gradient-to-r from-[#00f0ff] via-blue-400 to-[#702efd] bg-clip-text text-transparent drop-shadow-md">
                Scan Master
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="text-xs text-slate-300/80 mt-2 max-w-[200px] leading-relaxed font-medium"
            >
              Your intelligent portable document hub and AI productivity toolbox.
            </motion.p>
          </div>
          
          <div className="relative">
            {/* Pulsing scanning ring */}
            <div className="absolute -inset-2 bg-gradient-to-r from-[#00f0ff] to-primary rounded-full opacity-35 blur-md animate-pulse" />
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              whileTap={{ scale: 0.88 }}
              onClick={() => setActiveView('scan-to-pdf')}
              className="relative w-15 h-15 rounded-full bg-gradient-to-br from-[#00f0ff] to-primary flex items-center justify-center text-white shadow-[0_4px_20px_rgba(0,240,255,0.4)] cursor-pointer"
              aria-label="Quick Scan"
            >
              <Camera className="h-6.5 w-6.5 text-[#070d1e]" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="grid grid-cols-3 gap-3"
      >
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className="glass-card p-3 flex flex-col items-center justify-center text-center gap-1.5 border border-glass-border/30 shadow-sm"
            >
              <div
                className={`w-9 h-9 rounded-xl ${stat.iconBg} flex items-center justify-center`}
              >
                <Icon className={`h-4.5 w-4.5 ${stat.iconColor}`} />
              </div>
              <div className="space-y-0.5">
                <p className="text-base font-extrabold text-foreground tracking-tight leading-none">
                  {stat.value}
                </p>
                <p className="text-[9px] font-medium text-muted-foreground leading-none tracking-wide uppercase">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Featured Tools */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Featured Tools
          </h3>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x px-1">
          {featuredTools.map((tool, i) => {
            const Icon = tool.icon
            return (
              <motion.button
                key={tool.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveView(tool.id)}
                className="glass-card flex-shrink-0 w-44 flex flex-col justify-between p-4.5 border border-glass-border/40 bg-gradient-to-tr from-white/5 to-white/[0.02] shadow-md snap-align-start cursor-pointer text-left h-36"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${tool.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground tracking-tight">
                    {tool.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                    {tool.description}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 text-[9px] text-primary font-bold uppercase tracking-wider mt-1">
                  <span>Try Now</span>
                  <ChevronRight className="h-2.5 w-2.5" />
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Quick Scan Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35 }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setActiveView('scan-to-pdf')}
          className="w-full glass-card p-4 flex items-center gap-3.5 border border-glass-border/40 shadow-lg cursor-pointer bg-gradient-to-r from-primary/10 via-primary/[0.03] to-transparent"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <Sparkles className="h-5.5 w-5.5" />
          </div>
          <div className="text-left space-y-0.5">
            <p className="text-sm font-bold text-white tracking-tight">Quick Scanner</p>
            <p className="text-xs text-muted-foreground">
              Scan, crop, and convert to PDF in seconds
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/60 ml-auto" />
        </motion.button>
      </motion.div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none px-1">
        {categories.map((cat) => (
          <motion.button
            key={cat}
            whileTap={{ scale: 0.93 }}
            onClick={() => setActiveCategory(cat)}
            className={`px-4.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer ${
              activeCategory === cat
                ? 'bg-gradient-to-r from-primary to-[#702efd] text-white shadow-md'
                : 'bg-secondary/40 border border-glass-border/20 text-secondary-foreground hover:bg-secondary/60'
            }`}
          >
            {cat}
          </motion.button>
        ))}
      </div>

      {/* Tool Cards Grid */}
      <div>
        <div className="flex items-center gap-2 mb-3.5 px-1">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            All Tools
          </h3>
        </div>
        <motion.div
          key={activeCategory}
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3"
        >
          {filteredTools.map((tool) => {
            const Icon = tool.icon
            return (
              <motion.button
                key={tool.id}
                variants={item}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveView(tool.id)}
                className="glass-card p-4.5 flex flex-col items-center text-center justify-center gap-3 border border-glass-border/30 shadow-md cursor-pointer hover:border-primary/20 transition-colors h-36"
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${tool.color}`}
                >
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground tracking-tight">
                    {tool.title}
                  </p>
                  <p className="text-[9.5px] text-muted-foreground leading-tight line-clamp-2">
                    {tool.description}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </motion.div>
      </div>

      {/* Recent Files */}
      <div>
        <div className="flex items-center justify-between mb-3.5 px-1">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Recent Files
          </h3>
          <button
            onClick={() => setActiveView('files')}
            className="text-xs text-primary font-bold hover:underline cursor-pointer"
          >
            View All
          </button>
        </div>
        {recentFiles.length > 0 ? (
          <div className="space-y-2.5">
            {recentFiles.map((file, index) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className="glass-card p-3 flex items-center gap-3 border border-glass-border/30 hover:border-glass-border/60 transition-all shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <File className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0 text-left space-y-0.5">
                  <p className="text-xs font-semibold text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground/40 mr-1" />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 text-center border border-glass-border/25">
            <File className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2.5" />
            <p className="text-xs font-semibold text-white">No recent files</p>
            <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] mx-auto">
              Your scanned or converted documents will appear here.
            </p>
          </div>
        )}
      </div>

      {/* Premium Upgrade Banner */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setActiveView('premium')}
        className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#d97706]/20 via-[#ea580c]/15 to-[#d97706]/5 border border-amber-500/20 p-4.5 flex items-center gap-4 shadow-lg cursor-pointer"
      >
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
          <Crown className="h-5.5 w-5.5 text-white" />
        </div>
        <div className="flex-1 text-left space-y-0.5">
          <p className="text-xs font-extrabold text-amber-400 tracking-tight">
            Upgrade to ScanMaster Premium
          </p>
          <p className="text-[10.5px] text-muted-foreground leading-snug">
            Unlock all advanced PDF tools and unlimited AI explanations.
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-amber-500" />
      </motion.button>
    </div>
  )
})
