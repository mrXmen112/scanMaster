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
    const { image } = body;

    if (!image || typeof image !== 'string') {
      return addCorsHeaders(NextResponse.json(
        { error: 'Image base64 data is required' },
        { status: 400 }
      ));
    }

    // Enforce Business Card Vision daily limits (ocr feature)
    const rateLimit = await checkRateLimit(request, 'ocr');
    if (!rateLimit.allowed) {
      return rateLimit.errorResponse!;
    }

    // Enforce 1 free lifetime use per feature
    const featureGate = await checkFeatureGate(request, 'business-card');
    if (!featureGate.allowed) {
      return featureGate.errorResponse!;
    }

    const prompt = 'Extract all the details from this business card image and return them as a neat, structured JSON object containing: name, title, company, email, phone, website, and address. If any detail is not found, leave the field empty. Only return the final raw JSON object in output, do not wrap in markdown or add conversational intro/commentary.';

    const rawText = await runAI({
      image,
      prompt,
      isVision: true
    });

    if (!rawText) {
      return addCorsHeaders(NextResponse.json(
        { error: 'AI service is temporarily unavailable. Please try again later.' },
        { status: 500 }
      ));
    }

    await incrementFeatureUsage(request, 'business-card');

    let parsedDetails = {};
    try {
      // Clean JSON delimiters if returned
      const cleanJsonStr = rawText.replace(/```json|```/g, '').trim();
      parsedDetails = JSON.parse(cleanJsonStr);
    } catch {
      // Fallback if AI returned non-JSON structure
      parsedDetails = { rawText };
    }

    return addCorsHeaders(NextResponse.json({ details: parsedDetails }));
  } catch (error: any) {
    const reqId = createRequestId();
    logAiDiagnostic({
      route: '/api/ai/business-card', feature: 'business-card', requestId: reqId,
      statusCode: 500, errorCode: error.code || 'UNKNOWN',
      errorMessage: error.message,
    });
    return addCorsHeaders(NextResponse.json(
      { error: error.message || 'AI service is temporarily unavailable. Please try again later.', requestId: reqId },
      { status: 500 }
    ));
  }
}

