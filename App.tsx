// App entry: wraps everything in the login state and the screen navigator.

import { Archivo_400Regular, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { SairaCondensed_700Bold } from '@expo-google-fonts/saira-condensed';
import { SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  // Wait for the three fonts. If one fails to load, carry on with the phone's normal font.
  const [loaded, error] = useFonts({
    SairaCondensed_700Bold,
    Archivo_400Regular,
    Archivo_700Bold,
    SpaceMono_700Bold,
  });
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
