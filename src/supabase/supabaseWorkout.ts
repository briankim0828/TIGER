// Legacy Supabase workout sync has been disabled. We now use local SQLite/AsyncStorage only.
import 'react-native-get-random-values';
import { LiveWorkoutSession, StoredWorkoutSession } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function toStoredSession(live: LiveWorkoutSession): StoredWorkoutSession {
  return {
    id: uuidv4(),
    date: live.session_date,
    splitName: live.split_name,
    userId: live.user_id,
    sets: live.sets,
    startTime: live.start_time,
    durationSec: live.duration_sec,
    exercises: live.exercises,
    completed: true,
  };
}

export async function saveSessionToSupabase(_session: StoredWorkoutSession): Promise<void> {
  // No-op: remote sync removed
  console.log('[supabaseWorkout] Remote save disabled; skipping.');
}

export async function fetchSessionsFromSupabase(): Promise<StoredWorkoutSession[]> {
  // No-op: remote sync removed
  console.log('[supabaseWorkout] Remote fetch disabled; returning empty list.');
  return [];
}

export async function clearWorkoutSessionsFromSupabase(): Promise<void> {
  // No-op: remote sync removed
  console.log('[supabaseWorkout] Remote clear disabled; skipping.');
}