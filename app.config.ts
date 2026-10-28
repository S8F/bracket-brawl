// Expo app settings. Reads the Supabase address and public key from the local
// ".env" file (see ".env.example"). Nothing secret belongs in this file.
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Bracket Brawl',
  slug: 'bracket-brawl',
  version: '1.0.0',
  platforms: ['ios'], // Android is out of scope for v1
  scheme: 'bracketbrawl', // lets email links open the app
  orientation: 'portrait',
  icon: './assets/icon.png', // placeholder icon; the real icon is a later task
  userInterfaceStyle: 'dark',
  ios: {
    supportsTablet: false, // iPhone only: iPad support is switched off
    bundleIdentifier: 'com.saief.bracketbrawl',
    infoPlist: {
      // Only standard Apple encryption (web connections) is used: no yearly US export report needed.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: [
    [
      'expo-build-properties',
      {
        // Xcode 27 / iOS 27 SDK apps must use the UIKit scene life cycle or they crash at launch
        // ("UIScene life cycle is required for apps built with this SDK"). Expo SDK 57.0.23+ ships
        // this as opt-in. Not needed from SDK 58 on (it is the default there); remove it then.
        ios: { enableSceneSupport: true },
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
    eas: { projectId: '1af561cd-b1a0-4af7-ab4b-5d2b8b26219f' }, // Expo project (account s8fii)
  },
};

export default config;
