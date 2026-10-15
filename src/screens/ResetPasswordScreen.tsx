// Shown after the user taps the reset link in the email: pick a new password.

import { useState } from 'react';
import { updatePassword } from '../auth/authService';
import { useAuth } from '../auth/AuthContext';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { Screen } from '../components/Screen';
import { StatusMessage } from '../components/StatusMessage';
import { TextField } from '../components/TextField';
import { getClient } from '../lib/supabase';
import { MIN_PASSWORD_LENGTH, validatePassword, validatePasswordMatch } from '../lib/validation';

export function ResetPasswordScreen() {
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError(null);
    const next = {
      password: validatePassword(password),
      confirm: validatePasswordMatch(password, confirm),
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setBusy(true);
    const result = await updatePassword(getClient(), password);
    setBusy(false);
    if (result.ok)
      finishRecovery(); // the user is already logged in, so the home screen opens
    else setFormError(result.message);
  };

  return (
    <Screen>
      <Heading>New password</Heading>
      <BodyText>{`Pick a new password. Use at least ${MIN_PASSWORD_LENGTH} characters.`}</BodyText>
      <TextField
        label="New password"
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
        label="Repeat new password"
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
      <AppButton label="Save new password" onPress={submit} busy={busy} />
    </Screen>
  );
}
