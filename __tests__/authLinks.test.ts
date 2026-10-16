// Tests for reading email links (confirm email / reset password).
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import {
  APP_REDIRECT_URL,
  authRedirectUrl,
  detectExpoGo,
  expoGoFallbackUrl,
  parseAuthLink,
  pickRedirectUrl,
} from '../src/lib/authLinks';

jest.mock('expo-linking', () => ({ createURL: jest.fn() }));

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

describe('detectExpoGo', () => {
  const base = {
    executionEnvironment: 'standalone',
    appOwnership: null,
    linkingUri: 'bracketbrawl://',
    createdUrl: 'bracketbrawl://auth-callback',
  };
  it('is false in a built app (real setup: bare, no linkingUri)', () =>
    expect(detectExpoGo({ ...base, executionEnvironment: 'bare', linkingUri: undefined })).toBe(
      false,
    ));
  it('is true when the environment is storeClient (Expo Go)', () =>
    expect(detectExpoGo({ ...base, executionEnvironment: 'storeClient' })).toBe(true));
  it('is true from the Expo Go owner flag alone', () =>
    expect(detectExpoGo({ ...base, appOwnership: 'expo' })).toBe(true));
  it('is true when the running address starts with exp://', () =>
    expect(detectExpoGo({ ...base, linkingUri: 'exp://192.168.111.7:8081/--/' })).toBe(true));
  it('is true when the created address starts with exp://', () =>
    expect(detectExpoGo({ ...base, createdUrl: 'exp://192.168.111.7:8081/--/auth-callback' })).toBe(
      true,
    ));
});

describe('expoGoFallbackUrl', () => {
  it('adds the auth-callback path', () =>
    expect(expoGoFallbackUrl('exp://192.168.111.7:8081/--/')).toBe(
      'exp://192.168.111.7:8081/--/auth-callback',
    ));
  it('handles no trailing path', () =>
    expect(expoGoFallbackUrl('exp://192.168.111.7:8081')).toBe(
      'exp://192.168.111.7:8081/--/auth-callback',
    ));
  it('returns null for a non-exp address', () =>
    expect(expoGoFallbackUrl('bracketbrawl://')).toBeNull());
});

describe('authRedirectUrl with the real setup', () => {
  const setConstants = (values: Record<string, unknown>) => {
    for (const [key, value] of Object.entries({
      appOwnership: null,
      linkingUri: undefined,
      ...values,
    })) {
      Object.defineProperty(Constants, key, { value, configurable: true, writable: true });
    }
  };
  const createURL = Linking.createURL as jest.Mock;

  it('built app: bare, no linkingUri -> bracketbrawl://', () => {
    createURL.mockReturnValue('bracketbrawl://auth-callback');
    setConstants({ executionEnvironment: 'bare' });
    expect(authRedirectUrl()).toBe('bracketbrawl://auth-callback');
  });
  it('Expo Go: storeClient -> exp:// address', () => {
    createURL.mockReturnValue('exp://192.168.111.7:8081/--/auth-callback');
    setConstants({ executionEnvironment: 'storeClient' });
    expect(authRedirectUrl()).toBe('exp://192.168.111.7:8081/--/auth-callback');
  });
  it('Expo Go with an unexpected environment value still gets exp://', () => {
    createURL.mockReturnValue('bracketbrawl://auth-callback');
    setConstants({ executionEnvironment: 'bare', linkingUri: 'exp://192.168.111.7:8081/--/' });
    expect(authRedirectUrl()).toBe('exp://192.168.111.7:8081/--/auth-callback');
  });
});
