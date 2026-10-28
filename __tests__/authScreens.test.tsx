// Screen tests for the "Resend confirmation email" link on the sign-up and log-in screens.
import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LoginScreen } from '../src/screens/LoginScreen';
import { SignUpScreen } from '../src/screens/SignUpScreen';
import { resendConfirmation, signIn, signUp } from '../src/auth/authService';
import { friendlyAuthError } from '../src/lib/authErrors';

jest.mock('../src/lib/supabase', () => ({ getClient: () => ({}) }));
jest.mock('../src/lib/authLinks', () => ({ authRedirectUrl: () => 'x://cb' }));
jest.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ linkError: null, clearLinkError: () => {} }),
}));
jest.mock('../src/auth/authService', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  resendConfirmation: jest.fn(),
}));

const mSignUp = signUp as jest.Mock;
const mSignIn = signIn as jest.Mock;
const mResend = resendConfirmation as jest.Mock;
const LINK = { name: 'Resend confirmation email' };

const nav = { navigate: jest.fn(), replace: jest.fn() };
const signUpProps = { navigation: nav, route: {} } as unknown as ComponentProps<
  typeof SignUpScreen
>;
const loginProps = { navigation: nav, route: {} } as unknown as ComponentProps<typeof LoginScreen>;

beforeEach(() => jest.clearAllMocks());

async function fillSignUp(email: string, pw = 'longenough1', again = 'longenough1') {
  await render(<SignUpScreen {...signUpProps} />);
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), pw);
  await fireEvent.changeText(screen.getByLabelText('Repeat password'), again);
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
}

describe('SignUpScreen resend link', () => {
  it('shows after a sign-up server error and calls resendConfirmation with the email', async () => {
    mSignUp.mockResolvedValue({ ok: false, message: 'server', mayHaveAccount: true });
    mResend.mockResolvedValue({ ok: true });
    await fillSignUp('a@b.co');
    await fireEvent.press(await screen.findByRole('link', LINK));
    expect(mResend).toHaveBeenCalledWith({}, 'a@b.co', 'x://cb');
  });

  it('is hidden on a validation error', async () => {
    await fillSignUp('a@b.co', 'longenough1', 'different1');
    expect(mSignUp).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', LINK)).toBeNull();
  });

  it('is hidden on a sign-up error that cannot leave an account (weak password)', async () => {
    mSignUp.mockResolvedValue({ ok: false, message: 'too weak' });
    await fillSignUp('a@b.co');
    await screen.findByText('too weak');
    expect(screen.queryByRole('link', LINK)).toBeNull();
  });

  it('is hidden after the "email sent" line', async () => {
    mSignUp.mockResolvedValue({ ok: false, message: 'server', mayHaveAccount: true });
    mResend.mockResolvedValue({ ok: true });
    await fillSignUp('a@b.co');
    await fireEvent.press(await screen.findByRole('link', LINK));
    await screen.findByText('Confirmation email sent. Check your inbox.');
    expect(screen.queryByRole('link', LINK)).toBeNull();
  });
});

describe('LoginScreen resend link', () => {
  async function logIn(message: string) {
    mSignIn.mockResolvedValue({ ok: false, message });
    await render(<LoginScreen {...loginProps} />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.co');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'pw123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await screen.findByText(message);
  }

  it('shows for email-not-confirmed and calls resendConfirmation with the email', async () => {
    mResend.mockResolvedValue({ ok: true });
    await logIn(friendlyAuthError({ code: 'email_not_confirmed' }));
    await fireEvent.press(screen.getByRole('link', LINK));
    expect(mResend).toHaveBeenCalledWith({}, 'a@b.co', 'x://cb');
  });

  it('is hidden for any other login error', async () => {
    await logIn(friendlyAuthError({ code: 'invalid_credentials' }));
    expect(screen.queryByRole('link', LINK)).toBeNull();
  });
});
