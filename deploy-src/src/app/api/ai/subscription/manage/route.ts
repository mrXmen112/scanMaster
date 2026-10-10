import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { getInsforgeClient } from '@/lib/insforge/client';
import { addCorsHeaders, handleOptions } from '@/lib/cors-helper';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request.headers.get('origin'));
}

const RAZORPAY_ENV = process.env.RAZORPAY_ENV || 'test';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, subscriptionId } = body;

    if (!action || !subscriptionId) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'missing_fields', message: 'Action and subscriptionId are required.' },
        { status: 400 }
      ));
    }

    const validActions = ['cancel', 'pause', 'resume'];
    if (!validActions.includes(action)) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'invalid_action', message: 'Action must be cancel, pause, or resume.' },
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

    const { data: userData, error: userError } = await insforge.auth.getCurrentUser();
    if (userError || !userData?.user) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'auth_failed', message: 'Session expired.' },
        { status: 401 }
      ));
    }

    const userId = userData.user.id;

    const dbClient = getInsforgeClient();
    const { data: sub, error: subError } = await dbClient.database
      .from('subscriptions')
      .select('razorpay_subscription_id')
      .eq('user_id', userId)
      .eq('razorpay_subscription_id', subscriptionId)
      .maybeSingle();

    if (subError || !sub) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'not_found', message: 'Subscription not found.' },
        { status: 404 }
      ));
    }

    let result;
    if (action === 'cancel') {
      result = await insforge.payments.razorpay.cancelSubscription(RAZORPAY_ENV, subscriptionId, {
        cancelAtCycleEnd: true,
      });
    } else if (action === 'pause') {
      result = await insforge.payments.razorpay.pauseSubscription(RAZORPAY_ENV, subscriptionId);
    } else if (action === 'resume') {
      result = await insforge.payments.razorpay.resumeSubscription(RAZORPAY_ENV, subscriptionId);
    }

    if (result?.error) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'action_failed', message: result.error.message || 'Action failed.' },
        { status: 500 }
      ));
    }

    return addCorsHeaders(NextResponse.json({ success: true }));
  } catch (err: any) {
    return addCorsHeaders(NextResponse.json(
      { success: false, error: 'server_error', message: err.message || 'Something went wrong.' },
      { status: 500 }
    ));
  }
}
