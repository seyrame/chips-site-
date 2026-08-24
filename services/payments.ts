import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyTransaction,
  type PaystackTransactionData,
} from "@/lib/paystack";

/**
 * Payment settlement pipeline — shared by the customer-facing callback
 * page (which verifies via the Paystack API) and the webhook route
 * (which trusts the HMAC-signed payload). Both funnel through the
 * service-role-only settle_payment() RPC, which is idempotent and
 * amount-guarded at the database level.
 */

/** Where a settlement attempt originated (stored with the snapshot). */
export type SettlementSource = "callback" | "webhook";

export type PaymentOutcome =
  | { kind: "paid"; orderNumber: string }
  | { kind: "failed"; orderNumber?: string }
  /** Gateway says the transaction isn't finished (e.g. abandoned). */
  | { kind: "pending"; orderNumber?: string }
  /** We cannot establish truth right now (transport error, unknown ref). */
  | { kind: "unverifiable"; message: string };

interface SettleResult {
  order_id?: string;
  order_number?: string;
  payment_status?: string;
  already_settled?: boolean;
  mismatch?: boolean;
}

/**
 * Server-generated unique reference for a new Paystack attempt.
 * Prefix keeps it recognizable in the Paystack dashboard; the UUID
 * body guarantees global uniqueness across retries.
 */
export function generatePaymentReference(): string {
  return `TTB-${randomUUID().replace(/-/g, "").toUpperCase()}`;
}

/**
 * Apply a gateway-reported transaction to our ledger. Never throws —
 * every failure mode becomes an explicit outcome the caller renders
 * or logs. The database remains the arbiter of what actually counts.
 */
export async function settleFromGatewayPayload(
  data: PaystackTransactionData,
  source: SettlementSource,
  eventName?: string
): Promise<PaymentOutcome> {
  const supabase = createAdminClient();

  // Not-yet-terminal states are left alone; nothing to record yet.
  if (data.status !== "success" && data.status !== "failed") {
    console.warn(
      `[payments:${source}] non-terminal transaction state "${data.status}" for ${data.reference}`
    );
    return {
      kind: "pending",
      orderNumber: readOrderNumber(data),
    };
  }

  const { data: result, error } = await supabase.rpc("settle_payment", {
    p_reference: data.reference,
    p_outcome: data.status === "success" ? "PAID" : "FAILED",
    p_amount: Number.isFinite(data.amount) ? Math.trunc(data.amount) : null,
    p_currency: data.currency || null,
    p_channel: data.channel,
    p_gateway_response: data.gateway_response,
    p_paid_at: data.paid_at,
    p_snapshot: {
      source,
      ...(eventName ? { event: eventName } : {}),
      paystack: data,
    },
  });

  if (error) {
    // UNKNOWN_REFERENCE etc. Log loudly, but let callers answer politely.
    console.error(`[payments:${source}] settle_payment failed`, error.message);
    return { kind: "unverifiable", message: error.message };
  }

  const settled = result as SettleResult;

  if (settled.mismatch) {
    console.error(
      `[payments:${source}] AMOUNT MISMATCH for ${data.reference} — kept PENDING for review`
    );
    return {
      kind: "unverifiable",
      message: "Amount reported by the gateway does not match the order.",
    };
  }

  if (settled.payment_status === "PAID") {
    if (!settled.already_settled && source === "webhook") {
      console.info(
        `[payments:webhook] order ${settled.order_number} marked PAID (${data.reference})`
      );
    }
    return { kind: "paid", orderNumber: settled.order_number ?? "" };
  }

  return { kind: "failed", orderNumber: settled.order_number };
}

/**
 * Callback-page flow: ask Paystack for the authoritative transaction
 * status, then settle. Distinguishes "gateway unreachable" from real
 * outcomes so the UI never lies about money.
 */
export async function verifyAndSettle(
  reference: string
): Promise<PaymentOutcome> {
  let data: PaystackTransactionData | null;
  try {
    data = await verifyTransaction(reference);
  } catch (cause) {
    console.error("[payments:callback] verify failed", cause);
    return {
      kind: "unverifiable",
      message: "We could not reach the payment gateway. Please try again.",
    };
  }

  if (!data) {
    return {
      kind: "unverifiable",
      message: "The payment gateway has no record of this reference.",
    };
  }

  return settleFromGatewayPayload(data, "callback");
}

function readOrderNumber(data: PaystackTransactionData): string | undefined {
  const value = data.metadata?.order_number;
  return typeof value === "string" ? value : undefined;
}
