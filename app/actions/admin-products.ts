"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireManagerAccess } from "@/services/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cedisToPesewas } from "@/utils/money";

export interface ActionState {
  error?: string;
  success?: string;
}

/* ── Validation schemas ─────────────────────────────────────── */

const productFieldsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  slug: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug may only contain lowercase letters, numbers and hyphens"
    )
    .max(140)
    .optional()
    .or(z.literal("")),
  category_id: z.uuid("Choose a category"),
  short_description: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  ingredients: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

const variantRowSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Variant name is required").max(60),
  priceCedis: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, "Price must look like 35 or 35.50"),
  stockQuantity: z.coerce.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(5),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

/** Postgres unique-violation → human message. */
function uniqueMessage(e: unknown): string | null {
  if (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "23505"
  ) {
    const msg = (e as { message?: string }).message ?? "";
    if (msg.includes("products_slug_key")) {
      return "That URL slug is already in use.";
    }
    if (msg.includes("variants_product_name_key")) {
      return "A variant with that name already exists on this product.";
    }
    if (msg.includes("variants_sku_key")) {
      return "That SKU is already assigned to another variant.";
    }
    return "That value must be unique and is already taken.";
  }
  return null;
}

function dbError(e: unknown): string {
  const unique = uniqueMessage(e);
  if (unique) return unique;
  console.error("[admin-products]", e);
  return "Something went wrong saving. Please try again.";
}

function parseProduct(formData: FormData) {
  return productFieldsSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    category_id: formData.get("category_id"),
    short_description: formData.get("short_description") ?? "",
    description: formData.get("description") ?? "",
    ingredients: formData.get("ingredients") ?? "",
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
  });
}

interface ParsedVariant {
  id?: string;
  name: string;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  sku: string | null;
  active: boolean;
}

function parseVariants(formData: FormData): ParsedVariant[] | string {
  // Variants arrive as parallel arrays: variant_id[], variant_name[], ...
  const ids = formData.getAll("variant_id").map(String);
  const names = formData.getAll("variant_name").map(String);
  const prices = formData.getAll("variant_price").map(String);
  const stocks = formData.getAll("variant_stock").map(String);
  const thresholds = formData.getAll("variant_threshold").map(String);
  const skus = formData.getAll("variant_sku").map(String);

  const rows = names
    .map((name, i) => ({
      id: ids[i] || undefined,
      name,
      priceCedis: prices[i] ?? "",
      stockQuantity: stocks[i] ?? "0",
      lowStockThreshold: thresholds[i] ?? "5",
      sku: skus[i] ?? "",
      active: true,
    }))
    .filter((r) => r.name.trim() !== "" || r.priceCedis.trim() !== "");

  if (rows.length === 0) {
    return "Add at least one variant (e.g. Small / Medium / Large).";
  }

  const parsed: ParsedVariant[] = [];
  for (const row of rows) {
    const result = variantRowSchema.safeParse(row);
    if (!result.success) {
      return `Variant "${row.name || "(unnamed)"}": ${
        z.prettifyError(result.error).split("\n")[0]
      }`;
    }
    parsed.push({
      id: result.data.id,
      name: result.data.name,
      // Money convention: cedis input → integer pesewas storage.
      price: cedisToPesewas(result.data.priceCedis),
      stock_quantity: result.data.stockQuantity,
      low_stock_threshold: result.data.lowStockThreshold,
      sku: result.data.sku ? result.data.sku : null,
      active: true,
    });
  }
  return parsed;
}

