import React, { createContext, useContext, useState, useCallback } from 'react';
import { Exercise } from '../types';

interface WorkoutContextType {
  isWorkoutActive: boolean;
  workoutExercises: Exercise[];
  startWorkout: (exercises: Exercise[]) => void;
  endWorkout: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [workoutExercises, setWorkoutExercises] = useState<Exercise[]>([]);

  const startWorkout = useCallback((exercises: Exercise[]) => {
    console.log('WorkoutContext - Starting workout with exercises:', JSON.stringify(exercises, null, 2));
    setWorkoutExercises(exercises);
    setIsWorkoutActive(true);
    console.log('WorkoutContext - State after start:', {
      isWorkoutActive: true,
      workoutExercises: exercises
    });
  }, []);

  const endWorkout = useCallback(() => {
    console.log('WorkoutContext - Ending workout');
    setIsWorkoutActive(false);
    setWorkoutExercises([]);
    console.log('WorkoutContext - State after end:', {
      isWorkoutActive: false,
      workoutExercises: []
    });
  }, []);

  // Log state changes
  React.useEffect(() => {
    console.log('WorkoutContext - State updated:', {
      isWorkoutActive,
      workoutExercises
    });
  }, [isWorkoutActive, workoutExercises]);

  return (
    <WorkoutContext.Provider
      value={{
        isWorkoutActive,
        workoutExercises,
        startWorkout,
        endWorkout
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