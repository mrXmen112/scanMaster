'use client'

import { useMemo, useState, memo } from 'react'
import { motion } from 'framer-motion'
import { Search, SearchX } from 'lucide-react'

import { useAppStore } from '@/store/useAppStore'
import { TOOLS, TOOL_CATEGORIES, type ToolDefinition } from '@/lib/tools'
import { ToolRow, ToolEmptyState } from './ToolIcon'
import { useDebounce } from '@/hooks/use-debounce'

/**
 * Tools directory.
 *
 * Categories are derived from the shared registry so a tool can never appear
 * here without also appearing on Home (and vice versa). Ordering follows the
 * registry order, which preserves the previous grouping: Scan, then Create,
 * then Edit, then AI.
 */
const CATEGORY_ORDER = ['Scan', 'Create', 'Edit', 'AI'] as const

export default memo(function ToolsPage() {
  const { setActiveView } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const debouncedSearch = useDebounce(searchQuery, 250)

  const filteredTools = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return TOOLS.filter((tool) => {
      const matchesCategory = activeCategory === 'All' || tool.category === activeCategory
      if (!matchesCategory) return false
      if (!q) return true
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q)
      )
    })
  }, [activeCategory, debouncedSearch])

  const grouped = useMemo(() => {
    const map = new Map<string, ToolDefinition[]>()
    for (const tool of filteredTools) {
      const list = map.get(tool.category) ?? []
      list.push(tool)
      map.set(tool.category, list)
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      tools: map.get(c) as ToolDefinition[],
    }))
  }, [filteredTools])

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="text"
          placeholder="Search tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search tools"
          className="glass-input w-full py-2.5 pl-10 pr-4 text-sm"
        />
      </div>

      {/* Category filter */}
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
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

      {/* Tools */}
      {grouped.length > 0 ? (
        grouped.map((group) => (
          <div key={group.category}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.category === 'AI' ? 'AI Tools' : `${group.category} Tools`}
            </h3>
            <div className="space-y-2">
              {group.tools.map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  onSelect={(id) => setActiveView(id as never)}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <ToolEmptyState
            icon={SearchX}
            title="No tools found"
            subtitle="Try a different search term or category"
          />
        </motion.div>
      )}
    </div>
  )
})
