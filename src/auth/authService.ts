// All login actions in one place. Each takes the Supabase client as an argument so tests can pass a fake.
// Every function returns { ok: true } or { ok: false, message } with a message safe to show on screen.

import type { SupabaseClient } from '@supabase/supabase-js';
import { friendlyAuthError, isServerOutage } from '../lib/authErrors';

// mayHaveAccount is set only on sign-up server errors that could leave a half-made account.
export type AuthResult = { ok: true } | { ok: false; message: string; mayHaveAccount?: true };

const OK: AuthResult = { ok: true };

function fail(
  error: {
    code?: string;
    message?: string;
    status?: number;
    name?: string;
  },
  context?: 'signup',
): AuthResult {
  return { ok: false, message: friendlyAuthError(error, context) };
}

function signUpFail(error: Parameters<typeof fail>[0]): AuthResult {
  const result = fail(error, 'signup');
  const half =
    error.code === 'unexpected_failure' ||
    error.code === 'error_sending_confirmation_email' ||
    isServerOutage(error);
  return half && !result.ok ? { ...result, mayHaveAccount: true } : result;
}

export async function signIn(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthResult> {
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  return error ? fail(error) : OK;
}

// With "Confirm email" switched on in Supabase, no login exists until the email link is clicked.
export async function signUp(
  client: SupabaseClient,
  email: string,
  password: string,
  redirectTo: string,
): Promise<AuthResult> {
  const { error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    // Real cause for TestFlight / Xcode logs. No password, no keys.
    console.warn('signUp failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return signUpFail(error);
  }
  return OK;
}

// Sends the confirmation email again for an account that was created but never confirmed.
export async function resendConfirmation(
  client: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<AuthResult> {
  const { error } = await client.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    console.warn('resend failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return signUpFail(error);
  }
  return OK;
}

export async function requestPasswordReset(
  client: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<AuthResult> {
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  return error ? fail(error) : OK;
}

export async function updatePassword(
  client: SupabaseClient,
  newPassword: string,
): Promise<AuthResult> {
  const { error } = await client.auth.updateUser({ password: newPassword });
  return error ? fail(error) : OK;
}

export async function signOut(client: SupabaseClient): Promise<AuthResult> {
  const { error } = await client.auth.signOut();
  return error ? fail(error) : OK;
}

// Calls the database function "delete_my_account" (see supabase/migrations). It deletes the caller's
// login; the database then removes all of that user's rows. Afterwards the phone's saved login is cleared.
export async function deleteAccount(client: SupabaseClient): Promise<AuthResult> {
  const { error } = await client.rpc('delete_my_account');
  if (error) return fail(error);
  await client.auth.signOut({ scope: 'local' });
  return OK;
}

// Trades the one-time code from an email link for a real login.
export async function exchangeEmailCode(client: SupabaseClient, code: string): Promise<AuthResult> {
  const { error } = await client.auth.exchangeCodeForSession(code);
  return error ? fail(error) : OK;
}
