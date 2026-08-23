import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Resolve the signed-in admin (any profiled role) for the current
 * request, or null. Runs under RLS via the cookie-scoped server client,
 * so a forged role claim in the JWT gains nothing — the profiles table
 * is the source of truth.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role) return null;

  return { id: user.id, email: user.email, role: profile.role };
}

/**
 * Guard for the admin panel. Redirects unauthenticated users to login
 * and unprivileged authenticated users to an access-denied notice.
 */
export async function requirePanelAccess(nextPath = "/admin"): Promise<AdminUser> {
  const admin = await getAdminUser();

  if (!admin) {
    redirectToLogin(nextPath, "expired");
  }

  // STAFF enters V1 read-only; manager-only pages re-check with
  // requireManagerAccess() as write features land in Phase 8.
  return admin;
}

/** Guard for destructive/management operations (OWNER/ADMIN only). */
export async function requireManagerAccess(
  nextPath = "/admin"
): Promise<AdminUser> {
  const admin = await requirePanelAccess(nextPath);
  if (admin.role === "STAFF") {
    redirect("/admin?denied=1");
  }
  return admin;
}

function redirectToLogin(nextPath: string, reason: string): never {
  const params = new URLSearchParams({ next: nextPath, reason });
  redirect(`/admin/login?${params.toString()}`);
}
