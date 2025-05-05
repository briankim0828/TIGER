import React, { createContext, useContext, useState, useCallback } from 'react';
import { LiveWorkoutSession, Exercise, Set } from '../types';
import { supabase } from "../utils/supabaseClient";
import { toStoredSession, saveSessionToSupabase } from '../supabase/supabaseWorkout';
import { dataService } from '../services/data';
import { useData } from './DataContext';
import { Toast } from 'native-base';
import { v4 as uuidv4 } from 'uuid';

interface WorkoutContextType {
  isWorkoutActive: boolean;
  currentWorkoutSession: LiveWorkoutSession | null;
  startWorkout: (exercises: Exercise[], selectedDate: string, splitName?: string | null) => Promise<void>;
  endWorkout: () => Promise<void>;
  discardWorkout: () => void;
  updateSet: (exerciseIndex: number, setIndex: number, updatedSet: Partial<Set>) => void;
  addSet: (exerciseIndex: number) => void;
  addExercisesToCurrentSession: (exercisesToAdd: Exercise[]) => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentWorkoutSession, setCurrentWorkoutSession] = useState<LiveWorkoutSession | null>(null);
  const [isSessionSaved, setIsSessionSaved] = useState(false);
  const { addWorkoutSession } = useData();

  const startWorkout = useCallback(async (exercises: Exercise[], selectedDate: string, splitName: string | null = null) => {
    setIsSessionSaved(false);

    const dateString = selectedDate;
    const dateForId = dateString.replace(/-/g, '');

    console.log(`WorkoutContext - Starting workout for date: ${dateString}`);

    const allSets: Set[][] = exercises.map((exercise) => {
      if (!exercise.sets || exercise.sets.length === 0) {
        return Array(1).fill(null).map((_, setIndex) => ({
          id: `${dateForId}-1-${splitName || 'custom'}-${exercise.name.toLowerCase().replace(/\s+/g, '-')}-${setIndex + 1}`,
          weight: 0,
          reps: 0,
          completed: false
        }));
      } else {
        return exercise.sets.map((set, setIndex) => ({
          ...set,
          id: `${dateForId}-1-${splitName || 'custom'}-${exercise.name.toLowerCase().replace(/\s+/g, '-')}-${setIndex + 1}`,
          completed: false
        }));
      }
    });

    const { data: user } = await supabase.auth.getUser();

    const newWorkoutSession: LiveWorkoutSession = {
      user_id: user?.user?.id || 'current-user',
      session_date: dateString,
      split_name: splitName,
      sets: allSets,
      start_time: new Date().toISOString(),
      duration_sec: 0,
      exercises: exercises.map((exercise, index) => ({
        ...exercise,
        sets: allSets[index]
      }))
    };

    console.log('WorkoutContext - Created new workout session:', {
      date: newWorkoutSession.session_date,
      split_name: newWorkoutSession.split_name,
      exercises: newWorkoutSession.exercises.length
    });

    setCurrentWorkoutSession(newWorkoutSession);
    setIsWorkoutActive(true);
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
      
      // console.log('WorkoutContext - Completed session details:', {
      //   id: stored.id,
      //   session_date: sessionToSave.session_date,
      //   split_id: sessionToSave.split_id,
      //   user_id: sessionToSave.user_id,
      //   duration_sec: durationSec,
      //   exercises_count: sessionToSave.exercises.length,
      //   completed_sets: sessionToSave.sets.map((exerciseSets, i) => ({
      //     exercise: sessionToSave.exercises[i]?.name,
      //     sets_completed: exerciseSets.filter(set => set.completed).length,
      //     total_sets: exerciseSets.length,
      //     completion_percentage: `${Math.round((exerciseSets.filter(set => set.completed).length / exerciseSets.length) * 100)}%`
      //   }))
      // });
      
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

  // Function to discard the current workout without saving
  const discardWorkout = useCallback(() => {
    console.log('WorkoutContext - Discarding current workout');
    setIsWorkoutActive(false);
    setCurrentWorkoutSession(null);
    setIsSessionSaved(false); // Ensure this is reset too
  }, []);

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
      const newSetId = `${dateString}-1-${prevSession.split_name || 'custom'}-${exercise.name.toLowerCase().replace(/\s+/g, '-')}-${lastSetIndex + 1}`;
      
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

  const addExercisesToCurrentSession = useCallback((exercisesToAdd: Exercise[]) => {
    setCurrentWorkoutSession(prevSession => {
      if (!prevSession) return null;

      console.log('WorkoutContext - Adding exercises to current session:', exercisesToAdd.map(ex => ex.name));

      const newExercisesForSession: Exercise[] = [];
      const newSetArraysForSession: Set[][] = [];

      // Get necessary info for the ID schema from the current session
      const dateForId = prevSession.session_date.replace(/-/g, '');
      const splitNameForId = prevSession.split_name || 'custom';

      exercisesToAdd.forEach(exercise => {
        // Check if exercise already exists in the session
        const alreadyExists = prevSession.exercises.some(ex => ex.id === exercise.id);
        if (!alreadyExists) {
          // Construct the set ID based on the schema
          const exerciseNameForId = exercise.name.toLowerCase().replace(/\s+/g, '-');
          const initialSetIndex = 1; // This is the first set for this exercise
          const newSetId = `${dateForId}-1-${splitNameForId}-${exerciseNameForId}-${initialSetIndex}`;

          // Initialize one default set for the new exercise using the schema ID
          const defaultSet: Set = {
            id: newSetId, // Use the constructed ID
            weight: 0,
            reps: 0,
            completed: false,
          };
          const initialSetsForExercise = [defaultSet];
          newSetArraysForSession.push(initialSetsForExercise);

          // Add the exercise itself, including the reference to its sets
          newExercisesForSession.push({
            ...exercise,
            sets: initialSetsForExercise, // Add sets to the exercise object
          });
        } else {
          console.log(`WorkoutContext - Exercise "${exercise.name}" already in session, skipping.`);
        }
      });

      if (newExercisesForSession.length === 0) {
          console.log('WorkoutContext - No new exercises to add.');
          return prevSession; // No changes if all selected exercises already exist
      }

      // Combine existing and new exercises/sets
      const updatedExercises = [...prevSession.exercises, ...newExercisesForSession];
      const updatedSets = [...prevSession.sets, ...newSetArraysForSession];

      console.log('WorkoutContext - Session updated with new exercises.');

      return {
        ...prevSession,
        exercises: updatedExercises,
        sets: updatedSets,
      };
    });
  }, []);

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

  const value = {
    isWorkoutActive,
    currentWorkoutSession,
    startWorkout,
    endWorkout,
    discardWorkout,
    updateSet,
    addSet,
    addExercisesToCurrentSession,
  };

  return (
    <WorkoutContext.Provider value={value}>
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