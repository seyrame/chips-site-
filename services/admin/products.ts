import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  InventoryMovementRow,
  ProductImageRow,
  ProductRow,
  ProductVariantRow,
} from "@/types";

/**
 * Admin catalog reads. All queries run through the cookie-scoped
 * Supabase client under RLS — STAFF sees everything read-only,
 * OWNER/ADMIN additionally get write access via is_manager().
 */

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export interface ProductListItem {
  product: Pick<
    ProductRow,
    "id" | "name" | "slug" | "active" | "featured" | "short_description"
  > & { category_name: string };
  variants: Array<
    Pick<
      ProductVariantRow,
      "id" | "name" | "price" | "stock_quantity" | "low_stock_threshold" | "active"
    >
  >;
  primaryImage: Pick<ProductImageRow, "image_url" | "alt_text"> | null;
}

export async function listProductsForAdmin(): Promise<ProductListItem[]> {
  const supabase = await createClient();

  const [{ data: products, error: pErr }, { data: variants, error: vErr }, { data: images, error: iErr }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, slug, active, featured, short_description, category:categories(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("product_variants")
        .select("id, product_id, name, price, stock_quantity, low_stock_threshold, active")
        .order("sort_order"),
      supabase
        .from("product_images")
        .select("product_id, image_url, alt_text, sort_order")
        .order("sort_order"),
    ]);

  if (pErr || vErr || iErr) throw (pErr ?? vErr ?? iErr);

  return (products ?? []).map((p) => {
    const categoryRow = Array.isArray(p.category) ? p.category[0] : p.category;
    const productVariants = (variants ?? []).filter((v) => v.product_id === p.id);
    const firstImage = (images ?? []).find((i) => i.product_id === p.id);
    return {
      product: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        active: p.active,
        featured: p.featured,
        short_description: p.short_description,
        category_name: categoryRow?.name ?? "Uncategorized",
      },
      variants: productVariants.map((v) => ({
        id: v.id,
        name: v.name,
        price: Number(v.price),
        stock_quantity: v.stock_quantity,
        low_stock_threshold: v.low_stock_threshold,
        active: v.active,
      })),
      primaryImage: firstImage
        ? { image_url: firstImage.image_url, alt_text: firstImage.alt_text }
        : null,
    };
  });
}

export interface AdminProduct
  extends ProductRow {
  category_name?: string;
  variants: ProductVariantRow[];
  images: ProductImageRow[];
}

export async function getProductById(productId: string): Promise<AdminProduct | null> {
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("*, category:categories(name)")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw error;
  if (!product) return null;

  const [variantsResult, imagesResult] = await Promise.all([
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order"),
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order"),
  ]);

  if (variantsResult.error) throw variantsResult.error;
  if (imagesResult.error) throw imagesResult.error;

  const categoryRow = Array.isArray(product.category)
    ? product.category[0]
    : product.category;

  return {
    ...product,
    category: undefined,
    category_name: categoryRow?.name,
    variants: variantsResult.data ?? [],
    images: imagesResult.data ?? [],
  };
}

export interface InventoryRow {
  variantId: string;
  variantName: string;
  productName: string;
  productId: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  active: boolean;
}

export async function listInventoryRows(): Promise<InventoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("id, name, price, stock_quantity, low_stock_threshold, active, product:products(id, name)")
    .order("product_id")
    .order("sort_order");

  if (error) throw error;

  return (data ?? []).map((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    return {
      variantId: row.id,
      variantName: row.name,
      productId: product?.id ?? "",
      productName: product?.name ?? "—",
      price: Number(row.price),
      stockQuantity: row.stock_quantity,
      lowStockThreshold: row.low_stock_threshold,
      active: row.active,
    };
  });
}

export async function listRecentMovements(
  limit = 25
): Promise<InventoryMovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
