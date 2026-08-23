"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createProductAction,
  updateProductAction,
  type ActionState,
} from "@/app/actions/admin-products";

export interface VariantDraft {
  key: string;
  id?: string;
  name: string;
  priceCedis: string;
  stockQuantity: string;
  lowStockThreshold: string;
  sku: string;
}

interface ProductFormProps {
  categories: Array<{ id: string; name: string }>;
  product?: {
    id: string;
    name: string;
    slug: string;
    category_id: string;
    short_description: string | null;
    description: string | null;
    ingredients: string | null;
    active: boolean;
    featured: boolean;
  };
  initialVariants?: Array<{
    key: string;
    id?: string;
    name: string;
    priceCedis: string;
    stockQuantity: string;
    lowStockThreshold: string;
    sku: string;
  }>;
}

let draftCounter = 0;
function nextKey() {
  draftCounter += 1;
  return `v${draftCounter}`;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-forest px-8 py-3 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-forest/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-forest";
const labelClass =
  "flex flex-col gap-1.5 text-left text-xs font-semibold uppercase tracking-widest text-toast";

export function ProductForm({
  categories,
  product,
  initialVariants,
}: ProductFormProps) {
  const isEdit = Boolean(product);
  const [variants, setVariants] = useState<VariantDraft[]>(
    initialVariants && initialVariants.length > 0
      ? initialVariants
      : [{ key: nextKey(), name: "", priceCedis: "", stockQuantity: "0", lowStockThreshold: "5", sku: "" }]
  );
  const [state, formAction] = useActionState<ActionState, FormData>(
    isEdit ? updateProductAction : createProductAction,
    {}
  );

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {product ? <input type="hidden" name="product_id" value={product.id} /> : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          role="status"
          className="rounded-2xl bg-plantain/20 px-4 py-3 text-sm text-charcoal"
        >
          ✓ {state.success}
        </p>
      ) : null}

      {/* ── Details ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">Details</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Name *
            <input
              name="name"
              required
              defaultValue={product?.name}
              className={inputClass}
              placeholder="TT Original Plantain Chips"
            />
          </label>
          <label className={labelClass}>
            Category *
            <select
              name="category_id"
              required
              defaultValue={product?.category_id}
              className={inputClass}
            >
              <option value="" disabled>
                Choose…
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            URL slug
            <input
              name="slug"
              defaultValue={product?.slug}
              className={inputClass}
              placeholder="Auto-generated from the name if left blank"
            />
          </label>
          <label className={labelClass}>
            Short description
            <input
              name="short_description"
              maxLength={200}
              defaultValue={product?.short_description ?? ""}
              className={inputClass}
              placeholder="One-liner for cards and listings"
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Full description
            <textarea
              name="description"
              rows={4}
              defaultValue={product?.description ?? ""}
              className={`${inputClass} h-auto py-3`}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Ingredients
            <textarea
              name="ingredients"
              rows={2}
              defaultValue={product?.ingredients ?? ""}
              className={`${inputClass} h-auto py-3`}
              placeholder="Ripe plantain, sunflower oil, sea salt…"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active ?? true}
              className="h-4 w-4 accent-[#0a3d2e]"
            />
            Live on storefront
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={product?.featured ?? false}
              className="h-4 w-4 accent-[#0a3d2e]"
            />
            Featured on home page
          </label>
        </div>
      </section>

      {/* ── Variants ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-forest">Variants</h2>
          <span className="text-xs text-charcoal/50">
            Price in GH₵ · stock per size
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {variants.map((variant) => (
            <fieldset
              key={variant.key}
              className="grid grid-cols-2 gap-3 rounded-2xl bg-cream p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_auto] sm:items-end"
            >
              {variant.id ? (
                <input type="hidden" name="variant_id" value={variant.id} />
              ) : null}
              <label className="text-xs text-charcoal/60">
                Size / name *
                <input
                  name="variant_name"
                  required
                  defaultValue={variant.name}
                  onChange={(e) =>
                    updateVariant(variant.key, { name: e.target.value })
                  }
                  className={inputClass}
                  placeholder="Small"
                />
              </label>
              <label className="text-xs text-charcoal/60">
                Price (GH₵) *
                <input
                  name="variant_price"
                  required
                  inputMode="decimal"
                  pattern="\d{1,6}(\.\d{1,2})?"
                  defaultValue={variant.priceCedis}
                  onChange={(e) =>
                    updateVariant(variant.key, { priceCedis: e.target.value })
                  }
                  className={inputClass}
                  placeholder="35.00"
                />
              </label>
              <label className="text-xs text-charcoal/60">
                Stock
                <input
                  name="variant_stock"
                  type="number"
                  min={0}
                  defaultValue={variant.stockQuantity}
                  onChange={(e) =>
                    updateVariant(variant.key, { stockQuantity: e.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-charcoal/60">
                Low-stock alert at
                <input
                  name="variant_threshold"
                  type="number"
                  min={0}
                  defaultValue={variant.lowStockThreshold}
                  onChange={(e) =>
                    updateVariant(variant.key, {
                      lowStockThreshold: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-charcoal/60">
                SKU (optional)
                <input
                  name="variant_sku"
                  defaultValue={variant.sku}
                  onChange={(e) =>
                    updateVariant(variant.key, { sku: e.target.value })
                  }
                  className={inputClass}
                  placeholder="TTO-SM"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setVariants((rows) =>
                    rows.filter((r) => r.key !== variant.key)
                  )
                }
                disabled={variants.length === 1}
                aria-label={`Remove variant ${variant.name || "(unnamed)"}`}
                className="h-11 justify-self-start rounded-xl px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-30"
              >
                ✕
              </button>
            </fieldset>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setVariants((rows) => [
              ...rows,
              {
                key: nextKey(),
                name: "",
                priceCedis: "",
                stockQuantity: "0",
                lowStockThreshold: "5",
                sku: "",
              },
            ])
          }
          className="mt-4 rounded-full border border-forest/25 px-5 py-2 text-sm font-semibold text-forest hover:bg-cream-dark"
        >
          + Add variant
        </button>
      </section>

      <div className="flex items-center gap-4">
        <SubmitButton label={isEdit ? "Save changes" : "Create product"} />
        <span className="text-xs text-charcoal/50">
          {isEdit
            ? "Variant stock changes made here replace levels directly — use Inventory for audited adjustments."
            : "You can upload images after creating the product."}
        </span>
      </div>
    </form>
  );
}
