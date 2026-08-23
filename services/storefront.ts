import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Category, ProductImageRow, ProductVariantRow } from "@/types";

/**
 * Storefront catalog reads — active rows only, enforced by RLS
 * (anon visitors see nothing else even if a query is malformed).
 */

export interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  categorySlug: string;
  categoryName: string;
  imageUrl: string | null;
  imageAlt: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
}

function toShopProduct(
  product: {
    id: string;
    name: string;
    slug: string;
    short_description: string | null;
  },
  category: { name: string; slug: string } | null,
  variants: ProductVariantRow[],
  primaryImage: ProductImageRow | null
): ShopProduct {
  const prices = variants.map((v) => Number(v.price));
  return {
    ...product,
    categorySlug: category?.slug ?? "",
    categoryName: category?.name ?? "",
    imageUrl: primaryImage?.image_url ?? null,
    imageAlt: primaryImage?.alt_text ?? product.name,
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    maxPrice: prices.length > 0 ? Math.max(...prices) : null,
    inStock: variants.some((v) => v.active && v.stock_quantity > 0),
  };
}

export async function listActiveCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function listFeaturedProducts(limit = 3): Promise<ShopProduct[]> {
  const supabase = await createClient();

  const [{ data: products, error: pErr }, { data: variants, error: vErr }, { data: images, error: iErr }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, slug, short_description, category:categories!inner(name, slug)")
        .eq("active", true)
        .eq("featured", true)
        .limit(limit),
      supabase
        .from("product_variants")
        .select("*")
        .eq("active", true)
        .gt("stock_quantity", 0),
      supabase
        .from("product_images")
        .select("*")
        .order("sort_order"),
    ]);

  if (pErr || vErr || iErr) throw (pErr ?? vErr ?? iErr);

  return (products ?? []).map((p) => {
    const category = Array.isArray(p.category) ? p.category[0] : p.category;
    const pid = p.id;
    return toShopProduct(
      p,
      category ?? null,
      (variants ?? []).filter((v) => v.product_id === pid),
      (images ?? []).find((i) => i.product_id === pid) ?? null
    );
  });
}

export async function listShopProducts(options?: {
  categorySlug?: string;
  search?: string;
}): Promise<ShopProduct[]> {
  const supabase = await createClient();

  let categoryId: string | undefined;
  if (options?.categorySlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", options.categorySlug)
      .maybeSingle();
    // Unknown category → empty result set rather than unfiltered list.
    if (!cat) return [];
    categoryId = cat.id;
  }

  let query = supabase
    .from("products")
    .select("id, name, slug, short_description, category:categories!inner(name, slug)")
    .eq("active", true)
    .order("name");

  if (categoryId) query = query.eq("category_id", categoryId);
  if (options?.search) {
    const q = options.search.replace(/[%_,()]/g, " ").trim();
    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    }
  }

  const [{ data: products, error: pErr }, { data: variants, error: vErr }, { data: images, error: iErr }] =
    await Promise.all([
      query,
      supabase.from("product_variants").select("*").eq("active", true),
      supabase.from("product_images").select("*").order("sort_order"),
    ]);

  if (pErr || vErr || iErr) throw (pErr ?? vErr ?? iErr);

  return (products ?? []).map((p) => {
    const category = Array.isArray(p.category) ? p.category[0] : p.category;
    const pid = p.id;
    return toShopProduct(
      p,
      category ?? null,
      (variants ?? []).filter((v) => v.product_id === pid),
      (images ?? []).find((i) => i.product_id === pid) ?? null
    );
  });
}

export interface ProductDetail extends ShopProduct {
  description: string | null;
  ingredients: string | null;
  featured: boolean;
  images: ProductImageRow[];
  /** Active variants with stock info for the size picker. */
  variants: Array<{
    id: string;
    name: string;
    price: number;
    stockQuantity: number;
    lowStockThreshold: number;
  }>;
}

export async function getProductBySlug(
  slug: string
): Promise<ProductDetail | null> {
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*, category:categories!inner(name, slug)")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!product) return null;

  const [variantsResult, imagesResult] = await Promise.all([
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order"),
  ]);

  if (variantsResult.error) throw variantsResult.error;
  if (imagesResult.error) throw imagesResult.error;

  const category = Array.isArray(product.category)
    ? product.category[0]
    : product.category;

  const base = toShopProduct(
    product,
    category ?? null,
    variantsResult.data ?? [],
    (imagesResult.data ?? [])[0] ?? null
  );

  return {
    ...base,
    description: product.description,
    ingredients: product.ingredients,
    featured: product.featured,
    images: imagesResult.data ?? [],
    variants: (variantsResult.data ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      price: Number(v.price),
      stockQuantity: v.stock_quantity,
      lowStockThreshold: v.low_stock_threshold,
    })),
  };
}
