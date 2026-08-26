"use server";

/**
 * Revalidation helpers — call after admin mutations to keep ISR pages
 * fresh. Uses Next.js server-only revalidatePath/revalidateTag.
 */

import { revalidatePath, revalidateTag } from "next/cache";

/** Revalidate storefront pages after product changes. */
export async function revalidateProduct(slug?: string): Promise<void> {
  revalidateTag("products", "max");
  revalidatePath("/shop");
  if (slug) {
    revalidatePath(`/shop/${slug}`);
  }
}

/** Revalidate storefront after category changes. */
export async function revalidateCategory(): Promise<void> {
  revalidateTag("categories", "max");
  revalidatePath("/shop");
}

/** Revalidate the entire storefront (nuclear option). */
export async function revalidateAll(): Promise<void> {
  revalidatePath("/", "layout");
}
