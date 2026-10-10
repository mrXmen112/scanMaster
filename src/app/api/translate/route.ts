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
        const { text, sourceLanguage, targetLanguage } = body;

        if (!text || typeof text !== 'string') {
          return NextResponse.json(
            { error: 'Text is required and must be a string' },
            { status: 400 }
          );
        }

        if (!sourceLanguage || typeof sourceLanguage !== 'string') {
          return NextResponse.json(
            { error: 'Source language is required' },
            { status: 400 }
          );
        }

        if (!targetLanguage || typeof targetLanguage !== 'string') {
          return NextResponse.json(
            { error: 'Target language is required' },
            { status: 400 }
          );
        }

        const zai = await createZAIWithTimeout();

        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Only return the translation, nothing else.`,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          thinking: { type: 'disabled' },
        });

        const translatedText = completion.choices[0]?.message?.content || '';

        if (!translatedText) {
          return NextResponse.json(
            { error: 'Translation failed: no response from AI' },
            { status: 500 }
          );
        }

        return NextResponse.json({ translatedText });
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
    return handleApiError(error, 'POST /api/translate');
  }
}
