import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeClient } from '@/lib/insforge/client';
import { addCorsHeaders, handleOptions } from '@/lib/cors-helper';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request.headers.get('origin'));
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  diagnostics.checks.backend = { status: 'ok', message: 'Backend is reachable' };

  const orVal = process.env.OPENROUTER_API_KEY || '';
  diagnostics.checks.aiKeys = {
    OpenRouter: {
      configured: orVal.length > 0,
      prefix: orVal.length > 0 ? orVal.substring(0, 8) + '...' : 'not set',
    },
    anyConfigured: orVal.length > 0,
  };

  diagnostics.checks.aiConfig = {
    provider: 'OpenRouter',
    model: 'openrouter/free',
    documentation: 'https://openrouter.ai/keys',
  };

  let databaseConnected = false;
  let dbError: string | null = null;
  try {
    const insforge = getInsforgeClient();
    const { error } = await insforge.database.from('ai_usage').select('id').limit(1);
    if (!error) {
      databaseConnected = true;
    } else {
      dbError = error.message || String(error);
    }
  } catch (err: any) {
    dbError = err.message || String(err);
  }
  diagnostics.checks.database = {
    connected: databaseConnected,
    error: dbError,
    table: 'ai_usage',
    type: 'postgres',
  };

  diagnostics.checks.cors = {
    allowedOrigins: ['capacitor://localhost', 'http://localhost:3000', 'https://*.insforge.site', 'https://*.insforge.app'],
  };

  diagnostics.checks.environment = {
    insforgeUrl: !!process.env.NEXT_PUBLIC_INSFORGE_URL,
    apiBaseUrl: !!process.env.NEXT_PUBLIC_API_BASE_URL,
    admobConfigured: !!process.env.NEXT_PUBLIC_ADMOB_APP_ID,
  };

  diagnostics.checks.capacitorApiUrl = {
    configured: !!process.env.NEXT_PUBLIC_API_BASE_URL,
    url: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://rtut9pdy.insforge.site (fallback)',
  };

  const tierLimits = { guest: { text: 2, pdf: 2, ocr: 2, maxPages: 5 }, free: { text: 3, pdf: 3, ocr: 3, maxPages: 10 }, premium: { text: 50, pdf: 50, ocr: 50, maxPages: 50 } };
  diagnostics.checks.rateLimiter = {
    status: 'enabled',
    storageType: 'postgres',
    guestTextLimit: tierLimits.guest.text,
    guestPdfLimit: tierLimits.guest.pdf,
    guestOcrLimit: tierLimits.guest.ocr,
    guestMaxPages: tierLimits.guest.maxPages,
    freeTextLimit: tierLimits.free.text,
    freePdfLimit: tierLimits.free.pdf,
    freeOcrLimit: tierLimits.free.ocr,
    freeMaxPages: tierLimits.free.maxPages,
    premiumTextLimit: tierLimits.premium.text,
  };

  const allPassed = databaseConnected && orVal.length > 0;
  let summary = 'All systems operational';
  if (!allPassed) {
    const issues: string[] = [];
    if (!databaseConnected) issues.push('Database (ai_usage table) unreachable');
    if (!orVal) issues.push('No AI provider API keys configured');
    summary = issues.join('; ');
  }

  return addCorsHeaders(NextResponse.json({
    success: allPassed,
    backendReachable: true,
    ...diagnostics,
    summary,
  }));
}
