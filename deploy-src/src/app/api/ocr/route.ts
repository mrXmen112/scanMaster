import { NextRequest, NextResponse } from 'next/server';
import { runAI, validateKeys, classifyAndLogAIError } from '@/lib/ai-provider';
import { checkRateLimit, checkFeatureGate, incrementFeatureUsage } from '@/lib/rate-limiter';
import { addCorsHeaders, handleOptions } from '@/lib/cors-helper';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request.headers.get('origin'));
}

export async function POST(request: NextRequest) {
  const keyCheck = validateKeys();
  if (!keyCheck.isValid) {
    return addCorsHeaders(keyCheck.errorResponse!);
  }

  try {
    const body = await request.json();
    const { image } = body;

    if (!image || typeof image !== 'string') {
      return addCorsHeaders(NextResponse.json(
        { error: 'Image data is required (base64 data URL)' },
        { status: 400 }
      ));
    }

    const rateLimit = await checkRateLimit(request, 'ocr');
    if (!rateLimit.allowed) {
      return rateLimit.errorResponse!;
    }

    const featureCheck = await checkFeatureGate(request, 'ocr');
    if (!featureCheck.allowed) {
      return featureCheck.errorResponse!;
    }

    const extractedText = await runAI({
      image,
      prompt: 'Extract all text from this image. Preserve the layout and formatting as much as possible. ONLY return the extracted text without any explanations.',
      isVision: true,
      timeoutMs: 25000,
    });

    if (!extractedText) {
      return addCorsHeaders(NextResponse.json(
        { error: 'OCR failed: no text extracted from image' },
        { status: 500 }
      ));
    }

    await incrementFeatureUsage(request, 'ocr');

    return addCorsHeaders(NextResponse.json({ text: extractedText }));
  } catch (error: any) {
    classifyAndLogAIError(error);
    return addCorsHeaders(NextResponse.json(
      { error: error.message || 'An error occurred. Please try again.' },
      { status: 500 }
    ));
  }
}
