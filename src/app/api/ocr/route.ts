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
        const { image } = body;

        if (!image || typeof image !== 'string') {
          return NextResponse.json(
            { error: 'Image data is required (base64 data URL)' },
            { status: 400 }
          );
        }

        const zai = await createZAIWithTimeout();

        const visionResponse = await zai.chat.completions.createVision({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this image. Preserve the layout and formatting as much as possible.',
                },
                {
                  type: 'image_url',
                  image_url: { url: image },
                },
              ],
            },
          ],
          thinking: { type: 'disabled' },
        });

        const extractedText = visionResponse.choices[0]?.message?.content || '';

        if (!extractedText) {
          return NextResponse.json(
            { error: 'OCR failed: no text extracted from image' },
            { status: 500 }
          );
        }

        return NextResponse.json({ text: extractedText });
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
    return handleApiError(error, 'POST /api/ocr');
  }
}
