import { NextRequest, NextResponse } from 'next/server';
import { validateKeys, classifyAndLogAIError } from '@/lib/ai-provider';
import { addCorsHeaders, handleOptions } from '@/lib/cors-helper';
import { checkRateLimit, checkFeatureGate, incrementFeatureUsage } from '@/lib/rate-limiter';
import { getInsforgeClient } from '@/lib/insforge/client';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const STT_MODEL = 'openai/whisper-large-v3';

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
    const { audio } = body;

    if (!audio || typeof audio !== 'string') {
      return addCorsHeaders(NextResponse.json(
        { error: 'Audio data is required (base64 encoded)' },
        { status: 400 }
      ));
    }

    const rateCheck = await checkRateLimit(request, 'text');
    if (!rateCheck.allowed) {
      return rateCheck.errorResponse!;
    }

    const featureCheck = await checkFeatureGate(request, 'speech-to-text');
    if (!featureCheck.allowed) {
      return featureCheck.errorResponse!;
    }

    const key = process.env.OPENROUTER_API_KEY!;
    let base64Audio = audio;
    const dataUrlMatch = audio.match(/^data:audio\/\w+;base64,(.+)$/);
    if (dataUrlMatch) {
      base64Audio = dataUrlMatch[1];
    }

    const response = await fetch(OPENROUTER_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://scanmaster-ai.app',
        'X-Title': 'ScanMaster AI',
      },
      body: JSON.stringify({
        model: STT_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe the audio speech to text accurately. Only return the transcription.' },
              { type: 'audio_url', audio_url: { url: `data:audio/wav;base64,${base64Audio}` } },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = data.choices?.[0]?.message?.content || '';

    if (!transcription) {
      return addCorsHeaders(NextResponse.json(
        { error: 'Speech-to-text failed: no transcription returned' },
        { status: 500 }
      ));
    }

    await incrementFeatureUsage(request, 'speech-to-text');

    return addCorsHeaders(NextResponse.json({ transcription }));
  } catch (error: any) {
    classifyAndLogAIError(error);
    return addCorsHeaders(NextResponse.json(
      { error: error.message || 'An error occurred. Please try again.' },
      { status: 500 }
    ));
  }
}
