import { NextRequest, NextResponse } from 'next/server';
import { runAI, validateKeys } from '@/lib/ai-provider';
import { addCorsHeaders, handleOptions } from '@/lib/cors-helper';
import { logAiDiagnostic, createRequestId } from '@/lib/ai-diagnostics';

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
    const { image, region } = body;

    if (!image || typeof image !== 'string') {
      return addCorsHeaders(NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      ));
    }

    const prompt = `This image shows a cropped region of a screenshot that contains text to be removed. Identify the text present in this region, then describe the background colors, patterns, and textures that should appear once the text is erased. Be specific about: 1) Exact hex color codes of the background, 2) Whether there's a gradient, solid color, or pattern, 3) Any visible lines or elements that continue through this region. Return your answer as JSON: {"text_detected": "...", "background_type": "solid|gradient|pattern|complex", "colors": ["#hex1", "#hex2"], "description": "..."}`;

    const analysis = await runAI({
      image,
      prompt,
      isVision: true,
      timeoutMs: 30000
    });

    if (!analysis) {
      return addCorsHeaders(NextResponse.json(
        { error: 'AI analysis failed' },
        { status: 500 }
      ));
    }

    return addCorsHeaders(NextResponse.json({ analysis }));
  } catch (error: any) {
    const reqId = createRequestId();
    logAiDiagnostic({
      route: '/api/ai/text-erase', feature: 'text-erase', requestId: reqId,
      statusCode: 500, errorCode: error.code || 'UNKNOWN',
      errorMessage: error.message,
    });
    return addCorsHeaders(NextResponse.json(
      { error: error.message || 'Text erase service unavailable.', requestId: reqId },
      { status: 500 }
    ));
  }
}
