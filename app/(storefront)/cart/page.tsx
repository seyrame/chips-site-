import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Your cart — TT Brothers",
};

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14">
      <h1 className="font-display text-5xl text-forest">Your cart</h1>
      <p className="mt-2 text-sm text-charcoal/60">
        Review your order, then check out — delivery is calculated by region.
      </p>
      <div className="mt-10">
        <CartView />
      </div>
    </div>
  );
}
