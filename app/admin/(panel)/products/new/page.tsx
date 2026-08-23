import type { Metadata } from "next";
import Link from "next/link";

import { ProductForm } from "@/components/admin/product-form";
import { listCategories } from "@/services/admin/products";

export const metadata: Metadata = {
  title: "New product",
};

export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/admin/products"
          className="text-xs font-semibold uppercase tracking-widest text-forest hover:text-forest-soft"
        >
          ← All products
        </Link>
        <h1 className="mt-2 font-display text-4xl text-forest">New product</h1>
      </header>

      <ProductForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
