// supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Support both legacy NEXT_PUBLIC_ vars and canonical names.
// Prefer unprefixed if present so we can drop NEXT_PUBLIC_ going forward.
import { 
  NEXT_PUBLIC_SUPABASE_URL, 
  NEXT_PUBLIC_SUPABASE_ANON_KEY, 
  SUPABASE_URL as RAW_SUPABASE_URL,
  SUPABASE_ANON_KEY as RAW_SUPABASE_ANON_KEY
} from '@env';

const SUPABASE_URL = RAW_SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = RAW_SUPABASE_ANON_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[supabaseClient] Missing Supabase env vars: ensure SUPABASE_URL and SUPABASE_ANON_KEY (or legacy NEXT_PUBLIC_*) are set');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // disable this in mobile apps
    },
    realtime: undefined,
  });