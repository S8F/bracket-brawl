// Tests that Supabase error codes become plain messages and unknown ones stay generic.
import { friendlyAuthError, GENERIC_AUTH_ERROR } from '../src/lib/authErrors';

describe('friendlyAuthError', () => {
  it('explains wrong password', () =>
    expect(friendlyAuthError({ code: 'invalid_credentials' })).toMatch(/wrong email or password/i));
  it('explains unconfirmed email', () =>
    expect(friendlyAuthError({ code: 'email_not_confirmed' })).toMatch(/confirm your email/i));
  it('hides technical text for unknown errors', () =>
    expect(friendlyAuthError({ code: 'weird', message: 'pg_stack_trace' })).toBe(
      GENERIC_AUTH_ERROR,
    ));
  it('handles null', () => expect(friendlyAuthError(null)).toBe(GENERIC_AUTH_ERROR));
});
