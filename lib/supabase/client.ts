import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

/**
 * Browser-side Supabase client (anon key).
 * Scoped by Row Level Security — can only read active public catalog data
 * and the currently authenticated admin session.
 *
 * Call inside Client Components/hooks. Returns a singleton to avoid
 * recreating the GoTrue client on every render.
 */
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!client) {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
      getPublicEnv();
    client = createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return client;
}
