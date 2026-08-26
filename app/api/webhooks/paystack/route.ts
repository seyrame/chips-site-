import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { captureError } from "@/lib/error-reporting";
import { requireServerSecret } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { PaystackTransactionData } from "@/lib/paystack";
import { settleFromGatewayPayload } from "@/services/payments";

const log = logger.child("webhook.paystack");

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
    log.warn("invalid_signature", { ip: request.headers.get("x-forwarded-for")?.split(",")[0] });
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event?: unknown; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    log.error("malformed_body");
    // Return 500 so Paystack retries — a malformed body may be a
    // truncated legitimate event that would otherwise be lost.
    return new Response("Malformed body", { status: 500 });
  }

  const eventName = typeof event.event === "string" ? event.event : "";
  const data = parseTransactionData(event.data);

  if (!data) {
    if (eventName === "charge.success" || eventName === "charge.failed") {
      log.error("event.no_payload", { event: eventName });
    }
    return Response.json({ received: true });
  }

  if (eventName !== "charge.success" && eventName !== "charge.failed") {
    return Response.json({ received: true });
  }

  log.info("event.received", {
    event: eventName,
    reference: data.reference,
    amount: data.amount,
    status: data.status,
  });

  try {
    await settleFromGatewayPayload(data, "webhook", eventName);
    log.info("settlement.ok", { reference: data.reference, event: eventName });
  } catch (e) {
    captureError({
      fingerprint: "webhook/settlement_threw",
      message: e instanceof Error ? e.message : String(e),
      level: "error",
      cause: e,
      tags: { reference: data.reference, event: eventName },
    });
  }

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
