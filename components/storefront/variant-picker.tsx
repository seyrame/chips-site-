"use client";

import { useState } from "react";
import Link from "next/link";

import { useCart } from "@/components/cart/cart-provider";
import type { CartItem } from "@/types";
import { formatMoney } from "@/utils/money";

interface PickerVariant {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
}

export function VariantPicker({
  productId,
  productSlug,
  productName,
  imageUrl,
  variants,
}: {
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl: string | null;
  variants: PickerVariant[];
}) {
  const { addItem } = useCart();
  const firstAvailable =
    variants.find((v) => v.stockQuantity > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState<string | undefined>(
    firstAvailable?.id
  );
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId);
  const maxQty = Math.min(selected?.stockQuantity ?? 1, 99);
  const anyStock = variants.some((v) => v.stockQuantity > 0);

  function handleAdd() {
    if (!selected || selected.stockQuantity === 0) return;

    const line: Omit<CartItem, "quantity"> = {
      variantId: selected.id,
      productId,
      productSlug,
      productName,
      variantName: selected.name,
      imageUrl,
      unitPrice: selected.price,
      maxQuantity: selected.stockQuantity,
    };
    addItem(line, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
  }

  return (
    <div>
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-widest text-toast">
          Choose a size
        </legend>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {variants.map((variant) => {
            const soldOut = variant.stockQuantity === 0;
            const isSelected = variant.id === selectedId;
            return (
              <button
                key={variant.id}
                type="button"
                disabled={soldOut}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedId(variant.id);
                  setQuantity(1);
                }}
                className={`rounded-2xl border px-5 py-3 text-sm transition-colors ${
                  isSelected
                    ? "border-forest bg-forest text-cream"
                    : "border-forest/20 bg-white text-charcoal hover:border-forest"
                } ${soldOut ? "cursor-not-allowed opacity-40 line-through" : ""}`}
              >
                {variant.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      {selected ? (
        <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-display text-3xl font-semibold text-forest">
            {formatMoney(selected.price)}
          </p>
          <p className="text-sm">
            {selected.stockQuantity === 0 ? (
              <span className="font-semibold text-red-700">Sold out</span>
            ) : selected.stockQuantity <= selected.lowStockThreshold ? (
              <span className="font-semibold text-toast">
                Only {selected.stockQuantity} left — order soon
              </span>
            ) : (
              <span className="font-medium text-forest">
                In stock and ready to ship
              </span>
            )}
          </p>
        </div>
      ) : null}

      {/* Quantity + add to cart */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex h-12 items-center rounded-full border border-forest/20 bg-white">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="h-full rounded-l-full px-4 text-lg text-charcoal transition-colors hover:bg-cream-dark disabled:opacity-30"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="w-8 text-center text-sm font-bold text-charcoal"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={quantity >= maxQty}
            aria-label="Increase quantity"
            className="h-full rounded-r-full px-4 text-lg text-charcoal transition-colors hover:bg-cream-dark disabled:opacity-30"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!anyStock || (selected?.stockQuantity ?? 0) === 0}
          className={`h-12 rounded-full px-8 text-sm font-bold transition-colors ${
            justAdded
              ? "bg-plantain text-forest"
              : "bg-forest text-cream hover:bg-forest-soft"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {justAdded
            ? "✓ Added to cart"
            : !anyStock
              ? "Sold out"
              : "Add to cart"}
        </button>

        {anyStock && (selected?.stockQuantity ?? 0) > 0 ? (
          <Link
            href="/cart"
            className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
          >
            View cart →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
