'use client'

import { useState, memo, ElementType } from 'react'
import {
  Search,
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
  ChevronRight,
  Lock,
  PenTool,
  Bot,
  Crop,
  Sparkles,
  Contact,
} from 'lucide-react'
import { useAppStore, ToolView } from '@/store/useAppStore'
import { motion } from 'framer-motion'
import { useDebounce } from '@/hooks/use-debounce'

interface Tool {
  id: ToolView
  title: string
  description: string
  icon: ElementType
  color: string
}

interface ToolCategory {
  name: string
  tools: Tool[]
}

const categories: ToolCategory[] = [
  {
    name: 'Scan & Clean',
    tools: [
      {
        id: 'scan-to-pdf',
        title: 'Camera Scanner',
        description: 'Scan documents with your camera',
        icon: Camera,
        color: 'bg-blue-500/15 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.1)]',
      },
      {
        id: 'smart-crop',
        title: 'Smart Crop',
        description: 'Detect document edges and fix perspective distortion',
        icon: Crop,
        color: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
      },
      {
        id: 'background-cleaner',
        title: 'Background Cleaner',
        description: 'Remove shadows and enhance document readability',
        icon: Sparkles,
        color: 'bg-teal-500/15 text-teal-400 border border-teal-500/20',
      },
      {
        id: 'screenshot-editor',
        title: 'Screenshot Editor',
        description: 'Crop, annotate, and redact sensitive screen information',
        icon: Image,
        color: 'bg-sky-500/15 text-sky-400 border border-sky-500/20',
      },
    ],
  },
  {
    name: 'PDF Security & Signing',
    tools: [
      {
        id: 'password-protect',
        title: 'Password Protect PDF',
        description: 'Encrypt your PDF with standard, secure password locking',
        icon: Lock,
        color: 'bg-red-500/15 text-red-400 border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.1)]',
      },
      {
        id: 'e-signature',
        title: 'E-Signature',
        description: 'Draw, place, and resize signatures on PDF pages',
        icon: PenTool,
        color: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
      },
    ],
  },
  {
    name: 'AI Document Tools',
    tools: [
      {
        id: 'ocr',
        title: 'OCR to Text',
        description: 'Extract readable text from image scans',
        icon: ScanText,
        color: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
      },
      {
        id: 'ai-summary',
        title: 'AI Document Summary',
        description: 'Generate multi-mode professional summaries of documents',
        icon: Bot,
        color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]',
      },
      {
        id: 'handwriting-to-text',
        title: 'Handwriting to Text',
        description: 'Transcribe handwritten notes into editable files',
        icon: FileText,
        color: 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
      },
      {
        id: 'business-card-scanner',
        title: 'Business Card Scanner',
        description: 'Extract business card credentials to vCard/contacts',
        icon: Contact,
        color: 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
      },
      {
        id: 'speech-to-text',
        title: 'Speech to Text',
        description: 'Convert voice recordings to text with AI',
        icon: Mic,
        color: 'bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/20',
      },
    ],
  },
  {
    name: 'PDF Editor & Utilities',
    tools: [
      {
        id: 'pdf-editor',
        title: 'PDF Editor',
        description: 'Add Text, Erase content with Whiteouts, and annotate',
        icon: Edit,
        color: 'bg-purple-500/15 text-purple-400 border border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.1)]',
      },
      {
        id: 'text-to-pdf',
        title: 'Text to PDF',
        description: 'Convert plain text files to formatted PDFs',
        icon: FileText,
        color: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
      },
      {
        id: 'image-to-pdf',
        title: 'Image to PDF',
        description: 'Assemble JPG/PNG assets into a single PDF',
        icon: Image,
        color: 'bg-sky-500/15 text-sky-400 border border-sky-500/20',
      },
      {
        id: 'compress-pdf',
        title: 'Compress PDF',
        description: 'Reduce PDF document file sizes',
        icon: Minimize2,
        color: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
      },
      {
        id: 'merge-pdf',
        title: 'Merge PDF',
        description: 'Combine multiple PDFs into one file',
        icon: Merge,
        color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
      },
      {
        id: 'split-pdf',
        title: 'Split PDF',
        description: 'Separate document pages into multiple files',
        icon: Split,
        color: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
      },
      {
        id: 'zip-export',
        title: 'ZIP Export',
        description: 'Bundle multiple files into a clean ZIP archive',
        icon: FileArchive,
        color: 'bg-teal-500/15 text-teal-400 border border-teal-500/20',
      },
    ],
  },
]

export default memo(function ToolsPage() {
  const { setActiveView } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 250)

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      tools: cat.tools.filter(
        (tool) =>
          tool.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          tool.description.toLowerCase().includes(debouncedSearch.toLowerCase())
      ),
    }))
    .filter((cat) => cat.tools.length > 0)

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full glass-input pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      {/* Categories */}
      {filteredCategories.map((category, catIndex) => (
        <motion.div
          key={category.name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: catIndex * 0.1 }}
        >
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {category.name}
          </h3>
          <div className="space-y-2">
            {category.tools.map((tool) => {
              const Icon = tool.icon
              return (
                <motion.button
                  key={tool.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setActiveView(tool.id)}
                  className="w-full glass-card-hover p-3 flex items-center gap-3"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tool.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {tool.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {tool.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      ))}

      {filteredCategories.length === 0 && (
        <div className="glass-card p-8 text-center">
          <Search className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tools found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try a different search term
          </p>
        </div>
      )}
    </div>
  )
})
