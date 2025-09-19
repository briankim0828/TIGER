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
export const fetchUserProfileFromSupabase = async (_userId: string): Promise<UserProfile | null> => {
  // Profiles table no longer exists; return null to avoid errors.
  // console.log('[supabaseProfile] profiles table removed; skipping remote fetch.');
  return null;
};

/**
 * Updates the avatar_id in the user's profile.
 */
export const updateUserProfileAvatar = async (_userId: string, _avatarId: string): Promise<UserProfile | null> => {
  // Profiles table removed; there's nothing to update remotely.
  console.log('[supabaseProfile] update avatar skipped; profiles table removed.');
  return null;
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

// Workout stats & history deletion now handled locally via Drizzle (see useWorkoutHistory).