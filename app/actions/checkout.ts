"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

export interface PlaceOrderState {
  error?: string;
}

/** Map Postgres exception codes from place_order() to friendly copy. */
function friendlyError(message: string): string {
  if (message.startsWith("INSUFFICIENT_STOCK")) {
    return "Sorry — someone just beat you to the last bags of that size. Adjust the quantity and try again.";
  }
  if (message.startsWith("VARIANT_UNAVAILABLE")) {
    return "One of the items in your cart is no longer available. Please review your cart.";
  }
  switch (message) {
    case "EMPTY_CART":
      return "Your cart is empty.";
    case "INVALID_EMAIL":
      return "Please enter a valid email address.";
    case "INVALID_PHONE":
      return "Please enter a valid phone number (e.g. 0201234567).";
    case "INVALID_CUSTOMER_NAME":
      return "Please enter your full name.";
    case "INVALID_REGION":
    case "INVALID_REGION_ID":
      return "Please choose a delivery region.";
    case "INVALID_CITY":
      return "Please enter your city or town.";
    case "INVALID_ADDRESS":
      return "Please enter your delivery address.";
    case "INVALID_QUANTITY":
      return "Quantities must be between 1 and 99 per item.";
    default:
      console.error("[placeOrder]", message);
      return "We could not place your order. Please try again in a moment.";
  }
}

const customerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s\-]{7,20}$/, "Enter a valid phone number"),
  region: z.string().trim().min(1, "Choose a region").max(80),
  city: z.string().trim().min(1, "Enter your city or town").max(80),
  delivery_address: z.string().trim().min(5, "Enter your delivery address").max(300),
  delivery_instructions: z.string().trim().max(500).optional(),
});

const lineSchema = z.object({
  variant_id: z.uuid(),
  quantity: z.number().int().min(1).max(99),
});

export async function placeOrderAction(
  _prev: PlaceOrderState,
  formData: FormData
): Promise<PlaceOrderState> {
  // ── Shape validation (authoritative checks live in place_order()) ──
  const parsedCustomer = customerSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    region: formData.get("region"),
    city: formData.get("city"),
    delivery_address: formData.get("delivery_address"),
    delivery_instructions: formData.get("delivery_instructions") ?? undefined,
  });

  if (!parsedCustomer.success) {
    const first = z.prettifyError(parsedCustomer.error)
      .split("\n")
      .find((line) => line.trim().startsWith("✖"));
    return { error: first ? first.replace(/^.*?✖\s*/, "") : "Please check the highlighted fields." };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items_json") ?? "[]"));
  } catch {
    return { error: "Your cart could not be read. Please refresh and try again." };
  }

  const parsedItems = z.array(lineSchema).safeParse(rawItems);
  if (!parsedItems.success || parsedItems.data.length === 0) {
    return { error: "Your cart is empty." };
  }

  const regionIdRaw = String(formData.get("region_id") ?? "");
  const regionId = /^[0-9a-f-]{36}$/i.test(regionIdRaw) ? regionIdRaw : null;

  // ── Atomic pipeline via service role ──
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_items: parsedItems.data,
    p_customer: parsedCustomer.data,
    p_region_id: regionId,
  });

  if (error || !data) {
    return { error: friendlyError(error?.message ?? "unknown") };
  }

  const result = data as { order_number?: string };
  if (!result.order_number) {
    console.error("[placeOrder] unexpected payload", data);
    return { error: "We could not confirm your order. Please contact support." };
  }

  redirect(`/checkout/success?order=${encodeURIComponent(result.order_number)}`);
}
