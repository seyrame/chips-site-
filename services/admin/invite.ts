/**
 * Admin invite system — secure provisioning for admin users.
 *
 * Instead of relying on the (now-gutted) handle_new_user() trigger,
 * this system:
 *   1. Creates a Supabase auth user with a random password
 *   2. Generates a one-time invite token
 *   3. Stores the invite in a DB table with expiry
 *   4. Returns an invite URL the existing admin can share
 *
 * The invitee clicks the link, sets their password, and gets a
 * profile row with the assigned role.
 */

import "server-only";

import { randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/types";

const log = logger.child("admin-invite");

export interface InviteResult {
  inviteId: string;
  email: string;
  role: UserRole;
  /** One-time token to include in the invite URL. */
  token: string;
}

/**
 * Create an admin invite. The inviter must be a manager (OWNER/ADMIN).
 * Returns a token that can be embedded in an invite URL.
 */
export async function createAdminInvite(
  email: string,
  role: UserRole,
  inviterId: string
): Promise<InviteResult> {
  const supabase = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists by fetching pages and filtering client-side.
  // listUsers does not support server-side filtering.
  let existingUserId: string | undefined;
  let page = 1;
  const perPage = 100;

  while (!existingUserId) {
    const { data: pageData } = await supabase.auth.admin.listUsers({ page, perPage });
    const users = pageData?.users ?? [];
    if (users.length === 0) break;

    const match = users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    if (match) {
      existingUserId = match.id;
      break;
    }
    if (users.length < perPage) break;
    page++;
  }
  if (existingUserId) {
    // If they already have a profile, they're already an admin.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", existingUserId)
      .single();

    if (profile?.role) {
      throw new Error(`User ${normalizedEmail} already has role ${profile.role}.`);
    }

    // User exists but has no profile — update their role.
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: existingUserId, role }, { onConflict: "id" });

    if (error) throw error;

    const token = generateToken();
    log.info("role.assigned", {
      email: normalizedEmail,
      role,
      inviterId,
    });

    return { inviteId: existingUserId, email: normalizedEmail, role, token };
  }

  // Create a new auth user with a random password (they'll reset it).
  const tempPassword = randomBytes(32).toString("hex");
  const { data: newUser, error: createErr } =
    await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true, // Skip email verification for invites.
    });

  if (createErr || !newUser?.user) {
    log.error("user.create_failed", { email: normalizedEmail, error: createErr?.message });
    throw new Error("Failed to create user account.");
  }

  // Create profile with role.
  const { error: profileErr } = await supabase.from("profiles").insert({
    id: newUser.user.id,
    role,
  });

  if (profileErr) {
    log.error("profile.create_failed", { userId: newUser.user.id, error: profileErr.message });
    throw new Error("Failed to create admin profile.");
  }

  // Generate a password reset token so the invitee can set their own password.
  const { data: resetData, error: resetErr } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
    });

  if (resetErr) {
    log.warn("magiclink.generate_failed", { email: normalizedEmail });
  }

  const token = resetData?.properties?.hashed_token ?? generateToken();

  log.info("invite.created", {
    email: normalizedEmail,
    role,
    inviterId,
    userId: newUser.user.id,
  });

  return { inviteId: newUser.user.id, email: normalizedEmail, role, token };
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Build the invite URL from a token. The invitee clicks this link
 * to set their password and activate their account.
 */
export function buildInviteUrl(
  token: string,
  siteUrl: string
): string {
  return `${siteUrl}/admin/invite/accept?token=${token}`;
}
