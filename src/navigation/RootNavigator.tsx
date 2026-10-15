// Picks which set of screens to show: loading, setup-needed, new password, signed in, or signed out.

import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { supabaseConfig } from '../config';
import { CheckEmailScreen } from '../screens/CheckEmailScreen';
import { ConfigMissingScreen } from '../screens/ConfigMissingScreen';
import { CreateTournamentScreen } from '../screens/CreateTournamentScreen';
import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoadingScreen } from '../screens/LoadingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PlayersScreen } from '../screens/PlayersScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { TournamentScreen } from '../screens/TournamentScreen';
import { colors } from '../theme';
import type { SignedInStackParams, SignedOutStackParams } from './types';

const SignedOut = createNativeStackNavigator<SignedOutStackParams>();
const SignedIn = createNativeStackNavigator<SignedInStackParams>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
  },
};

const headerOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerBackButtonDisplayMode: 'minimal' as const,
};

export function RootNavigator() {
  const { loading, session, recovering } = useAuth();

  if (!supabaseConfig) return <ConfigMissingScreen />;
  if (loading) return <LoadingScreen />;
  // Someone who tapped a reset link is technically logged in, but must pick a new password first.
  if (session && recovering) return <ResetPasswordScreen />;

  return (
    <NavigationContainer theme={theme}>
      {session ? (
        <SignedIn.Navigator screenOptions={headerOptions}>
          <SignedIn.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Bracket Brawl' }}
          />
          <SignedIn.Screen name="Players" component={PlayersScreen} />
          <SignedIn.Screen
            name="CreateTournament"
            component={CreateTournamentScreen}
            options={{ title: 'New tournament' }}
          />
          <SignedIn.Screen name="Tournament" component={TournamentScreen} />
          <SignedIn.Screen name="Settings" component={SettingsScreen} />
          <SignedIn.Screen
            name="DeleteAccount"
            component={DeleteAccountScreen}
            options={{ title: 'Delete account' }}
          />
        </SignedIn.Navigator>
      ) : (
        <SignedOut.Navigator screenOptions={{ ...headerOptions, headerShown: false }}>
          <SignedOut.Screen name="Login" component={LoginScreen} />
          <SignedOut.Screen name="SignUp" component={SignUpScreen} />
          <SignedOut.Screen name="CheckEmail" component={CheckEmailScreen} />
          <SignedOut.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </SignedOut.Navigator>
      )}
    </NavigationContainer>
  );
}
