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
  title: "Privacy Policy",
  description: `How ${BRAND.name} collects, uses, and protects your personal information.`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16">
      <h1 className="font-display text-4xl text-forest">Privacy Policy</h1>
      <p className="mt-2 text-sm text-charcoal/50">Last updated: {formatLegalDate()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-charcoal/70">
        <section>
          <h2 className="font-display text-xl text-forest">Information We Collect</h2>
          <p className="mt-2">
            When you place an order, we collect your name, email address, phone number,
            and delivery address. This information is necessary to fulfil your order and
            communicate with you about delivery.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">How We Use Your Information</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>To process and deliver your orders</li>
            <li>To communicate with you about order status and delivery</li>
            <li>To provide customer support via WhatsApp</li>
            <li>To improve our products and services</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Payment Security</h2>
          <p className="mt-2">
            We do not store your payment card details. All payments are processed
            securely through Paystack, a PCI-DSS compliant payment processor.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Data Retention</h2>
          <p className="mt-2">
            We retain order information for as long as necessary to fulfil the purposes
            described in this policy, unless a longer retention period is required by law.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-forest">Contact Us</h2>
          <p className="mt-2">
            If you have questions about this Privacy Policy, please reach us via WhatsApp
            using the link on our website.
          </p>
        </section>
      </div>
    </div>
  );
}
