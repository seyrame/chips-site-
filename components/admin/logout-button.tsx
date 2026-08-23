"use client";

import { useFormStatus } from "react-dom";

import { signOutAction } from "@/app/actions/admin-auth";

function SignOutButtonInner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-cream/25 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-cream transition-colors hover:bg-cream/10 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <SignOutButtonInner />
    </form>
  );
}
