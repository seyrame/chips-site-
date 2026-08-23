"use client";

import { useState } from "react";

import { formatMoney } from "@/utils/money";

interface PickerVariant {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
}

export function VariantPicker({ variants }: { variants: PickerVariant[] }) {
  const firstAvailable = variants.find((v) => v.stockQuantity > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState<string | undefined>(
    firstAvailable?.id
  );

  const selected = variants.find((v) => v.id === selectedId);

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
                onClick={() => setSelectedId(variant.id)}
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

      <p className="mt-6 rounded-2xl bg-cream-dark px-5 py-4 text-sm text-charcoal/70">
        Online checkout launches with our next release. To order today, message
        us on WhatsApp using the link below.
      </p>
    </div>
  );
}
