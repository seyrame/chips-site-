"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { BRAND } from "@/lib/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRefund } from "@/lib/paystack";
import { ORDER_TRANSITIONS } from "@/lib/order-workflow";
import { requireManagerAccess } from "@/services/admin/auth";
import type { OrderStatus } from "@/types/database";

/**
 * Fulfilment mutations. All writes go through service-role RPCs
 * (migration 0011) so transition rules and restock side effects live
 * in exactly one place — SQL, not TypeScript.
 */

const orderIdSchema = z.string().uuid();

const STATUS_VALUES = Object.keys(ORDER_TRANSITIONS) as OrderStatus[];

export interface OrderActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function friendlyOrderError(error: { message?: string }): string {
  const raw = error.message ?? "";
  if (raw.includes("ORDER_NOT_FOUND")) return "We couldn't find that order.";
  if (raw.includes("INVALID_TRANSITION") || raw.includes("INVALID_STATUS")) {
    return "That status change isn't allowed from where this order is right now.";
  }
  if (raw.includes("ORDER_NOT_PAID")) {
    return "This order has no settled payment to refund.";
  }
  console.error("[admin-orders] rpc failed:", raw);
  return "Something went wrong on our side. Please try again.";
}

export async function updateOrderStatusAction(
  _prev: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  try {
    await requireManagerAccess();
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: "You don't have permission to manage orders." };
  }

  const parsed = z
    .object({
      orderId: orderIdSchema,
      next: z.enum(STATUS_VALUES),
    })
    .safeParse({
      orderId: formData.get("orderId"),
      next: formData.get("status"),
    });
  if (!parsed.success) return { error: "That order or status isn't recognised." };

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("update_order_status", {
    p_order_id: parsed.data.orderId,
    p_next: parsed.data.next,
  });
  if (error) return { error: friendlyOrderError(error) };

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true, message: `Order marked ${parsed.data.next.toLowerCase()}.` };
}

export async function refundOrderAction(
  _prev: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  try {
    await requireManagerAccess();
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: "You don't have permission to issue refunds." };
  }

  const parsed = orderIdSchema.safeParse(formData.get("orderId"));
  if (!parsed.success) return { error: "That order isn't recognised." };

  const supabase = createAdminClient();

  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, order_number, paystack_reference, payment_status")
    .eq("id", parsed.data)
    .maybeSingle();
  if (fetchErr || !order) return { error: "We couldn't find that order." };
  if (!order.paystack_reference || order.payment_status !== "PAID") {
    return { error: "Only paid orders can be refunded." };
  }

  // Local idempotency short-circuit: nothing left to refund at the
  // gateway either, because we only mark REFUNDED after Paystack
  // accepts.
  const { data: paidRows } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", parsed.data)
    .eq("status", "PAID")
    .limit(1);
  if (!paidRows?.length) return { ok: true, message: "This order is already fully refunded." };

  try {
    await createRefund(
      order.paystack_reference,
      `${BRAND.name} ${order.order_number} full refund`
    );
  } catch (cause) {
    console.error("[admin-orders] paystack refund rejected:", cause);
    return {
      error:
        cause instanceof Error && cause.message
          ? `Paystack refused the refund: ${cause.message}`
          : "Paystack could not process the refund. No changes were made.",
    };
  }

  const { error: markErr } = await supabase.rpc("mark_order_refunded", {
    p_order_id: parsed.data,
  });
  if (markErr) {
    console.error("[admin-orders] mark_order_refunded failed:", markErr.message);
    return {
      error:
        "Paystack accepted the refund but recording it here failed. Refresh this page and verify the payment state before retrying — do NOT resubmit blindly.",
    };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data}`);
  return { ok: true, message: "Full refund issued via Paystack." };
}
