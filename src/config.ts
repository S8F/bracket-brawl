// Reads the Supabase address and public key that app.config.ts took from the ".env" file.

import Constants from 'expo-constants';

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

// A value counts as missing if it is empty or still the placeholder text from ".env.example".
function isMissing(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '' || value.includes('YOUR-');
}

// Returns the settings, or null if either one has not been filled in yet.
export function readSupabaseConfig(
  extra: Record<string, unknown> | undefined,
): SupabaseConfig | null {
  const url = extra?.supabaseUrl;
  const publishableKey = extra?.supabasePublishableKey;
  if (isMissing(url) || isMissing(publishableKey)) return null;
  return { url: url as string, publishableKey: publishableKey as string };
}

export const supabaseConfig = readSupabaseConfig(Constants.expoConfig?.extra);
