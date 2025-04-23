import React, { createContext, useContext, useState, useCallback } from 'react';
import { Exercise, Set } from '../types';
import { supabase } from "../utils/supabaseClient";

// Matches the SQL schema
interface WorkoutSession {
  // id: string; // uuid
  user_id: string; // uuid
  session_date: string; // date in ISO format (YYYY-MM-DD)
  split_id: string | null; // uuid
  sets: Set[][]; // JSON - array of arrays of sets (one array per exercise)
  start_time: string; // time with timezone
  duration_sec: number | null;
  exercises: Exercise[]; // Not in DB schema but needed for UI
}

interface WorkoutContextType {
  isWorkoutActive: boolean;
  currentWorkoutSession: WorkoutSession | null;
  startWorkout: (exercises: Exercise[], splitId?: string | null) => Promise<void>;
  endWorkout: () => void;
  updateSet: (exerciseIndex: number, setIndex: number, updatedSet: Partial<Set>) => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);



export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentWorkoutSession, setCurrentWorkoutSession] = useState<WorkoutSession | null>(null);

  const startWorkout = useCallback(async (exercises: Exercise[], splitId: string | null = null) => {
    // console.log('WorkoutContext - Starting workout with exercises:', JSON.stringify(exercises, null, 2));
    
    // Get current date in ISO format YYYY-MM-DD
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const dateForId = dateString.replace(/-/g, '');
    
    // Generate sets with the new ID schema
    const allSets: Set[][] = exercises.map((exercise) => {
      // Create sets for this exercise if they don't exist
      if (!exercise.sets || exercise.sets.length === 0) {
        // Default to 3 sets per exercise
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
    const newWorkoutSession: WorkoutSession = {
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

  const endWorkout = useCallback(() => {
    console.log('WorkoutContext - Ending workout');
    if (currentWorkoutSession) {
      // Calculate duration in seconds
      const startTime = new Date(currentWorkoutSession.start_time).getTime();
      const endTime = new Date().getTime();
      const durationSec = Math.floor((endTime - startTime) / 1000);
      
      const completedSession = {
        ...currentWorkoutSession,
        duration_sec: durationSec
      };
      
      console.log('WorkoutContext - Completed session details:', {
        session_date: completedSession.session_date,
        split_id: completedSession.split_id,
        user_id: completedSession.user_id,
        duration_sec: durationSec,
        exercises_count: completedSession.exercises.length,
        completed_sets: completedSession.sets.map((exerciseSets, i) => ({
          exercise: completedSession.exercises[i]?.name,
          sets_completed: exerciseSets.filter(set => set.completed).length,
          total_sets: exerciseSets.length,
          completion_percentage: `${Math.round((exerciseSets.filter(set => set.completed).length / exerciseSets.length) * 100)}%`
        }))
      });
      // Here you would normally save the workout session to the database
    }
    
    setIsWorkoutActive(false);
    setCurrentWorkoutSession(null);
    
    // console.log('WorkoutContext - State after end:', {
    //   isWorkoutActive: false,
    //   currentWorkoutSession: null
    // });
  }, [currentWorkoutSession]);

  // Log state changes
  React.useEffect(() => {
    console.log('WorkoutContext - State updated:', {
      isWorkoutActive,
      currentWorkoutSession
    });
  }, [isWorkoutActive, currentWorkoutSession]);

  return (
    <WorkoutContext.Provider
      value={{
        isWorkoutActive,
        currentWorkoutSession,
        startWorkout,
        endWorkout,
        updateSet
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