import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dataService } from '../services/data';
import { 
  Exercise, 
  Split, 
  WorkoutSession, 
  WorkoutDay,
  BodyPartSectionData 
} from '../types';

interface DataContextType {
  splits: Split[];
  exercises: Exercise[];
  workoutSessions: WorkoutSession[];
  workoutDays: WorkoutDay[];
  bodyPartSections: BodyPartSectionData[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  updateSplits: (splits: Split[]) => Promise<void>;
  updateExercises: (exercises: Exercise[]) => Promise<void>;
  addWorkoutSession: (session: WorkoutSession) => Promise<void>;
  saveDefaultWorkoutState: (splits: Split[]) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [splits, setSplits] = useState<Split[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutSessions, setWorkoutSessions] = useState<WorkoutSession[]>([]);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [bodyPartSections, setBodyPartSections] = useState<BodyPartSectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        splitsData,
        exercisesData,
        sessionsData,
        sectionsData
      ] = await Promise.all([
        dataService.getSplits(),
        dataService.getExercises(),
        dataService.getWorkoutSessions(),
        dataService.getBodyPartSections()
      ]);

      setSplits(splitsData);
      setExercises(exercisesData);
      setWorkoutSessions(sessionsData);
      setWorkoutDays(sessionsData.map(session => ({
        date: session.date,
        completed: session.completed,
        splitId: session.splitId
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

  const addWorkoutSession = useCallback(async (session: WorkoutSession) => {
    try {
      await dataService.saveWorkoutSession(session);
      setWorkoutSessions(prev => [...prev, session]);
      setWorkoutDays(prev => [...prev, {
        date: session.date,
        completed: session.completed,
        splitId: session.splitId
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
        saveDefaultWorkoutState
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