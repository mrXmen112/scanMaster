/**
 * ID Card PDF generation.
 *
 * Requirement that drives this file: the produced PDF must contain EXACTLY ONE
 * page with BOTH card sides on it (front on the left, back on the right).
 * It must never fall back to "front on page 1, back on page 2", and it must
 * never stretch or crop a card.
 *
 * Layout math is split into a pure, DOM-free function (`computeIdCardLayout`)
 * so it can be unit tested without a browser or a PDF renderer. Only
 * `generateIdCardPdf` touches jsPDF.
 *
 * Privacy: filenames and PDF metadata never contain card numbers, names or any
 * other card content. Only a neutral filename is used.
 */

import type { Size, Rect } from './camera-geometry.ts'
import { fitInsideBox, imageSizeFromDataUrl } from './camera-geometry.ts'

/** Page sizes in PDF points (1pt = 1/72 inch). Both are landscape. */
export const ID_CARD_PAGE_SIZES = {
  a4: { width: 841.89, height: 595.28, label: 'A4' },
  letter: { width: 792, height: 612, label: 'Letter' },
} as const

export type IdCardPageSize = keyof typeof ID_CARD_PAGE_SIZES

/** ISO/IEC 7810 ID-1 card aspect ratio (85.6mm x 54mm). */
export const CARD_ASPECT = 85.6 / 54

export interface IdCardLayoutInput {
  frontSize: Size
  backSize: Size
  pageWidth: number
  pageHeight: number
  margin: number
  gutter: number
}

export interface IdCardLayout {
  pageWidth: number
  pageHeight: number
  front: Rect
  back: Rect
}

/**
 * Compute where each card is drawn on the single landscape page.
 *
 * Both cards get the SAME box, so they always share one visual scale. Each card
 * is then fitted into its box with its own aspect ratio preserved, which is why
 * a slightly different capture size on one side cannot stretch that side.
 */
export function computeIdCardLayout(input: IdCardLayoutInput): IdCardLayout {
  const { pageWidth, pageHeight, margin, gutter } = input

  const usableWidth = Math.max(0, pageWidth - margin * 2 - gutter)
  const cellWidth = usableWidth / 2
  const cellHeight = Math.max(0, pageHeight - margin * 2)

  const frontBox: Rect = {
    x: margin,
    y: margin,
    width: cellWidth,
    height: cellHeight,
  }
  const backBox: Rect = {
    x: margin + cellWidth + gutter,
    y: margin,
    width: cellWidth,
    height: cellHeight,
  }

  return {
    pageWidth,
    pageHeight,
    front: fitInsideBox(input.frontSize, frontBox),
    back: fitInsideBox(input.backSize, backBox),
  }
}

export interface IdCardPdfResult {
  blob: Blob
  pageCount: number
  layout: IdCardLayout
  pageLabel: string
}

/**
 * Build the single-page, two-up ID card PDF.
 *
 * Throws (rather than emitting a broken file) if either side is missing, so a
 * half-captured card can never reach the user as a PDF.
 */
export async function generateIdCardPdf(
  frontDataUrl: string,
  backDataUrl: string,
  pageSize: IdCardPageSize = 'a4'
): Promise<IdCardPdfResult> {
  if (!frontDataUrl) {
    throw new Error('Front side of the ID card is missing. Please capture the front side again.')
  }
  if (!backDataUrl) {
    throw new Error('Back side of the ID card is missing. Please capture the back side again.')
  }

  const page = ID_CARD_PAGE_SIZES[pageSize]

  const [frontSize, backSize] = await Promise.all([
    imageSizeFromDataUrl(frontDataUrl),
    imageSizeFromDataUrl(backDataUrl),
  ])

  // Guard against a corrupted / zero-dimension image reaching jsPDF, which would
  // either throw deep inside the encoder or silently draw nothing.
  if (frontSize.width <= 0 || frontSize.height <= 0) {
    throw new Error('Front side image could not be read. Please capture the front side again.')
  }
  if (backSize.width <= 0 || backSize.height <= 0) {
    throw new Error('Back side image could not be read. Please capture the back side again.')
  }

  const layout = computeIdCardLayout({
    frontSize,
    backSize,
    pageWidth: page.width,
    pageHeight: page.height,
    margin: 40,
    gutter: 28,
  })

  const { jsPDF } = await import('jspdf')
  // Landscape orientation: jsPDF swaps width/height for 'landscape'.
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: pageSize,
    compress: false,
  })

  pdf.addImage(frontDataUrl, detectFormat(frontDataUrl), layout.front.x, layout.front.y, layout.front.width, layout.front.height)
  pdf.addImage(backDataUrl, detectFormat(backDataUrl), layout.back.x, layout.back.y, layout.back.width, layout.back.height)

  // Neutral metadata only - never include card content.
  pdf.setProperties({ title: 'ID Card Scan', creator: 'ScanMaster' })

  const blob = pdf.output('blob')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const pageCount = countPdfPages(bytes)

  if (pageCount !== 1) {
    throw new Error(
      `Generated ID card PDF has ${pageCount} page(s) instead of 1. Output rejected.`
    )
  }

  return { blob, pageCount, layout, pageLabel: page.label }
}

function detectFormat(dataUrl: string): 'JPEG' | 'PNG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
}

/**
 * Count page objects in raw PDF bytes.
 *
 * Used to verify the produced file really has exactly one page instead of
 * trusting the generator. Matches "/Type /Page" while excluding "/Type /Pages".
 */
export function countPdfPages(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes)
  const matches = text.match(/\/Type\s*\/Page[^s]/g)
  return matches ? matches.length : 0
}

/**
 * Neutral, privacy-safe filename. No card number, name or address ever appears
 * in the filename.
 */
export function idCardFileName(timestamp = Date.now()): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `ID_Card_Scan_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.pdf`
}