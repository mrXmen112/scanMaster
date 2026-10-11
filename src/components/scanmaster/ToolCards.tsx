'use client'

import { motion } from 'framer-motion'
import { SearchX } from 'lucide-react'

import type { ToolDefinition } from '@/lib/tools'
import ToolIcon from './ToolIconTile'

export { ToolIcon }
export default ToolIcon

/**
 * Tile wrappers around the shared <ToolIcon>.
 *
 * These keep layout/animation concerns separate from the artwork so every tool
 * surface looks and behaves identically. The tile supplies its own colour and
 * rounded corners, so nothing here paints a background or a circular mask.
 */

export function ToolTile({
  toolId,
  size = 'lg',
  className = '',
  title,
}: {
  toolId: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  title?: string
}) {
  return <ToolIcon toolId={toolId} size={size} className={className} title={title} />
}

/** Grid-style tool card used on Home. */
export function ToolCard({
  tool,
  onSelect,
  index = 0,
}: {
  tool: ToolDefinition
  onSelect: (id: string) => void
  index?: number
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.2 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(tool.id)}
      className="glass-card-hover flex flex-col items-center gap-2.5 p-3.5 text-center"
      aria-label={tool.title}
    >
      <ToolTile toolId={tool.id} size="lg" />
      <div className="min-w-0 w-full">
        <p className="truncate text-sm font-medium text-foreground">{tool.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
          {tool.description}
        </p>
      </div>
    </motion.button>
  )
}

/** Row-style tool card used by the Tools directory and search results. */
export function ToolRow({
  tool,
  onSelect,
}: {
  tool: ToolDefinition
  onSelect: (id: string) => void
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(tool.id)}
      className="glass-card-hover flex w-full items-center gap-3 p-3 text-left"
      aria-label={tool.title}
    >
      <ToolTile toolId={tool.id} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{tool.title}</p>
        <p className="text-xs leading-snug text-muted-foreground">{tool.description}</p>
      </div>
    </motion.button>
  )
}

/** Shared empty-state block so Home/Tools/Files stay consistent. */
export function ToolEmptyState({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string
  subtitle: string
  icon: React.ElementType
}) {
  return (
    <div className="glass-card p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-tool-surface text-tool-surface-fg">
        <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

/** Named export so search-result lists can import it directly. */
export { SearchX }
