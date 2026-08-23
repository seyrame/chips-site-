import type { Metadata } from "next";
import Link from "next/link";

import { listProductsForAdmin } from "@/services/admin/products";
import { formatMoney } from "@/utils/money";

export const metadata: Metadata = {
  title: "Products",
};

export default async function AdminProductsPage() {
  const rows = await listProductsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-forest">Products</h1>
          <p className="mt-1 text-sm text-charcoal/70">
            {rows.length} product{rows.length === 1 ? "" : "s"} in the catalog
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          + New product
        </Link>
      </header>

      {rows.length === 0 ? (
        <section className="rounded-3xl border border-toast/15 bg-white p-10 text-center">
          <p className="font-display text-2xl text-forest">No products yet</p>
          <p className="mt-2 text-sm text-charcoal/70">
            Create your first product to start selling.
          </p>
          <Link
            href="/admin/products/new"
            className="mt-5 inline-block rounded-full bg-forest px-6 py-2.5 text-sm font-semibold text-cream hover:bg-forest-soft"
          >
            Create product
          </Link>
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ product, variants, primaryImage }) => {
            const totalStock = variants.reduce(
              (sum, v) => sum + v.stock_quantity,
              0
            );
            const lowCount = variants.filter(
              (v) =>
                v.stock_quantity > 0 &&
                v.stock_quantity <= v.low_stock_threshold
            ).length;
            const outCount = variants.filter(
              (v) => v.stock_quantity === 0
            ).length;

            return (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-3xl border border-toast/15 bg-white transition-shadow hover:shadow-lg"
                >
                  <div className="relative aspect-[16/9] bg-cream-dark">
                    {primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryImage.image_url}
                        alt={primaryImage.alt_text ?? product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest text-charcoal/40">
                        No image yet
                      </span>
                    )}
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <StatusBadge active={product.active} />
                      {product.featured ? (
                        <span className="rounded-full bg-plantain px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-forest">
                          Featured
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-toast">
                      {product.category_name}
                    </p>
                    <h2 className="font-display text-xl leading-snug text-forest">
                      {product.name}
                    </h2>

                    <dl className="mt-auto grid grid-cols-3 gap-2 pt-3 text-center text-xs">
                      <div className="rounded-xl bg-cream py-2">
                        <dt className="text-charcoal/50">Variants</dt>
                        <dd className="font-bold text-forest">
                          {variants.length}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-cream py-2">
                        <dt className="text-charcoal/50">Stock</dt>
                        <dd
                          className={`font-bold ${
                            outCount > 0
                              ? "text-red-700"
                              : lowCount > 0
                                ? "text-toast"
                                : "text-forest"
                          }`}
                        >
                          {totalStock}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-cream py-2">
                        <dt className="text-charcoal/50">From</dt>
                        <dd className="font-bold text-forest">
                          {variants.length > 0
                            ? formatMoney(
                                Math.min(...variants.map((v) => v.price))
                              )
                            : "—"}
                        </dd>
                      </div>
                    </dl>

                    {lowCount > 0 || outCount > 0 ? (
                      <p className="text-xs text-toast">
                        {outCount > 0
                          ? `${outCount} out of stock`
                          : `${lowCount} running low`}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
        active
          ? "bg-forest text-cream"
          : "bg-charcoal/60 text-cream"
      }`}
    >
      {active ? "Live" : "Hidden"}
    </span>
  );
}
