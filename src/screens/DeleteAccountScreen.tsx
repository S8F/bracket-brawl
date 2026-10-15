// Permanently deletes the login and all of the user's data, after an "are you sure" step.

import { useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { deleteAccount } from '../auth/authService';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { Screen } from '../components/Screen';
import { StatusMessage } from '../components/StatusMessage';
import { getClient } from '../lib/supabase';
import type { SignedInStackParams } from '../navigation/types';

export function DeleteAccountScreen({
  navigation,
}: NativeStackScreenProps<SignedInStackParams, 'DeleteAccount'>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reallyDelete = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteAccount(getClient());
    setBusy(false);
    // On success the login is gone, so the app returns to the login screen by itself.
    if (!result.ok) setError(result.message);
  };

  const confirm = () =>
    Alert.alert('Delete your account?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: () => void reallyDelete() },
    ]);

  return (
    <Screen>
      <Heading>Delete account</Heading>
      <BodyText>
        This permanently deletes your login and all your tournaments and players. It cannot be
        undone.
      </BodyText>
      <StatusMessage message={error} />
      <AppButton label="Delete my account" variant="danger" onPress={confirm} busy={busy} />
      <AppButton
        label="Cancel"
        variant="secondary"
        onPress={() => navigation.goBack()}
        disabled={busy}
      />
    </Screen>
  );
}
