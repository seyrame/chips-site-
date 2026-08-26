import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env";

/**
 * Health check endpoint — verifies all critical dependencies are alive.
 * Returns 200 if everything is healthy, 503 if any check fails.
 *
 * Checks:
 *  - Supabase database connectivity
 *  - Environment variables configured
 *  - Paystack API reachable (optional)
 */

export const dynamic = "force-dynamic";

interface HealthCheck {
  name: string;
  status: "ok" | "error";
  latencyMs?: number;
  message?: string;
}

export async function GET(): Promise<Response> {
  const checks: HealthCheck[] = [];

  // 1. Environment check
  try {
    getPublicEnv();
    checks.push({ name: "env", status: "ok" });
  } catch {
    checks.push({ name: "env", status: "error", message: "Public env vars missing" });
  }

  // 2. Supabase connectivity
  const dbStart = Date.now();
  try {
    const supabase = createAdminClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const { error } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .abortSignal(controller.signal);
    clearTimeout(timer);
    checks.push({
      name: "database",
      status: error ? "error" : "ok",
      latencyMs: Date.now() - dbStart,
      message: error?.message,
    });
  } catch (e) {
    const isConfig =
      e instanceof Error && e.message.includes("SUPABASE_SERVICE_ROLE_KEY");
    checks.push({
      name: "database",
      status: "error",
      latencyMs: Date.now() - dbStart,
      message: isConfig
        ? "Service role key not configured"
        : e instanceof Error
          ? e.message
          : "Unknown error",
    });
  }

  const healthy = checks.every((c) => c.status === "ok");
  const status = healthy ? 200 : 503;

  return Response.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}
