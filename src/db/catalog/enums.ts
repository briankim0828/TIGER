// Consolidated modality enum (merged former kind+modality semantics)
export const EXERCISE_MODALITIES = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'smith',
  'cable',
  'bodyweight',
] as const;
export type ExerciseModality = typeof EXERCISE_MODALITIES[number];
export const isValidModality = (m: string): m is ExerciseModality => EXERCISE_MODALITIES.includes(m as ExerciseModality);

// Body part enum (broad groupings)
export const BODY_PARTS = [
  'chest','back','leg','shoulder','triceps','biceps','core','forearm','cardio'
] as const;
export type BodyPart = typeof BODY_PARTS[number];
export const isValidBodyPart = (b: string): b is BodyPart => BODY_PARTS.includes(b as BodyPart);
