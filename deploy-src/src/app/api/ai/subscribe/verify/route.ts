import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { addCorsHeaders, handleOptions } from '@/lib/cors-helper';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request.headers.get('origin'));
}

const RAZORPAY_ENV = process.env.RAZORPAY_ENV || 'test';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionId, paymentId, signature } = body;

    if (!subscriptionId || !paymentId || !signature) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'missing_fields', message: 'Missing verification fields.' },
        { status: 400 }
      ));
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token || token === 'null' || token === 'undefined') {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'unauthorized', message: 'Please sign in.' },
        { status: 401 }
      ));
    }

    const insforge = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL || 'https://rtut9pdy.ap-southeast.insforge.app',
      edgeFunctionToken: token,
    });

    const { data, error } = await insforge.payments.razorpay.verifySubscription(RAZORPAY_ENV, {
      subscriptionId,
      paymentId,
      signature,
    });

    if (error) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'verification_failed', message: 'Payment verification failed.' },
        { status: 400 }
      ));
    }

    return addCorsHeaders(NextResponse.json({
      success: true,
      verified: true,
    }));
  } catch (err: any) {
    return addCorsHeaders(NextResponse.json(
      { success: false, error: 'server_error', message: err.message || 'Something went wrong.' },
      { status: 500 }
    ));
  }
}
