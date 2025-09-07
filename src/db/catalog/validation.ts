import { EXERCISE_MODALITIES, isValidModality, ExerciseModality, BODY_PARTS, isValidBodyPart, BodyPart } from './enums';

export interface RawExerciseInput {
  name: string;
  modality?: string | null;
  bodyPart?: string | null;
  defaultRestSec?: number | null;
  slug?: string | null; // optional pre-specified (e.g., seed)
}

export interface NormalizedExerciseInput {
  name: string;
  modality: ExerciseModality;
  bodyPart?: BodyPart | null;
  defaultRestSec?: number;
  slug?: string; // final slug (generation handled elsewhere)
}

export function normalizeModality(value?: string | null): ExerciseModality {
  if (!value) return 'bodyweight';
  const lower = value.toLowerCase().trim();
  return isValidModality(lower) ? lower : 'bodyweight';
}

export function normalizeBodyPart(value?: string | null): BodyPart | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  return isValidBodyPart(lower) ? lower : null;
}

export function normalizeExerciseInput(raw: RawExerciseInput): NormalizedExerciseInput {
  return {
    name: raw.name.trim(),
  modality: normalizeModality(raw.modality),
  defaultRestSec: raw.defaultRestSec ?? undefined,
  bodyPart: normalizeBodyPart(raw.bodyPart) ?? null,
    slug: raw.slug?.trim() || undefined,
  };
}

export const ALLOWED_MODALITIES = EXERCISE_MODALITIES;
export const ALLOWED_BODY_PARTS = BODY_PARTS;
