import React, { createContext, useCallback, useContext, useState } from 'react';
import type { ProgramSplit } from '../types/ui';

// New: Workout summary overlay payload
export type WorkoutSummaryExercise = { name: string; setCount: number };
export type WorkoutSummaryPayload = {
  sessionName: string | null;
  note: string | null;
  durationMin: number | null;
  totalVolumeKg: number | null;
  startedAtMs?: number | null;
  startedAtISO?: string | null;
  exercises: WorkoutSummaryExercise[];
};

type SessionSummaryPayload = {
  selectedDate: string | null;
  scheduledSplit: ProgramSplit | null;
  onStartWorkout: () => void;
};

interface OverlayContextValue {
  showSessionSummary: (payload: SessionSummaryPayload) => void;
  hideSessionSummary: () => void;
  sessionSummary: SessionSummaryPayload | null;
  // New: workout summary modal controls
  showWorkoutSummary: (payload: WorkoutSummaryPayload) => void;
  hideWorkoutSummary: () => void;
  workoutSummary: WorkoutSummaryPayload | null;
  liveDebugEnabled: boolean;
  setLiveDebugEnabled: (value: boolean) => void;
}

const OverlayContext = createContext<OverlayContextValue | undefined>(undefined);

export const OverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryPayload | null>(null);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummaryPayload | null>(null);
  const [liveDebugEnabled, setLiveDebugEnabled] = useState<boolean>(false);

  const showSessionSummary = useCallback((payload: SessionSummaryPayload) => {
    setSessionSummary(payload);
  }, []);

  const hideSessionSummary = useCallback(() => {
    setSessionSummary(null);
  }, []);

  const showWorkoutSummary = useCallback((payload: WorkoutSummaryPayload) => {
    setWorkoutSummary(payload);
  }, []);
  const hideWorkoutSummary = useCallback(() => setWorkoutSummary(null), []);

  return (
    <OverlayContext.Provider value={{ showSessionSummary, hideSessionSummary, sessionSummary, showWorkoutSummary, hideWorkoutSummary, workoutSummary, liveDebugEnabled, setLiveDebugEnabled }}>
      {children}
    </OverlayContext.Provider>
  );
};

export const useOverlay = () => {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider');
  return ctx;
};
