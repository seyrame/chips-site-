"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  adjustStockAction,
  type ActionState,
} from "@/app/actions/admin-products";

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-full bg-forest px-4 text-xs font-semibold text-cream hover:bg-forest-soft disabled:opacity-60"
    >
      {pending ? "…" : "Apply"}
    </button>
  );
}

export function StockAdjuster({
  variantId,
}: {
  variantId: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    adjustStockAction,
    {}
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 text-xs text-charcoal/70"
    >
      <input type="hidden" name="variant_id" value={variantId} />
      <input
        name="delta"
        type="number"
        required
        placeholder="+50 or −3"
        title="Positive to add stock, negative to deduct"
        className="h-9 w-20 min-w-[5rem] rounded-xl border border-forest/15 px-2.5 outline-none focus:border-forest sm:w-24"
      />
      <input
        name="note"
        maxLength={280}
        placeholder="Reason (e.g. delivery received)"
        className="h-9 min-w-0 flex-1 rounded-xl border border-forest/15 px-2.5 outline-none focus:border-forest sm:w-44 sm:flex-none"
      />
      <ApplyButton />
      {state.error ? (
        <span role="alert" className="text-red-700">
          {state.error}
        </span>
      ) : null}
      {state.success ? (
        <span role="status" className="text-forest">
          ✓ {state.success}
        </span>
      ) : null}
    </form>
  );
}
