export interface Exercise {
  id: string;
  name: string;
  sets: Set[];
  notes?: string;
}

export interface Set {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface WorkoutDay {
  date: string;
  exercises: Exercise[];
  completed: boolean;
}

export interface MonthData {
  month: number;
  year: number;
  workouts: WorkoutDay[];
} 