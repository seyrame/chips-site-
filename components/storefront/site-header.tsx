"use client";

import Link from "next/link";
import { useState } from "react";

import { CartBadge } from "@/components/cart/cart-badge";
import { BRAND } from "@/lib/config/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-toast/10 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 px-5 py-4 sm:gap-x-8">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-wide text-forest">
            {BRAND.name}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Main"
          className="ml-auto hidden items-center gap-1 text-sm font-medium sm:flex"
        >
          <Link
            href="/shop"
            className="rounded-full px-4 py-2 text-charcoal transition-colors hover:bg-cream-dark hover:text-forest"
          >
            Shop
          </Link>
          <Link
            href="/#story"
            className="rounded-full px-4 py-2 text-charcoal transition-colors hover:bg-cream-dark hover:text-forest"
          >
            Our Story
          </Link>
          <CartBadge />
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-cream-dark sm:hidden"
        >
          {open ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open ? (
        <nav
          aria-label="Mobile"
          className="border-t border-toast/10 px-5 pb-5 pt-4 sm:hidden"
        >
          <ul className="flex flex-col gap-2 text-sm font-medium">
            <li>
              <Link
                href="/shop"
                onClick={() => setOpen(false)}
                className="block rounded-full px-4 py-3 text-charcoal transition-colors hover:bg-cream-dark hover:text-forest"
              >
                Shop
              </Link>
            </li>
            <li>
              <Link
                href="/#story"
                onClick={() => setOpen(false)}
                className="block rounded-full px-4 py-3 text-charcoal transition-colors hover:bg-cream-dark hover:text-forest"
              >
                Our Story
              </Link>
            </li>
            <li className="flex items-center px-4 pt-1">
              <CartBadge />
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
