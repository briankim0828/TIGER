import { drizzle } from 'drizzle-orm/expo-sqlite';
import type * as SQLite from 'expo-sqlite';
import { exerciseCatalog } from '../sqlite/schema';
import { generateUUID } from '../../utils/uuid';
import { ensureSlug } from '../../utils/slug';

// Canonical public exercise catalog seeds.
// Fields kept minimal; can be safely extended later.
export interface SeedExerciseSpec {
  name: string;
  modality?: string; // must pass validator later if enforced
  bodyPart?: string | null;
  defaultRestSec?: number;
}

const SEED_EXERCISES: SeedExerciseSpec[] = [
  { name: 'Barbell Bench Press', modality: 'barbell', bodyPart: 'chest' },
  { name: 'Incline Barbell Bench Press', modality: 'barbell', bodyPart: 'chest' },
  { name: 'Dumbbell Bench Press', modality: 'dumbbell', bodyPart: 'chest' },
  { name: 'Barbell Back Squat', modality: 'barbell', bodyPart: 'leg' },
  { name: 'Front Squat', modality: 'barbell', bodyPart: 'leg' },
  { name: 'Romanian Deadlift', modality: 'barbell', bodyPart: 'leg' },
  { name: 'Conventional Deadlift', modality: 'barbell', bodyPart: 'back' },
  { name: 'Barbell Row', modality: 'barbell', bodyPart: 'back' },
  { name: 'Lat Pulldown', modality: 'cable', bodyPart: 'back' },
  { name: 'Pull Up', modality: 'bodyweight', bodyPart: 'back' },
  { name: 'Seated Cable Row', modality: 'cable', bodyPart: 'back' },
  { name: 'Overhead Press', modality: 'barbell', bodyPart: 'shoulder' },
  { name: 'Dumbbell Shoulder Press', modality: 'dumbbell', bodyPart: 'shoulder' },
  { name: 'Lateral Raise', modality: 'dumbbell', bodyPart: 'shoulder' },
  { name: 'Rear Delt Fly', modality: 'dumbbell', bodyPart: 'shoulder' },
  { name: 'Bicep Curl', modality: 'dumbbell', bodyPart: 'biceps' },
  { name: 'Hammer Curl', modality: 'dumbbell', bodyPart: 'biceps' },
  { name: 'Tricep Rope Pushdown', modality: 'cable', bodyPart: 'triceps' },
  { name: 'Skullcrusher', modality: 'barbell', bodyPart: 'triceps' },
  { name: 'Crunch', modality: 'bodyweight', bodyPart: 'core' },
  { name: 'Plank', modality: 'bodyweight', bodyPart: 'core' },
  { name: 'Treadmill Walk', modality: 'bodyweight', bodyPart: 'cardio' },
  { name: 'Stationary Bike', modality: 'bodyweight', bodyPart: 'cardio' },
];

// Meta table name to track seed execution version
const SEED_STATE_TABLE = 'seed_state';
const CATALOG_SEED_KEY = 'exercise_catalog_v1';

async function ensureSeedStateTable(sqlite: SQLite.SQLiteDatabase) {
  await sqlite.execAsync(`CREATE TABLE IF NOT EXISTS ${SEED_STATE_TABLE} (
    key TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);
}

async function isAlreadyApplied(sqlite: SQLite.SQLiteDatabase, key: string): Promise<boolean> {
  const row = await sqlite.getFirstAsync(`SELECT key FROM ${SEED_STATE_TABLE} WHERE key = ?`, [key]);
  return !!row;
}

async function recordApplied(sqlite: SQLite.SQLiteDatabase, key: string) {
  await sqlite.runAsync(`INSERT OR REPLACE INTO ${SEED_STATE_TABLE} (key, applied_at) VALUES (?, CURRENT_TIMESTAMP)`, [key]);
}

export async function seedExerciseCatalog(sqlite: SQLite.SQLiteDatabase, opts?: { force?: boolean; log?: boolean }) {
  await ensureSeedStateTable(sqlite);
  if (!opts?.force) {
    const already = await isAlreadyApplied(sqlite, CATALOG_SEED_KEY);
    if (already) {
      if (opts?.log) console.log('[seed] exercise catalog already applied');
      return { inserted: 0, skipped: SEED_EXERCISES.length };
    }
  }

  const db = drizzle(sqlite as any);
  let inserted = 0;
  for (const spec of SEED_EXERCISES) {
    const slug = ensureSlug({ name: spec.name, isPublic: true });
    const id = generateUUID();
    try {
      await db.insert(exerciseCatalog).values({
        id, // UUID id; slug remains deterministic human key
        name: spec.name,
        slug,
        modality: spec.modality ?? 'bodyweight',
        bodyPart: spec.bodyPart ?? null,
        defaultRestSec: spec.defaultRestSec,
        isPublic: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).onConflictDoNothing({ target: exerciseCatalog.slug }).run();
      inserted += 1;
    } catch (e) {
      // Ignore individual row errors to continue best-effort
      if (opts?.log) console.warn('[seed] insert failed', { name: spec.name, error: String(e) });
    }
  }

  await recordApplied(sqlite, CATALOG_SEED_KEY);
  if (opts?.log) console.log(`[seed] exercise catalog applied: inserted=${inserted}, totalSpecs=${SEED_EXERCISES.length}`);
  return { inserted, skipped: SEED_EXERCISES.length - inserted };
}
