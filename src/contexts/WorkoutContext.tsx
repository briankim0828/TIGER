import React, { createContext, useContext, useMemo } from 'react';
import { useWorkouts } from '../db/queries';
import type { WorkoutSetRow, SessionExerciseJoin } from '../db/queries/workouts.drizzle';

// Policy for handling an existing active session when starting a workout
export type StartPolicy = 'resumeIfActive' | 'endExistingThenStart';

export interface WorkoutContextType {
  // Core operations (DB-backed)
  startWorkout: (
    userId: string,
    splitId?: string | null,
    opts?: { policy?: StartPolicy; fromSplitExerciseIds?: string[] }
  ) => Promise<{ sessionId: string; resumed: boolean }>;
  endWorkout: (sessionId: string, opts?: { status?: 'completed' | 'cancelled' }) => Promise<boolean>;
  addSet: (
    sessionExerciseId: string,
    data: { weightKg?: number | null; reps?: number | null; durationSec?: number | null; distanceM?: number | null; restSec?: number | null; isWarmup?: boolean | null }
  ) => Promise<WorkoutSetRow>;
  updateSet: (
    setId: string,
    patch: Partial<Pick<WorkoutSetRow, 'weightKg' | 'reps' | 'durationSec' | 'distanceM' | 'restSec' | 'isWarmup' | 'isCompleted'>>
  ) => Promise<boolean>;
  deleteSet: (setId: string) => Promise<boolean>;
  addExerciseToSession: (sessionId: string, exerciseId: string) => Promise<{ id: string }>;
  removeExerciseFromSession: (sessionExerciseId: string) => Promise<boolean>;
  reorderSessionExercises: (sessionId: string, nextIds: string[]) => Promise<boolean>;

  // Helpers
  getActiveSessionId: (userId: string) => Promise<string | null>;
  getSessionSnapshot: (
    sessionId: string
  ) => Promise<{ exercises: SessionExerciseJoin[]; setsByExercise: Record<string, WorkoutSetRow[]> }>;
  deleteWorkout: (sessionId: string) => Promise<boolean>;
  getSplitName: (splitId: string) => Promise<string | null>;
  getSessionInfo: (sessionId: string) => Promise<{ id: string; userId: string; splitId: string | null; state: string; startedAt: string | null; finishedAt: string | null } | null>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const workouts = useWorkouts();

  const api = useMemo<WorkoutContextType>(() => ({
    startWorkout: async (userId, splitId = null, opts) => {
      console.debug('[WorkoutContext] startWorkout called', { userId, splitId, opts });
      const policy: StartPolicy = opts?.policy ?? 'resumeIfActive';
      const active = await workouts.getActiveWorkoutSession(userId);
      if (active && policy === 'resumeIfActive') {
        console.debug('[WorkoutContext] resuming existing active session', { sessionId: active.id });
        return { sessionId: active.id, resumed: true };
      }
      if (active && policy === 'endExistingThenStart') {
        console.debug('[WorkoutContext] ending existing session before starting new', { sessionId: active.id });
        await workouts.endWorkout(active.id, { status: 'completed' });
      }
      const { sessionId } = await workouts.startWorkout({ userId, splitId, fromSplitExerciseIds: opts?.fromSplitExerciseIds });
      console.debug('[WorkoutContext] new session started', { sessionId });
      return { sessionId, resumed: false };
    },
    endWorkout: (sessionId, opts) => workouts.endWorkout(sessionId, opts),
    addSet: (sessionExerciseId, data) => workouts.addSet(sessionExerciseId, data),
    updateSet: (setId, patch) => workouts.updateSet(setId, patch),
    deleteSet: (setId) => workouts.deleteSet(setId),
    addExerciseToSession: (sessionId, exerciseId) => workouts.addExerciseToSession(sessionId, exerciseId),
    removeExerciseFromSession: (sessionExerciseId) => workouts.removeExerciseFromSession(sessionExerciseId),
    reorderSessionExercises: (sessionId, nextIds) => workouts.reorderSessionExercises(sessionId, nextIds),
    getActiveSessionId: async (userId) => {
      const s = await workouts.getActiveWorkoutSession(userId);
      return s?.id ?? null;
    },
    getSessionSnapshot: async (sessionId) => {
  console.debug('[WorkoutContext] getSessionSnapshot', { sessionId });
      const exercises = await workouts.getSessionExercises(sessionId);
      const setsByExercise: Record<string, WorkoutSetRow[]> = {};
      for (const ex of exercises) {
        setsByExercise[ex.sessionExerciseId] = await workouts.getSetsForSessionExercise(ex.sessionExerciseId);
      }
  console.debug('[WorkoutContext] getSessionSnapshot completed', { exCount: exercises.length });
      return { exercises, setsByExercise };
    },
  deleteWorkout: (sessionId) => workouts.deleteWorkout(sessionId),
  getSplitName: (splitId) => workouts.getSplitName(splitId),
  getSessionInfo: (sessionId) => workouts.getSessionInfo(sessionId),
  }), [workouts]);

  return <WorkoutContext.Provider value={api}>{children}</WorkoutContext.Provider>;
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within a WorkoutProvider');
  return ctx;
}