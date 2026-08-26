"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  updateWhatsAppSettings,
  updateDeliverySettings,
  type SettingsActionState,
} from "@/app/actions/admin-settings";
import type { AppSettings } from "@/services/admin/settings";
import { formatMoney } from "@/utils/money";

const inputClass =
  "h-11 w-full rounded-xl border border-forest/15 bg-white px-3.5 text-sm outline-none transition-colors focus:border-forest";
const labelClass =
  "flex flex-col gap-1.5 text-left text-xs font-semibold uppercase tracking-widest text-toast";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-forest px-8 py-3 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [whatsappState, whatsappAction] = useActionState<SettingsActionState, FormData>(
    updateWhatsAppSettings,
    {}
  );
  const [deliveryState, deliveryAction] = useActionState<SettingsActionState, FormData>(
    updateDeliverySettings,
    {}
  );

  return (
    <div className="flex flex-col gap-8">
      {/* ── WhatsApp ── */}
      <form action={whatsappAction} className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">WhatsApp Support</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Customers can reach you directly via WhatsApp from product pages and
          the footer.
        </p>

        {whatsappState.error ? (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {whatsappState.error}
          </p>
        ) : null}
        {whatsappState.success ? (
          <p role="status" className="mt-4 rounded-2xl bg-plantain/20 px-4 py-3 text-sm text-charcoal">
            ✓ {whatsappState.success}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Phone number
            <input
              name="whatsapp_number"
              defaultValue={settings.whatsappNumber}
              placeholder="233201234567"
              className={inputClass}
              autoComplete="tel"
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Default message
            <input
              name="whatsapp_message"
              defaultValue={settings.whatsappMessage}
              maxLength={500}
              className={inputClass}
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-charcoal/50">
          International format without + or spaces (e.g. 233201234567). Leave
          empty to disable WhatsApp links.
        </p>

        <div className="mt-5">
          <SaveButton />
        </div>
      </form>

      {/* ── Delivery ── */}
      <form action={deliveryAction} className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">Delivery</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Default delivery fee and free delivery threshold. Per-region fees are
          managed in the database directly.
        </p>

        {deliveryState.error ? (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {deliveryState.error}
          </p>
        ) : null}
        {deliveryState.success ? (
          <p role="status" className="mt-4 rounded-2xl bg-plantain/20 px-4 py-3 text-sm text-charcoal">
            ✓ {deliveryState.success}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Default fee (GH₵)
            <input
              name="default_fee_cedis"
              defaultValue={(settings.defaultDeliveryFee / 100).toFixed(2)}
              inputMode="decimal"
              pattern="\d{1,6}(\.\d{1,2})?"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Free delivery threshold (GH₵)
            <input
              name="free_threshold_cedis"
              defaultValue={
                settings.freeDeliveryThreshold != null
                  ? (settings.freeDeliveryThreshold / 100).toFixed(2)
                  : ""
              }
              inputMode="decimal"
              placeholder="Leave empty to disable"
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Free delivery note (shown at checkout)
            <input
              name="free_delivery_note"
              defaultValue={settings.freeDeliveryNote}
              maxLength={500}
              className={inputClass}
              placeholder="Free delivery on orders over GHc200"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <SaveButton />
          <span className="text-xs text-charcoal/50">
            Current default: {formatMoney(settings.defaultDeliveryFee)}
            {settings.freeDeliveryThreshold != null
              ? ` · Free above ${formatMoney(settings.freeDeliveryThreshold)}`
              : " · No free delivery threshold set"}
          </span>
        </div>
      </form>
    </div>
  );
}
