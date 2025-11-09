import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.PROPOSAL_SUPABASE_URL;
const supabaseServiceKey = process.env.PROPOSAL_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set PROPOSAL_SUPABASE_URL and PROPOSAL_SUPABASE_SERVICE_ROLE_KEY"
  );
}

/**
 * Server-side Supabase client using the service role key.
 * This client bypasses Row Level Security (RLS) and should only be used in server contexts.
 * For API routes that need to respect RLS, use the client with user auth tokens instead.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Create a Supabase client for API routes that respects RLS.
 * This requires passing the user's access token from the request.
 */
export function createServerClient(accessToken?: string) {
  if (!supabaseUrl) {
    throw new Error("Missing PROPOSAL_SUPABASE_URL environment variable");
  }

  const anonKey = process.env.PROPOSAL_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("Missing PROPOSAL_SUPABASE_ANON_KEY environment variable");
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  });

  return client;
}
