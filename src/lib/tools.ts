import {
  ScanLine,
  FileText,
  PencilLine,
  Image,
  Minimize2,
  Combine,
  Scissors,
  ScanText,
  Languages,
  AudioLines,
  Archive,
  Lock,
  LockOpen,
  Signature,
  Sparkles,
  Crop,
  PenLine,
  Contact,
  Wand2,
  MousePointer2,
  type LucideIcon,
} from 'lucide-react'

import type { ToolView } from '@/store/useAppStore'

export type ToolCategory = 'Scan' | 'Create' | 'Edit' | 'AI'

/**
 * The single source of truth for the app's tool inventory.
 *
 * Previously the same 11 tools were declared twice - once in Dashboard.tsx and
 * once in ToolsPage.tsx - each with its own icon and its own arbitrary colour.
 * That duplication is what let the two screens drift apart and what produced
 * the "rainbow" look. Both screens now read from this registry.
 *
 * Ids, labels and routes are unchanged - this is a presentation-only
 * consolidation, no tool was added, removed or re-routed.
 */
export interface ToolDefinition {
  id: ToolView
  title: string
  description: string
  icon: LucideIcon
  category: ToolCategory
  /** Highlighted on Home and at the top of Tools. */
  featured?: boolean
  /**
   * Icon container tone. Kept to the brand blue/cyan pair so the grid reads as
   * one family; the distinction between tools comes from the glyph, not the
   * background colour.
   */
  tone: 'blue' | 'cyan'
}

export const TOOLS: ToolDefinition[] = [
  {
    id: 'scan-to-pdf',
    title: 'Scan to PDF',
    description: 'Scan documents with your camera',
    icon: ScanLine,
    category: 'Scan',
    featured: true,
    tone: 'blue',
  },
  {
    id: 'text-to-pdf',
    title: 'Text to PDF',
    description: 'Convert text into a PDF document',
    icon: FileText,
    category: 'Create',
    tone: 'cyan',
  },
  {
    id: 'image-to-pdf',
    title: 'Image to PDF',
    description: 'Convert images into a PDF',
    icon: Image,
    category: 'Create',
    tone: 'blue',
  },
  {
    id: 'pdf-editor',
    title: 'PDF Editor',
    description: 'Edit and annotate your PDFs',
    icon: PencilLine,
    category: 'Edit',
    featured: true,
    tone: 'blue',
  },
  {
    id: 'compress-pdf',
    title: 'Compress PDF',
    description: 'Reduce PDF file size',
    icon: Minimize2,
    category: 'Edit',
    tone: 'cyan',
  },
  {
    id: 'merge-pdf',
    title: 'Merge PDF',
    description: 'Combine multiple PDFs into one',
    icon: Combine,
    category: 'Edit',
    tone: 'blue',
  },
  {
    id: 'split-pdf',
    title: 'Split PDF',
    description: 'Split a PDF into separate parts',
    icon: Scissors,
    category: 'Edit',
    tone: 'cyan',
  },
  {
    id: 'zip-export',
    title: 'ZIP Export',
    description: 'Export files as a ZIP archive',
    icon: Archive,
    category: 'Create',
    tone: 'blue',
  },
  {
    id: 'ocr',
    title: 'OCR to Text',
    description: 'Extract text from images',
    icon: ScanText,
    category: 'AI',
    tone: 'blue',
  },
  {
    id: 'translate',
    title: 'Translate',
    description: 'Translate text and documents',
    icon: Languages,
    category: 'AI',
    featured: true,
    tone: 'cyan',
  },
  {
    id: 'speech-to-text',
    title: 'Speech to Text',
    description: 'Convert voice into text',
    icon: AudioLines,
    category: 'AI',
    tone: 'blue',
  },

  // ── Restored tools ──────────────────────────────────────────────────────
  // These components have always existed in the repo, but src/ never listed
  // or routed them, so they were unreachable from the UI. They are wired back
  // here so the whole built inventory is reachable again. No new tools were
  // invented - every one of these maps to an existing screen.
  {
    id: 'smart-crop',
    title: 'Smart Crop',
    description: 'Auto-crop and straighten a photo',
    icon: Crop,
    category: 'Scan',
    tone: 'cyan',
  },
  {
    id: 'background-cleaner',
    title: 'Background Cleaner',
    description: 'Clean up document backgrounds',
    icon: Wand2,
    category: 'Scan',
    tone: 'blue',
  },
  {
    id: 'screenshot-editor',
    title: 'Screenshot Editor',
    description: 'Markup, blur and redact screenshots',
    icon: MousePointer2,
    category: 'Edit',
    tone: 'cyan',
  },
  {
    id: 'password-protect',
    title: 'Password Protect PDF',
    description: 'Encrypt a PDF with a password',
    icon: Lock,
    category: 'Edit',
    tone: 'blue',
  },
  {
    id: 'password-remove',
    title: 'Remove PDF Password',
    description: 'Unlock a protected PDF',
    icon: LockOpen,
    category: 'Edit',
    tone: 'cyan',
  },
  {
    id: 'e-signature',
    title: 'E-Signature',
    description: 'Draw and place a signature',
    icon: Signature,
    category: 'Edit',
    tone: 'blue',
  },
  {
    id: 'ai-summary',
    title: 'AI Summary',
    description: 'Summarise a document with AI',
    icon: Sparkles,
    category: 'AI',
    tone: 'blue',
  },
  {
    id: 'handwriting-to-text',
    title: 'Handwriting to Text',
    description: 'Convert handwriting into text',
    icon: PenLine,
    category: 'AI',
    tone: 'cyan',
  },
  {
    id: 'business-card-scanner',
    title: 'Business Card Scanner',
    description: 'Scan a card and save the contact',
    icon: Contact,
    category: 'Scan',
    tone: 'blue',
  },
]

export const TOOL_CATEGORIES: Array<'All' | ToolCategory> = [
  'All',
  'Scan',
  'Create',
  'Edit',
  'AI',
]

export const FEATURED_TOOLS = TOOLS.filter((t) => t.featured)

export function getTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id)
}

/** Canonical, user-facing product name. */
export const APP_NAME = 'ScanMaster'
