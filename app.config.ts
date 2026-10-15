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
  },
  extra: {
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
  },
};

export default config;
