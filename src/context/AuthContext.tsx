import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as auth from '@/lib/auth';
import type { User } from '@/lib/auth';

interface AuthValue {
  user: User | null;
  signIn: (i: { email: string; password: string }) => Promise<void>;
  signUp: (i: { name: string; email: string; password: string }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => auth.currentUser());

  // Re-verify the stored token with the server; a revoked or expired session signs the user out.
  useEffect(() => { auth.restoreSession().then(setUser); }, []);

  const signIn = useCallback(async (i: { email: string; password: string }) => setUser(await auth.signIn(i)), []);
  const signUp = useCallback(async (i: { name: string; email: string; password: string }) => setUser(await auth.signUp(i)), []);
  const signOut = useCallback(() => { auth.signOut(); setUser(null); }, []);

  const value = useMemo(() => ({ user, signIn, signUp, signOut }), [user, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
