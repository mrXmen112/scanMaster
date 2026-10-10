import { NextRequest, NextResponse } from 'next/server';
import { resolveVerifiedIdentity, getTierLimits, getUsageRecord } from '@/lib/rate-limiter';
import { addCorsHeaders, handleOptions } from '@/lib/cors-helper';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request.headers.get('origin'));
}

/**
 * GET /api/ai/usage
 *
 * Returns the current user's daily AI usage and remaining limits.
 * Identifies the user by verified session token (Authorization: Bearer <accessToken>)
 * or falls back to device ID / IP.
 */
export async function GET(request: NextRequest) {
  try {
    let identity;
    try {
      identity = await resolveVerifiedIdentity(request);
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        return addCorsHeaders(NextResponse.json(
          { error: 'unauthorized', message: 'Please sign in again.' },
          { status: 401 }
        ));
      }
      identity = { identifier: 'guest-fallback', tier: 'guest' as const };
    }

    const { identifier, tier } = identity;
    const limits = getTierLimits(tier);
    const record = await getUsageRecord(identifier);

    // Calculate when the daily window resets (next midnight UTC)
    const now = new Date();
    const resetDate = new Date(now);
    resetDate.setUTCDate(resetDate.getUTCDate() + 1);
    resetDate.setUTCHours(0, 0, 0, 0);

    return addCorsHeaders(NextResponse.json({
      success: true,
      tier,
      text: {
        usedToday: record.textCount,
        dailyLimit: limits.text,
        remainingToday: Math.max(0, limits.text - record.textCount),
      },
      pdf: {
        usedToday: record.pdfCount,
        dailyLimit: limits.pdf,
        remainingToday: Math.max(0, limits.pdf - record.pdfCount),
        maxPagesPerPdf: limits.maxPages,
      },
      ocr: {
        usedToday: record.ocrCount,
        dailyLimit: limits.ocr,
        remainingToday: Math.max(0, limits.ocr - record.ocrCount),
      },
      resetsAt: resetDate.toISOString(),
    }));
  } catch (error: any) {
    console.error('[AI Usage API Error]:', error);
    return addCorsHeaders(NextResponse.json(
      { success: false, error: 'Failed to retrieve usage data.' },
      { status: 500 }
    ));
  }
}

export const dynamic = 'force-dynamic';

