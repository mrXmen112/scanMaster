import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { handleApiError } from '@/lib/api-error-handler';

/**
 * POST /api/pdf/image-to-pdf
 * Creates a PDF from an array of base64 image data URLs.
 *
 * Body: { images: string[], title?: string, fullPage?: boolean }
 * - images: Array of data URLs (data:image/jpeg;base64,... or data:image/png;base64,...)
 * - title: Optional PDF title metadata
 * - fullPage: If true, images fill the entire page with no margins (better for scans)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { images, title, fullPage } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Images array is required and must not be empty' },
        { status: 400 }
      );
    }

    const pdfDoc = await PDFDocument.create();

    // Set PDF metadata
    pdfDoc.setTitle(title || 'Scanned Document');
    pdfDoc.setCreator('ScanMaster AI');
    pdfDoc.setProducer('ScanMaster AI');
    pdfDoc.setCreationDate(new Date());

    for (const imageDataUrl of images) {
      // Parse the data URL to extract mime type and base64 data
      const matches = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches) {
        return NextResponse.json(
          { error: 'Invalid image data URL format. Expected data:image/...;base64,...' },
          { status: 400 }
        );
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const imageBytes = Buffer.from(base64Data, 'base64');

      let embeddedImage;
      if (mimeType === 'image/png') {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
      } else {
        return NextResponse.json(
          { error: `Unsupported image format: ${mimeType}. Only PNG and JPEG are supported.` },
          { status: 400 }
        );
      }

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;

      // A4 dimensions in points (1 point = 1/72 inch)
      const a4Width = 595.28;
      const a4Height = 841.89;

      if (fullPage) {
        // Full-page mode: image fills the entire page, no margins
        // Page size matches image aspect ratio but within A4 bounds
        const imgAspect = imgWidth / imgHeight;
        const a4Aspect = a4Width / a4Height;

        let pageWidth: number;
        let pageHeight: number;
        let drawWidth: number;
        let drawHeight: number;

        if (imgAspect > a4Aspect) {
          // Image is wider than A4 aspect - fit to width
          pageWidth = a4Width;
          pageHeight = a4Width / imgAspect;
          drawWidth = pageWidth;
          drawHeight = pageHeight;
        } else {
          // Image is taller than A4 aspect - fit to height
          pageHeight = a4Height;
          pageWidth = a4Height * imgAspect;
          drawWidth = pageWidth;
          drawHeight = pageHeight;
        }

        // Use standard A4 page and scale image to fill it
        const page = pdfDoc.addPage([a4Width, a4Height]);

        // Scale image to fill A4 while maintaining aspect ratio
        const scaleFitter = Math.max(a4Width / imgWidth, a4Height / imgHeight);
        const scaledW = imgWidth * scaleFitter;
        const scaledH = imgHeight * scaleFitter;

        // Center the image (may overflow slightly on one dimension)
        const x = (a4Width - scaledW) / 2;
        const y = (a4Height - scaledH) / 2;

        page.drawImage(embeddedImage, { x, y, width: scaledW, height: scaledH });
      } else {
        // Standard mode: image centered with margins
        const margin = 40;
        const maxWidth = a4Width - 2 * margin;
        const maxHeight = a4Height - 2 * margin;

        // Scale to fit within margins while preserving aspect ratio
        // For scans, allow upscaling (remove the `1` cap in Math.min)
        const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;

        // Center the image on the page
        const x = margin + (maxWidth - scaledWidth) / 2;
        const y = margin + (maxHeight - scaledHeight) / 2;

        const page = pdfDoc.addPage([a4Width, a4Height]);
        page.drawImage(embeddedImage, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
        });
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="scanned-document.pdf"',
      },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/pdf/image-to-pdf');
  }
}
