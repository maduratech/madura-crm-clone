
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in the environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Fix: Persist session in localStorage to survive page reloads.
    persistSession: true,
    // Fix: Automatically refresh the token to prevent inactivity logouts.
    autoRefreshToken: true,
    // Enable URL detection to handle password reset and magic link tokens from URL hash
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
    },
  }
});
