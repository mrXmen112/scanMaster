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
          // Brief pause before retry
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
      }
      // For non-pending errors, still retry once
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
    // 30-second overall request timeout
    const result = await Promise.race([
      (async () => {
        const body = await request.json();
        const { message, history } = body;

        if (!message || typeof message !== 'string') {
          return NextResponse.json(
            { error: 'Message is required and must be a string' },
            { status: 400 }
          );
        }

        const zai = await createZAIWithTimeout();

        // Build messages array with system prompt and conversation history
        const messages: Array<{ role: string; content: string }> = [
          {
            role: 'assistant',
            content:
              'You are an AI document assistant for ScanMaster. Help users with document-related tasks like summarizing, explaining, rewriting, and formatting text. Be concise and helpful.',
          },
        ];

        // Add conversation history if provided
        if (Array.isArray(history)) {
          for (const msg of history) {
            if (msg.role && msg.content) {
              messages.push({
                role: msg.role,
                content: msg.content,
              });
            }
          }
        }

        // Add the current user message
        messages.push({
          role: 'user',
          content: message,
        });

        const completion = await zai.chat.completions.create({
          messages,
          thinking: { type: 'disabled' },
        });

        const responseText = completion.choices[0]?.message?.content || '';

        if (!responseText) {
          return NextResponse.json(
            { error: 'AI chat failed: no response generated' },
            { status: 500 }
          );
        }

        return NextResponse.json({ response: responseText });
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
    return handleApiError(error, 'POST /api/ai-chat');
  }
}
