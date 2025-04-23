import 'react-native-get-random-values';
import { LiveWorkoutSession, StoredWorkoutSession } from '../types';
import { supabase } from '../utils/supabaseClient';
import { isUuid } from '../utils/ids';
import { v4 as uuidv4 } from 'uuid';

/**
 * Converts a LiveWorkoutSession to a StoredWorkoutSession
 */
export function toStoredSession(live: LiveWorkoutSession): StoredWorkoutSession {
  return {
    id: uuidv4(),
    date: live.session_date,
    splitId: live.split_id,
    userId: live.user_id,
    sets: live.sets,
    startTime: live.start_time,
    durationSec: live.duration_sec,
    exercises: live.exercises,
    completed: true
  };
}

/**
 * Format ISO timestamp to a PostgreSQL-compatible timestamp
 * This fixes the "invalid input syntax for type time with time zone" error
 */
function formatTimestamp(isoTimestamp: string): string {
  try {
    // Convert ISO string to a PostgreSQL-compatible timestamp format
    const date = new Date(isoTimestamp);
    return date.toISOString().replace('T', ' ').replace('Z', '+00');
  } catch (error) {
    console.warn('Error formatting timestamp:', error);
    // Return a safe default format
    return new Date().toISOString().replace('T', ' ').replace('Z', '+00');
  }
}

/**
 * Saves a workout session to the Supabase database
 */
export async function saveSessionToSupabase(session: StoredWorkoutSession): Promise<void> {
  // Validate the split_id is a proper UUID, set to null if not
  let splitId = session.splitId;
  if (splitId && !isUuid(splitId)) {
    console.warn(`Split ID "${splitId}" is not a valid UUID, setting to null for Supabase compatibility`);
    splitId = null;
  }

  // Ensure we have a valid ID for the session
  const sessionId = session.id || uuidv4();

  try {
    console.log('[DEBUG] Saving session to Supabase:', { 
      id: sessionId,
      date: session.date, 
      splitId,
      exercises: session.exercises.length
    });
    
    const { error } = await supabase
      .from('workout_sessions')
      .insert({
        id: sessionId,
        user_id: session.userId,
        session_date: session.date,
        split_id: splitId,
        sets: session.sets,
        start_time: formatTimestamp(session.startTime),
        duration_sec: session.durationSec
      });

    if (error) {
      console.error('Error saving workout session to Supabase:', error);
      throw error;
    }
    
    console.log('[DEBUG] Successfully saved session to Supabase');
  } catch (error) {
    console.error('Failed to save session to Supabase:', error);
    throw error;
  }
}

/**
 * Fetches all workout sessions for the current user from Supabase
 */
export async function fetchSessionsFromSupabase(): Promise<StoredWorkoutSession[]> {
  try {
    const { data: currentUser } = await supabase.auth.getUser();
    
    if (!currentUser?.user?.id) {
      console.error('No authenticated user found');
      return [];
    }
    
    console.log('[DEBUG] Fetching workout sessions for user:', currentUser.user.id);
    
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', currentUser.user.id);
      
    if (error) {
      console.error('Error fetching workout sessions from Supabase:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('[DEBUG] No workout sessions found in Supabase');
      return [];
    }
    
    console.log(`[DEBUG] Found ${data.length} workout sessions in Supabase`);
    
    // Convert from snake_case DB columns to camelCase for StoredWorkoutSession
    return data.map(item => ({
      id: item.id,
      userId: item.user_id,
      date: item.session_date,
      splitId: item.split_id,
      sets: item.sets,
      startTime: item.start_time,
      durationSec: item.duration_sec,
      exercises: item.exercises || [], // Handle potential null/undefined
      completed: true
    }));
  } catch (error) {
    console.error('Failed to fetch sessions from Supabase:', error);
    return [];
  }
}

/**
 * Deletes all workout sessions for the current user from Supabase
 */
export async function clearWorkoutSessionsFromSupabase(): Promise<void> {
  try {
    const { data: currentUser } = await supabase.auth.getUser();
    
    if (!currentUser?.user?.id) {
      console.error('No authenticated user found');
      return;
    }
    
    console.log('[DEBUG] Clearing all workout sessions for user:', currentUser.user.id);
    
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('user_id', currentUser.user.id);
      
    if (error) {
      console.error('Error deleting workout sessions from Supabase:', error);
      throw error;
    }
    
    console.log('[DEBUG] Successfully cleared all workout sessions from Supabase');
  } catch (error) {
    console.error('Failed to clear sessions from Supabase:', error);
    throw error;
  }
} 