// Tests for reading email links (confirm email / reset password).
import { APP_REDIRECT_URL, parseAuthLink, pickRedirectUrl } from '../src/lib/authLinks';

describe('parseAuthLink', () => {
  it('reads a code in the query', () =>
    expect(parseAuthLink('bracketbrawl://auth-callback?code=abc123')).toEqual({
      kind: 'code',
      code: 'abc123',
    }));
  it('reads an expired-link error in the fragment', () => {
    const link = parseAuthLink(
      'bracketbrawl://auth-callback#error=access_denied&error_code=otp_expired',
    );
    expect(link.kind).toBe('error');
  });
  it('ignores other links', () =>
    expect(parseAuthLink('bracketbrawl://other?code=1')).toEqual({ kind: 'none' }));
  it('ignores null', () => expect(parseAuthLink(null)).toEqual({ kind: 'none' }));
  it('works with an Expo Go style link', () =>
    expect(parseAuthLink('exp://192.168.0.5:8081/--/auth-callback?code=zzz')).toEqual({
      kind: 'code',
      code: 'zzz',
    }));
});

describe('pickRedirectUrl', () => {
  it('uses the exp:// dev address inside Expo Go', () =>
    expect(pickRedirectUrl(true, 'exp://192.168.0.5:8081/--/auth-callback')).toBe(
      'exp://192.168.0.5:8081/--/auth-callback',
    ));
  it('uses bracketbrawl:// in a built app', () => {
    expect(pickRedirectUrl(false, 'exp://192.168.0.5:8081/--/auth-callback')).toBe(
      APP_REDIRECT_URL,
    );
    expect(APP_REDIRECT_URL).toBe('bracketbrawl://auth-callback');
  });
});
