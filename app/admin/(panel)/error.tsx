"use client";

import Link from "next/link";

export default function AdminError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl text-forest">Admin error</h1>
      <p className="mt-3 max-w-md text-sm text-charcoal/60">
        Something broke while loading this admin page. Check the server logs for
        details or try again.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-soft"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-full border border-forest/20 px-6 py-3 text-sm font-semibold text-forest hover:bg-cream-dark"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
