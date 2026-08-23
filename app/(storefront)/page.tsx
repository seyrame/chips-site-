import Link from "next/link";

import { BRAND } from "@/lib/config/site";

/**
 * Phase 1 placeholder — proves brand tokens, fonts, and layout wiring.
 * The real homepage (hero, editorial sections, featured products) is
 * built in Phase 5 against live catalog data.
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-toast">
        Ghana · Small Batch · {new Date().getFullYear()}
      </p>
      <h1 className="mt-6 max-w-2xl font-display text-5xl leading-tight text-forest sm:text-6xl">
        {BRAND.name}
        <span className="mt-2 block text-plantain-deep">{BRAND.tagline}</span>
      </h1>
      <p className="mt-6 max-w-md text-base leading-relaxed text-charcoal/70">
        Hand-cut, small-batch plantain chips — fried golden, salted just right.
        Delivered fresh across Ghana.
      </p>
      <div className="mt-10 flex items-center gap-4">
        <Link
          href="/shop"
          className="rounded-full bg-forest px-8 py-4 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          Shop the Crunch
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-forest/20 px-8 py-4 text-sm font-semibold text-forest transition-colors hover:border-forest"
        >
          Owner Login
        </Link>
      </div>
    </main>
  );
}
