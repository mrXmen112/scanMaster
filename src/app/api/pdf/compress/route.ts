import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdf, quality = 'medium' } = body;

    if (!pdf || typeof pdf !== 'string') {
      return NextResponse.json(
        { error: 'PDF data is required' },
        { status: 400 }
      );
    }

    // Extract base64 data from data URL
    const base64Match = pdf.match(/^data:application\/pdf;base64,(.+)$/);
    let pdfBytes: Uint8Array;

    if (base64Match) {
      pdfBytes = Uint8Array.from(Buffer.from(base64Match[1], 'base64'));
    } else {
      pdfBytes = Uint8Array.from(Buffer.from(pdf, 'base64'));
    }

    const originalSize = pdfBytes.length;

    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Strip metadata based on quality level
    if (quality === 'medium' || quality === 'high') {
      // Remove document metadata
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
    }

    if (quality === 'high') {
      // For high compression, also remove creation/modification dates
      pdfDoc.setCreationDate(new Date(0));
      pdfDoc.setModificationDate(new Date(0));
    }

    // Save with options - pdf-lib automatically handles some optimization
    // like removing orphaned objects when re-saving
    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true, // More compact storage
    });

    const compressedSize = compressedPdfBytes.length;
    const compressionRatio = (
      ((originalSize - compressedSize) / originalSize) *
      100
    ).toFixed(1);

    // If the "compressed" version is actually larger (can happen with small PDFs),
    // return the original
    const finalBytes =
      compressedSize < originalSize ? compressedPdfBytes : pdfBytes;
    const finalSize = compressedSize < originalSize ? compressedSize : originalSize;

    // Return PDF with compression metadata as a custom header
    return new NextResponse(finalBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="compressed.pdf"',
        'X-Original-Size': originalSize.toString(),
        'X-Compressed-Size': finalSize.toString(),
        'X-Compression-Ratio': compressionRatio + '%',
      },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/pdf/compress');
  }
}
