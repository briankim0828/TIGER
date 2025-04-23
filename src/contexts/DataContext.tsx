import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dataService } from '../services/data';
import { 
  Exercise, 
  Split, 
  StoredWorkoutSession, 
  WorkoutDay,
  BodyPartSectionData 
} from '../types';
import { fetchSessionsFromSupabase, clearWorkoutSessionsFromSupabase } from '../supabase/supabaseWorkout';
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

      // Immediately fetch remote data from Supabase - this is now the source of truth
      try {
        const remoteSessionsData = await fetchSessionsFromSupabase();
        console.log('[DEBUG] Remote sessions from Supabase:', remoteSessionsData.length);
        console.log('[DEBUG] Local sessions in AsyncStorage:', localSessionsData.length);
        
        // If Supabase returned data, use it as the source of truth
        if (remoteSessionsData.length > 0) {
          // Clean up remote data (handle non-UUID split IDs)
          const cleanedRemoteData = remoteSessionsData.map(session => {
            if (session.splitId && !isUuid(session.splitId)) {
              console.warn(`Remote session ${session.date} has non-UUID splitId: "${session.splitId}". Treating as null.`);
              return { ...session, splitId: null };
            }
            return session;
          });
          
          console.log('[DEBUG] Using Supabase as source of truth for workout history');
          
          // Update local storage to match Supabase
          await dataService.saveWorkoutSessions(cleanedRemoteData);
          
          // Update state with cleaned remote data
          setWorkoutSessions(cleanedRemoteData);
          setWorkoutDays(cleanedRemoteData.map(session => ({
            date: session.date,
            completed: session.completed,
            splitId: session.splitId === null ? undefined : session.splitId
          })));
        } else {
          // If Supabase has no data but local storage does, use local
          console.log('[DEBUG] No remote sessions found in Supabase, using local data');
          setWorkoutSessions(localSessionsData);
          setWorkoutDays(localSessionsData.map(session => ({
            date: session.date,
            completed: session.completed,
            splitId: session.splitId === null ? undefined : session.splitId
          })));
        }
        
        // Always update the other data
        setSplits(splitsData);
        setExercises(exercisesData);
        setBodyPartSections(sectionsData);
      } catch (syncError) {
        console.error('Error syncing with Supabase:', syncError);
        
        // If sync fails, still load local data as fallback
        console.log('[DEBUG] Supabase sync failed, falling back to local data');
        setSplits(splitsData);
        setExercises(exercisesData);
        setWorkoutSessions(localSessionsData);
        setWorkoutDays(localSessionsData.map(session => ({
          date: session.date,
          completed: session.completed,
          splitId: session.splitId === null ? undefined : session.splitId
        })));
        setBodyPartSections(sectionsData);
      }
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
        splitId: session.splitId === null ? undefined : session.splitId
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
      
      // Then clear remote Supabase data
      try {
        await clearWorkoutSessionsFromSupabase();
        console.log('[DEBUG] Successfully cleared both local and Supabase data');
      } catch (supabaseError) {
        console.error('Failed to clear Supabase data:', supabaseError);
        // Continue even if Supabase clear fails
      }
      
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