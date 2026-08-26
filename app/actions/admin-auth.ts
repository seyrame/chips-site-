"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { checkRateLimit, rateLimitKey, LOGIN_LIMIT } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export interface SignInState {
  error?: string;
}

function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // Only allow relative paths — never redirect off-site.
  return value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

export async function signInAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  // Rate limit: 5 attempts per minute per IP.
  const ip = "server-action"; // Actions don't have direct IP access; edge gate handles IP-based limiting.
  const rl = checkRateLimit(rateLimitKey(ip, "login-action"), LOGIN_LIMIT);
  if (!rl.allowed) {
    return { error: "Too many login attempts. Please wait a minute and try again." };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address and password." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately generic — no account enumeration.
    return { error: "Invalid email or password." };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
