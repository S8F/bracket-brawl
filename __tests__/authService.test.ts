// Tests the login actions against a fake Supabase client (no network, no keys needed).
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  deleteAccount,
  requestPasswordReset,
  resendConfirmation,
  signIn,
  signUp,
} from '../src/auth/authService';

function fakeClient(overrides: Record<string, unknown> = {}) {
  const auth = {
    signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
    signUp: jest.fn().mockResolvedValue({ error: null }),
    resend: jest.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
  };
  const rpc = jest.fn().mockResolvedValue({ error: null });
  return { client: { auth, rpc, ...overrides } as unknown as SupabaseClient, auth, rpc };
}

describe('authService', () => {
  it('signIn trims the email and passes the password', async () => {
    const { client, auth } = fakeClient();
    await expect(signIn(client, ' a@b.co ', 'pw123456')).resolves.toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw123456' });
  });

  it('signIn turns a wrong password into a plain message', async () => {
    const { client, auth } = fakeClient();
    auth.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } });
    const result = await signIn(client, 'a@b.co', 'bad');
    expect(result).toEqual({ ok: false, message: 'Wrong email or password.' });
  });

  it('signUp sends the redirect link for the confirmation email', async () => {
    const { client, auth } = fakeClient();
    await signUp(client, 'a@b.co', 'pw123456', 'bracketbrawl://auth-callback');
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'pw123456',
      options: { emailRedirectTo: 'bracketbrawl://auth-callback' },
    });
  });

  it('signUp logs the real error and shows a non-internet message', async () => {
    const { client, auth } = fakeClient();
    auth.signUp.mockResolvedValue({
      error: { code: 'unexpected_failure', status: 500, message: 'smtp' },
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await signUp(client, 'a@b.co', 'pw123456', 'x://cb');
    expect(warn).toHaveBeenCalledWith('signUp failed', {
      code: 'unexpected_failure',
      status: 500,
      message: 'smtp',
    });
    expect(result).toMatchObject({ ok: false });
    expect((result as { message: string }).message).not.toMatch(/internet/i);
    warn.mockRestore();
  });

  it('signUp flags a server error as maybe-half-made, but not a weak password', async () => {
    const { client, auth } = fakeClient();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    auth.signUp.mockResolvedValue({ error: { code: 'unexpected_failure', status: 500 } });
    expect(await signUp(client, 'a@b.co', 'pw', 'x://cb')).toMatchObject({
      ok: false,
      mayHaveAccount: true,
      message: expect.stringMatching(/confirmation email/i),
    });
    auth.signUp.mockResolvedValue({ error: { status: 503, name: 'AuthRetryableFetchError' } });
    expect(await signUp(client, 'a@b.co', 'pw', 'x://cb')).toMatchObject({
      mayHaveAccount: true,
      message: expect.stringMatching(/server is having trouble/i),
    });
    for (const status of [501, 520, 530]) {
      auth.signUp.mockResolvedValue({ error: { status, name: 'AuthRetryableFetchError' } });
      expect(await signUp(client, 'a@b.co', 'pw', 'x://cb')).toMatchObject({
        mayHaveAccount: true,
        message: expect.stringMatching(/server is having trouble/i),
      });
    }
    auth.signUp.mockResolvedValue({ error: { status: 0, name: 'AuthRetryableFetchError' } });
    const net = await signUp(client, 'a@b.co', 'pw', 'x://cb');
    expect(net).not.toHaveProperty('mayHaveAccount');
    expect((net as { message: string }).message).toMatch(/internet/i);
    auth.signUp.mockResolvedValue({ error: { code: 'weak_password', status: 422 } });
    expect(await signUp(client, 'a@b.co', 'pw', 'x://cb')).not.toHaveProperty('mayHaveAccount');
    warn.mockRestore();
  });

  it('unexpected_failure on log in and reset shows the neutral line', async () => {
    const { client, auth } = fakeClient();
    auth.signInWithPassword.mockResolvedValue({
      error: { code: 'unexpected_failure', status: 500 },
    });
    auth.resetPasswordForEmail.mockResolvedValue({
      error: { code: 'unexpected_failure', status: 500 },
    });
    for (const r of [
      await signIn(client, 'a@b.co', 'pw'),
      await requestPasswordReset(client, 'a@b.co', 'x://cb'),
    ]) {
      expect((r as { message: string }).message).not.toMatch(/confirmation email|internet/i);
    }
  });

  it('resendConfirmation calls auth.resend with type signup and the trimmed email', async () => {
    const { client, auth } = fakeClient();
    await expect(resendConfirmation(client, ' a@b.co ', 'x://cb')).resolves.toEqual({ ok: true });
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'a@b.co',
      options: { emailRedirectTo: 'x://cb' },
    });
  });

  it('requestPasswordReset sends the redirect link', async () => {
    const { client, auth } = fakeClient();
    await requestPasswordReset(client, 'a@b.co', 'bracketbrawl://auth-callback');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', {
      redirectTo: 'bracketbrawl://auth-callback',
    });
  });

  it('deleteAccount calls the database function, then clears the local login', async () => {
    const { client, auth, rpc } = fakeClient();
    await expect(deleteAccount(client)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('deleteAccount does NOT clear the login if the server refused', async () => {
    const { client, auth, rpc } = fakeClient();
    rpc.mockResolvedValue({ error: { message: 'boom' } });
    const result = await deleteAccount(client);
    expect(result.ok).toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
