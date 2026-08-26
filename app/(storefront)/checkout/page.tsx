import type { Metadata } from "next";

import { CheckoutForm } from "@/components/cart/checkout-form";
import { BRAND } from "@/lib/config/site";
import { getDeliveryConfig } from "@/services/delivery";

export const metadata: Metadata = {
  title: `Checkout — ${BRAND.name}`,
};

export default async function CheckoutPage() {
  let delivery;
  try {
    delivery = await getDeliveryConfig();
  } catch {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-14 text-center">
        <h1 className="font-display text-5xl text-forest">Checkout</h1>
        <p className="mt-6 text-charcoal/60">
          We couldn&apos;t load delivery information right now. Please try again
          in a moment.
        </p>
        <a
          href="/checkout"
          className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-soft"
        >
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14">
      <h1 className="font-display text-5xl text-forest">Checkout</h1>
      <p className="mt-2 text-sm text-charcoal/60">
        Guest checkout — no account needed.
      </p>
      <div className="mt-10">
        <CheckoutForm delivery={delivery} />
      </div>
    </div>
  );
}
