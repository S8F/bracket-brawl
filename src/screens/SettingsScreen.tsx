// Account settings: shows who is logged in, log out, and the way to delete the account.

import { useState } from 'react';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signOut } from '../auth/authService';
import { useAuth } from '../auth/AuthContext';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { Screen } from '../components/Screen';
import { StatusMessage } from '../components/StatusMessage';
import { PRIVACY_POLICY_URL } from '../lib/privacyPolicy';
import { getClient } from '../lib/supabase';
import type { SignedInStackParams } from '../navigation/types';

export function SettingsScreen({
  navigation,
}: NativeStackScreenProps<SignedInStackParams, 'Settings'>) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logOut = async () => {
    setBusy(true);
    setError(null);
    const result = await signOut(getClient());
    setBusy(false);
    if (!result.ok) setError(result.message);
  };

  return (
    <Screen>
      <Heading>Settings</Heading>
      <BodyText>{`Logged in as ${session?.user.email ?? 'unknown'}`}</BodyText>
      <StatusMessage message={error} />
      <AppButton label="Log out" variant="secondary" onPress={logOut} busy={busy} />
      <AppButton
        label="Privacy Policy"
        variant="secondary"
        onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        hint="Opens the privacy policy in your web browser"
      />
      <AppButton
        label="Delete my account"
        variant="danger"
        onPress={() => navigation.navigate('DeleteAccount')}
        hint="Opens a screen where you can permanently delete your account"
      />
    </Screen>
  );
}
