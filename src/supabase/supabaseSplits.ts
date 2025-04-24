import { supabase } from '../utils/supabaseClient';
import { Split } from '../types';

/**
 * Fetches the splits data for the current authenticated user from Supabase.
 * Returns the splits array or null if not found or an error occurs.
 */
export const getUserSplitsFromSupabase = async (): Promise<Split[] | null> => {
  try {
    const { data: userResponse } = await supabase.auth.getUser();
    if (!userResponse?.user?.id) {
      console.error("getUserSplitsFromSupabase: No authenticated user found.");
      return null;
    }
    const userId = userResponse.user.id;

    console.log(`[Supabase] Fetching splits for user: ${userId}`);
    const { data, error } = await supabase
      .from("splits")
      .select("splits") // Select only the 'splits' column which contains the array
      .eq("user_id", userId)
      .single(); // Expecting one row per user

    if (error) {
      // Handle case where no row exists for the user yet (common on first load)
      if (error.code === 'PGRST116') {
         console.log(`[Supabase] No splits found for user ${userId}. Returning empty array.`);
         return []; // Return empty array if no record found
      }
      console.error("[Supabase] Error fetching splits:", error);
      return null;
    }

    // The 'splits' column directly contains the array
    if (data && data.splits && Array.isArray(data.splits)) {
       console.log(`[Supabase] Successfully fetched ${data.splits.length} splits for user ${userId}.`);
       return data.splits as Split[];
    } else {
       console.warn(`[Supabase] Fetched data is not in the expected format or is empty for user ${userId}. Returning empty array. Data:`, data);
       return []; // Return empty array if data is not as expected
    }

  } catch (err) {
    console.error("[Supabase] Unexpected error in getUserSplitsFromSupabase:", err);
    return null;
  }
};

/**
 * Saves the provided splits array to Supabase for the current authenticated user.
 * Uses upsert to create or update the user's single splits record.
 * Relies on database defaults for 'id', 'user_id' (on insert), and 'updated_at'.
 */
export const saveSplitsToSupabase = async (splits: Split[]): Promise<boolean> => {
  try {
    const { data: userResponse } = await supabase.auth.getUser();
    if (!userResponse?.user?.id) {
      console.error("saveSplitsToSupabase: No authenticated user found.");
      return false;
    }
    const userId = userResponse.user.id;

    console.log(`[Supabase] Saving/Updating ${splits.length} splits for user: ${userId}`);

    // Data object only contains what needs to be set/updated by the app.
    // 'user_id' is needed for the WHERE clause of the UPDATE part of UPSERT.
    // 'id', database 'user_id' default, and 'updated_at' are handled by the database.
    const { error } = await supabase.from("splits").upsert(
      {
        user_id: userId, // Required for identifying the row on conflict
        splits: splits,  // The actual data payload
        // REMOVED: created_at / updated_at are handled by DB defaults now
      },
      {
        onConflict: "user_id", // Correct based on the user_id unique constraint
      }
    );

    if (error) {
      console.error("[Supabase] Error saving splits:", error);
      return false;
    }

    console.log(`[Supabase] Successfully saved splits for user ${userId}.`);
    return true;

  } catch (err) {
    console.error("[Supabase] Unexpected error in saveSplitsToSupabase:", err);
    return false;
  }
}; 