import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';

/**
 * POST /api/pdf/enhance-scan
 * Server-side document scan image enhancement.
 * Accepts a base64 image and returns an enhanced version.
 *
 * Body: { image: string, options?: { brightness?, contrast?, bw?, sharpen?, shadowRemoval? } }
 * Response: { image: string } (enhanced base64 data URL)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, options = {} } = body;

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'Image data URL is required' },
        { status: 400 }
      );
    }

    // Parse data URL
    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: 'Invalid image data URL format' },
        { status: 400 }
      );
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const imageBytes = Buffer.from(base64Data, 'base64');

    // Use sharp for image processing if available, otherwise return original
    try {
      const sharp = await import('sharp');

      let pipeline = sharp.default(imageBytes);

      // Get metadata first
      const metadata = await pipeline.metadata();
      const width = metadata.width || 1920;
      const height = metadata.height || 1080;

      // Re-create pipeline after metadata
      pipeline = sharp.default(imageBytes);

      // Resize to reasonable max for PDF (keep quality but reduce huge files)
      if (width > 2480 || height > 3508) {
        pipeline = pipeline.resize(2480, 3508, { fit: 'inside', withoutEnlargement: true });
      }

      // Apply brightness/contrast adjustments
      const brightness = options.brightness || 100;
      const contrast = options.contrast || 100;
      const bw = options.bw || false;
      const sharpen = options.sharpen !== false; // default true for scans
      const shadowRemoval = options.shadowRemoval || false;

      // Build linear adjustment for brightness/contrast
      // brightness: 100 = normal, <100 = darker, >100 = brighter
      // contrast: 100 = normal, <100 = less contrast, >100 = more contrast
      const brightnessFactor = brightness / 100;
      const contrastFactor = contrast / 100;

      // Linear transformation: output = (input - midpoint) * contrast * brightness + midpoint
      // For 8-bit images, midpoint is 128
      // Simplified: output = input * (contrastFactor * brightnessFactor) + offset
      const multiplier = contrastFactor * brightnessFactor;
      const midpoint = 128;
      const offset = midpoint - midpoint * multiplier;

      pipeline = pipeline.linear(multiplier, offset);

      // Shadow removal: lighten dark areas more aggressively
      if (shadowRemoval) {
        // Apply additional brightness boost in shadows via a second pass
        pipeline = pipeline.linear(1.05, 8).linear(1.0, 0);
      }

      // Sharpen for document clarity (unsharp mask)
      if (sharpen) {
        pipeline = pipeline.sharpen({
          sigma: 1.2,
          m1: 1.5,
          m2: 0.5,
          x1: 2,
          y2: 10,
          y3: 20,
        });
      }

      // Black and white conversion for document text clarity
      if (bw) {
        pipeline = pipeline.grayscale().threshold(140);
      }

      // Normalize to stretch histogram for better contrast
      pipeline = pipeline.normalize();

      // Output as JPEG with good quality
      const outputBuffer = await pipeline
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();

      const enhancedBase64 = outputBuffer.toString('base64');
      const enhancedDataUrl = `data:image/jpeg;base64,${enhancedBase64}`;

      return NextResponse.json({ image: enhancedDataUrl });
    } catch (sharpError) {
      // Sharp not available - return original image with a note
      console.warn('Sharp not available for image enhancement, returning original:', sharpError);
      return NextResponse.json({
        image,
        note: 'Server-side enhancement unavailable - using original image',
      });
    }
  } catch (error) {
    return handleApiError(error, 'POST /api/pdf/enhance-scan');
  }
}
