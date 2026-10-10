import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text,
      title,
      fontSize = 12,
      alignment = 'left',
      pageSize = 'A4',
      margins = { top: 50, bottom: 50, left: 50, right: 50 },
      bold = false,
      italic = false,
    } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    // Page size dimensions in points (1 point = 1/72 inch)
    const pageSizes: Record<string, [number, number]> = {
      A4: [595.28, 841.89],
      Letter: [612, 792],
      Legal: [612, 1008],
    };

    const [pageWidth, pageHeight] = pageSizes[pageSize] || pageSizes.A4;

    const pdfDoc = await PDFDocument.create();

    // Select font based on bold/italic options
    let fontName = StandardFonts.Helvetica;
    if (bold && italic) {
      fontName = StandardFonts.HelveticaBoldOblique;
    } else if (bold) {
      fontName = StandardFonts.HelveticaBold;
    } else if (italic) {
      fontName = StandardFonts.HelveticaOblique;
    }

    const font = await pdfDoc.embedFont(fontName);
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const contentWidth = pageWidth - margins.left - margins.right;
    const lineHeight = fontSize * 1.5;

    // Helper: word-wrap text into lines that fit within contentWidth
    function wrapText(inputText: string, fnt: typeof font, size: number): string[] {
      const paragraphs = inputText.split('\n');
      const lines: string[] = [];

      for (const paragraph of paragraphs) {
        if (paragraph.trim() === '') {
          lines.push('');
          continue;
        }
        const words = paragraph.split(/\s+/);
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = fnt.widthOfTextAtSize(testLine, size);

          if (testWidth > contentWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
      }
      return lines;
    }

    // Helper: calculate x position based on alignment
    function getAlignedX(lineText: string, fnt: typeof font, size: number): number {
      const textWidth = fnt.widthOfTextAtSize(lineText, size);
      switch (alignment) {
        case 'center':
          return margins.left + (contentWidth - textWidth) / 2;
        case 'right':
          return margins.left + contentWidth - textWidth;
        case 'left':
        default:
          return margins.left;
      }
    }

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margins.top;

    // Draw title if provided
    if (title) {
      const titleSize = fontSize * 1.5;
      const titleLines = wrapText(title, titleFont, titleSize);
      for (const titleLine of titleLines) {
        if (y < margins.bottom + titleSize) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margins.top;
        }
        const x = getAlignedX(titleLine, titleFont, titleSize);
        currentPage.drawText(titleLine, {
          x,
          y,
          size: titleSize,
          font: titleFont,
          color: rgb(0, 0, 0),
        });
        y -= titleSize * 1.5;
      }
      // Add spacing between title and body
      y -= fontSize;
    }

    // Draw body text
    const lines = wrapText(text, font, fontSize);
    for (const line of lines) {
      if (y < margins.bottom + fontSize) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margins.top;
      }
      if (line === '') {
        y -= lineHeight;
        continue;
      }
      const x = getAlignedX(line, font, fontSize);
      currentPage.drawText(line, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/pdf/text-to-pdf');
  }
}
