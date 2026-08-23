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
} as const;

/** WhatsApp number in international format without "+" (e.g. 233201234567). */
export function getWhatsAppNumber(): string {
  return process.env.WHATSAPP_NUMBER ?? "";
}

export function buildWhatsAppLink(message: string): string | null {
  const number = getWhatsAppNumber();
  if (!number || number.includes("X")) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP_DEFAULT_MESSAGE =
  "Hello TT Brothers, I need help with my order.";

export function buildOrderSupportLink(orderNumber: string): string | null {
  return buildWhatsAppLink(
    `Hello TT Brothers, I need help with my order ${orderNumber}.`
  );
}
