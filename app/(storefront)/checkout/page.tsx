import type { Metadata } from "next";

import { CheckoutForm } from "@/components/cart/checkout-form";
import { getDeliveryConfig } from "@/services/delivery";

export const metadata: Metadata = {
  title: "Checkout — TT Brothers",
};

export default async function CheckoutPage() {
  const delivery = await getDeliveryConfig();

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
