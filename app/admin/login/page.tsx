import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/admin/login-form";
import { BRAND } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Owner Login",
  robots: { index: false, follow: false },
};

const REASONS: Record<string, string> = {
  expired: "Your session expired. Please sign in again.",
  error: "Something went wrong verifying your session. Please try again.",
};

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const rawReason = Array.isArray(params.reason)
    ? params.reason[0]
    : params.reason;

  const nextPath =
    typeof rawNext === "string" && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/admin";
  const reason = typeof rawReason === "string" ? rawReason : undefined;

  return (
    <main className="flex flex-1 items-center justify-center bg-forest px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-cream p-8 shadow-2xl sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-toast">
          {BRAND.name}
        </p>
        <h1 className="mt-3 font-display text-4xl text-forest">Owner Login</h1>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
          Sign in to manage products, inventory and orders.
        </p>

        {reason && REASONS[reason] ? (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-plantain/15 px-4 py-3 text-sm text-charcoal"
          >
            {REASONS[reason]}
          </p>
        ) : null}

        <LoginForm next={nextPath} />

        <div className="mt-8 border-t border-toast/15 pt-5 text-xs leading-relaxed text-charcoal/50">
          Admins are invited by the business owner through Supabase Auth.
          Customer accounts are not required — checkout stays guest-first.
        </div>
        <Link
          href="/"
          className="mt-3 inline-block text-xs font-semibold uppercase tracking-widest text-forest hover:text-forest-soft"
        >
          ← Back to store
        </Link>
      </div>
    </main>
  );
}
