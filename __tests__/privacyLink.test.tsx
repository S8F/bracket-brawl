// Checks that the "Privacy Policy" button on the login, sign-up and settings screens each
// open exactly the real privacy policy address in the phone's web browser.

import type { ComponentProps, ReactElement } from 'react';
import * as Linking from 'expo-linking';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AuthContext, type AuthState } from '../src/auth/AuthContext';
import { LoginScreen } from '../src/screens/LoginScreen';
import { SignUpScreen } from '../src/screens/SignUpScreen';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { fakeNavigation, screenProps } from './helpers/screenSetup';

jest.mock('expo-linking', () => ({ openURL: jest.fn(() => Promise.resolve(true)) }));
jest.mock('../src/lib/supabase', () => ({ getClient: () => ({}) }));

const EXPECTED_URL = 'https://s8f.github.io/bracket-brawl-privacy/';

const auth: AuthState = {
  loading: false,
  session: null,
  recovering: false,
  linkError: null,
  clearLinkError: jest.fn(),
  finishRecovery: jest.fn(),
};

async function pressPrivacyPolicy(ui: ReactElement) {
  await render(<AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>);
  fireEvent.press(screen.getByLabelText('Privacy Policy'));
}

beforeEach(() => {
  (Linking.openURL as jest.Mock).mockClear();
});

describe('privacy policy buttons', () => {
  it('login screen opens the privacy policy address', async () => {
    await pressPrivacyPolicy(
      <LoginScreen
        {...screenProps<ComponentProps<typeof LoginScreen>>({
          navigation: fakeNavigation(),
          route: {},
        })}
      />,
    );
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(EXPECTED_URL);
  });

  it('settings screen opens the privacy policy address', async () => {
    await pressPrivacyPolicy(
      <SettingsScreen
        {...screenProps<ComponentProps<typeof SettingsScreen>>({
          navigation: fakeNavigation(),
          route: {},
        })}
      />,
    );
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(EXPECTED_URL);
  });

  it('sign-up screen opens the privacy policy address', async () => {
    await pressPrivacyPolicy(
      <SignUpScreen
        {...screenProps<ComponentProps<typeof SignUpScreen>>({
          navigation: fakeNavigation(),
          route: {},
        })}
      />,
    );
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(EXPECTED_URL);
  });
});
