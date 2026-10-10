import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost:3000',
  'https://scanmaster-ai.app',
  'https://scanmaster-ai.vercel.app',
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://scanmaster-ai.vercel.app',
].filter(Boolean);

function isOriginAllowed(origin: string): boolean {
  if (!origin) return true; // Allow requests with no origin (native apps)
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^capacitor:\/\/localhost$/.test(origin)) return true;
  if (/^ionic:\/\/localhost$/.test(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  if (origin.endsWith('.insforge.site') || origin.endsWith('.insforge.app')) return true;
  return false;
}

export function addCorsHeaders(res: NextResponse, origin?: string | null): NextResponse {
  if (origin && isOriginAllowed(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
  }
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-device-id, x-platform, x-app-version, x-pdf-id, x-pdf-pages');
  res.headers.set('Access-Control-Max-Age', '86400');
  return res;
}

export function handleOptions(origin?: string | null) {
  const res = new NextResponse(null, { status: 204 });
  return addCorsHeaders(res, origin);
}
