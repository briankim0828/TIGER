import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Exercise, 
  Split, 
  WorkoutSession, 
  WorkoutDay,
  BodyPartSectionData,
  DEFAULT_EXERCISES_BY_BODY_PART
} from '../types';

// Storage keys
const STORAGE_KEYS = {
  SPLITS: 'splits',
  EXERCISES: 'exercises',
  WORKOUT_SESSIONS: 'workout_sessions',
  DEFAULT_WORKOUT_STATE: 'default_workout_state',
} as const;

class DataService {
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
      throw error;
    }
  }

  // Exercises
  async getExercises(): Promise<Exercise[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
      const exercises = data ? JSON.parse(data) : [];
      
      // If no exercises exist, initialize with defaults
      if (exercises.length === 0) {
        await this.initializeDefaultExercises();
        return this.getExercises();
      }
      
      return exercises;
    } catch (error) {
      console.error('Error getting exercises:', error);
      return [];
    }
  }

  async saveExercises(exercises: Exercise[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
    } catch (error) {
      console.error('Error saving exercises:', error);
      throw error;
    }
  }
  
  async initializeDefaultExercises(): Promise<void> {
    try {
      // Convert default exercises to proper Exercise objects with splitIds
      const allDefaultExercises: Exercise[] = [];
      
      Object.keys(DEFAULT_EXERCISES_BY_BODY_PART).forEach(bodyPart => {
        DEFAULT_EXERCISES_BY_BODY_PART[bodyPart].forEach(ex => {
          allDefaultExercises.push({
            ...ex,
            splitIds: []
          });
        });
      });
      
      await this.saveExercises(allDefaultExercises);
    } catch (error) {
      console.error('Error initializing default exercises:', error);
      throw error;
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

  async saveWorkoutSession(session: WorkoutSession): Promise<void> {
    try {
      const sessions = await this.getWorkoutSessions();
      const updatedSessions = [...sessions, session];
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_SESSIONS, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Error saving workout session:', error);
      throw error;
    }
  }

  // Workout Days (for calendar)
  async getWorkoutDays(): Promise<WorkoutDay[]> {
    try {
      const sessions = await this.getWorkoutSessions();
      return sessions.map(session => ({
        date: session.date,
        completed: session.completed,
        splitId: session.splitId
      }));
    } catch (error) {
      console.error('Error getting workout days:', error);
      return [];
    }
  }

  // Body Part Sections
  async getBodyPartSections(): Promise<BodyPartSectionData[]> {
    try {
      const exercises = await this.getExercises();
      const sections = exercises.reduce((acc, exercise) => {
        const existingSection = acc.find(s => s.bodyPart === exercise.bodyPart);
        if (existingSection) {
          existingSection.exercises.push(exercise);
        } else {
          acc.push({
            id: exercise.bodyPart,
            bodyPart: exercise.bodyPart,
            exercises: [exercise]
          });
        }
        return acc;
      }, [] as BodyPartSectionData[]);
      return sections;
    } catch (error) {
      console.error('Error getting body part sections:', error);
      return [];
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
      throw error;
    }
  }
}

export const dataService = new DataService(); 