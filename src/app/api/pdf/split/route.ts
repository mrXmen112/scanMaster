import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { handleApiError } from '@/lib/api-error-handler';

/**
 * Parse a page range string like "1-3,5,7-9" into an array of page numbers (1-based).
 */
function parsePageRanges(rangeStr: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const parts = rangeStr.split(',').map((s) => s.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < 1) {
        throw new Error(`Invalid page range: "${part}"`);
      }

      const clampedStart = Math.max(start, 1);
      const clampedEnd = Math.min(end, totalPages);

      for (let i = clampedStart; i <= clampedEnd; i++) {
        pages.add(i);
      }
    } else {
      const page = parseInt(part, 10);
      if (isNaN(page) || page < 1) {
        throw new Error(`Invalid page number: "${part}"`);
      }
      if (page <= totalPages) {
        pages.add(page);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdf, pageRanges } = body;

    if (!pdf || typeof pdf !== 'string') {
      return NextResponse.json(
        { error: 'PDF data is required' },
        { status: 400 }
      );
    }

    if (!pageRanges || typeof pageRanges !== 'string') {
      return NextResponse.json(
        { error: 'Page ranges string is required (e.g., "1-3,5,7-9")' },
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

    const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = sourcePdf.getPageCount();

    let selectedPages: number[];
    try {
      selectedPages = parsePageRanges(pageRanges, totalPages);
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 }
      );
    }

    if (selectedPages.length === 0) {
      return NextResponse.json(
        { error: 'No valid pages selected' },
        { status: 400 }
      );
    }

    // Group consecutive pages into ranges for creating individual PDFs
    const groups: number[][] = [];
    let currentGroup: number[] = [selectedPages[0]];

    for (let i = 1; i < selectedPages.length; i++) {
      if (selectedPages[i] === selectedPages[i - 1] + 1) {
        currentGroup.push(selectedPages[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [selectedPages[i]];
      }
    }
    groups.push(currentGroup);

    const zip = new JSZip();

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      const newPdf = await PDFDocument.create();

      // Convert 1-based page numbers to 0-based indices
      const pageIndices = group.map((p) => p - 1);
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);

      for (const page of copiedPages) {
        newPdf.addPage(page);
      }

      const newPdfBytes = await newPdf.save();

      // Create filename based on page range
      const rangeLabel =
        group.length === 1
          ? `page_${group[0]}`
          : `pages_${group[0]}-${group[group.length - 1]}`;

      zip.file(`${rangeLabel}.pdf`, newPdfBytes);
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });

    return new NextResponse(zipBytes, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="split_pdfs.zip"',
      },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/pdf/split');
  }
}
