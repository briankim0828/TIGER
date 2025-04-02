import AsyncStorage from '@react-native-async-storage/async-storage';
import { Split, Exercise } from '../types';

// Storage keys
const STORAGE_KEYS = {
  SPLITS: 'splits',
  DEFAULT_WORKOUT_STATE: 'default_workout_state',
  SPLIT_EXERCISES: (splitId: string) => `split_exercises_${splitId}`,
  WORKOUT_SESSIONS: 'workout_sessions',
} as const;

interface WorkoutSession {
  date: string;
  completed: boolean;
}

class StorageService {
  // Splits
  async getSplits(): Promise<Split[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SPLITS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting splits:', error);
      return [];
    }
  }

  async saveSplits(splits: Split[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SPLITS, JSON.stringify(splits));
    } catch (error) {
      console.error('Error saving splits:', error);
    }
  }

  // Default Workout State
  async getDefaultWorkoutState(): Promise<Split[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_WORKOUT_STATE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting default workout state:', error);
      return [];
    }
  }

  async saveDefaultWorkoutState(splits: Split[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_WORKOUT_STATE, JSON.stringify(splits));
    } catch (error) {
      console.error('Error saving default workout state:', error);
    }
  }

  // Split Exercises
  async getSplitExercises(splitId: string): Promise<Exercise[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SPLIT_EXERCISES(splitId));
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting split exercises:', error);
      return [];
    }
  }

  async saveSplitExercises(splitId: string, exercises: Exercise[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SPLIT_EXERCISES(splitId), JSON.stringify(exercises));
    } catch (error) {
      console.error('Error saving split exercises:', error);
    }
  }

  // Workout Sessions
  async getWorkoutSessions(): Promise<WorkoutSession[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting workout sessions:', error);
      return [];
    }
  }

  async saveWorkoutSessions(sessions: WorkoutSession[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving workout sessions:', error);
    }
  }

  // Clear all data (useful for testing or resetting the app)
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

export const storageService = new StorageService(); 