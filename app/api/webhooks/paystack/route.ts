import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { requireServerSecret } from "@/lib/env";
import type { PaystackTransactionData } from "@/lib/paystack";
import { settleFromGatewayPayload } from "@/services/payments";

/**
 * Paystack webhook receiver.
 *
 * Security model:
 *  1. The raw body is verified against the x-paystack-signature header
 *     (HMAC-SHA512 of the exact bytes, keyed with the secret key) using
 *     a timing-safe comparison. Anything unsigned is rejected with 401.
 *  2. Only charge.success / charge.failed are acted on; every other
 *     event is acknowledged so Paystack stops retrying it.
 *  3. Settlement runs through settle_payment() — idempotent and
 *     amount-guarded at the database level, so replays and races
 *     (webhook vs callback) collapse to a single effect.
 *
 * Always answers 200 after a valid signature: transient internal
 * failures are logged and left for human review rather than
 * triggering Paystack's retry storm on data we can't act on anyway.
 */

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!signature || !isValidSignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event?: unknown; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.error("[paystack-webhook] malformed JSON body");
    return Response.json({ received: true });
  }

  const eventName = typeof event.event === "string" ? event.event : "";
  const data = parseTransactionData(event.data);

  if (!data) {
    if (eventName === "charge.success" || eventName === "charge.failed") {
      console.error(
        `[paystack-webhook] ${eventName} arrived without a usable payload`
      );
    }
    return Response.json({ received: true });
  }

  if (eventName !== "charge.success" && eventName !== "charge.failed") {
    return Response.json({ received: true });
  }

  await settleFromGatewayPayload(data, "webhook", eventName);

  return Response.json({ received: true });
}

function isValidSignature(rawBody: string, signature: string): boolean {
  const secretKey = requireServerSecret("PAYSTACK_SECRET_KEY");
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  // Length mismatch would make timingSafeEqual throw; unequal lengths
  // are equally conclusive evidence of tampering.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Defensive shape check — webhook bodies are only ever semi-trusted. */
function parseTransactionData(raw: unknown): PaystackTransactionData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;

  const reference = d.reference;
  if (typeof reference !== "string" || reference.trim() === "") return null;

  return {
    status: typeof d.status === "string" ? d.status : "",
    reference,
    amount: typeof d.amount === "number" ? d.amount : Number.NaN,
    currency: typeof d.currency === "string" ? d.currency : "",
    channel: typeof d.channel === "string" ? d.channel : null,
    gateway_response:
      typeof d.gateway_response === "string" ? d.gateway_response : null,
    paid_at: typeof d.paid_at === "string" ? d.paid_at : null,
    metadata:
      typeof d.metadata === "object" && d.metadata !== null
        ? (d.metadata as Record<string, unknown>)
        : null,
  };
}
