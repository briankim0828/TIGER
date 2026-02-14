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
  // Active workout modal controls
  activeWorkoutModalVisible: boolean;
  setActiveWorkoutModalVisible: (visible: boolean) => void;
  // Global signal: bump to indicate workout history changed (e.g., finished workout)
  workoutDataVersion: number;
  bumpWorkoutDataVersion: () => void;
  liveDebugEnabled: boolean;
  setLiveDebugEnabled: (value: boolean) => void;
}

const OverlayContext = createContext<OverlayContextValue | undefined>(undefined);

export const OverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryPayload | null>(null);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummaryPayload | null>(null);
  const [workoutDataVersion, setWorkoutDataVersion] = useState<number>(0);
  const [liveDebugEnabled, setLiveDebugEnabled] = useState<boolean>(false);
  const [activeWorkoutModalVisible, setActiveWorkoutModalVisible] = useState<boolean>(false);

  const showSessionSummary = useCallback((payload: SessionSummaryPayload) => {
    setSessionSummary(payload);
  }, []);

  const hideSessionSummary = useCallback(() => {
    setSessionSummary(null);
  }, []);

  const showWorkoutSummary = useCallback((payload: WorkoutSummaryPayload) => {
    setWorkoutSummary(payload);
  }, []);
  const hideWorkoutSummary = useCallback(() => {
    setWorkoutSummary(null);
    setWorkoutDataVersion((v) => v + 1);
  }, []);

  const bumpWorkoutDataVersion = useCallback(() => {
    setWorkoutDataVersion((v) => v + 1);
  }, []);

  return (
    <OverlayContext.Provider value={{ showSessionSummary, hideSessionSummary, sessionSummary, showWorkoutSummary, hideWorkoutSummary, workoutSummary, workoutDataVersion, bumpWorkoutDataVersion, liveDebugEnabled, setLiveDebugEnabled, activeWorkoutModalVisible, setActiveWorkoutModalVisible }}>
      {children}
    </OverlayContext.Provider>
  );
};

export const useOverlay = () => {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider');
  return ctx;
};
