import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file, annotations, pageRotations, deletedPages } = body;

    if (!file || typeof file !== 'string') {
      return NextResponse.json(
        { error: 'PDF file data is required' },
        { status: 400 }
      );
    }

    // Extract base64 data from data URL
    const base64Match = file.match(/^data:application\/pdf;base64,(.+)$/);
    let pdfBytes: Uint8Array;

    if (base64Match) {
      pdfBytes = Uint8Array.from(Buffer.from(base64Match[1], 'base64'));
    } else {
      pdfBytes = Uint8Array.from(Buffer.from(file, 'base64'));
    }

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Apply page rotations
    if (Array.isArray(pageRotations)) {
      for (let i = 0; i < Math.min(pageRotations.length, pdfDoc.getPageCount()); i++) {
        if (pageRotations[i] && pageRotations[i] !== 0) {
          const page = pdfDoc.getPage(i);
          page.setRotation({ type: 0, angle: pageRotations[i] });
        }
      }
    }

    // Apply annotations
    if (Array.isArray(annotations)) {
      for (const annotation of annotations) {
        const { type, page: pageNum } = annotation;

        if (pageNum < 0 || pageNum >= pdfDoc.getPageCount()) continue;

        const page = pdfDoc.getPage(pageNum);
        const pageHeight = page.getHeight();
        const pageWidth = page.getWidth();

        if (type === 'text') {
          const { x, y, content, fontSize: textFontSize, color } = annotation;
          const fs = textFontSize || 16;
          // Convert percentage positions to absolute
          const absX = (x / 100) * pageWidth;
          const absY = pageHeight - (y / 100) * pageHeight;

          try {
            page.drawText(content, {
              x: absX,
              y: absY,
              size: fs,
              font,
              color: color ? hexToRgb(color) : rgb(0, 0, 0),
            });
          } catch (e) {
            console.error('Error drawing text annotation:', e);
          }
        } else if (type === 'highlight') {
          const { x, y, w, h, color } = annotation;
          const highlightX = (x / 100) * pageWidth;
          const highlightY = pageHeight - (y / 100) * pageHeight - ((h || 4) / 100) * pageHeight;
          const highlightWidth = ((w || 80) / 100) * pageWidth;
          const highlightHeight = ((h || 4) / 100) * pageHeight;

          try {
            page.drawRectangle({
              x: highlightX,
              y: highlightY,
              width: highlightWidth,
              height: highlightHeight,
              color: color ? hexToRgb(color) : rgb(1, 1, 0),
              opacity: 0.3,
            });
          } catch (e) {
            console.error('Error drawing highlight annotation:', e);
          }
        } else if (type === 'drawing') {
          // Freehand drawing — render as a series of connected line segments
          const { points, color, width } = annotation;
          if (!Array.isArray(points) || points.length < 2) continue;

          const drawColor = color ? hexToRgb(color) : rgb(0, 0, 0);
          const lineWidth = Math.max(width || 2, 0.5);

          try {
            for (let i = 0; i < points.length - 1; i++) {
              const x1 = (points[i].x / 100) * pageWidth;
              const y1 = pageHeight - (points[i].y / 100) * pageHeight;
              const x2 = (points[i + 1].x / 100) * pageWidth;
              const y2 = pageHeight - (points[i + 1].y / 100) * pageHeight;

              page.drawLine({
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
                thickness: lineWidth,
                color: drawColor,
              });
            }
          } catch (e) {
            console.error('Error drawing freehand annotation:', e);
          }
        } else if (type === 'shape') {
          // Shape annotations
          const { shapeType, x, y, w, h, color, strokeWidth: sw } = annotation;
          const shapeX = (x / 100) * pageWidth;
          const shapeY = pageHeight - (y / 100) * pageHeight - ((h || 10) / 100) * pageHeight;
          const shapeW = ((w || 20) / 100) * pageWidth;
          const shapeH = ((h || 10) / 100) * pageHeight;
          const shapeColor = color ? hexToRgb(color) : rgb(0, 0, 0);
          const shapeLineWidth = Math.max(sw || 2, 0.5);

          try {
            if (shapeType === 'rectangle') {
              page.drawRectangle({
                x: shapeX,
                y: shapeY,
                width: shapeW,
                height: shapeH,
                borderColor: shapeColor,
                borderWidth: shapeLineWidth,
                color: rgb(0, 0, 0),
                opacity: 0,
                borderOpacity: 1,
              });
            } else if (shapeType === 'circle') {
              page.drawEllipse({
                x: shapeX + shapeW / 2,
                y: shapeY + shapeH / 2,
                xScale: shapeW / 2,
                yScale: shapeH / 2,
                borderColor: shapeColor,
                borderWidth: shapeLineWidth,
                color: rgb(0, 0, 0),
                opacity: 0,
                borderOpacity: 1,
              });
            } else if (shapeType === 'line') {
              page.drawLine({
                start: { x: shapeX, y: shapeY + shapeH },
                end: { x: shapeX + shapeW, y: shapeY },
                thickness: shapeLineWidth,
                color: shapeColor,
              });
            }
          } catch (e) {
            console.error('Error drawing shape annotation:', e);
          }
        } else if (type === 'signature') {
          // Signature — embedded as PNG image
          const { x, y, dataUrl, scale } = annotation;
          try {
            const sigImage = await embedPngFromDataUrl(pdfDoc, dataUrl);
            if (sigImage) {
              const imgScale = scale || 1;
              const imgWidth = pageWidth * 0.25 * imgScale;
              const imgHeight = (sigImage.height / sigImage.width) * imgWidth;
              const sigX = (x / 100) * pageWidth;
              const sigY = pageHeight - (y / 100) * pageHeight - imgHeight;

              page.drawImage(sigImage, {
                x: sigX,
                y: sigY,
                width: imgWidth,
                height: imgHeight,
              });
            }
          } catch (e) {
            console.error('Error drawing signature annotation:', e);
          }
        } else if (type === 'imageStamp') {
          // Image stamp — embedded as PNG image
          const { x, y, dataUrl, scale } = annotation;
          try {
            const stampImage = await embedPngFromDataUrl(pdfDoc, dataUrl);
            if (stampImage) {
              const imgScale = scale || 1;
              const imgWidth = pageWidth * 0.25 * imgScale;
              const imgHeight = (stampImage.height / stampImage.width) * imgWidth;
              const stampX = (x / 100) * pageWidth;
              const stampY = pageHeight - (y / 100) * pageHeight - imgHeight;

              page.drawImage(stampImage, {
                x: stampX,
                y: stampY,
                width: imgWidth,
                height: imgHeight,
              });
            }
          } catch (e) {
            console.error('Error drawing image stamp annotation:', e);
          }
        }
      }
    }

    // Remove deleted pages (process in reverse order to maintain indices)
    if (Array.isArray(deletedPages) && deletedPages.length > 0) {
      const sortedDeleted = [...deletedPages].sort((a, b) => b - a);
      for (const pageIndex of sortedDeleted) {
        if (pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
          pdfDoc.removePage(pageIndex);
        }
      }
    }

    const editedPdfBytes = await pdfDoc.save();

    return new NextResponse(editedPdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="edited.pdf"',
      },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/pdf/editor');
  }
}

// Helper: Convert hex color to pdf-lib rgb
function hexToRgb(hexColor: string) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

// Helper: Embed PNG image from data URL into PDF
async function embedPngFromDataUrl(pdfDoc: PDFDocument, dataUrl: string) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  try {
    // Handle data URL format
    let imageBytes: Uint8Array;

    if (dataUrl.startsWith('data:image/png;base64,')) {
      const base64 = dataUrl.replace('data:image/png;base64,', '');
      imageBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
    } else if (dataUrl.startsWith('data:image/jpeg;base64,')) {
      const base64 = dataUrl.replace('data:image/jpeg;base64,', '');
      imageBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
    } else if (dataUrl.startsWith('data:image/')) {
      // Try as PNG for other image types
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return null;
      const base64 = dataUrl.substring(commaIdx + 1);
      imageBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
    } else {
      return null;
    }

    // Try embedding as PNG first, then as JPG
    try {
      return await pdfDoc.embedPng(imageBytes);
    } catch {
      try {
        return await pdfDoc.embedJpg(imageBytes);
      } catch {
        console.error('Could not embed image as PNG or JPG');
        return null;
      }
    }
  } catch (e) {
    console.error('Error embedding image from data URL:', e);
    return null;
  }
}
