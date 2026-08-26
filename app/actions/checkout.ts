"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { captureError } from "@/lib/error-reporting";
import { CONFIG } from "@/lib/config/site";
import { getSiteUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { initializeTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePaymentReference } from "@/services/payments";

const log = logger.child("checkout");

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
    case "INVALID_REFERENCE":
      return "We could not start your payment session. Please try again.";
    default:
      log.error("friendly_error", { code: message });
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
  quantity: z.number().int().min(1).max(CONFIG.maxLineQuantity),
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

  // Idempotency key: client generates once on mount; prevents double-submit
  // from creating duplicate orders + stock decrements.
  const idempotencyKey = String(formData.get("idempotency_key") ?? "");
  const safeIdempotencyKey =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idempotencyKey
    )
      ? idempotencyKey
      : null;

  // ── Atomic pipeline via service role ──
  // The reference is generated here (server-side, per the schema
  // contract) and stamped onto order + payment intent in one
  // transaction by place_order().
  const reference = generatePaymentReference();

  log.info("order.placing", {
    email: parsedCustomer.data.email,
    itemCount: parsedItems.data.length,
    reference,
    idempotencyKey: safeIdempotencyKey,
  });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_items: parsedItems.data,
    p_customer: parsedCustomer.data,
    p_region_id: regionId,
    p_paystack_reference: reference,
    p_idempotency_key: safeIdempotencyKey,
  });

  if (error || !data) {
    log.error("place_order_failed", { error: error?.message });
    return { error: friendlyError(error?.message ?? "unknown") };
  }

  const result = data as {
    order_number?: string;
    total?: number;
  };
  if (!result.order_number || typeof result.total !== "number") {
    log.error("place_order_unexpected_payload", { data });
    return { error: "We could not confirm your order. Please contact support." };
  }

  log.info("order.created", {
    orderNumber: result.order_number,
    total: result.total,
  });

  // ── Start the Paystack checkout session ─────────────────────
  // Work happens inside try/catch; redirect() stays outside it —
  // its control-flow error must never be swallowed.
  let authorizationUrl: string | undefined;
  try {
    const session = await initializeTransaction({
      email: parsedCustomer.data.email,
      amount: result.total,
      reference,
      callbackUrl: `${getSiteUrl()}/checkout/paystack/callback`,
      metadata: { order_number: result.order_number },
    });
    authorizationUrl = session.authorizationUrl;
  } catch (cause) {
    captureError({
      fingerprint: "checkout/paystack_init_failed",
      message: cause instanceof Error ? cause.message : String(cause),
      level: "error",
      cause,
      tags: { orderNumber: result.order_number, reference },
    });
  }

  if (!authorizationUrl) {
    // The order (and stock reservation) is real; only the payment
    // session failed. Never invite a duplicate submission.
    return {
      error: `Your order ${result.order_number} has been reserved, but we couldn't start the payment. Please reach us and we'll send you a secure payment link — don't place the order again.`,
    };
  }

  redirect(authorizationUrl);
}
