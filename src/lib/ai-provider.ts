import { NextResponse } from 'next/server';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.AI_MODEL || 'openrouter/free';

export function validateKeys() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return {
      isValid: false,
      errorResponse: NextResponse.json(
        {
          success: false,
          error: "AI service is temporarily unavailable. Please try again later."
        },
        { status: 500 }
      )
    };
  }
  return { isValid: true, errorResponse: null };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetry(url: string, options: RequestInit, timeoutMs = 15000, maxRetries = 1): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (response.ok) {
        return response;
      }
      let errDetails = '';
      try {
        const errJson = await response.json();
        errDetails = errJson.error?.message || errJson.message || response.statusText;
      } catch {
        errDetails = response.statusText || `HTTP status ${response.status}`;
      }
      throw new Error(errDetails);
    } catch (err: any) {
      lastError = err;
      console.warn(`[OpenRouter attempt ${attempt + 1} failed]: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  throw lastError || new Error('Request failed after retries');
}

export function classifyAndLogAIError(err: any) {
  const errMsg = err.message || '';
  let classification = 'UNKNOWN_ERROR';

  if (errMsg.includes('timed out') || errMsg.includes('Timeout') || errMsg.includes('AbortError')) {
    classification = 'NETWORK_TIMEOUT';
  } else if (errMsg.includes('quota') || errMsg.includes('insufficient_quota') || errMsg.includes('402')) {
    classification = 'QUOTA_EXCEEDED';
  } else if (errMsg.includes('rate limit') || errMsg.includes('429')) {
    classification = 'RATE_LIMITED';
  } else if (errMsg.includes('model_not_found') || errMsg.includes('not found') || errMsg.includes('404')) {
    classification = 'MODEL_NOT_FOUND';
  } else if (errMsg.includes('400') || errMsg.includes('invalid')) {
    classification = 'INVALID_REQUEST';
  }

  console.error(`[AI ERROR] ${classification}: ${errMsg}`);
}

async function callOpenRouter(
  prompt: string,
  systemPrompt?: string,
  messages?: ChatMessage[],
  image?: string,
  timeoutMs = 15000
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OpenRouter API key is missing on backend.");

  const bodyMessages: any[] = [];
  if (systemPrompt) {
    bodyMessages.push({ role: 'system', content: systemPrompt });
  }

  if (messages && messages.length > 0) {
    messages.forEach(msg => {
      bodyMessages.push({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.content
      });
    });
  } else if (image) {
    let mimeType = 'image/jpeg';
    let base64Data = image;
    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }
    bodyMessages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
      ]
    });
  } else {
    bodyMessages.push({ role: 'user', content: prompt });
  }

  const response = await fetchWithRetry(OPENROUTER_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://scanmaster-ai.app',
      'X-Title': 'ScanMaster'
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: bodyMessages,
      temperature: image ? 0.1 : 0.7,
      max_tokens: image ? 4096 : 2048
    })
  }, timeoutMs);

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenRouter returned empty response.");
  }
  return text;
}

export async function runAI(options: {
  prompt: string;
  systemPrompt?: string;
  messages?: ChatMessage[];
  image?: string;
  isVision?: boolean;
  timeoutMs?: number;
}): Promise<string> {
  const isVision = !!options.image || !!options.isVision;
  const timeoutMs = options.timeoutMs || (isVision ? 30000 : 15000);

  console.log(`[OpenRouter] Starting request | vision=${isVision} | timeout=${timeoutMs}ms`);
  // Key presence verified internally

  if (isVision && !options.image) {
    throw new Error("Vision task requested but image payload is empty.");
  }

  try {
    const result = await callOpenRouter(
      options.prompt,
      options.systemPrompt,
      options.messages,
      options.image,
      timeoutMs
    );
    console.log("[OpenRouter] Request succeeded");
    return result;
  } catch (err: any) {
    classifyAndLogAIError(err);
    throw new Error("AI service is temporarily unavailable. Please try again later.");
  }
}
