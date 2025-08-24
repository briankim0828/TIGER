import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dataService } from '../services/data';
import { 
  Exercise, 
  Split, 
  StoredWorkoutSession, 
  WorkoutDay,
  BodyPartSectionData 
} from '../types';
// Legacy Supabase sync disabled
import { isUuid } from '../utils/ids';

interface DataContextType {
  splits: Split[];
  exercises: Exercise[];
  workoutSessions: StoredWorkoutSession[];
  workoutDays: WorkoutDay[];
  bodyPartSections: BodyPartSectionData[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  updateSplits: (splits: Split[]) => Promise<void>;
  updateExercises: (exercises: Exercise[]) => Promise<void>;
  addWorkoutSession: (session: StoredWorkoutSession) => Promise<void>;
  saveDefaultWorkoutState: (splits: Split[]) => Promise<void>;
  getSplitExercises: (splitId: string) => Promise<Exercise[]>;
  saveSplitExercises: (splitId: string, exercises: Exercise[]) => Promise<void>;
  clearStorage: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [splits, setSplits] = useState<Split[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutSessions, setWorkoutSessions] = useState<StoredWorkoutSession[]>([]);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [bodyPartSections, setBodyPartSections] = useState<BodyPartSectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // First load local data for fallback
      const [
        splitsData,
        exercisesData,
        localSessionsData,
        sectionsData
      ] = await Promise.all([
        dataService.getSplits(),
        dataService.getExercises(),
        dataService.getWorkoutSessions(),
        dataService.getBodyPartSections()
      ]);

      // Remote Supabase sync removed; use local data only
      setSplits(splitsData);
      setExercises(exercisesData);
      setWorkoutSessions(localSessionsData);
      setWorkoutDays(localSessionsData.map(session => ({
        date: session.date,
        completed: session.completed,
        splitId: undefined,
      })));
      setBodyPartSections(sectionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const updateSplits = useCallback(async (newSplits: Split[]) => {
    try {
      await dataService.saveSplits(newSplits);
      setSplits(newSplits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update splits');
      throw err;
    }
  }, []);

  const updateExercises = useCallback(async (newExercises: Exercise[]) => {
    try {
      await dataService.saveExercises(newExercises);
      setExercises(newExercises);
      const sections = await dataService.getBodyPartSections();
      setBodyPartSections(sections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update exercises');
      throw err;
    }
  }, []);

  const addWorkoutSession = useCallback(async (session: StoredWorkoutSession) => {
    try {
      await dataService.saveWorkoutSession(session);
      setWorkoutSessions(prev => [...prev, session]);
      setWorkoutDays(prev => [...prev, {
        date: session.date,
        completed: session.completed,
        splitId: undefined,
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add workout session');
      throw err;
    }
  }, []);

  const saveDefaultWorkoutState = useCallback(async (newSplits: Split[]) => {
    try {
      await dataService.saveDefaultWorkoutState(newSplits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save default workout state');
      throw err;
    }
  }, []);

  const getSplitExercises = useCallback(async (splitId: string) => {
    try {
      return await dataService.getSplitExercises(splitId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get split exercises');
      throw err;
    }
  }, []);

  const saveSplitExercises = useCallback(async (splitId: string, exercises: Exercise[]) => {
    try {
      await dataService.saveSplitExercises(splitId, exercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save split exercises');
      throw err;
    }
  }, []);

  const clearStorage = useCallback(async () => {
    try {
      // First clear local storage
      await dataService.clearAll();
      
      // Refresh data to update state with empty storage
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear storage');
      throw err;
    }
  }, [refreshData]);

  return (
    <DataContext.Provider
      value={{
        splits,
        exercises,
        workoutSessions,
        workoutDays,
        bodyPartSections,
        loading,
        error,
        refreshData,
        updateSplits,
        updateExercises,
        addWorkoutSession,
        saveDefaultWorkoutState,
        getSplitExercises,
        saveSplitExercises,
        clearStorage
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}; 