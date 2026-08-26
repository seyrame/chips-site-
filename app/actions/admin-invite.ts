"use server";

/**
 * Admin invite server actions — secure provisioning for admin users.
 *
 * Flow:
 *  1. Existing OWNER/ADMIN fills in the invite form
 *  2. `inviteAdmin` creates the auth user + profile + invite token
 *  3. Returns an invite URL the inviter shares with the new admin
 *  4. New admin clicks the link, sets their password, and is active
 */

import { z } from "zod";

import { requireManagerAccess } from "@/services/admin/auth";
import { createAdminInvite, buildInviteUrl } from "@/services/admin/invite";
import { getSiteUrl } from "@/lib/env";
import type { UserRole } from "@/types";

export interface InviteAdminState {
  success?: boolean;
  inviteUrl?: string;
  email?: string;
  role?: UserRole;
  error?: string;
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email address").max(200),
  role: z.enum(["OWNER", "ADMIN", "STAFF"], {
    error: "Choose a valid role",
  }),
});

export async function inviteAdmin(
  _prev: InviteAdminState,
  formData: FormData
): Promise<InviteAdminState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const first = z.prettifyError(parsed.error)
      .split("\n")
      .find((line) => line.trim().startsWith("✖"));
    return {
      error: first ? first.replace(/^.*?✖\s*/, "") : "Please check the form fields.",
    };
  }

  try {
    const user = await requireManagerAccess();
    const siteUrl = getSiteUrl();

    const result = await createAdminInvite(
      parsed.data.email,
      parsed.data.role as UserRole,
      user.id
    );

    const inviteUrl = buildInviteUrl(result.token, siteUrl);

    return {
      success: true,
      inviteUrl,
      email: parsed.data.email,
      role: parsed.data.role as UserRole,
    };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Failed to create invite. Please try again.",
    };
  }
}
