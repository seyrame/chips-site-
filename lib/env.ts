/**
 * Centralized, validated environment configuration.
 *
 * Strategy:
 * - Validation is LAZY so builds and CI never require real credentials.
 * - Strict validation happens where a value is actually consumed
 *   (Supabase client factories, Paystack helpers), failing with clear errors.
 * - getSiteUrl() degrades gracefully for SEO/metadata contexts.
 */
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().min(1),
});

type PublicEnv = z.infer<typeof publicSchema>;

let cachedPublicEnv: PublicEnv | undefined;

/**
 * Validated public environment. Throws a descriptive error when unset or
 * still holding placeholder values. Only call from code paths that truly
 * need these values.
 */
export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;

  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  };

  const parsed = publicSchema.safeParse(raw);

  // Fail fast on unfilled .env.example placeholders — they would otherwise
  // pass format checks and blow up later as confusing network errors.
  const unfilled = Object.entries(raw)
    .filter(
      ([, v]) => !v || /^YOUR-/.test(v) || v.includes("YOUR-PROJECT-REF")
    )
    .map(([k]) => k);

  if (!parsed.success || unfilled.length > 0) {
    const detail = parsed.success
      ? `Unconfigured placeholder values: ${unfilled.join(", ")}`
      : z.prettifyError(parsed.error);
    console.error("❌ Invalid public environment variables:\n" + detail);
    throw new Error(
      "Invalid public environment variables — copy .env.example to .env.local and set real values."
    );
  }
  cachedPublicEnv = parsed.data;
  return cachedPublicEnv;
}

/** Canonical site URL without trailing slash. Safe fallback for builds. */
export function getSiteUrl(): string {
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? (vercelUrl ? `https://${vercelUrl}` : null);
  const url = (raw ?? "http://localhost:3000").replace(/\/$/, "");
  // In production (not dev), localhost fallback breaks Paystack callback.
  if (url.startsWith("http://localhost") && process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set in production — Paystack callback URL would point to localhost."
    );
  }
  return url;
}

/* ────────────────────────────────────────────────────────────
 * Server-only secrets.
 * ──────────────────────────────────────────────────────────── */

export type ServerSecret = "SUPABASE_SERVICE_ROLE_KEY" | "PAYSTACK_SECRET_KEY";

export function requireServerSecret(name: ServerSecret): string {
  if (typeof window !== "undefined") {
    throw new Error(`${name} may only be accessed server-side`);
  }
  const value = process.env[name];
  if (!value || /^YOUR-/.test(value)) {
    throw new Error(
      `${name} is not configured. Copy .env.example to .env.local and set real values.`
    );
  }
  return value;
}
