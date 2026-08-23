import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv, requireServerSecret } from "@/lib/env";

/**
 * Service-role Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * Use ONLY where the operation is genuinely privileged and already
 * authorized by application logic, e.g.:
 *  - atomic inventory mutations during payment verification
 *  - order creation from the checkout route handler
 *  - admin CRUD after role verification
 *
 * Never import this from a Client Component — `server-only` enforces that
 * at bundle time, and the secret is read lazily via requireServerSecret().
 */
export function createAdminClient() {
  const serviceRoleKey = requireServerSecret("SUPABASE_SERVICE_ROLE_KEY");
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();

  return createSupabaseClient(
    NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        // The service role key is a machine credential; persisting a session
        // would only add risk and storage overhead.
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
