import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { isPendingError, handleApiError } from '@/lib/api-error-handler';

async function createZAIWithTimeout(timeoutMs = 15000) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await Promise.race([
        ZAI.create(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('ZAI.create() timed out')),
            timeoutMs
          )
        ),
      ]);
      return result;
    } catch (error) {
      lastError = error;
      if (isPendingError(error)) {
        console.warn(
          `ZAI.create() attempt ${attempt + 1} failed with pending/precondition error:`,
          error instanceof Error ? error.message : error
        );
        if (attempt < 1) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
      }
      if (attempt < 1) {
        console.warn(
          `ZAI.create() attempt ${attempt + 1} failed:`,
          error instanceof Error ? error.message : error
        );
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
    }
  }

  throw lastError;
}

export async function POST(request: NextRequest) {
  try {
    const result = await Promise.race([
      (async () => {
        const body = await request.json();
        const { audio } = body;

        if (!audio || typeof audio !== 'string') {
          return NextResponse.json(
            { error: 'Audio data is required (base64 encoded)' },
            { status: 400 }
          );
        }

        const zai = await createZAIWithTimeout();

        // Extract base64 data if it's a data URL, otherwise use as-is
        let base64Audio = audio;
        const dataUrlMatch = audio.match(/^data:audio\/\w+;base64,(.+)$/);
        if (dataUrlMatch) {
          base64Audio = dataUrlMatch[1];
        }

        const asrResponse = await zai.audio.asr.create({
          file_base64: base64Audio,
        });

        const transcription = asrResponse.text || '';

        if (!transcription) {
          return NextResponse.json(
            { error: 'Speech-to-text failed: no transcription returned' },
            { status: 500 }
          );
        }

        return NextResponse.json({ transcription });
      })(),
      new Promise<NextResponse>((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timed out after 30 seconds')),
          30000
        )
      ),
    ]);

    return result;
  } catch (error) {
    return handleApiError(error, 'POST /api/speech-to-text');
  }
}
