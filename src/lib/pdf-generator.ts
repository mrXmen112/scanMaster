/**
 * Client-Side PDF Generation Helper
 * Uses 'jspdf' to compile styled text into a PDF completely offline.
 */

export interface PdfGenerationOptions {
  text: string
  title?: string
  fontSize?: number
  alignment?: 'left' | 'center' | 'right'
  bold?: boolean
  italic?: boolean
  underline?: boolean
  pageSize?: string
  margins?: {
    top: number
    bottom: number
    left: number
    right: number
  }
}

export async function generatePdfFromTextLocally(options: PdfGenerationOptions): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  
  const format = (options.pageSize || 'A4').toLowerCase()
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: format,
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const margins = options.margins || { top: 50, bottom: 50, left: 50, right: 50 }
  const marginX = margins.left
  const marginY = margins.top
  const maxLineWidth = pageWidth - marginX - margins.right

  const baseFontSize = options.fontSize || 12
  let currentY = marginY

  // Helper to apply font styles
  const applyFont = (size: number, isTitle: boolean = false) => {
    pdf.setFontSize(size)
    let style = 'normal'
    if (isTitle || options.bold) {
      style = options.italic ? 'bolditalic' : 'bold'
    } else if (options.italic) {
      style = 'italic'
    }
    pdf.setFont('helvetica', style)
  }

  // Draw title if present
  if (options.title) {
    applyFont(baseFontSize * 1.5, true)
    const titleLines = pdf.splitTextToSize(options.title, maxLineWidth)
    for (const line of titleLines) {
      let x = marginX
      if (options.alignment === 'center') {
        x = (pageWidth - pdf.getTextWidth(line)) / 2
      } else if (options.alignment === 'right') {
        x = pageWidth - margins.right - pdf.getTextWidth(line)
      }
      
      pdf.text(line, x, currentY)
      currentY += baseFontSize * 1.8
    }
    currentY += 15 // Gap after title
  }

  // Draw content text
  applyFont(baseFontSize, false)
  
  // Split input text by newlines first to preserve paragraph breaks
  const paragraphs = options.text.split('\n')
  
  for (const para of paragraphs) {
    // Empty line check
    if (para.trim() === '') {
      currentY += baseFontSize * 1.5
      continue
    }

    const textLines = pdf.splitTextToSize(para, maxLineWidth)
    for (const line of textLines) {
      // Check for page overflow
      if (currentY + baseFontSize * 1.5 > pageHeight - margins.bottom) {
        pdf.addPage()
        currentY = marginY
        // Re-apply font on new page
        applyFont(baseFontSize, false)
      }

      let x = marginX
      if (options.alignment === 'center') {
        x = (pageWidth - pdf.getTextWidth(line)) / 2
      } else if (options.alignment === 'right') {
        x = pageWidth - margins.right - pdf.getTextWidth(line)
      }

      pdf.text(line, x, currentY)
      currentY += baseFontSize * 1.5
    }
  }

  pdf.setProperties({
    title: options.title || 'ScanMaster Document',
    creator: 'ScanMaster',
  })

  return pdf.output('blob')
}
