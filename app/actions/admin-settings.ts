"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { WHATSAPP_DEFAULT_MESSAGE } from "@/lib/config/site";
import { requireManagerAccess } from "@/services/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cedisToPesewas } from "@/utils/money";

export interface SettingsActionState {
  error?: string;
  success?: string;
}

async function updateAppSetting(key: string, value: unknown) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value: JSON.stringify(value) }, { onConflict: "key" });
  if (error) throw error;
}

const whatsappSchema = z.object({
  whatsapp_number: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s\-]{7,20}$|$/, "Enter a valid phone number or leave empty"),
  whatsapp_message: z.string().trim().max(500).default(WHATSAPP_DEFAULT_MESSAGE),
});

export async function updateWhatsAppSettings(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  await requireManagerAccess();

  const parsed = whatsappSchema.safeParse({
    whatsapp_number: formData.get("whatsapp_number"),
    whatsapp_message: formData.get("whatsapp_message"),
  });

  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error).split("\n")[0] };
  }

  const number = parsed.data.whatsapp_number.replace(/[\s\-]/g, "");
  try {
    await updateAppSetting("public.whatsapp_number", number);
    await updateAppSetting("public.whatsapp_message", parsed.data.whatsapp_message);
  } catch {
    return { error: "Could not save WhatsApp settings. Please try again." };
  }

  revalidatePath("/admin/settings");
  return { success: "WhatsApp settings saved." };
}

const deliverySchema = z.object({
  default_fee_cedis: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a valid amount"),
  free_threshold_cedis: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a valid amount")
    .optional()
    .or(z.literal("")),
  free_delivery_note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function updateDeliverySettings(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  await requireManagerAccess();

  const parsed = deliverySchema.safeParse({
    default_fee_cedis: formData.get("default_fee_cedis"),
    free_threshold_cedis: formData.get("free_threshold_cedis") ?? "",
    free_delivery_note: formData.get("free_delivery_note") ?? "",
  });

  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error).split("\n")[0] };
  }

  let defaultFee: number;
  let freeThreshold: number | null;
  try {
    defaultFee = cedisToPesewas(parsed.data.default_fee_cedis);
    // DB CHECK requires: null or > 0. Treat empty and "0" as null (no threshold).
    freeThreshold =
      parsed.data.free_threshold_cedis && parsed.data.free_threshold_cedis !== "0"
        ? cedisToPesewas(parsed.data.free_threshold_cedis)
        : null;
  } catch {
    return { error: "Enter valid monetary amounts." };
  }

  try {
    const supabase = createAdminClient();
    const { error: deliveryErr } = await supabase
      .from("delivery_settings")
      .update({
        default_fee: defaultFee,
        free_delivery_threshold: freeThreshold,
      })
      .eq("id", true);

    if (deliveryErr) throw deliveryErr;

    const note = parsed.data.free_delivery_note?.trim() || null;
    if (note) {
      await updateAppSetting("public.free_delivery_note", note);
    } else {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.from("app_settings").delete().eq("key", "public.free_delivery_note");
    }
  } catch {
    return { error: "Could not save delivery settings. Please try again." };
  }

  revalidatePath("/admin/settings");
  return { success: "Delivery settings saved." };
}
