// Keeps the login state up to date: reads the saved login on start, follows sign-in / sign-out,
// and handles email links (confirm email, reset password) that open the app.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { parseAuthLink } from '../lib/authLinks';
import { exchangeEmailCode } from './authService';
import { AuthContext, type AuthState } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabase !== null);
  const [recovering, setRecovering] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Follow login changes from Supabase.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Supabase's advice for phones: refresh the login only while the app is on screen.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  // Handle email links, both when the app was closed (initial URL) and already open.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const handle = async (url: string | null) => {
      const link = parseAuthLink(url);
      if (link.kind === 'error') setLinkError(link.message);
      if (link.kind === 'code') {
        const result = await exchangeEmailCode(client, link.code);
        if (!result.ok) setLinkError(result.message);
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (event) => void handle(event.url));
    return () => sub.remove();
  }, []);

  const clearLinkError = useCallback(() => setLinkError(null), []);
  const finishRecovery = useCallback(() => setRecovering(false), []);

  const value = useMemo<AuthState>(
    () => ({ loading, session, recovering, linkError, clearLinkError, finishRecovery }),
    [loading, session, recovering, linkError, clearLinkError, finishRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
