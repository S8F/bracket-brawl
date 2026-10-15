// Turns Supabase login errors into short, plain messages for the user.
// Unknown errors get a generic message so no technical text is shown on screen.

interface ErrorLike {
  code?: string;
  message?: string;
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
};

export const GENERIC_AUTH_ERROR = 'Something went wrong. Check your internet and try again.';

export function friendlyAuthError(error: ErrorLike | null | undefined): string {
  if (error?.code && MESSAGES[error.code]) return MESSAGES[error.code];
  return GENERIC_AUTH_ERROR;
}
