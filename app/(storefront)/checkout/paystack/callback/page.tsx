import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buildOrderSupportLink } from "@/lib/config/site";
import { verifyAndSettle } from "@/services/payments";

export const metadata: Metadata = {
  title: "Finishing up — TT Brothers",
  robots: { index: false, follow: false },
};

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

/**
 * Paystack redirects here after hosted checkout (?reference=…).
 * The query string is NEVER trusted for status decisions — the only
 * source of truth is the server-side verify call, whose result is
 * settled idempotently in the database.
 */
export default async function PaystackCallbackPage({
  searchParams,
}: PageProps<"/checkout/paystack/callback">) {
  const params = await searchParams;
  const reference = firstParam(params.reference);

  if (!reference) {
    redirect("/cart");
  }

  const outcome = await verifyAndSettle(reference);

  if (outcome.kind === "paid") {
    redirect(
      `/checkout/success?order=${encodeURIComponent(outcome.orderNumber || reference)}&paid=1`
    );
  }

  const orderNumber =
    outcome.kind === "failed" || outcome.kind === "pending"
      ? outcome.orderNumber
      : undefined;
  const supportLink = buildOrderSupportLink(orderNumber ?? reference);
  const heading =
    outcome.kind === "pending"
      ? "Payment not finished yet"
      : "Payment didn't go through";

  const body =
    outcome.kind === "unverifiable"
      ? "We couldn't confirm your payment status just now. If you were charged, don't worry — your order is safe and we'll sort it out."
      : outcome.kind === "failed"
        ? "The payment was declined or cancelled. Your order is reserved — reach out and we'll send you a fresh payment link."
        : "Looks like the checkout wasn't completed. Your order is reserved — reach out and we'll help you finish paying.";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-20 text-center">
      <span
        aria-hidden
        className="flex h-20 w-20 items-center justify-center rounded-full bg-toast/15 text-4xl"
      >
        !
      </span>
      <h1 className="mt-8 font-display text-4xl text-forest sm:text-5xl">
        {heading}
      </h1>
      <p className="mt-4 leading-relaxed text-charcoal/70">{body}</p>
      {orderNumber ? (
        <p className="mt-2 text-sm text-charcoal/60">
          Order{" "}
          <strong className="font-bold text-charcoal">{orderNumber}</strong>
        </p>
      ) : null}

      <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
        {supportLink ? (
          <a
            href={supportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#25d366] py-4 text-sm font-bold text-white hover:opacity-90"
          >
            Contact us about this order
          </a>
        ) : null}
        <Link
          href="/shop"
          className="rounded-full border border-forest/20 py-4 text-sm font-semibold text-forest hover:border-forest"
        >
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
