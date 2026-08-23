import Link from "next/link";

import { BRAND } from "@/lib/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-toast/10 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-x-8 px-5 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-wide text-forest">
            {BRAND.name}
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="ml-auto flex items-center gap-1 text-sm font-medium"
        >
          <Link
            href="/shop"
            className="rounded-full px-4 py-2 text-charcoal transition-colors hover:bg-cream-dark hover:text-forest"
          >
            Shop
          </Link>
          <Link
            href="/#story"
            className="hidden rounded-full px-4 py-2 text-charcoal transition-colors hover:bg-cream-dark hover:text-forest sm:inline-block"
          >
            Our Story
          </Link>
          <Link
            href="/shop"
            className="ml-2 rounded-full bg-forest px-5 py-2.5 font-semibold text-cream transition-colors hover:bg-forest-soft"
          >
            Order Now
          </Link>
        </nav>
      </div>
    </header>
  );
}
