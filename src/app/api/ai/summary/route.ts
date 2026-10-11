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
    const { text, image, mode } = body;

    if (!text && !image) {
      return addCorsHeaders(NextResponse.json(
        { error: 'Document text or image base64 data is required' },
        { status: 400 }
      ));
    }

    // Enforce daily rate limit by task type (Vision OCR vs general Text)
    const rateLimit = image 
      ? await checkRateLimit(request, 'ocr')
      : await checkRateLimit(request, 'text', { textLength: text ? text.length : 0 });
      
    if (!rateLimit.allowed) {
      return rateLimit.errorResponse!;
    }

    // Enforce 1 free lifetime use per feature
    const featureName = image ? 'ocr' : 'summary';
    const featureGate = await checkFeatureGate(request, featureName);
    if (!featureGate.allowed) {
      return featureGate.errorResponse!;
    }

    const activeMode = mode || 'short';
    let promptModeInstruction = '';
    switch (activeMode) {
      case 'short':
        promptModeInstruction = 'Provide a concise, extremely high-level 1-paragraph summary of the key message of this document.';
        break;
      case 'detailed':
        promptModeInstruction = 'Provide a comprehensive, detailed, and deeply structured summary of the document. Explain major themes, developments, and structures.';
        break;
      case 'key-points':
        promptModeInstruction = 'List the key points and major takeaways from this document in a clean, bulleted list format.';
        break;
      case 'action-items':
        promptModeInstruction = 'Scan the document and compile a clean bulleted checklist of actionable items, follow-up tasks, deadlines, and responsibilities mentioned.';
        break;
      case 'names-dates':
        promptModeInstruction = 'Locate and list all critical entities mentioned, including Important Names, Dates, Deadlines, Monetary Amounts, and Locations. Present this in a structured, neat layout.';
        break;
      case 'student-notes':
        promptModeInstruction = 'Transform this document into beautiful, high-quality Student Study Notes. Group key vocabulary, concepts, definitions, formulas, or history into structured paragraphs and summaries suitable for exam preparation.';
        break;
      default:
        promptModeInstruction = 'Provide a summary of the document.';
    }

    let summaryText = '';
    if (image) {
      // Multimodal summary using Vision completion
      summaryText = await runAI({
        image,
        prompt: `Analyze this document and summarize it. Follow these instructions exactly:\n\n${promptModeInstruction}`
      });
    } else {
      // Text-based summary
      summaryText = await runAI({
        prompt: `Please read the following text and summarize it. Follow these instructions exactly:\n\n${promptModeInstruction}\n\nText:\n${text}`,
        systemPrompt: 'You are a professional document analysis and summarizing expert.'
      });
    }

    if (!summaryText) {
      return addCorsHeaders(NextResponse.json(
        { error: 'AI service is temporarily unavailable. Please try again later.' },
        { status: 500 }
      ));
    }

    await incrementFeatureUsage(request, featureName);
    return addCorsHeaders(NextResponse.json({ summary: summaryText }));
  } catch (error: any) {
    const reqId = createRequestId();
    logAiDiagnostic({
      route: '/api/ai/summary', feature: 'summary', requestId: reqId,
      statusCode: 500, errorCode: error.code || 'UNKNOWN',
      errorMessage: error.message,
    });
    return addCorsHeaders(NextResponse.json(
      { error: error.message || 'AI service is temporarily unavailable. Please try again later.', requestId: reqId },
      { status: 500 }
    ));
  }
}

