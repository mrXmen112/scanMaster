/**
 * Turns a Supabase auth error into something a person can act on.
 *
 * The app previously surfaced `error.message` straight from the SDK, so users
 * saw raw strings like "Email not confirmed" or "Invalid login credentials"
 * and were given no idea what to do next. GoTrue returns a stable
 * machine-readable `code` alongside the message, so branch on that and fall
 * back to the original text for anything unrecognised.
 */

export interface FriendlyAuthError {
  message: string
  /** True when the only thing standing between the user and a session is
   *  clicking a link in their inbox. The UI shows different copy for this. */
  needsEmailConfirmation: boolean
}

export function toFriendlyAuthError(error: { code?: string; message?: string } | null): FriendlyAuthError {
  const code = error?.code ?? ''
  const raw = error?.message ?? 'Something went wrong. Please try again.'

  switch (code) {
    case 'email_not_confirmed':
      return {
        needsEmailConfirmation: true,
        message:
          'You need to confirm your email address first. Open the email we sent you and tap the link, then sign in.',
      }

    case 'invalid_credentials':
      return {
        needsEmailConfirmation: false,
        message: 'Incorrect email or password. Please check and try again.',
      }

    // GoTrue renamed this over time; both codes exist in the wild.
    case 'user_already_exists':
    case 'email_exists':
      return {
        needsEmailConfirmation: false,
        message: 'An account with that email already exists. Try signing in instead.',
      }

    case 'weak_password':
      return {
        needsEmailConfirmation: false,
        message: 'That password is too weak. Use at least 6 characters.',
      }

    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return {
        needsEmailConfirmation: false,
        message: 'Too many attempts. Please wait a minute and try again.',
      }

    case 'email_address_invalid':
      return {
        needsEmailConfirmation: false,
        message: 'That email address does not look valid. Please check it.',
      }

    case 'network_error':
    case 'Failed to fetch':
      return {
        needsEmailConfirmation: false,
        message: 'No connection. Check your internet and try again.',
      }

    default:
      return { message: raw, needsEmailConfirmation: false }
  }
}