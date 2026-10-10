/**
 * Client-Side PDF Editor Compiler
 * Combines annotations, rotations, and page deletions completely offline.
 */

// Helper: Convert hex color to pdf-lib rgb
function hexToRgb(hexColor: string, rgb: any) {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  return rgb(r, g, b)
}

// Helper: Embed PNG image from data URL into PDF (client-side safe)
async function embedPngFromDataUrl(pdfDoc: any, dataUrl: string) {
  if (!dataUrl || typeof dataUrl !== 'string') return null

  try {
    let base64 = ''
    if (dataUrl.startsWith('data:image/png;base64,')) {
      base64 = dataUrl.replace('data:image/png;base64,', '')
    } else if (dataUrl.startsWith('data:image/jpeg;base64,')) {
      base64 = dataUrl.replace('data:image/jpeg;base64,', '')
    } else if (dataUrl.includes('base64,')) {
      const commaIdx = dataUrl.indexOf('base64,')
      base64 = dataUrl.substring(commaIdx + 7)
    } else {
      const commaIdx = dataUrl.indexOf(',')
      if (commaIdx !== -1) {
        base64 = dataUrl.substring(commaIdx + 1)
      }
    }

    if (!base64) return null

    const binary = window.atob(base64)
    const length = binary.length
    const imageBytes = new Uint8Array(length)
    for (let i = 0; i < length; i++) {
      imageBytes[i] = binary.charCodeAt(i)
    }

    try {
      return await pdfDoc.embedPng(imageBytes)
    } catch {
      try {
        return await pdfDoc.embedJpg(imageBytes)
      } catch {
        console.error('Could not embed image as PNG or JPG')
        return null
      }
    }
  } catch (e) {
    console.error('Error embedding image from data URL:', e)
    return null
  }
}

