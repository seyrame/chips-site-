import "server-only";

import { BRAND } from "@/lib/config/site";
import { requireServerSecret } from "@/lib/env";

/**
 * Minimal server-side Paystack REST client (secret-key operations).
 *
 * Only what the checkout pipeline needs:
 *  - initializeTransaction → hosted checkout URL for the customer
 *  - verifyTransaction     → authoritative status check on return
 *  - createRefund          → full refund of a settled transaction
 *
 * The secret key is read lazily via requireServerSecret(), so builds
 * and CI never need real credentials. All amounts are integer
 * pesewas — Paystack's native minor-unit format, same as our DB.
 */

const PAYSTACK_API_BASE = "https://api.paystack.co";
const REQUEST_TIMEOUT_MS = 15_000;

export interface InitializeTransactionInput {
  /** Customer email (Paystack requires it at initialization). */
  email: string;
  /** Amount in pesewas. */
  amount: number;
  /** Our server-generated unique reference (payments.paystack_reference). */
  reference: string;
  /** Absolute URL Paystack redirects to after checkout. */
  callbackUrl: string;
  /** Arbitrary metadata echoed back in verify/webhook payloads. */
  metadata?: Record<string, unknown>;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/** Subset of Paystack's transaction object we rely on. */
export interface PaystackTransactionData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel: string | null;
  gateway_response: string | null;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
}

class PaystackApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "PaystackApiError";
  }
}

async function paystackRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const secretKey = requireServerSecret("PAYSTACK_SECRET_KEY");

  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new PaystackApiError(
      `Paystack request failed: ${String(cause)}`,
      0
    );
  }

  // Paystack wraps every response in { status, message, data }.
  let payload: { status?: boolean; message?: string; data?: T };
  try {
    payload = await response.json();
  } catch {
    throw new PaystackApiError(
      `Paystack returned non-JSON response (HTTP ${response.status})`,
      response.status
    );
  }

  if (!response.ok || payload.status !== true || payload.data === undefined) {
    throw new PaystackApiError(
      payload.message ?? `Paystack error (HTTP ${response.status})`,
      response.status
    );
  }

  return payload.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Create a hosted-checkout session and return the URL to redirect to.
 * Throws on failure — callers own the fallback UX.
 */
export async function initializeTransaction(
  input: InitializeTransactionInput
): Promise<InitializeTransactionResult> {
  const data = await paystackRequest<{
    authorization_url?: unknown;
    access_code?: unknown;
    reference?: unknown;
  }>("POST", "/transaction/initialize", {
    email: input.email,
    amount: input.amount,
    currency: BRAND.currency.code,
    reference: input.reference,
    callback_url: input.callbackUrl,
    metadata: input.metadata,
  });

  if (
    typeof data.authorization_url !== "string" ||
    !data.authorization_url.startsWith("https://")
  ) {
    throw new PaystackApiError(
      "Paystack initialize returned no authorization URL",
      0
    );
  }

  return {
    authorizationUrl: data.authorization_url,
    accessCode: typeof data.access_code === "string" ? data.access_code : "",
    reference: typeof data.reference === "string" ? data.reference : input.reference,
  };
}

/**
 * Authoritative transaction lookup. Returns null-shaped data when
 * Paystack doesn't know the reference; throws only on transport/API
 * failure so callers can distinguish "not paid yet" from "can't tell".
 */
export async function verifyTransaction(
  reference: string
): Promise<PaystackTransactionData | null> {
  let raw: unknown;
  try {
    raw = await paystackRequest<unknown>(
      "GET",
      `/transaction/verify/${encodeURIComponent(reference)}`
    );
  } catch (e) {
    // Paystack returns 400/404 for non-existent references — treat as "not found"
    // rather than throwing, so callers can distinguish "not paid" from "can't tell".
    if (e instanceof PaystackApiError && (e.status === 400 || e.status === 404)) {
      return null;
    }
    throw e;
  }

  if (!isRecord(raw)) return null;

  return {
    status: typeof raw.status === "string" ? raw.status : "",
    reference:
      typeof raw.reference === "string" ? raw.reference : reference,
    amount: typeof raw.amount === "number" ? raw.amount : Number.NaN,
    currency: typeof raw.currency === "string" ? raw.currency : "",
    channel: typeof raw.channel === "string" ? raw.channel : null,
    gateway_response:
      typeof raw.gateway_response === "string" ? raw.gateway_response : null,
    paid_at: typeof raw.paid_at === "string" ? raw.paid_at : null,
    metadata: isRecord(raw.metadata) ? raw.metadata : null,
  };
}

export interface RefundResult {
  /** Paystack refund id. */
  id: number;
  /** pending | processing | processed | failed */
  status: string;
}

/**
 * Refund a transaction IN FULL (amount omitted → Paystack refunds
 * whatever remains refundable, which also makes accidental double
 * refunds fail loudly instead of over-refunding).
 *
 * Throws on transport/API failure — the caller must only persist the
 * local REFUNDED state after this resolves successfully.
 */
export async function createRefund(
  reference: string,
  merchantNote?: string
): Promise<RefundResult> {
  const data = await paystackRequest<{
    id?: unknown;
    status?: unknown;
  }>("POST", "/refund", {
    transaction: reference,
    merchant_note: merchantNote,
  });

  return {
    id: typeof data.id === "number" ? data.id : 0,
    status: typeof data.status === "string" ? data.status : "pending",
  };
}
