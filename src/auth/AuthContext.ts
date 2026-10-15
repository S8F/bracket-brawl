// The shared "who is logged in" information that every screen can read through useAuth().

import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export interface AuthState {
  // True until the saved login (if any) has been read from the phone.
  loading: boolean;
  session: Session | null;
  // True while the user came from a "reset password" email and still has to pick a new password.
  recovering: boolean;
  // Message from a broken email link, shown once on the login screen.
  linkError: string | null;
  clearLinkError: () => void;
  finishRecovery: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
