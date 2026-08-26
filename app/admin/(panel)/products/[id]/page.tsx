import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageManager } from "@/components/admin/image-manager";
import { ProductForm } from "@/components/admin/product-form";
import {
  getProductById,
  listCategories,
} from "@/services/admin/products";

export const metadata: Metadata = {
  title: "Edit product",
};

export default async function EditProductPage({
  params,
}: PageProps<"/admin/products/[id]">) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    getProductById(id),
    listCategories(),
  ]);

  if (!product) notFound();

  const drafts = product.variants.map((v) => ({
    key: `db-${v.id}`,
    id: v.id,
    name: v.name,
    priceCedis: String(Number(v.price) / 100),
    stockQuantity: String(v.stock_quantity),
    lowStockThreshold: String(v.low_stock_threshold),
    sku: v.sku ?? "",
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/admin/products"
          className="text-xs font-semibold uppercase tracking-widest text-forest hover:text-forest-soft"
        >
          ← All products
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold text-forest break-words sm:text-4xl">
          {product.name}
        </h1>
        <p className="mt-1 break-all text-sm text-charcoal/60">
          /shop/{product.slug} · in {product.category_name}
        </p>
      </header>

      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          category_id: product.category_id,
          short_description: product.short_description,
          description: product.description,
          ingredients: product.ingredients,
          active: product.active,
          featured: product.featured,
        }}
        initialVariants={drafts}
      />

      <ImageManager
        productId={product.id}
        images={product.images.map((i) => ({
          id: i.id,
          image_url: i.image_url,
          alt_text: i.alt_text,
        }))}
      />
    </div>
  );
}
