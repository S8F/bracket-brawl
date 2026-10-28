// Login with email + password. Links to sign-up and forgot-password. Shows a message if an email link failed.

import { useState } from 'react';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { resendConfirmation, signIn } from '../auth/authService';
import { useAuth } from '../auth/AuthContext';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { Screen } from '../components/Screen';
import { StatusMessage } from '../components/StatusMessage';
import { TextField } from '../components/TextField';
import { TextLink } from '../components/TextLink';
import { authRedirectUrl } from '../lib/authLinks';
import { friendlyAuthError } from '../lib/authErrors';
import { PRIVACY_POLICY_URL } from '../lib/privacyPolicy';
import { getClient } from '../lib/supabase';
import { validateEmail } from '../lib/validation';
import type { SignedOutStackParams } from '../navigation/types';

export function LoginScreen({ navigation }: NativeStackScreenProps<SignedOutStackParams, 'Login'>) {
  const { linkError, clearLinkError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    clearLinkError();
    setFormError(null);
    const problem = validateEmail(email);
    setEmailError(problem);
    if (problem || password === '') {
      if (!problem) setFormError('Enter your password.');
      return;
    }
    setBusy(true);
    const result = await signIn(getClient(), email, password);
    setBusy(false);
    // On success the login state changes and the app moves to the home screen by itself.
    if (!result.ok) setFormError(result.message);
  };

  const resend = async () => {
    setBusy(true);
    const result = await resendConfirmation(getClient(), email, authRedirectUrl());
    setBusy(false);
    setFormError(result.ok ? 'Confirmation email sent. Check your inbox.' : result.message);
  };

  return (
    <Screen>
      <Heading>Bracket Brawl</Heading>
      <BodyText>Log in to see your tournaments.</BodyText>
      <StatusMessage message={linkError} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <StatusMessage message={formError} />
      {formError === friendlyAuthError({ code: 'email_not_confirmed' }) ? (
        <TextLink label="Resend confirmation email" onPress={resend} />
      ) : null}
      <AppButton label="Log in" onPress={submit} busy={busy} />
      <TextLink label="Forgot password?" onPress={() => navigation.navigate('ForgotPassword')} />
      <TextLink label="Create an account" onPress={() => navigation.navigate('SignUp')} />
      <AppButton
        label="Privacy Policy"
        variant="secondary"
        onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        hint="Opens the privacy policy in your web browser"
      />
    </Screen>
  );
}
