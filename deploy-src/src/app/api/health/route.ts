import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'scan-master-ai-backend',
    timestamp: new Date().toISOString(),
  });
}
export const dynamic = 'force-dynamic';
