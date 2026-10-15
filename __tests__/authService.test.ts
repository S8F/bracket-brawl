// Tests the login actions against a fake Supabase client (no network, no keys needed).
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteAccount, requestPasswordReset, signIn, signUp } from '../src/auth/authService';

function fakeClient(overrides: Record<string, unknown> = {}) {
  const auth = {
    signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
    signUp: jest.fn().mockResolvedValue({ error: null }),
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