export async function compilePdfOffline(
  file: File,
  annotations: any[],
  pageRotations: number[],
  deletedPages: number[] = []
): Promise<Blob> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')

  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Apply page rotations
  if (Array.isArray(pageRotations)) {
    for (let i = 0; i < Math.min(pageRotations.length, pdfDoc.getPageCount()); i++) {
      if (pageRotations[i] && pageRotations[i] !== 0) {
        const page = pdfDoc.getPage(i)
        // Normalize rotation angle
        const currentRot = page.getRotation().angle
        const newRot = (currentRot + pageRotations[i]) % 360
        page.setRotation({ type: 0, angle: newRot })
      }
    }
  }

  // Apply annotations
  if (Array.isArray(annotations)) {
    for (const annotation of annotations) {
      const { type, page: pageNum } = annotation

      if (pageNum < 0 || pageNum >= pdfDoc.getPageCount()) continue

      const page = pdfDoc.getPage(pageNum)
      const pageHeight = page.getHeight()
      const pageWidth = page.getWidth()

      if (type === 'text') {
        const { x, y, content, fontSize: textFontSize, color } = annotation
        const fs = textFontSize || 16
        const absX = (x / 100) * pageWidth
        const absY = pageHeight - (y / 100) * pageHeight

        try {
          page.drawText(content, {
            x: absX,
            y: absY,
            size: fs,
            font,
            color: color ? hexToRgb(color, rgb) : rgb(0, 0, 0),
          })
        } catch (e) {
          console.error('Error drawing text annotation:', e)
        }
      } else if (type === 'highlight') {
        const { x, y, w, h, color } = annotation
        const highlightX = (x / 100) * pageWidth
        const highlightY = pageHeight - (y / 100) * pageHeight - ((h || 4) / 100) * pageHeight
        const highlightWidth = ((w || 80) / 100) * pageWidth
        const highlightHeight = ((h || 4) / 100) * pageHeight

        try {
          page.drawRectangle({
            x: highlightX,
            y: highlightY,
            width: highlightWidth,
            height: highlightHeight,
            color: color ? hexToRgb(color, rgb) : rgb(1, 1, 0),
            opacity: 0.3,
          })
        } catch (e) {
          console.error('Error drawing highlight annotation:', e)
        }
      } else if (type === 'drawing') {
        const { points, color, width } = annotation
        if (!Array.isArray(points) || points.length < 2) continue

        const drawColor = color ? hexToRgb(color, rgb) : rgb(0, 0, 0)
        const lineWidth = Math.max(width || 2, 0.5)

        try {
          for (let i = 0; i < points.length - 1; i++) {
            const x1 = (points[i].x / 100) * pageWidth
            const y1 = pageHeight - (points[i].y / 100) * pageHeight
            const x2 = (points[i + 1].x / 100) * pageWidth
            const y2 = pageHeight - (points[i + 1].y / 100) * pageHeight

            page.drawLine({
              start: { x: x1, y: y1 },
              end: { x: x2, y: y2 },
              thickness: lineWidth,
              color: drawColor,
            })
          }
        } catch (e) {
          console.error('Error drawing freehand annotation:', e)
        }
      } else if (type === 'shape') {
        const { shapeType, x, y, w, h, color, strokeWidth: sw } = annotation
        const shapeX = (x / 100) * pageWidth
        const shapeY = pageHeight - (y / 100) * pageHeight - ((h || 10) / 100) * pageHeight
        const shapeW = ((w || 20) / 100) * pageWidth
        const shapeH = ((h || 10) / 100) * pageHeight
        const shapeColor = color ? hexToRgb(color, rgb) : rgb(0, 0, 0)
        const shapeLineWidth = Math.max(sw || 2, 0.5)

        try {
          if (shapeType === 'rectangle') {
            const isFilled = annotation.filled === true
            page.drawRectangle({
              x: shapeX,
              y: shapeY,
              width: shapeW,
              height: shapeH,
              borderColor: shapeColor,
              borderWidth: isFilled ? 0 : shapeLineWidth,
              color: shapeColor,
              opacity: isFilled ? 1 : 0,
              borderOpacity: isFilled ? 0 : 1,
            })
          } else if (shapeType === 'circle') {
            const isFilled = annotation.filled === true
            page.drawEllipse({
              x: shapeX + shapeW / 2,
              y: shapeY + shapeH / 2,
              xScale: shapeW / 2,
              yScale: shapeH / 2,
              borderColor: shapeColor,
              borderWidth: isFilled ? 0 : shapeLineWidth,
              color: shapeColor,
              opacity: isFilled ? 1 : 0,
              borderOpacity: isFilled ? 0 : 1,
            })
          } else if (shapeType === 'line') {
            page.drawLine({
              start: { x: shapeX, y: shapeY + shapeH },
              end: { x: shapeX + shapeW, y: shapeY },
              thickness: shapeLineWidth,
              color: shapeColor,
            })
          }
        } catch (e) {
          console.error('Error drawing shape annotation:', e)
        }
      } else if (type === 'signature') {
        const { x, y, dataUrl, scale } = annotation
        try {
          const sigImage = await embedPngFromDataUrl(pdfDoc, dataUrl)
          if (sigImage) {
            const imgScale = scale || 1
            const imgWidth = pageWidth * 0.25 * imgScale
            const imgHeight = (sigImage.height / sigImage.width) * imgWidth
            const sigX = (x / 100) * pageWidth
            const sigY = pageHeight - (y / 100) * pageHeight - imgHeight

            page.drawImage(sigImage, {
              x: sigX,
              y: sigY,
              width: imgWidth,
              height: imgHeight,
            })
          }
        } catch (e) {
          console.error('Error drawing signature annotation:', e)
        }
      } else if (type === 'imageStamp') {
        const { x, y, dataUrl, scale } = annotation
        try {
          const stampImage = await embedPngFromDataUrl(pdfDoc, dataUrl)
          if (stampImage) {
            const imgScale = scale || 1
            const imgWidth = pageWidth * 0.25 * imgScale
            const imgHeight = (stampImage.height / stampImage.width) * imgWidth
            const stampX = (x / 100) * pageWidth
            const stampY = pageHeight - (y / 100) * pageHeight - imgHeight

            page.drawImage(stampImage, {
              x: stampX,
              y: stampY,
              width: imgWidth,
              height: imgHeight,
            })
          }
        } catch (e) {
          console.error('Error drawing image stamp annotation:', e)
        }
      }
    }
  }

  // Remove deleted pages
  if (Array.isArray(deletedPages) && deletedPages.length > 0) {
    const sortedDeleted = [...deletedPages].sort((a, b) => b - a)
    for (const pageIndex of sortedDeleted) {
      if (pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
        pdfDoc.removePage(pageIndex)
      }
    }
  }

  const editedPdfBytes = await pdfDoc.save()
  return new Blob([editedPdfBytes], { type: 'application/pdf' })
}
