import { NextResponse } from 'next/server';

/**
 * Consistent error response format for all API routes.
 * Never exposes raw platform error JSON (e.g. {"Code":"PreconditionFailed","Message":"..."})
 * to the client. Always returns clean, user-friendly messages.
 *
 * Error format: { error: "user-friendly message" }
 */

const PENDING_ERROR_MESSAGE = 'Service temporarily unavailable. Please try again in a moment.';
const GENERIC_ERROR_MESSAGE = 'An error occurred. Please try again.';

/**
 * Checks if an error is a "PreconditionFailed" / "pending state" error
 * from the ZAI SDK or any other platform that surfaces function-pending errors.
 */
export function isPendingError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message || '';
    const name = error.name || '';
    // Also check stringified error in case it's a JSON error object
    const str = String(error);
    return (
      name === 'PreconditionFailed' ||
      msg.includes('PreconditionFailed') ||
      msg.includes('pending state') ||
      msg.includes('function is pending state') ||
      str.includes('PreconditionFailed') ||
      str.includes('pending state')
    );
  }
  if (typeof error === 'string') {
    return error.includes('PreconditionFailed') || error.includes('pending state');
  }
  return false;
}

/**
 * Returns a consistent error response based on the error type.
 * - PreconditionFailed / pending state errors → 503 with friendly message
 * - All other errors → 500 with generic message
 *
 * The raw error is logged server-side but NEVER exposed to the client.
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  // Log the full error server-side for debugging
  if (context) {
    console.error(`Error in ${context}:`, error);
  } else {
    console.error('API error:', error);
  }

  if (isPendingError(error)) {
    return NextResponse.json(
      { error: PENDING_ERROR_MESSAGE },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: GENERIC_ERROR_MESSAGE },
    { status: 500 }
  );
}
