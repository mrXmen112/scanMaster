import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { addCorsHeaders, handleOptions } from '@/lib/cors-helper';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request.headers.get('origin'));
}

const RAZORPAY_ENV = process.env.RAZORPAY_ENV || 'test';

const PLAN_ID_MAP_TEST: Record<string, string> = {
  'Premium Monthly': 'plan_TFhLZBx8iGpD34',
  'Premium Yearly': 'plan_TFhLYyT8fVbtSC',
};

const PLAN_ID_MAP_LIVE: Record<string, string> = {
  'Premium Monthly': '',
  'Premium Yearly': '',
};

function getPlanId(planType: string): string | null {
  const map = RAZORPAY_ENV === 'live' ? PLAN_ID_MAP_LIVE : PLAN_ID_MAP_TEST;
  return map[planType] || null;
}

const SUBSCRIPTION_TOTAL_COUNT: Record<string, number> = {
  'Premium Monthly': 12,
  'Premium Yearly': 1,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planType } = body;

    const planId = getPlanId(planType);
    if (!planType || !planId) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'invalid_plan', message: 'Invalid subscription plan selected.' },
        { status: 400 }
      ));
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token || token === 'null' || token === 'undefined') {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'unauthorized', message: 'Please sign in to subscribe.' },
        { status: 401 }
      ));
    }

    const insforge = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL || 'https://rtut9pdy.ap-southeast.insforge.app',
      edgeFunctionToken: token,
    });

    const { data: userData, error: userError } = await insforge.auth.getCurrentUser();
    if (userError || !userData?.user) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'auth_failed', message: 'Session expired. Please sign in again.' },
        { status: 401 }
      ));
    }

    const user = userData.user;
    const totalCount = SUBSCRIPTION_TOTAL_COUNT[planType];

    const { data, error } = await insforge.payments.razorpay.createSubscription(RAZORPAY_ENV, {
      planId,
      totalCount,
      subject: { type: 'user', id: user.id },
      customerName: user.profile?.name || user.email?.split('@')[0] || 'User',
      customerEmail: user.email || '',
    });

    if (error) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'payment_error', message: error.message || 'Failed to create subscription.' },
        { status: 500 }
      ));
    }

    return addCorsHeaders(NextResponse.json({
      success: true,
      checkoutOptions: data.checkoutOptions,
    }));
  } catch (err: any) {
    return addCorsHeaders(NextResponse.json(
      { success: false, error: 'server_error', message: err.message || 'Something went wrong.' },
      { status: 500 }
    ));
  }
}
