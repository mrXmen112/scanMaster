'use client'

import { useState } from 'react'

import { TOOL_ICONS } from '@/lib/tool-icons'

type Size = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Rendered size in dp, and the tile's own radius (the artwork already carries
 * its rounded corners, so the tile is never wrapped in a circle).
 */
const SIZES: Record<Size, number> = {
  sm: 32,
  md: 44, // Tools list
  lg: 48, // Home cards
  xl: 56,
}

interface ToolIconProps {
  /** Registry id, e.g. "merge-pdf". */
  toolId: string
  size?: Size
  className?: string
  /** Accessible label; defaults to the registry label. */
  title?: string
}

/**
 * The single place a tool icon is drawn.
 *
 * Every tool surface in the app - Home quick actions, Home popular/featured
 * tiles, the Tools directory, search results, the Files list, the ad-gate
 * modal and the per-tool headers - renders through this component, so an icon
 * can never fall back to a mismatched line glyph.
 *
 * The tile is a self-contained rounded square with its own colour, so it reads
 * correctly on both the light and the dark theme without any per-theme styling.
 */
export default function ToolIcon({
  toolId,
  size = 'md',
  className = '',
  title,
}: ToolIconProps) {
  const entry = TOOL_ICONS[toolId]
  const px = SIZES[size]
  const [failed, setFailed] = useState(false)

  // Fallback keeps the layout intact if artwork is ever missing.
  if (!entry || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-[28%] bg-tool-surface ${className}`}
        style={{ width: px, height: px }}
        role="img"
        aria-label={title ?? entry?.label ?? 'Tool'}
      >
        <span
          className="font-semibold text-tool-surface-fg"
          style={{ fontSize: Math.round(px * 0.4) }}
        >
          {initials(title ?? entry?.label ?? toolId)}
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={entry.src}
      alt={title ?? entry.label}
      width={px}
      height={px}
      className={`shrink-0 select-none object-contain ${className}`}
      style={{ width: px, height: px }}
      onError={() => setFailed(true)}
      draggable={false}
    />
  )
}

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
