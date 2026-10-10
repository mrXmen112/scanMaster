import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { files } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'Files array is required and must not be empty' },
        { status: 400 }
      );
    }

    const zip = new JSZip();

    for (const file of files) {
      if (!file.name || !file.data) continue;

      // Decode base64 data and add to zip
      const buffer = Buffer.from(file.data, 'base64');
      zip.file(file.name, buffer);
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });

    return new NextResponse(zipBytes, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="export.zip"',
      },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/pdf/zip-export');
  }
}
