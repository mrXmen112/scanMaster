import { NextRequest, NextResponse } from 'next/server';
import { addCorsHeaders } from '@/lib/cors-helper';

export type Feature = 'text' | 'pdf' | 'ocr' | 'speech';

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const FEATURE_NAME_MAP: Record<string, Feature> = {
  'summary': 'text',
  'ocr': 'ocr',
  'business-card': 'ocr',
  'handwriting': 'ocr',
  'speech-to-text': 'speech',
};

const FEATURE_LIMITS: Record<Feature, RateLimitConfig> = {
  text: { limit: 50, windowMs: 24 * 60 * 60 * 1000 },
  pdf: { limit: 7, windowMs: 24 * 60 * 60 * 1000 },
  ocr: { limit: 20, windowMs: 24 * 60 * 60 * 1000 },
  speech: { limit: 20, windowMs: 24 * 60 * 60 * 1000 },
};

interface StoreEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, StoreEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetTime < now) {
      store.delete(key);
    }
  }
}, 10 * 60 * 1000);

function getIdentifier(request: NextRequest): string {
  const deviceId = request.headers.get('x-device-id');
  if (deviceId) return deviceId;
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

function getStoreKey(identifier: string, feature: Feature): string {
  const date = new Date().toISOString().split('T')[0];
  return `${date}:${feature}:${identifier}`;
}

export async function checkRateLimit(
  request: NextRequest,
  feature: Feature,
  options?: { textLength?: number; pdfPages?: number; pdfId?: string }
): Promise<{
  allowed: boolean;
  errorResponse?: NextResponse;
}> {
  const config = FEATURE_LIMITS[feature];
  if (!config) {
    return { allowed: true };
  }

  if (options?.textLength && options.textLength > 100000) {
    return {
      allowed: false,
      errorResponse: addCorsHeaders(NextResponse.json(
        {
          error: 'invalid_request',
          message: 'Text length exceeds the maximum limit of 100,000 characters. Please shorten your input.',
        },
        { status: 400 }
      )),
    };
  }

  const identifier = getIdentifier(request);
  const key = getStoreKey(identifier, feature);
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || entry.resetTime < now) {
    return { allowed: true };
  }

  if (entry.count >= config.limit) {
    return {
      allowed: false,
      errorResponse: addCorsHeaders(NextResponse.json(
        {
          error: 'rate_limit_exceeded',
          message: `Daily limit reached (${config.limit}/${config.limit}). Try again tomorrow.`,
          limit: config.limit,
          remaining: 0,
          resetAt: entry.resetTime,
        },
        { status: 429 }
      )),
    };
  }

  return { allowed: true };
}

export async function incrementFeatureUsage(
  request: NextRequest,
  feature: string
): Promise<void> {
  const mapped = FEATURE_NAME_MAP[feature] || (feature as Feature);
  if (!(mapped in FEATURE_LIMITS)) return;

  const config = FEATURE_LIMITS[mapped];
  const identifier = getIdentifier(request);
  const key = getStoreKey(identifier, mapped);
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || entry.resetTime < now) {
    store.set(key, { count: 1, resetTime: now + config.windowMs });
  } else {
    entry.count++;
  }
}

export async function checkFeatureGate(
  _request: NextRequest,
  _feature: string
): Promise<{ allowed: boolean; errorResponse?: NextResponse }> {
  return { allowed: true };
}

export function getTierLimits(_tier: string) {
  return { text: 99999, pdf: 99999, ocr: 99999, maxPages: 99999 };
}

export async function resolveVerifiedIdentity(request: NextRequest): Promise<{
  identifier: string;
  tier: string;
}> {
  return { identifier: getIdentifier(request), tier: 'free' };
}

export async function getUsageRecord(_identifier: string): Promise<{
  textCount: number;
  pdfCount: number;
  ocrCount: number;
  date: string;
  translatedPdfIds: string[];
}> {
  const today = new Date().toISOString().split('T')[0];
  return {
    textCount: 0,
    pdfCount: 0,
    ocrCount: 0,
    date: today,
    translatedPdfIds: [],
  };
}

export async function incrementUsageRecord(
  _identifier: string,
  _feature: 'text' | 'pdf' | 'ocr',
  _options?: { pdfId?: string }
): Promise<void> {
}
