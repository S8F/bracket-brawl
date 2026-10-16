// Asks for an email address and sends a password-reset link to it.

import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset } from '../auth/authService';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { Screen } from '../components/Screen';
import { StatusMessage } from '../components/StatusMessage';
import { TextField } from '../components/TextField';
import { TextLink } from '../components/TextLink';
import { authRedirectUrl } from '../lib/authLinks';
import { getClient } from '../lib/supabase';
import { validateEmail } from '../lib/validation';
import type { SignedOutStackParams } from '../navigation/types';
import { colors, fonts } from '../theme';

export function ForgotPasswordScreen({
  navigation,
}: NativeStackScreenProps<SignedOutStackParams, 'ForgotPassword'>) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError(null);
    const problem = validateEmail(email);
    setEmailError(problem);
    if (problem) return;
    setBusy(true);
    const result = await requestPasswordReset(getClient(), email, authRedirectUrl());
    setBusy(false);
    if (result.ok) setSent(true);
    else setFormError(result.message);
  };

  return (
    <Screen>
      <Heading>Forgot password</Heading>
      <BodyText>Enter your email and we will send you a link to pick a new password.</BodyText>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <StatusMessage message={formError} />
      {/* Same wording whether or not the email has an account, so strangers cannot probe who is registered. */}
      <StatusMessage
        kind="info"
        message={sent ? 'If that email has an account, a reset link is on its way.' : null}
      />
      {sent ? (
        <Text style={styles.spamHint}>{"Didn't get it? Check your spam folder."}</Text>
      ) : null}
      <AppButton label="Send reset link" onPress={submit} busy={busy} />
      <TextLink label="Back to log in" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spamHint: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
});
