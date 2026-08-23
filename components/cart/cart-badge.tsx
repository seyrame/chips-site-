"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/cart-provider";

export function CartBadge() {
  const { count, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      className="relative ml-1 rounded-full border border-forest/20 bg-white px-4 py-2 text-charcoal transition-colors hover:border-forest hover:text-forest"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      Cart
      {hydrated && count > 0 ? (
        <span
          aria-hidden
          className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-plantain px-1 text-[10px] font-bold text-forest"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
