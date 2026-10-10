import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getInsforgeClient } from '@/lib/insforge/client';
import { addCorsHeaders } from '@/lib/cors-helper';

export interface UsageRecord {
  textCount: number;
  pdfCount: number;
  ocrCount: number;
  date: string;
  translatedPdfIds: string[];
}

const TIER_LIMITS: Record<'guest' | 'free' | 'premium', { text: number; pdf: number; ocr: number; maxPages: number }> = {
  guest: { text: 2, pdf: 2, ocr: 2, maxPages: 5 },
  free: { text: 3, pdf: 3, ocr: 3, maxPages: 10 },
  premium: { text: 50, pdf: 50, ocr: 50, maxPages: 50 },
};

export type Tier = 'guest' | 'free' | 'premium';

export function getTierLimits(tier: Tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.guest;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function guestIdentifier(request: NextRequest): string {
  const deviceId = request.headers.get('x-device-id');
  if (deviceId) return `device:${deviceId}`;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip) return `ip:${ip}`;
  return 'anonymous';
}

export async function resolveVerifiedIdentity(request: NextRequest): Promise<{
  identifier: string;
  tier: Tier;
}> {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) throw new Error('UNAUTHORIZED');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('UNAUTHORIZED');
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Error('UNAUTHORIZED');
    }

    let tier: Tier = 'free';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('premium_status')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profile?.premium_status === 'active' || profile?.premium_status === true) {
        tier = 'premium';
      }
    } catch {
      tier = 'free';
    }

    return { identifier: data.user.id, tier };
  }

  return { identifier: guestIdentifier(request), tier: 'guest' };
}

export async function getUsageRecord(identifier: string): Promise<UsageRecord> {
  const insforge = getInsforgeClient();
  const { data, error } = await insforge.database
    .from('ai_usage')
    .select('*')
    .eq('identifier', identifier)
    .eq('date', today())
    .maybeSingle();

  if (error || !data) {
    return { textCount: 0, pdfCount: 0, ocrCount: 0, date: today(), translatedPdfIds: [] };
  }

  return {
    textCount: data.text_count ?? 0,
    pdfCount: data.pdf_count ?? 0,
    ocrCount: data.ocr_count ?? 0,
    date: data.date ?? today(),
    translatedPdfIds: Array.isArray(data.translated_pdf_ids) ? data.translated_pdf_ids : [],
  };
}

export async function incrementUsageRecord(
  identifier: string,
  feature: 'text' | 'pdf' | 'ocr',
  options?: { pdfId?: string }
): Promise<void> {
  const current = await getUsageRecord(identifier);
  const translatedPdfIds = current.translatedPdfIds.slice();
  if (feature === 'pdf' && options?.pdfId && !translatedPdfIds.includes(options.pdfId)) {
    translatedPdfIds.push(options.pdfId);
  }

  const insforge = getInsforgeClient();
  await insforge.database.from('ai_usage').upsert(
    {
      identifier,
      date: today(),
      text_count: feature === 'text' ? current.textCount + 1 : current.textCount,
      pdf_count: feature === 'pdf' ? current.pdfCount + 1 : current.pdfCount,
      ocr_count: feature === 'ocr' ? current.ocrCount + 1 : current.ocrCount,
      translated_pdf_ids: translatedPdfIds,
    },
    { onConflict: 'identifier,date' }
  );
}

function quotaError(request: NextRequest): NextResponse {
  return addCorsHeaders(
    NextResponse.json(
      { error: 'quota_exceeded', message: 'Daily free limit reached. Upgrade to Premium.' },
      { status: 429 }
    ),
    request.headers.get('origin')
  );
}

export async function checkRateLimit(
  request: NextRequest,
  feature: 'text' | 'pdf' | 'ocr',
  options?: { textLength?: number; pdfPages?: number; pdfId?: string }
): Promise<{
  allowed: boolean;
  errorResponse?: NextResponse;
}> {
  try {
    const { identifier, tier } = await resolveVerifiedIdentity(request);
    const limits = getTierLimits(tier);

    if (feature === 'pdf' && options?.pdfPages && options.pdfPages > limits.maxPages) {
      return {
        allowed: false,
        errorResponse: addCorsHeaders(
          NextResponse.json(
            { error: 'pdf_too_large', message: `PDF exceeds the ${limits.maxPages}-page limit. Upgrade to Premium for larger documents.` },
            { status: 429 }
          ),
          request.headers.get('origin')
        ),
      };
    }

    const record = await getUsageRecord(identifier);
    const used = feature === 'text' ? record.textCount : feature === 'pdf' ? record.pdfCount : record.ocrCount;
    const limit = feature === 'text' ? limits.text : feature === 'pdf' ? limits.pdf : limits.ocr;

    if (used >= limit) {
      return { allowed: false, errorResponse: quotaError(request) };
    }

    await incrementUsageRecord(identifier, feature, options);
    return { allowed: true };
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return {
        allowed: false,
        errorResponse: addCorsHeaders(
          NextResponse.json({ error: 'unauthorized', message: 'Please sign in again.' }, { status: 401 }),
          request.headers.get('origin')
        ),
      };
    }
    console.error('[RateLimiter] checkRateLimit error:', err);
    return { allowed: true };
  }
}

export async function checkFeatureGate(
  request: NextRequest,
  feature: string
): Promise<{ allowed: boolean; errorResponse?: NextResponse }> {
  try {
    const { identifier, tier } = await resolveVerifiedIdentity(request);
    if (tier === 'premium') return { allowed: true };

    const insforge = getInsforgeClient();
    const { data, error } = await insforge.database
      .from('feature_usage')
      .select('use_count')
      .eq('user_id', identifier)
      .eq('feature', feature)
      .eq('usage_date', today())
      .maybeSingle();

    if (error) {
      console.error('[RateLimiter] checkFeatureGate db error:', error.message);
      return { allowed: true };
    }

    if (data && data.use_count >= 1) {
      return {
        allowed: false,
        errorResponse: addCorsHeaders(
          NextResponse.json(
            { error: 'feature_limit_reached', message: 'You have reached the free limit for this feature. Upgrade to Premium for unlimited access.' },
            { status: 429 }
          ),
          request.headers.get('origin')
        ),
      };
    }

    return { allowed: true };
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return {
        allowed: false,
        errorResponse: addCorsHeaders(
          NextResponse.json({ error: 'unauthorized', message: 'Please sign in again.' }, { status: 401 }),
          request.headers.get('origin')
        ),
      };
    }
    console.error('[RateLimiter] checkFeatureGate error:', err);
    return { allowed: true };
  }
}

export async function incrementFeatureUsage(
  request: NextRequest,
  feature: string
): Promise<void> {
  try {
    const { identifier, tier } = await resolveVerifiedIdentity(request);
    if (tier === 'premium') return;

    const insforge = getInsforgeClient();
    const { data, error } = await insforge.database
      .from('feature_usage')
      .select('use_count')
      .eq('user_id', identifier)
      .eq('feature', feature)
      .eq('usage_date', today())
      .maybeSingle();

    if (error) {
      console.error('[RateLimiter] incrementFeatureUsage read error:', error.message);
      return;
    }

    await insforge.database.from('feature_usage').upsert(
      {
        user_id: identifier,
        feature,
        use_count: (data?.use_count ?? 0) + 1,
        usage_date: today(),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,feature,usage_date' }
    );
  } catch (err: any) {
    console.error('[RateLimiter] incrementFeatureUsage error:', err);
  }
}
