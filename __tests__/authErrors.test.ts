// Tests that Supabase error codes become plain messages and unknown ones stay generic.
import {
  friendlyAuthError,
  GENERIC_AUTH_ERROR,
  SERVER_TROUBLE_ERROR,
  UNKNOWN_AUTH_ERROR,
} from '../src/lib/authErrors';

describe('friendlyAuthError', () => {
  it('explains wrong password', () =>
    expect(friendlyAuthError({ code: 'invalid_credentials' })).toMatch(/wrong email or password/i));
  it('explains unconfirmed email', () =>
    expect(friendlyAuthError({ code: 'email_not_confirmed' })).toMatch(/confirm your email/i));
  it('hides technical text for unknown errors', () =>
    expect(friendlyAuthError({ code: 'weird', message: 'pg_stack_trace' })).toBe(
      UNKNOWN_AUTH_ERROR,
    ));
  it('handles null', () => expect(friendlyAuthError(null)).toBe(UNKNOWN_AUTH_ERROR));
  it('unexpected_failure on sign up says the email could not be sent', () => {
    const m = friendlyAuthError({ code: 'unexpected_failure' }, 'signup');
    expect(m).not.toMatch(/internet/i);
    expect(m).toMatch(/confirmation email/i);
  });
  it('unexpected_failure outside sign up is the neutral line', () => {
    expect(friendlyAuthError({ code: 'unexpected_failure', status: 500 })).toBe(UNKNOWN_AUTH_ERROR);
    expect(friendlyAuthError({ code: 'unexpected_failure' })).not.toMatch(/confirmation email/i);
  });
  it.each([
    [{ status: 502, name: 'AuthRetryableFetchError' }],
    [{ status: 503, name: 'AuthRetryableFetchError' }],
    [{ status: 504, name: 'AuthRetryableFetchError' }],
    [{ status: 500 }],
    [{ status: 501, name: 'AuthRetryableFetchError' }],
    [{ status: 520, name: 'AuthRetryableFetchError' }],
    [{ status: 530, name: 'AuthRetryableFetchError' }],
  ])('server outage %j gets its own message', (err) =>
    expect(friendlyAuthError(err)).toBe(SERVER_TROUBLE_ERROR),
  );
  it('500 with a code is not an outage', () =>
    expect(friendlyAuthError({ status: 500, code: 'weird' })).toBe(UNKNOWN_AUTH_ERROR));
  it('a real network error still says check your internet', () => {
    expect(friendlyAuthError({ name: 'AuthRetryableFetchError', status: 0 })).toBe(
      GENERIC_AUTH_ERROR,
    );
    expect(friendlyAuthError({ name: 'AuthRetryableFetchError' })).toBe(GENERIC_AUTH_ERROR);
    expect(friendlyAuthError({ message: 'fetch failed' })).toBe(GENERIC_AUTH_ERROR);
  });
  it.each([
    ['error_sending_confirmation_email', /could not send the confirmation email/i],
    ['signup_disabled', /sign-ups are switched off/i],
    ['captcha_failed', /security check failed/i],
  ])('maps %s', (code, re) => expect(friendlyAuthError({ code })).toMatch(re));
});
