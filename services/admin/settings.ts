import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Admin settings reads — cookie-scoped client under RLS.
 * Settings live in the app_settings key/value table.
 */

export interface AppSettings {
  whatsappNumber: string;
  whatsappMessage: string;
  freeDeliveryNote: string;
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number | null;
}

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();

  const [{ data: settings, error: sErr }, { data: delivery, error: dErr }] =
    await Promise.all([
      supabase.from("app_settings").select("key, value"),
      supabase
        .from("delivery_settings")
        .select("default_fee, free_delivery_threshold")
        .single(),
    ]);

  if (sErr) throw sErr;
  if (dErr) throw dErr;

  const settingsMap = new Map<string, unknown>();
  for (const row of settings ?? []) {
    settingsMap.set(row.key, row.value);
  }

  function readString(key: string): string {
    const raw = settingsMap.get(key);
    if (typeof raw === "string") {
      // JSON-encoded string — strip surrounding quotes
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "string" ? parsed : raw;
      } catch {
        return raw;
      }
    }
    return "";
  }

  return {
    whatsappNumber: readString("public.whatsapp_number"),
    whatsappMessage: readString("public.whatsapp_message"),
    freeDeliveryNote: readString("public.free_delivery_note"),
    defaultDeliveryFee: Number(delivery?.default_fee ?? 1500),
    freeDeliveryThreshold: delivery?.free_delivery_threshold == null
      ? null
      : Number(delivery.free_delivery_threshold),
  };
}
