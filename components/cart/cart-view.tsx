"use client";

import Image from "next/image";
import Link from "next/link";

import { useCart } from "@/components/cart/cart-provider";
import { CONFIG } from "@/lib/config/site";
import { formatMoney } from "@/utils/money";

export function CartView() {
  const { items, hydrated, subtotal, updateQuantity, removeItem, clear } =
    useCart();

  if (!hydrated) {
    return (
      <div className="py-24 text-center text-sm text-charcoal/50">
        Loading your cart…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-toast/15 bg-white p-8 text-center sm:p-12">
        <p className="font-display text-3xl text-forest">Your cart is empty</p>
        <p className="mt-3 text-sm text-charcoal/60">
          The crunch is waiting — grab a bag or three.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-block rounded-full bg-forest px-8 py-3.5 text-sm font-semibold text-cream hover:bg-forest-soft"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Lines */}
      <ul className="flex flex-col divide-y divide-toast/10 rounded-3xl border border-toast/15 bg-white">
        {items.map((item) => (
          <li key={item.variantId} className="flex gap-4 p-5 sm:p-6">
            <Link
              href={`/shop/${item.productSlug}`}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-cream-dark"
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.productName}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : null}
            </Link>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={`/shop/${item.productSlug}`}
                className="font-display text-lg leading-snug text-forest hover:underline"
              >
                {item.productName}
              </Link>
              <p className="text-sm text-charcoal/60">{item.variantName}</p>
              <p className="text-sm font-semibold text-charcoal">
                {formatMoney(item.unitPrice)}
              </p>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                <div className="flex h-11 items-center rounded-full border border-forest/20">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                    aria-label={`Decrease quantity of ${item.productName} ${item.variantName}`}
                    disabled={item.quantity <= 1}
                    className="h-full min-h-11 min-w-11 rounded-l-full px-3 text-charcoal hover:bg-cream-dark disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm font-bold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                    aria-label={`Increase quantity of ${item.productName} ${item.variantName}`}
                    disabled={item.quantity >= Math.min(item.maxQuantity, CONFIG.maxLineQuantity)}
                    title={
                      item.maxQuantity <= 99
                        ? `Only ${item.maxQuantity} in stock`
                        : undefined
                    }
                    className="h-full min-h-11 min-w-11 rounded-r-full px-3 text-charcoal hover:bg-cream-dark disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.variantId)}
                  className="min-h-11 min-w-11 rounded-full text-xs font-semibold uppercase tracking-widest text-red-700 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>

            <p className="shrink-0 self-start pt-1 text-sm font-bold text-forest">
              {formatMoney(item.unitPrice * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      {/* Summary */}
      <aside className="h-fit rounded-3xl border border-toast/15 bg-white p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl text-forest">Summary</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-charcoal/60">Subtotal</dt>
            <dd className="font-semibold">{formatMoney(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-charcoal/60">Delivery</dt>
            <dd className="text-charcoal/50">Calculated at checkout</dd>
          </div>
        </dl>
        <Link
          href="/checkout"
          className="mt-6 block rounded-full bg-forest py-4 text-center text-sm font-bold text-cream transition-colors hover:bg-forest-soft"
        >
          Proceed to checkout
        </Link>
        <button
          type="button"
          onClick={clear}
          className="mt-3 w-full rounded-full py-2 text-xs font-semibold uppercase tracking-widest text-charcoal/50 hover:text-red-700"
        >
          Empty cart
        </button>
        <Link
          href="/shop"
          className="mt-4 block text-center text-sm text-forest underline-offset-4 hover:underline"
        >
          ← Keep shopping
        </Link>
      </aside>
    </div>
  );
}
