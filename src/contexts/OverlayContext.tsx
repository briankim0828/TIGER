import React, { createContext, useCallback, useContext, useState } from 'react';
import type { ProgramSplit } from '../types/ui';

type SessionSummaryPayload = {
  selectedDate: string | null;
  scheduledSplit: ProgramSplit | null;
  onStartWorkout: () => void;
};

interface OverlayContextValue {
  showSessionSummary: (payload: SessionSummaryPayload) => void;
  hideSessionSummary: () => void;
  sessionSummary: SessionSummaryPayload | null;
  liveDebugEnabled: boolean;
  setLiveDebugEnabled: (value: boolean) => void;
}

const OverlayContext = createContext<OverlayContextValue | undefined>(undefined);

export const OverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryPayload | null>(null);
  const [liveDebugEnabled, setLiveDebugEnabled] = useState<boolean>(false);

  const showSessionSummary = useCallback((payload: SessionSummaryPayload) => {
    setSessionSummary(payload);
  }, []);

  const hideSessionSummary = useCallback(() => setSessionSummary(null), []);

  return (
    <OverlayContext.Provider value={{ showSessionSummary, hideSessionSummary, sessionSummary, liveDebugEnabled, setLiveDebugEnabled }}>
      {children}
    </OverlayContext.Provider>
  );
};

export const useOverlay = () => {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider');
  return ctx;
};
