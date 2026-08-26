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
  title: "Returns & Refunds",
  description: `${BRAND.name} return and refund policy for orders.`,
};

export default function ReturnsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16">
      <h1 className="font-display text-4xl text-forest">Returns &amp; Refunds</h1>
      <p className="mt-2 text-sm text-charcoal/50">Last updated: {formatLegalDate()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-charcoal/70">
        <section>
          <h2 className="font-display text-xl text-forest">Satisfaction Guarantee</h2>
          <p className="mt-2">
            Your satisfaction matters to us. If you receive a damaged or incorrect order,
            please contact us within 24 hours of delivery via WhatsApp with your order
            number and a photo of the issue.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Refund Eligibility</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Orders damaged during delivery</li>
            <li>Incorrect items received</li>
            <li>Orders cancelled before preparation begins</li>
          </ul>
          <p className="mt-2">
            Refunds are processed through Paystack to the original payment method.
            Processing typically takes 5-10 business days.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Non-Returnable Items</h2>
          <p className="mt-2">
            Due to the nature of our products, opened or consumed items cannot be
            returned. We encourage you to contact us immediately if there is any issue
            with your order.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Contact Us</h2>
          <p className="mt-2">
            To request a refund or report an issue, reach us via WhatsApp using the link
            on our website. Please include your order number.
          </p>
        </section>
      </div>
    </div>
  );
}
