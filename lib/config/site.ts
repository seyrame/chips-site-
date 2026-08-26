/**
 * Central business configuration — PLACEHOLDER VALUES.
 * Per project spec: do not invent real business information.
 * Replace these via environment variables when real values are known.
 */

export const BRAND = {
  name: "TT Brothers",
  tagline: "Premium Ghanaian Crunch",
  description:
    "TT Brothers is a premium Ghanaian food brand. Small-batch plantain chips, made with care.",
  currency: {
    code: "GHS",
    symbol: "GH₵",
  },
  timezone: "Africa/Accra",
} as const;

/** Business-wide constants — single source of truth. */
export const CONFIG = {
  /** Max quantity per line item in cart / checkout. */
  maxLineQuantity: 99,
  /** Supabase storage bucket for product images. */
  storageBucket: "product-images",
  /** Max rows returned from storefront variant/image queries. */
  maxQueryLimit: 10_000,
} as const;

/**
 * WhatsApp number in international format without "+" (e.g. 233201234567).
 *
 * SERVER-SIDE ONLY: WHATSAPP_NUMBER is not NEXT_PUBLIC_-prefixed, so this
 * returns "" in the browser. Client components must receive the link via a
 * server component prop (or the public.* app_settings row) instead.
 */
export function getWhatsAppNumber(): string {
  return process.env.WHATSAPP_NUMBER ?? "";
}

export function buildWhatsAppLink(message: string): string | null {
  const number = getWhatsAppNumber();
  if (!number || number.includes("X")) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP_DEFAULT_MESSAGE =
  `Hello ${BRAND.name}, I need help with my order.`;

export function buildOrderSupportLink(orderNumber: string): string | null {
  return buildWhatsAppLink(
    `Hello ${BRAND.name}, I need help with my order ${orderNumber}.`
  );
}
