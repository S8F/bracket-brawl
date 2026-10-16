// Reads the links in confirmation and password-reset emails when they open the app.
// With Supabase's "PKCE" login flow the link carries a one-time "code" that the app trades for a login.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';

export type AuthLink =
  { kind: 'code'; code: string } | { kind: 'error'; message: string } | { kind: 'none' };

// The link address used by the real (built) app. Must be on Supabase's redirect allow-list.
export const APP_REDIRECT_URL = 'bracketbrawl://auth-callback';

// Picks the address Supabase sends people to after they click an email link.
// Expo Go does not know our own "bracketbrawl://" scheme, so there the link must be the "exp://" address
// of the running dev server (devUrl). A built app uses bracketbrawl://.
export function pickRedirectUrl(isExpoGo: boolean, devUrl: string): string {
  return isExpoGo ? devUrl : APP_REDIRECT_URL;
}

// What the phone tells us about where the app is running.
export type RunSignals = {
  executionEnvironment: string | undefined;
  appOwnership: string | null | undefined;
  linkingUri: string | null | undefined;
  createdUrl: string;
};

const EXP_SCHEME = /^exps?:\/\//i;

// True when the app runs inside Expo Go. Any one of several signals is enough, so a change in one of them
// cannot silently send people to bracketbrawl://, which Expo Go cannot open.
// Do NOT add Constants.expoGoConfig: in a built app it returns the embedded manifest (truthy), so it is not Expo Go only.
// In a built app the remaining signals are all false: environment is "bare"/"standalone", appOwnership is null,
// linkingUri is not provided by the native module, and the created address starts with bracketbrawl://.
export function detectExpoGo(s: RunSignals): boolean {
  return (
    s.executionEnvironment === ExecutionEnvironment.StoreClient ||
    s.appOwnership === 'expo' ||
    EXP_SCHEME.test(s.createdUrl) ||
    EXP_SCHEME.test(s.linkingUri ?? '')
  );
}

// Used by sign-up and forgot-password. In dev it prints the address so it can be checked against Supabase's list.
export function authRedirectUrl(): string {
  const createdUrl = Linking.createURL('auth-callback');
  const signals: RunSignals = {
    executionEnvironment: Constants.executionEnvironment,
    appOwnership: Constants.appOwnership,
    linkingUri: Constants.linkingUri,
    createdUrl,
  };
  const isExpoGo = detectExpoGo(signals);
  // Expo Go needs an exp:// address. If it somehow came out as bracketbrawl://, build one from the running link.
  const devUrl = EXP_SCHEME.test(createdUrl)
    ? createdUrl
    : (expoGoFallbackUrl(signals.linkingUri) ?? createdUrl);
  const url = pickRedirectUrl(isExpoGo, devUrl);
  if (__DEV__) {
    console.log(`[auth] email links will redirect to: ${url}`);
    console.log(`[auth] detection signals: ${JSON.stringify(signals)}`);
  }
  return url;
}

// Constants.linkingUri looks like exp://192.168.1.5:8081/--/ in Expo Go; add the path to it.
export function expoGoFallbackUrl(linkingUri: string | null | undefined): string | null {
  if (!linkingUri || !EXP_SCHEME.test(linkingUri)) return null;
  return `${linkingUri.replace(/\/+$/, '').replace(/\/--$/, '')}/--/auth-callback`;
}

// Pulls "key=value" pairs from both the ?query and the #fragment parts of the link.
function readParams(url: string): URLSearchParams {
  const params = new URLSearchParams();
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex === -1 ? '' : beforeHash.slice(queryIndex + 1);
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => params.set(key, value));
  }
  return params;
}

export function parseAuthLink(url: string | null | undefined): AuthLink {
  if (!url || !url.includes('auth-callback')) return { kind: 'none' };
  const params = readParams(url);
  const errorCode = params.get('error_code');
  if (params.get('error') || errorCode) {
    return {
      kind: 'error',
      message:
        errorCode === 'otp_expired'
          ? 'That email link has expired. Ask for a new one.'
          : 'That email link did not work. Ask for a new one.',
    };
  }
  const code = params.get('code');
  return code ? { kind: 'code', code } : { kind: 'none' };
}
