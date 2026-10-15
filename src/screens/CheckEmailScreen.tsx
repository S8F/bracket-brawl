// Shown after sign-up: tells the user to click the link in the confirmation email before logging in.

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { Screen } from '../components/Screen';
import type { SignedOutStackParams } from '../navigation/types';

export function CheckEmailScreen({
  route,
  navigation,
}: NativeStackScreenProps<SignedOutStackParams, 'CheckEmail'>) {
  return (
    <Screen>
      <Heading>Check your email</Heading>
      <BodyText>
        {`We sent a link to ${route.params.email}. Tap the link to confirm your account, then log in. Look in spam if you do not see it.`}
      </BodyText>
      <AppButton label="Go to log in" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}
