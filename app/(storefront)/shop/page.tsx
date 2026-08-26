import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/storefront/product-card";
import {
  listActiveCategories,
  listShopProducts,
} from "@/services/storefront";

export const metadata: Metadata = {
  title: "Shop — TT Brothers",
  description:
    "Browse small-batch Ghanaian plantain chips. Original, sweet and spicy — delivered fresh.",
};

/** Revalidate the shop index every 60 seconds (ISR). */
export const revalidate = 60;

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

export default async function ShopPage({
  searchParams,
}: PageProps<"/shop">) {
  const params = await searchParams;
  const category = firstParam(params.category);
  const search = firstParam(params.q);

  const [products, categories] = await Promise.all([
    listShopProducts({ categorySlug: category, search }),
    listActiveCategories(),
  ]);

  function filterHref(next: { category?: string }) {
    const sp = new URLSearchParams();
    const cat = next.category ?? category;
    if (cat) sp.set("category", cat);
    if (search) sp.set("q", search);
    const qs = sp.toString();
    return qs ? `/shop?${qs}` : "/shop";
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-toast">
          The shop
        </p>
        <h1 className="mt-2 font-display text-5xl text-forest">
          Pick your crunch
        </h1>
        <p className="mx-auto mt-4 max-w-md text-charcoal/70">
          Every bag is hand-cut and fried in small batches. Choose a flavour
          below.
        </p>
      </header>

      {/* Search */}
      <form action="/shop" method="get" className="mx-auto mt-8 flex max-w-md gap-2">
        {category ? (
          <input type="hidden" name="category" value={category} />
        ) : null}
        <input
          name="q"
          defaultValue={search}
          placeholder="Search flavours…"
          aria-label="Search products"
          className="h-12 flex-1 rounded-full border border-forest/15 bg-white px-5 text-sm outline-none focus:border-forest"
        />
        <button
          type="submit"
          className="h-12 rounded-full bg-forest px-6 text-sm font-semibold text-cream hover:bg-forest-soft"
        >
          Search
        </button>
      </form>

      {/* Category chips */}
      {categories.length > 1 ||
      (categories.length === 1 && category) ? (
        <nav
          aria-label="Categories"
          className="mt-6 flex flex-wrap justify-center gap-2"
        >
          <Link
            href={filterHref({ category: "" })}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              !category
                ? "border-forest bg-forest text-cream"
                : "border-forest/20 bg-white text-charcoal hover:border-forest"
            }`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={filterHref({ category: c.slug })}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                category === c.slug
                  ? "border-forest bg-forest text-cream"
                  : "border-forest/20 bg-white text-charcoal hover:border-forest"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* Results */}
      {products.length > 0 ? (
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-16 rounded-3xl border border-toast/15 bg-white p-12 text-center">
          <p className="font-display text-2xl text-forest">Nothing found</p>
          <p className="mt-2 text-sm text-charcoal/60">
            {search
              ? `No products match “${search}”.`
              : "This shelf is being restocked."}
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-soft"
          >
            Show everything
          </Link>
        </div>
      )}
    </div>
  );
}