async function replaceVariants(productId: string, variants: ParsedVariant[]) {
  const supabase = await createClient();

  // Keep existing rows (stable ids for orders/analytics), insert new,
  // remove missing — all under RLS as the signed-in manager.
  const keepIds = variants.map((v) => v.id).filter(Boolean) as string[];

  const { data: existing } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);

  const toDelete = (existing ?? [])
    .map((e) => e.id)
    .filter((id) => !keepIds.includes(id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("product_variants")
      .delete()
      .in("id", toDelete);
    if (error) throw error;
  }

  for (const [index, v] of variants.entries()) {
    const values = {
      product_id: productId,
      name: v.name,
      price: v.price,
      stock_quantity: v.stock_quantity,
      low_stock_threshold: v.low_stock_threshold,
      sku: v.sku,
      active: v.active,
      sort_order: index,
    };
    if (v.id) {
      const { error } = await supabase
        .from("product_variants")
        .update(values)
        .eq("id", v.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("product_variants").insert(values);
      if (error) throw error;
    }
  }
}

/* ── Product mutations ──────────────────────────────────────── */

const EMPTY_STATE: ActionState = {};

export async function createProductAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireManagerAccess();

  const parsed = parseProduct(formData);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error).split("\n")[0] };
  }

  const variants = parseVariants(formData);
  if (typeof variants === "string") return { error: variants };

  const data = parsed.data;
  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      name: data.name,
      slug: data.slug ? data.slug : slugify(data.name),
      category_id: data.category_id,
      short_description: data.short_description || null,
      description: data.description || null,
      ingredients: data.ingredients || null,
      active: data.active,
      featured: data.featured,
    })
    .select("id")
    .single();

  if (error) return { error: dbError(error) };

  try {
    await replaceVariants(created.id, variants);
  } catch (e) {
    // Roll back the shell product so a failed variant save never
    // leaves an empty ghost row behind.
    await supabase.from("products").delete().eq("id", created.id);
    return { error: dbError(e) };
  }

  revalidatePath("/admin/products");
  redirect(`/admin/products/${created.id}`);
}

export async function updateProductAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireManagerAccess();

  const productId = formData.get("product_id");
  if (typeof productId !== "string" || !productId) {
    return { error: "Missing product." };
  }

  const parsed = parseProduct(formData);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error).split("\n")[0] };
  }

  const variants = parseVariants(formData);
  if (typeof variants === "string") return { error: variants };

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({
      name: data.name,
      slug: data.slug ? data.slug : slugify(data.name),
      category_id: data.category_id,
      short_description: data.short_description || null,
      description: data.description || null,
      ingredients: data.ingredients || null,
      active: data.active,
      featured: data.featured,
    })
    .eq("id", productId);

  if (error) return { error: dbError(error) };

  try {
    await replaceVariants(productId, variants);
  } catch (e) {
    return { error: dbError(e) };
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  return { ...EMPTY_STATE, success: "Saved." };
}

export async function toggleProductActiveAction(formData: FormData) {
  await requireManagerAccess();

  const productId = String(formData.get("product_id") ?? "");
  const nextActive = formData.get("next_active") === "true";
  if (!productId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ active: nextActive })
    .eq("id", productId);
  if (error) {
    console.error("[toggleProductActive]", error);
    return;
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
}

/* ── Stock adjustments ──────────────────────────────────────── */

const adjustmentSchema = z.object({
  variantId: z.uuid(),
  delta: z.coerce
    .number()
    .int("Adjust by whole units")
    .refine((n) => n !== 0, "Adjustment cannot be zero"),
  note: z.string().trim().max(280).optional().or(z.literal("")),
});

export async function adjustStockAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireManagerAccess();

  const parsed = adjustmentSchema.safeParse({
    variantId: formData.get("variant_id"),
    delta: formData.get("delta"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error).split("\n")[0] };
  }

  // Authorization first (cookie session → profiles.role), then the RPC
  // via the service-role client: adjust_variant_stock() is intentionally
  // revoked from anon/authenticated (migration 0006) so only the trusted
  // server pipeline can move stock. p_actor keeps the audit trail honest.
  const admin = await requireManagerAccess();

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("adjust_variant_stock", {
    p_variant_id: parsed.data.variantId,
    p_delta: parsed.data.delta,
    // Manual admin corrections (restocks, write-offs, recounts) all land
    // here; the free-text note carries the business context.
    p_reason: "ADMIN_ADJUSTMENT",
    p_note: parsed.data.note || null,
    p_actor: admin.id,
  });

  if (error) {
    if (error.message.includes("INSUFFICIENT_OR_INACTIVE_VARIANT")) {
      return {
        error:
          "Rejected — not enough stock on hand (or the variant is inactive).",
      };
    }
    console.error("[adjustStock]", error);
    return { error: "Could not adjust stock. Please try again." };
  }

  const newLevel = typeof data === "number" ? data : null;
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  return {
    success:
      newLevel !== null ? `Done — new stock level: ${newLevel}.` : "Stock adjusted.",
  };
}
