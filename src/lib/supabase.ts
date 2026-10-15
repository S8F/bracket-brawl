// Creates the one Supabase client the whole app shares. Uses only the public (publishable) key.
// Rows are protected by the database's row-level security rules, not by hiding this key.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config';

// Null until ".env" is filled in; the app then shows a setup screen instead of crashing.
export const supabase: SupabaseClient | null = supabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        storage: AsyncStorage, // keeps the user logged in after the app is closed
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // we read email links ourselves (see authLinks.ts)
        flowType: 'pkce',
      },
    })
  : null;

// For screens that only exist once the app is set up (App.tsx shows the setup screen otherwise).
export function getClient(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured. Fill in .env (see .env.example).');
  return supabase;
}
