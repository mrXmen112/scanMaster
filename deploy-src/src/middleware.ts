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

  // Exact match
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // Regex matches for Capacitor webview variations and local development ports
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    return origin;
  }
  if (/^capacitor:\/\/localhost$/.test(origin)) {
    return origin;
  }

  // InsForge domain matching
  if (origin.endsWith('.insforge.site') || origin.endsWith('.insforge.app')) {
    return origin;
  }

  // Fallback to primary base URL in production if set, or don't allow
  return process.env.NEXT_PUBLIC_API_BASE_URL || '';
}

export function middleware(request: NextRequest) {
  const allowedOrigin = getAllowedOrigin(request);

  // Handle OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    if (allowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-device-id, x-platform, x-app-version, x-pdf-id, x-pdf-pages');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
  }

  // Handle normal API requests - append CORS headers
  const response = NextResponse.next();
  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-device-id, x-platform, x-app-version, x-pdf-id, x-pdf-pages');
  return response;
}

// Intercept all API routes
export const config = {
  matcher: '/api/:path*',
};
