// Create an account with email + password. After sending, the user is told to confirm via the email link.

import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signUp } from '../auth/authService';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { Screen } from '../components/Screen';
import { StatusMessage } from '../components/StatusMessage';
import { TextField } from '../components/TextField';
import { TextLink } from '../components/TextLink';
import { authRedirectUrl } from '../lib/authLinks';
import { getClient } from '../lib/supabase';
import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
} from '../lib/validation';
import type { SignedOutStackParams } from '../navigation/types';

export function SignUpScreen({
  navigation,
}: NativeStackScreenProps<SignedOutStackParams, 'SignUp'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    email?: string | null;
    password?: string | null;
    confirm?: string | null;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError(null);
    const next = {
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: validatePasswordMatch(password, confirm),
    };
    setErrors(next);
    if (next.email || next.password || next.confirm) return;

    setBusy(true);
    const result = await signUp(getClient(), email, password, authRedirectUrl());
    setBusy(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    navigation.replace('CheckEmail', { email: email.trim() });
  };

  return (
    <Screen>
      <Heading>Create account</Heading>
      <BodyText>{`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`}</BodyText>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
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
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <TextField
        label="Repeat password"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <StatusMessage message={formError} />
      <AppButton label="Create account" onPress={submit} busy={busy} />
      <TextLink label="I already have an account" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}
