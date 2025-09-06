// Simple data access layer for local SQLite database
import * as SQLite from 'expo-sqlite';
import { useMemo } from 'react';
import { SimpleDataAccess } from './simple';
import { ProgramBuilderDataAccess } from './programBuilder.drizzle';
import { WorkoutsDataAccess } from './workouts.drizzle';
import { WorkoutHistoryDataAccess } from './workoutHistory.drizzle';

// Hook to access database from the Electric context
import { useElectric } from '../../electric';

export function useDatabase() {
  const { db, isInitialized } = useElectric();
  if (!db) {
    if (!isInitialized) {
      // Surface a predictable placeholder; caller can guard via isInitialized if needed
      throw new Error('Database not initialized.');
    }
    throw new Error('Database failed to initialize.');
  }
  return useMemo(() => new ProgramBuilderDataAccess(db), [db]);
}

// Export the SimpleDataAccess class for direct use
export { SimpleDataAccess, ProgramBuilderDataAccess, WorkoutsDataAccess };

// Dedicated hook for workouts access (kept separate to avoid mixing concerns)
export function useWorkouts() {
  const { db, isInitialized, live } = useElectric();
  if (!db) {
    if (!isInitialized) throw new Error('Database not initialized.');
    throw new Error('Database failed to initialize.');
  }
  return useMemo(() => {
    const inst = new WorkoutsDataAccess(db);
    // Inject live notifier so writes can bump table versions
    if (live?.bump) inst.setLiveNotifier(live.bump);
    return inst;
  }, [db, live?.bump]);
}

// History & stats (read‑only helpers) hook
export function useWorkoutHistory() {
  const { db, isInitialized } = useElectric();
  if (!db) {
    if (!isInitialized) throw new Error('Database not initialized.');
    throw new Error('Database failed to initialize.');
  }
  return useMemo(() => new WorkoutHistoryDataAccess(db), [db]);
}
