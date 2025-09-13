export type OutboxOp = 'insert' | 'update' | 'delete';

export type OutboxItem = {
  id: string; // uuid
  table_name: string;
  op: OutboxOp;
  row_id: string; // target row primary key
  payload?: unknown; // row payload for insert/update
  created_at?: string;
  retry_count?: number;
  status?: 'pending' | 'processing' | 'done' | 'failed';
};

// Define dependency-aware pull order to satisfy FK relationships on snapshot import
export const PULL_ORDER: string[] = [
  'exercise_catalog',
  'splits',
  'split_day_assignments',
  'split_exercises',
  'workout_sessions',
  'workout_exercises',
  'workout_sets',
];

// Safe flush order for deletes if we batch by op type later (MVP processes FIFO)
export const DELETE_ORDER: string[] = [
  'workout_sets',
  'workout_exercises',
  'workout_sessions',
  'split_exercises',
  'split_day_assignments',
  'splits',
  'exercise_catalog',
];
