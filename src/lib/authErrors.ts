// Turns Supabase login errors into short, plain messages for the user.
// Unknown errors get a generic message so no technical text is shown on screen.

interface ErrorLike {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: 'Please confirm your email first. Check your inbox for the link.',
  user_already_exists: 'There is already an account with that email. Try logging in.',
  email_exists: 'There is already an account with that email. Try logging in.',
  weak_password: 'That password is too weak. Try a longer one.',
  same_password: 'Pick a password you have not used before.',
  email_address_invalid: 'That email address does not look right.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
  over_request_rate_limit: 'Too many tries. Wait a few minutes and try again.',
  session_not_found: 'Your login has expired. Please log in again.',
  otp_expired: 'That email link has expired. Ask for a new one.',
  error_sending_confirmation_email:
    'We could not send the confirmation email. Try again in a few minutes.',
  signup_disabled: 'Sign-ups are switched off right now. Please try again later.',
  captcha_failed: 'The security check failed. Please try again.',
};

// Shown ONLY when the phone could not reach the server.
export const GENERIC_AUTH_ERROR = 'Something went wrong. Check your internet and try again.';

// Shown for any other unmapped error (the server answered, but with something we do not know).
export const UNKNOWN_AUTH_ERROR =
  'We could not finish that. If you were signing up and got no email, try logging in or ask for a new link.';

// Shown when Supabase itself is down (gateway errors, or any 5xx with no code).
export const SERVER_TROUBLE_ERROR =
  'Our server is having trouble. Please try again in a few minutes.';

// Sign-up only: unexpected_failure is Supabase's general server-error code, so elsewhere it stays neutral.
const SIGNUP_UNEXPECTED = 'We could not send the confirmation email. Try again in a few minutes.';

export function isServerOutage(error: ErrorLike | null | undefined): boolean {
  if (!error || typeof error.status !== 'number') return false;
  if (error.status === 502 || error.status === 503 || error.status === 504) return true;
  return error.status >= 500 && error.status <= 599 && !error.code;
}

function isNetworkFailure(error: ErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.status === 0) return true;
  if (!error.code && error.name === 'AuthRetryableFetchError') return true;
  return /fetch failed|network request failed/i.test(error.message ?? '');
}

export function friendlyAuthError(error: ErrorLike | null | undefined, context?: 'signup'): string {
  if (error?.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error?.code === 'unexpected_failure' && context === 'signup') return SIGNUP_UNEXPECTED;
  if (isServerOutage(error)) return SERVER_TROUBLE_ERROR;
  return isNetworkFailure(error) ? GENERIC_AUTH_ERROR : UNKNOWN_AUTH_ERROR;
}
