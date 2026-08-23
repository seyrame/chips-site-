import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface DeliveryRegionOption {
  id: string;
  region: string;
  fee: number;
}

export interface DeliveryConfig {
  regions: DeliveryRegionOption[];
  defaultFee: number;
  /** Subtotal (pesewas) at/above which delivery is free; null = disabled. */
  freeDeliveryThreshold: number | null;
}

/**
 * Public checkout data — active region fees plus the shop-wide
 * threshold rule. Read under anon RLS like the rest of the catalog.
 */
export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  const supabase = await createClient();

  const [regionsResult, settingsResult] = await Promise.all([
    supabase
      .from("delivery_regions")
      .select("id, region, fee")
      .eq("active", true)
      .order("sort_order"),
    supabase.from("delivery_settings").select("default_fee, free_delivery_threshold").single(),
  ]);

  if (regionsResult.error) throw regionsResult.error;
  if (settingsResult.error) throw settingsResult.error;

  return {
    regions: (regionsResult.data ?? []).map((r) => ({
      id: r.id,
      region: r.region,
      fee: Number(r.fee),
    })),
    defaultFee: Number(settingsResult.data.default_fee),
    freeDeliveryThreshold:
      settingsResult.data.free_delivery_threshold == null
        ? null
        : Number(settingsResult.data.free_delivery_threshold),
  };
}
