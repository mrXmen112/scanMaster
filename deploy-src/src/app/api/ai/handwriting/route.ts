import { NextRequest, NextResponse } from 'next/server';
import { runAI, validateKeys } from '@/lib/ai-provider';
import { checkRateLimit, checkFeatureGate, incrementFeatureUsage } from '@/lib/rate-limiter';
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
    const { image, languageMode } = body;

    if (!image || typeof image !== 'string') {
      return addCorsHeaders(NextResponse.json(
        { error: 'Image base64 data is required' },
        { status: 400 }
      ));
    }

    // Enforce Handwriting OCR daily limits (ocr feature)
    const rateLimit = await checkRateLimit(request, 'ocr');
    if (!rateLimit.allowed) {
      return rateLimit.errorResponse!;
    }

    // Enforce 1 free lifetime use per feature
    const featureGate = await checkFeatureGate(request, 'handwriting');
    if (!featureGate.allowed) {
      return featureGate.errorResponse!;
    }

    const languageStr = languageMode || 'english';
    const prompt = `Analyze this image and transcribe any text inside it. The text is in ${languageStr}. Provide a highly accurate, clean transcription of any handwritten or printed text. ONLY return the final transcribed text exactly as it appears in the image, without any introduction, explanations, quotes, or conversational commentary.`;

    const transcribedText = await runAI({
      image,
      prompt,
      isVision: true
    });

    if (!transcribedText) {
      return addCorsHeaders(NextResponse.json(
        { error: 'AI service is temporarily unavailable. Please try again later.' },
        { status: 500 }
      ));
    }

    await incrementFeatureUsage(request, 'handwriting');
    return addCorsHeaders(NextResponse.json({ text: transcribedText }));
  } catch (error: any) {
    const reqId = createRequestId();
    logAiDiagnostic({
      route: '/api/ai/handwriting', feature: 'handwriting', requestId: reqId,
      statusCode: 500, errorCode: error.code || 'UNKNOWN',
      errorMessage: error.message,
    });
    return addCorsHeaders(NextResponse.json(
      { error: error.message || 'AI service is temporarily unavailable. Please try again later.', requestId: reqId },
      { status: 500 }
    ));
  }
}

