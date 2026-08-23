import type { Metadata } from "next";
import Link from "next/link";

import { ClearCartOnMount } from "@/components/cart/clear-cart-on-mount";
import { buildOrderSupportLink } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Order received — TT Brothers",
  robots: { index: false, follow: false },
};

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim() !== "" ? raw : undefined;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const params = await searchParams;
  const orderNumber = firstParam(params.order) ?? "your order";
  const supportLink = buildOrderSupportLink(orderNumber);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-20 text-center">
      <ClearCartOnMount />

      <span
        aria-hidden
        className="flex h-20 w-20 items-center justify-center rounded-full bg-plantain/25 text-4xl"
      >
        ✓
      </span>
      <h1 className="mt-8 font-display text-4xl text-forest sm:text-5xl">
        Order received!
      </h1>
      <p className="mt-4 leading-relaxed text-charcoal/70">
        Thank you — your order{" "}
        <strong className="font-bold text-charcoal">{orderNumber}</strong> has
        been placed and is being prepared. We&apos;ll reach out to confirm
        payment and delivery details.
      </p>

      <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
        {supportLink ? (
          <a
            href={supportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#25d366] py-4 text-sm font-bold text-white hover:opacity-90"
          >
            Questions? WhatsApp us about this order
          </a>
        ) : null}
        <Link
          href="/shop"
          className="rounded-full border border-forest/20 py-4 text-sm font-semibold text-forest hover:border-forest"
        >
          Continue shopping
        </Link>
      </div>

      <p className="mt-10 text-xs text-charcoal/40">
        Keep your order number handy — it speeds up any support conversation.
      </p>
    </div>
  );
}
