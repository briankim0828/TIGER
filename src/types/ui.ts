// Import foundational primitive types/constants
import { WeekDay } from "./base";

// UI types used by Program Builder screens

// A lightweight split shape for the Program/Splits UIs backed by the local DB
export type ProgramSplit = {
  id: string;
  name: string;
  color?: string;
  // Days assigned in the weekly program (e.g., 'Mon'...'Sun')
  days: WeekDay[];
  // Number of exercises assigned to this split (for display)
  exerciseCount: number;
};

// Shared edit mode for Program Builder
export type ProgramEditMode = "none" | "program" | "splits";

// Lightweight exercise shape used by Program Builder lists
export type ProgramExerciseLite = {
  id: string;
  name: string;
  bodyPart: string; // group label; use DB bodyPart if present, else modality/"Uncategorized"
};

// Split shape enriched with exercises for the MyExercises component
export type ProgramSplitWithExercises = ProgramSplit & {
  exercises: ProgramExerciseLite[];
};

// Calendar entry used by Progress & calendar UI
export type WorkoutCalendarEntry = {
  date: string;      // YYYY-MM-DD
  completed: boolean;
};
