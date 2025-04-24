import { supabase } from '../utils/supabaseClient';
import { User } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';

// Interface for profile data from profiles table
export interface UserProfile {
  user_id: string;
  email: string;
  display_name: string;
  avatar_id: string | null;
  updated_at: string;
}

// --- User Authentication ---

/**
 * Fetches the currently authenticated user.
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
};

/**
 * Signs out the current user.
 */
export const signOutUser = async (): Promise<{ error: any | null }> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error signing out user:', error);
    return { error };
  }
};

// --- User Profile ---

/**
 * Fetches the user profile data from the 'profiles' table.
 */
export const fetchUserProfileFromSupabase = async (userId: string): Promise<UserProfile | null> => {
  if (!userId) return null;
  try {
    console.log('Supabase: Fetching user profile for:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Supabase: Error fetching user profile:', error);
      return null;
    }
    if (data) {
      console.log('Supabase: Profile data retrieved:', data);
      return data as UserProfile;
    } else {
      console.log('Supabase: No profile found for user');
      return null;
    }
  } catch (error) {
    console.error('Supabase: Exception fetching user profile:', error);
    return null;
  }
};

/**
 * Updates the avatar_id in the user's profile.
 */
export const updateUserProfileAvatar = async (userId: string, avatarId: string): Promise<UserProfile | null> => {
  try {
    const { data: updatedProfile, error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        avatar_id: avatarId, // Store the file path
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (profileUpdateError) {
      console.error('Supabase: Profile update error:', profileUpdateError);
      throw profileUpdateError;
    }
    console.log('Supabase: Profile updated with new avatar_id:', updatedProfile);
    return updatedProfile;
  } catch (error) {
    console.error('Supabase: Error updating profile avatar:', error);
    return null;
  }
};

// --- Avatar Storage ---

/**
 * Gets the public URL for an avatar from Supabase Storage.
 * Adds a timestamp for cache busting.
 */
export const getAvatarPublicUrl = (avatarPath: string): string | null => {
  if (!avatarPath) return null;
  try {
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatarPath);

    // Add timestamp as cache buster
    const timestamp = new Date().getTime();
    return `${publicUrl}?t=${timestamp}`;
  } catch (error) {
    console.error('Supabase: Error getting public URL for avatar:', error);
    return null;
  }
};

/**
 * Uploads an avatar image to Supabase Storage.
 */
export const uploadAvatar = async (
  userId: string,
  imageUri: string,
  base64Data: string
): Promise<{ filePath: string; publicUrl: string } | null> => {
  try {
    const fileExt = imageUri.split('.').pop();
    const timestamp = Date.now();
    const filePath = `${userId}_${timestamp}.${fileExt}`;

    if (!base64Data) throw new Error('No base64 data found for upload');

    const arrayBuffer = decode(base64Data);
    console.log('Supabase: Uploading avatar to path:', filePath);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        contentType: `image/${fileExt}`,
        cacheControl: 'no-cache, no-store, must-revalidate'
      });

    if (uploadError) {
      console.error('Supabase: Upload error details:', uploadError);
      throw uploadError;
    }
    console.log('Supabase: Upload success:', uploadData);

    const publicUrl = getAvatarPublicUrl(filePath);
    if (!publicUrl) {
        throw new Error("Failed to get public URL after upload");
    }

    return { filePath, publicUrl };

  } catch (error) {
    console.error('Supabase: Error uploading avatar:', error);
    return null;
  }
};

// --- Workout Stats ---

/**
 * Fetches workout session statistics for a user.
 */
export const fetchUserWorkoutStats = async (userId: string): Promise<{ totalWorkouts: number; hoursTrained: number } | null> => {
  if (!userId) return null;
  try {
    const { data: sessions, error } = await supabase
      .from('workout_sessions')
      .select('duration_sec')
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase: Error fetching workout sessions:', error);
      return null;
    }

    if (sessions) {
      return {
        totalWorkouts: sessions.length,
        hoursTrained: sessions.reduce((acc, session) => acc + (session.duration_sec || 0), 0)
      };
    }
    return { totalWorkouts: 0, hoursTrained: 0 }; // Return zero stats if no sessions
  } catch (error) {
    console.error('Supabase: Exception fetching workout stats:', error);
    return null;
  }
};

/**
 * Deletes all workout sessions for a given user.
 */
export const deleteWorkoutSessions = async (userId: string): Promise<{ error: any | null }> => {
  if (!userId) {
    return { error: new Error('User ID is required to delete sessions') };
  }
  try {
    console.log('Supabase: Deleting workout sessions for user:', userId);
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase: Error deleting workout sessions:', error);
      throw error;
    }
    console.log('Supabase: Successfully deleted workout sessions.');
    return { error: null };
  } catch (error) {
    return { error };
  }
}; 