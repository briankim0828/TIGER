import { useMemo } from 'react';
import { useLiveQuery } from '../../electric';
import { useWorkouts } from '../queries';
import type { WorkoutSessionRow, WorkoutSetRow, SessionExerciseJoin } from '../queries/workouts.drizzle';

// Live: latest active session for a user
export function useLiveActiveSession(userId: string) {
  const workouts = useWorkouts();
  const { data, loading, isLive } = useLiveQuery<WorkoutSessionRow | null>(
    async () => {
      if (!userId) return null;
      return await workouts.getActiveWorkoutSession(userId);
    },
    { watchTables: ['workout_sessions'], deps: [userId] }
  );
  return { session: data ?? null, loading, isLive } as const;
}

// Live: session exercises (joined with exercise details), ordered by order_pos
export function useLiveSessionExercises(sessionId: string | null) {
  const workouts = useWorkouts();
  const { data, loading, isLive } = useLiveQuery<SessionExerciseJoin[]>(
    async () => {
      if (!sessionId) return [];
      return await workouts.getSessionExercises(sessionId);
    },
    { watchTables: ['workout_exercises', 'exercise_catalog'], deps: [sessionId] }
  );
  return { exercises: data ?? [], loading, isLive } as const;
}

// Live: sets map for a given list of sessionExerciseIds
export function useLiveSetsForExercises(sessionExerciseIds: string[]) {
  const workouts = useWorkouts();
  const key = useMemo(() => (sessionExerciseIds && sessionExerciseIds.length > 0 ? sessionExerciseIds.join(',') : ''), [sessionExerciseIds]);

  const { data, loading, isLive } = useLiveQuery<Record<string, WorkoutSetRow[]>>(
    async () => {
      const map: Record<string, WorkoutSetRow[]> = {};
      if (!sessionExerciseIds || sessionExerciseIds.length === 0) return map;
      // Fetch sequentially to keep runtime small; can be parallelized if needed
      for (const id of sessionExerciseIds) {
        map[id] = await workouts.getSetsForSessionExercise(id);
      }
      return map;
    },
    { watchTables: ['workout_sets'], deps: [key] }
  );
  return { setsByExercise: data ?? {}, loading, isLive } as const;
}

// Live: composed snapshot matching getSessionSnapshot shape
export function useLiveSessionSnapshot(sessionId: string | null) {
  const workouts = useWorkouts();
  const { data, loading, isLive } = useLiveQuery<{
    exercises: SessionExerciseJoin[];
    setsByExercise: Record<string, WorkoutSetRow[]>;
  }>(
    async () => {
      if (!sessionId) return { exercises: [], setsByExercise: {} };
      const exercises = await workouts.getSessionExercises(sessionId);
      const setsByExercise: Record<string, WorkoutSetRow[]> = {};
      for (const ex of exercises) {
        setsByExercise[ex.sessionExerciseId] = await workouts.getSetsForSessionExercise(ex.sessionExerciseId);
      }
      return { exercises, setsByExercise };
    },
    { watchTables: ['workout_exercises', 'workout_sets', 'exercise_catalog'], deps: [sessionId] }
  );
  return { snapshot: data ?? { exercises: [], setsByExercise: {} }, loading, isLive } as const;
}
