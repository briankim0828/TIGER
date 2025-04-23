import React, { createContext, useContext, useState, useCallback } from 'react';
import { LiveWorkoutSession, Exercise, Set } from '../types';
import { supabase } from "../utils/supabaseClient";
import { toStoredSession, saveSessionToSupabase } from '../supabase/supabaseWorkout';
import { dataService } from '../services/data';
import { useData } from './DataContext';
import { Toast } from 'native-base';

interface WorkoutContextType {
  isWorkoutActive: boolean;
  currentWorkoutSession: LiveWorkoutSession | null;
  startWorkout: (exercises: Exercise[], splitId?: string | null) => Promise<void>;
  endWorkout: () => Promise<void>;
  updateSet: (exerciseIndex: number, setIndex: number, updatedSet: Partial<Set>) => void;
  addSet: (exerciseIndex: number) => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);



export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentWorkoutSession, setCurrentWorkoutSession] = useState<LiveWorkoutSession | null>(null);
  const [isSessionSaved, setIsSessionSaved] = useState(false);
  const { addWorkoutSession } = useData();

  const startWorkout = useCallback(async (exercises: Exercise[], splitId: string | null = null) => {
    // Reset the session saved flag when starting a new workout
    setIsSessionSaved(false);
    
    // console.log('WorkoutContext - Starting workout with exercises:', JSON.stringify(exercises, null, 2));
    
    // Get current date in ISO format YYYY-MM-DD
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const dateForId = dateString.replace(/-/g, '');
    
    // Generate sets with the new ID schema
    const allSets: Set[][] = exercises.map((exercise) => {
      // Create sets for this exercise if they don't exist
      if (!exercise.sets || exercise.sets.length === 0) {
        // Default to 1 set per exercise
        return Array(1).fill(null).map((_, setIndex) => ({
          id: `${dateForId}-1-${splitId || 'custom'}-${exercise.name.toLowerCase().replace(/\s+/g, '-')}-${setIndex + 1}`,
          weight: 0,
          reps: 0,
          completed: false
        }));
      } else {
        // Use existing sets but assign new IDs
        return exercise.sets.map((set, setIndex) => ({
          ...set,
          id: `${dateForId}-1-${splitId || 'custom'}-${exercise.name.toLowerCase().replace(/\s+/g, '-')}-${setIndex + 1}`,
          completed: false // Reset completed status
        }));
      }
    });

    const { data: user } = await supabase.auth.getUser();

    // Create a new workout session
    const newWorkoutSession: LiveWorkoutSession = {
      // id: crypto.randomUUID(), // Generate a UUID
      user_id: user?.user?.id || 'current-user', // Use Supabase user ID if available
      session_date: dateString,
      split_id: splitId,
      sets: allSets,
      start_time: new Date().toISOString(),
      duration_sec: 0,
      exercises: exercises.map((exercise, index) => ({
        ...exercise,
        sets: allSets[index]
      }))
    };

    console.log('WorkoutContext - New workout session initialized:', {
      user_id: newWorkoutSession.user_id,
      session_date: newWorkoutSession.session_date,
      split_id: newWorkoutSession.split_id,
      exercises_count: newWorkoutSession.exercises.length,
      sets_count: newWorkoutSession.sets.reduce((acc, curr) => acc + curr.length, 0),
      start_time: newWorkoutSession.start_time
    });

    setCurrentWorkoutSession(newWorkoutSession);
    setIsWorkoutActive(true);

    console.log("workout is active")
    
    // console.log('WorkoutContext - State after start:', {
    //   isWorkoutActive: true,
    //   currentWorkoutSession: newWorkoutSession
    // });
  }, []);

  const updateSet = useCallback((exerciseIndex: number, setIndex: number, updatedSet: Partial<Set>) => {
    if (!currentWorkoutSession) return;

    console.log('WorkoutContext - Updating set:', {
      exerciseIndex,
      setIndex,
      exerciseName: currentWorkoutSession.exercises[exerciseIndex]?.name,
      setId: currentWorkoutSession.sets[exerciseIndex]?.[setIndex]?.id,
      changes: updatedSet
    });

    setCurrentWorkoutSession(prevSession => {
      if (!prevSession) return null;

      // Create deep copies to avoid mutation
      const newSets = [...prevSession.sets];
      const exerciseSets = [...newSets[exerciseIndex]];
      
      // Update the specific set
      exerciseSets[setIndex] = {
        ...exerciseSets[setIndex],
        ...updatedSet
      };
      
      newSets[exerciseIndex] = exerciseSets;
      
      // Update exercises array to reflect set changes
      const newExercises = [...prevSession.exercises];
      newExercises[exerciseIndex] = {
        ...newExercises[exerciseIndex],
        sets: exerciseSets
      };

      return {
        ...prevSession,
        sets: newSets,
        exercises: newExercises
      };
    });
  }, [currentWorkoutSession]);

  const endWorkout = useCallback(async () => {
    console.log('WorkoutContext - Ending workout');
    
    if (!currentWorkoutSession || isSessionSaved) {
      console.log('WorkoutContext - Session already saved or no active session, skipping save');
      
      // Even if we skip saving, make sure all state is reset so the next workout can start
      setIsWorkoutActive(false);
      setCurrentWorkoutSession(null);
      setIsSessionSaved(false);
      return;
    }
    
    // Mark session as saved IMMEDIATELY to prevent any race conditions
    setIsSessionSaved(true);
    
    try {
      // Calculate duration in seconds
      const startTime = new Date(currentWorkoutSession.start_time).getTime();
      const endTime = new Date().getTime();
      const durationSec = Math.floor((endTime - startTime) / 1000);
      
      // Make a local copy of the current workout session to avoid state issues
      const sessionToSave = { ...currentWorkoutSession };
      sessionToSave.duration_sec = durationSec;
      
      // Convert to stored format - this will add a unique ID
      const stored = toStoredSession(sessionToSave);
      
      console.log('WorkoutContext - Saving session with ID:', stored.id);
      
      // Save to both Supabase and local storage
      await Promise.all([
        saveSessionToSupabase(stored),
        dataService.saveWorkoutSession(stored)
      ]);
      
      // Update DataContext
      await addWorkoutSession(stored);
      
      console.log('WorkoutContext - Completed session details:', {
        id: stored.id,
        session_date: sessionToSave.session_date,
        split_id: sessionToSave.split_id,
        user_id: sessionToSave.user_id,
        duration_sec: durationSec,
        exercises_count: sessionToSave.exercises.length,
        completed_sets: sessionToSave.sets.map((exerciseSets, i) => ({
          exercise: sessionToSave.exercises[i]?.name,
          sets_completed: exerciseSets.filter(set => set.completed).length,
          total_sets: exerciseSets.length,
          completion_percentage: `${Math.round((exerciseSets.filter(set => set.completed).length / exerciseSets.length) * 100)}%`
        }))
      });
      
      // Show success toast
      Toast.show({
        title: "Workout Saved",
        description: "Your workout has been saved successfully!",
        duration: 3000
      });
    } catch (error) {
      console.error('Error saving workout:', error);
      
      Toast.show({
        title: "Error Saving Workout",
        description: "There was an error saving your workout. Please try again.",
        duration: 3000
      });
    } finally {
      // ALWAYS reset state variables regardless of success or failure
      console.log('WorkoutContext - Resetting workout state');
      setIsWorkoutActive(false);
      setCurrentWorkoutSession(null);
      setIsSessionSaved(false);
    }
  }, [currentWorkoutSession, addWorkoutSession, isSessionSaved]);

  const addSet = useCallback((exerciseIndex: number) => {
    if (!currentWorkoutSession) return;
    
    console.log('WorkoutContext - Adding set to exercise:', {
      exerciseIndex,
      exerciseName: currentWorkoutSession.exercises[exerciseIndex]?.name
    });

    setCurrentWorkoutSession(prevSession => {
      if (!prevSession) return null;

      // Get the exercise for which we're adding a set
      const exercise = prevSession.exercises[exerciseIndex];
      if (!exercise) return prevSession;
      
      // Generate a new set ID based on the existing pattern
      const today = new Date();
      const dateString = today.toISOString().split('T')[0].replace(/-/g, '');
      const lastSetIndex = prevSession.sets[exerciseIndex].length;
      const newSetId = `${dateString}-1-${prevSession.split_id || 'custom'}-${exercise.name.toLowerCase().replace(/\s+/g, '-')}-${lastSetIndex + 1}`;
      
      // Create the new set
      const newSet: Set = {
        id: newSetId,
        weight: 0,
        reps: 0,
        completed: false
      };
      
      // Create deep copies to avoid mutation
      const newSets = [...prevSession.sets];
      const exerciseSets = [...newSets[exerciseIndex], newSet];
      newSets[exerciseIndex] = exerciseSets;
      
      // Update exercises array to reflect set changes
      const newExercises = [...prevSession.exercises];
      newExercises[exerciseIndex] = {
        ...newExercises[exerciseIndex],
        sets: exerciseSets
      };

      return {
        ...prevSession,
        sets: newSets,
        exercises: newExercises
      };
    });
  }, [currentWorkoutSession]);

  // Reset flags on component mount/unmount
  React.useEffect(() => {
    return () => {
      setIsSessionSaved(false);
    };
  }, []);

  // Log state changes
  React.useEffect(() => {
    console.log('WorkoutContext - State updated:', {
      isWorkoutActive,
      sessionExists: currentWorkoutSession !== null,
      isSessionSaved,
      session_date: currentWorkoutSession?.session_date || 'N/A',
      exercises_count: currentWorkoutSession?.exercises.length || 0,
    });
  }, [isWorkoutActive, currentWorkoutSession, isSessionSaved]);

  return (
    <WorkoutContext.Provider
      value={{
        isWorkoutActive,
        currentWorkoutSession,
        startWorkout,
        endWorkout,
        updateSet,
        addSet
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
};

export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (context === undefined) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
}; 