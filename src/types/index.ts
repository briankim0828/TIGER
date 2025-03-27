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