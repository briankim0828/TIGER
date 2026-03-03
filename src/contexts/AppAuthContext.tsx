import React, { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppAuthMode } from '../auth/mode';

export type AppAuthContextValue = {
  mode: AppAuthMode;
  isGuest: boolean;
  user: User | null;
  effectiveUserId: string | null;
  guestDisplayName: string;
  continueAsGuest: (displayName: string) => Promise<void>;
  exitGuestMode: () => Promise<void>;
};

const AppAuthContext = createContext<AppAuthContextValue | undefined>(undefined);

export function AppAuthProvider({ value, children }: { value: AppAuthContextValue; children: React.ReactNode }) {
  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export function useAppAuth() {
  const context = useContext(AppAuthContext);
  if (!context) {
    throw new Error('useAppAuth must be used within AppAuthProvider');
  }
  return context;
}
