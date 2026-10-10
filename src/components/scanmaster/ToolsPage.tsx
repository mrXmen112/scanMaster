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
  Languages,
  ScanText,
  Mic,
  FileArchive,
  ChevronRight,
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
    name: 'PDF Tools',
    tools: [
      {
        id: 'text-to-pdf',
        title: 'Text to PDF',
        description: 'Convert text content to PDF documents',
        icon: FileText,
        color: 'bg-green-500/20 text-green-400',
      },
      {
        id: 'image-to-pdf',
        title: 'Image to PDF',
        description: 'Convert images to PDF format',
        icon: Image,
        color: 'bg-orange-500/20 text-orange-400',
      },
      {
        id: 'pdf-editor',
        title: 'PDF Editor',
        description: 'Edit and annotate your PDFs',
        icon: Edit,
        color: 'bg-purple-500/20 text-purple-400',
      },
      {
        id: 'compress-pdf',
        title: 'Compress PDF',
        description: 'Reduce PDF file size easily',
        icon: Minimize2,
        color: 'bg-red-500/20 text-red-400',
      },
      {
        id: 'merge-pdf',
        title: 'Merge PDF',
        description: 'Combine multiple PDFs into one',
        icon: Merge,
        color: 'bg-cyan-500/20 text-cyan-400',
      },
      {
        id: 'split-pdf',
        title: 'Split PDF',
        description: 'Split a PDF into separate parts',
        icon: Split,
        color: 'bg-yellow-500/20 text-yellow-400',
      },
    ],
  },
  {
    name: 'Scan Tools',
    tools: [
      {
        id: 'scan-to-pdf',
        title: 'Scan to PDF',
        description: 'Scan documents with your camera',
        icon: Camera,
        color: 'bg-blue-500/20 text-blue-400',
      },
      {
        id: 'ocr',
        title: 'OCR to Text',
        description: 'Extract text from images using OCR',
        icon: ScanText,
        color: 'bg-emerald-500/20 text-emerald-400',
      },
    ],
  },
  {
    name: 'Translation Tools',
    tools: [
      {
        id: 'translate',
        title: 'Translate',
        description: 'Translate text and documents',
        icon: Languages,
        color: 'bg-indigo-500/20 text-indigo-400',
      },
    ],
  },
  {
    name: 'Voice Tools',
    tools: [
      {
        id: 'speech-to-text',
        title: 'Speech to Text',
        description: 'Convert voice to text with AI',
        icon: Mic,
        color: 'bg-pink-500/20 text-pink-400',
      },
    ],
  },
  {
    name: 'Export Tools',
    tools: [
      {
        id: 'zip-export',
        title: 'ZIP Export',
        description: 'Export and compress files as ZIP',
        icon: FileArchive,
        color: 'bg-teal-500/20 text-teal-400',
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
