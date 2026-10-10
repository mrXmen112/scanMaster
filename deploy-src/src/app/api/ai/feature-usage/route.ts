import { NextRequest, NextResponse } from 'next/server';
import { checkFeatureGate, incrementFeatureUsage } from '@/lib/rate-limiter';
import { addCorsHeaders, handleOptions } from '@/lib/cors-helper';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request.headers.get('origin'));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, feature } = body;

    if (!feature || typeof feature !== 'string') {
      return addCorsHeaders(NextResponse.json(
        { error: 'feature is required and must be a string' },
        { status: 400 }
      ));
    }

    if (action === 'check') {
      const result = await checkFeatureGate(request, feature);
      if (!result.allowed) {
        return result.errorResponse!;
      }
      return addCorsHeaders(NextResponse.json({ allowed: true }));
    }

    if (action === 'increment') {
      await incrementFeatureUsage(request, feature);
      return addCorsHeaders(NextResponse.json({ success: true }));
    }

    return addCorsHeaders(NextResponse.json(
      { error: 'action must be "check" or "increment"' },
      { status: 400 }
    ));
  } catch (error: any) {
    console.error('[FEATURE USAGE API ERROR]:', error);
    return addCorsHeaders(NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    ));
  }
}
