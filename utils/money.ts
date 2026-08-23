/**
 * Money helpers.
 *
 * DATABASE CONVENTION: all monetary values are integer pesewas
 * (GHS minor units). GH₵35.00 === 3500 pesewas — same format the
 * Paystack API expects. Never use floats for money.
 */

const CEDIS_FORMAT = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
});

/** 3500 → "GH₵35.00" */
export function formatMoney(pesewas: number): string {
  return CEDIS_FORMAT.format(pesewas / 100);
}

/** "35" or "35.50" (cedis) → 3500 pesewas. Throws on invalid input. */
export function cedisToPesewas(cedis: string | number): number {
  const value = typeof cedis === "string" ? Number.parseFloat(cedis) : cedis;
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid cedis amount: ${String(cedis)}`);
  }
  const pesewas = Math.round(value * 100);
  return pesewas;
}

/** 3500 → 35 (float, display-only) */
export function pesewasToCedis(pesewas: number): number {
  return pesewas / 100;
}
