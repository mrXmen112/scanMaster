import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfs } = body;

    if (!pdfs || !Array.isArray(pdfs) || pdfs.length < 2) {
      return NextResponse.json(
        { error: 'At least two PDFs are required for merging' },
        { status: 400 }
      );
    }

    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < pdfs.length; i++) {
      const pdfDataUrl = pdfs[i];

      // Extract base64 data from data URL
      const base64Match = pdfDataUrl.match(/^data:application\/pdf;base64,(.+)$/);
      let pdfBytes: Uint8Array;

      if (base64Match) {
        pdfBytes = Uint8Array.from(Buffer.from(base64Match[1], 'base64'));
      } else {
        // If it's raw base64 without the data URL prefix
        pdfBytes = Uint8Array.from(Buffer.from(pdfDataUrl, 'base64'));
      }

      let sourcePdf: PDFDocument;
      try {
        sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      } catch {
        return NextResponse.json(
          { error: `Failed to load PDF at index ${i}. The file may be corrupted.` },
          { status: 400 }
        );
      }

      const copiedPages = await mergedPdf.copyPages(
        sourcePdf,
        sourcePdf.getPageIndices()
      );
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();

    return new NextResponse(mergedPdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="merged.pdf"',
      },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/pdf/merge');
  }
}
