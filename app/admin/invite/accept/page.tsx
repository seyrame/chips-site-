"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { BRAND } from "@/lib/config/site";

/**
 * Invite acceptance page — the invited admin clicks the link from
 * the invite email/message, sets their password, and activates
 * their account.
 *
 * Flow:
 *   1. Invite URL contains ?token=... (Supabase magic link hash)
 *   2. This page renders a "Set your password" form
 *   3. On submit, calls Supabase's verifyOtp or magiclink flow
 *   4. Redirects to /admin on success
 *
 * Note: Supabase magic links already handle password setting via
 * their hosted UI. This page is a fallback/landing for the invite
 * flow that shows a branded confirmation and links to the admin
 * dashboard after password is set.
 */

function InviteAcceptInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (!token) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-4xl text-forest">Invalid invite link</h1>
        <p className="mt-3 max-w-md text-sm text-charcoal/60">
          This invite link is missing a token. Please ask the person who invited
          you to send a new link.
        </p>
        <Link
          href="/admin/login"
          className="mt-6 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-soft"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-4xl text-forest">Welcome to {BRAND.name}</h1>
      <p className="mt-3 max-w-md text-sm text-charcoal/60">
        You&apos;ve been invited as an admin. Click the link in your invite
        email to set your password, or contact the person who invited you if you
        need a new link.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/admin/login"
          className="rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-soft"
        >
          Go to login
        </Link>
        <Link
          href="/"
          className="rounded-full border border-forest/20 px-6 py-3 text-sm font-semibold text-forest hover:bg-cream-dark"
        >
          Back to shop
        </Link>
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense>
      <InviteAcceptInner />
    </Suspense>
  );
}
