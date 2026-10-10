'use client'

import { motion } from 'framer-motion'
import type { ElementType } from 'react'

import type { ToolDefinition } from '@/lib/tools'

type Size = 'sm' | 'md' | 'lg'

const CONTAINER: Record<Size, string> = {
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-11 w-11 rounded-xl',
  lg: 'h-12 w-12 rounded-xl',
}

const GLYPH: Record<Size, string> = {
  sm: 'h-[18px] w-[18px]',
  md: 'h-[22px] w-[22px]',
  lg: 'h-[24px] w-[24px]',
}

function toneClass(tone: ToolDefinition['tone']): string {
  return tone === 'cyan'
    ? 'bg-tool-surface-alt text-tool-surface-alt-fg'
    : 'bg-tool-surface text-tool-surface-fg'
}

/**
 * The one place a tool icon is rendered.
 *
 * Every tool card in the app (Home grid, Home featured rail, Tools list,
 * search results) routes through this component, so icon size, stroke weight,
 * corner radius and palette are identical everywhere. Colours come from theme
 * tokens, which means light and dark are both correct with no per-screen
 * overrides.
 */
export function ToolIcon({
  tool,
  size = 'md',
}: {
  tool: ToolDefinition
  size?: Size
}) {
  const Icon = tool.icon
  return (
    <div
      className={`${CONTAINER[size]} ${toneClass(tool.tone)} flex items-center justify-center shrink-0`}
    >
      <Icon className={GLYPH[size]} strokeWidth={1.9} aria-hidden />
    </div>
  )
}

/**
 * Grid-style tool card used on Home and anywhere else a compact tile is shown.
 */
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
      <ToolIcon tool={tool} size="md" />
      <div className="min-w-0 w-full">
        <p className="truncate text-sm font-medium text-foreground">{tool.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
          {tool.description}
        </p>
      </div>
    </motion.button>
  )
}

/**
 * Row-style tool card used by the Tools screen and search results.
 */
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
      <ToolIcon tool={tool} size="md" />
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
  icon: ElementType
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
