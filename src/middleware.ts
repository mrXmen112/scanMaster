import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
  process.env.NEXT_PUBLIC_API_BASE_URL,
].filter(Boolean);

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (!origin) return '';

  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  if (/^(capacitor|ionic):\/\/localhost$/.test(origin)) return origin;
  if (origin.endsWith('.vercel.app')) return origin;
  if (origin.endsWith('.insforge.site') || origin.endsWith('.insforge.app')) return origin;

  return process.env.NEXT_PUBLIC_API_BASE_URL || '';
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: capacitor:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
  return response;
}

export function middleware(request: NextRequest) {
  const allowedOrigin = getAllowedOrigin(request);

  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    if (allowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-device-id, x-platform, x-app-version, x-pdf-id, x-pdf-pages');
    response.headers.set('Access-Control-Max-Age', '86400');
    return addSecurityHeaders(response);
  }

  const response = NextResponse.next();
  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-device-id, x-platform, x-app-version, x-pdf-id, x-pdf-pages');
  return addSecurityHeaders(response);
}

export const config = {
  matcher: '/api/:path*',
};
