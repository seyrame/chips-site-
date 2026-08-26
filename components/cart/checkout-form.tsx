"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import {
  placeOrderAction,
  type PlaceOrderState,
} from "@/app/actions/checkout";
import { useCart } from "@/components/cart/cart-provider";
import type { DeliveryConfig } from "@/services/delivery";
import { formatMoney } from "@/utils/money";

const inputClass =
  "h-12 w-full rounded-xl border border-forest/15 bg-white px-4 text-sm outline-none transition-colors focus:border-forest";
const labelClass =
  "flex flex-col gap-1.5 text-left text-xs font-semibold uppercase tracking-widest text-toast";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="mt-2 h-13 w-full rounded-full bg-forest py-4 text-sm font-bold text-cream transition-colors hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? "Starting secure checkout…"
        : "Continue to payment"}
    </button>
  );
}

export function CheckoutForm({ delivery }: { delivery: DeliveryConfig }) {
  const { items, hydrated, subtotal } = useCart();
  const [state, formAction] = useActionState<PlaceOrderState, FormData>(
    placeOrderAction,
    {}
  );
  // Idempotency key: generated once per mount; prevents double-submit
  // from creating duplicate orders + stock decrements.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [regionId, setRegionId] = useState(
    () => delivery.regions[0]?.id ?? ""
  );

  const selectedRegion = delivery.regions.find((r) => r.id === regionId);
  const rawFee = selectedRegion
    ? selectedRegion.fee
    : subtotal > 0
      ? delivery.defaultFee
      : 0;
  const freeDelivery =
    delivery.freeDeliveryThreshold !== null &&
    subtotal >= delivery.freeDeliveryThreshold;
  const deliveryFee = freeDelivery ? 0 : rawFee;
  const total = subtotal + deliveryFee;

  if (hydrated && items.length === 0) {
    return (
      <div className="rounded-3xl border border-toast/15 bg-white p-12 text-center">
        <p className="font-display text-2xl text-forest">
          Nothing to check out yet
        </p>
        <p className="mt-2 text-sm text-charcoal/60">
          Add some crunch to your cart first.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full bg-forest px-7 py-3 text-sm font-semibold text-cream hover:bg-forest-soft"
        >
          Go to the shop
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* Cart payload travels with the form; server re-validates everything. */}
      <input
        type="hidden"
        name="items_json"
        value={JSON.stringify(
          items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity }))
        )}
      />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />

      <div className="flex flex-col gap-6">
        {state.error ? (
          <p
            role="alert"
            className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {state.error}
          </p>
        ) : null}

        {/* ── Contact ── */}
        <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl text-forest">Contact details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Full name *
              <input name="full_name" required maxLength={120} className={inputClass} autoComplete="name" />
            </label>
            <label className={labelClass}>
              Email *
              <input
                type="email"
                name="email"
                required
                maxLength={200}
                className={inputClass}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className={labelClass}>
              Phone *
              <input
                type="tel"
                name="phone"
                required
                className={inputClass}
                autoComplete="tel"
                placeholder="0201234567"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-charcoal/50">
            We use your email for the receipt and your phone for delivery
            coordination.
          </p>
        </section>

        {/* ── Delivery ── */}
        <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl text-forest">Delivery</h2>
          <div className="mt-5 grid gap-4">
            <label className={labelClass}>
              Region *
              {/* The select carries the region_id for fee lookup; the
                  hidden input carries the region NAME the server and
                  orders table expect. */}
              <input type="hidden" name="region" value={selectedRegion?.region ?? ""} />
              <select
                name="region_id"
                required
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className={inputClass}
              >
                {delivery.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.region}
                    {r.fee > 0 ? ` — ${formatMoney(r.fee)}` : " — Free"}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              City / town *
              <input name="city" required maxLength={80} className={inputClass} autoComplete="address-level2" />
            </label>
          </div>
          <label className={`${labelClass} mt-4`}>
              Delivery address *
              <textarea
                name="delivery_address"
                required
                rows={2}
                maxLength={300}
                className={`${inputClass} h-auto py-3`}
                autoComplete="street-address"
                placeholder="House number, street, area"
              />
            </label>
            <label className={`${labelClass} mt-4`}>
              Delivery instructions (optional)
              <input name="delivery_instructions" maxLength={500} className={inputClass} placeholder="Call when you arrive" />
            </label>
        </section>
      </div>

      {/* ── Summary ── */}
      <aside className="h-fit rounded-3xl border border-toast/15 bg-white p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl text-forest">Order summary</h2>

        <ul className="mt-4 divide-y divide-toast/10 text-sm">
          {items.map((item) => (
            <li key={item.variantId} className="flex justify-between gap-3 py-2.5">
              <span className="text-charcoal/70">
                {item.quantity}× {item.productName}{" "}
                <span className="text-charcoal/40">({item.variantName})</span>
              </span>
              <span className="shrink-0 font-semibold">
                {formatMoney(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2.5 border-t border-toast/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-charcoal/60">Subtotal</dt>
            <dd>{formatMoney(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-charcoal/60">Delivery</dt>
            <dd>
              {freeDelivery ? (
                <span className="font-semibold text-forest">FREE</span>
              ) : (
                formatMoney(deliveryFee)
              )}
            </dd>
          </div>
          {!freeDelivery && delivery.freeDeliveryThreshold !== null ? (
            <p className="text-xs text-toast">
              Free delivery on orders over{" "}
              {formatMoney(delivery.freeDeliveryThreshold)}
            </p>
          ) : null}
          <div className="flex justify-between border-t border-toast/10 pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd className="text-forest">{formatMoney(total)}</dd>
          </div>
        </dl>

        <SubmitButton disabled={!hydrated || items.length === 0 || delivery.regions.length === 0} />
        {delivery.regions.length === 0 ? (
          <p className="mt-2 text-center text-xs font-semibold text-red-700">
            Delivery is not available right now — no regions are configured.
            Please contact us via WhatsApp for assistance.
          </p>
        ) : null}
        <p className="mt-3 text-center text-xs leading-relaxed text-charcoal/50">
          You&apos;ll be taken to Paystack&apos;s secure checkout to pay by
          card, mobile money or bank transfer.
        </p>
      </aside>
    </form>
  );
}
