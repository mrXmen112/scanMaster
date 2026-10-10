import { NextResponse } from 'next/server';

const GENERIC_ERROR_MESSAGE = 'An error occurred. Please try again.';

export function isPendingError(_error: unknown): boolean {
  return false;
}

export function handleApiError(error: unknown, context?: string): NextResponse {
  if (context) {
    console.error(`Error in ${context}:`, error);
  } else {
    console.error('API error:', error);
  }

  return NextResponse.json(
    { error: GENERIC_ERROR_MESSAGE },
    { status: 500 }
  );
}
