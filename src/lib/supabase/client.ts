import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_PROPOSAL_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_PROPOSAL_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set NEXT_PUBLIC_PROPOSAL_SUPABASE_URL and NEXT_PUBLIC_PROPOSAL_SUPABASE_ANON_KEY"
  );
}

/**
 * Client-side Supabase client for use in React components.
 * This client respects Row Level Security (RLS) and uses the user's session.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
