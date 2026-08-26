import type { Metadata } from "next";

import { BRAND } from "@/lib/config/site";

function formatLegalDate(): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: BRAND.timezone,
  }).format(new Date());
}

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms and conditions for ordering from ${BRAND.name}.`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16">
      <h1 className="font-display text-4xl text-forest">Terms of Service</h1>
      <p className="mt-2 text-sm text-charcoal/50">Last updated: {formatLegalDate()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-charcoal/70">
        <section>
          <h2 className="font-display text-xl text-forest">Orders and Payment</h2>
          <p className="mt-2">
            All orders are subject to availability. We reserve the right to cancel or
            refuse any order. Payment is processed securely through Paystack before
            order fulfilment begins.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Pricing</h2>
          <p className="mt-2">
            All prices are in Ghana Cedis (GHS) and include applicable taxes unless
            stated otherwise. Delivery fees are calculated at checkout based on your
            delivery region.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Delivery</h2>
          <p className="mt-2">
            We deliver across Ghana. Delivery times are estimates and may vary based on
            your location and order volume. We are not responsible for delays caused by
            circumstances beyond our control.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Cancellations</h2>
          <p className="mt-2">
            You may cancel your order before it enters the preparation stage. Once
            preparation has begun, cancellation is no longer available. Contact us via
            WhatsApp for assistance.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Contact</h2>
          <p className="mt-2">
            For questions about these terms, reach us via WhatsApp using the link on
            our website.
          </p>
        </section>
      </div>
    </div>
  );
}
