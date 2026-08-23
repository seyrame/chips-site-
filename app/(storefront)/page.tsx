import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ProductCard } from "@/components/storefront/product-card";
import { BRAND } from "@/lib/config/site";
import { listActiveCategories, listFeaturedProducts } from "@/services/storefront";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
};

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    listFeaturedProducts(),
    listActiveCategories(),
  ]);

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-forest text-cream">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-plantain/15 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-toast/20 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 py-24 text-center sm:py-32">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-plantain">
            Ghana · Small Batch · {new Date().getFullYear()}
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.1] sm:text-6xl lg:text-7xl">
            {BRAND.name}
            <span className="mt-3 block text-plantain">{BRAND.tagline}</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-cream/75">
            Hand-cut, small-batch plantain chips — fried golden, salted just
            right, sealed at peak crunch. Delivered fresh across Accra and
            beyond.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/shop"
              className="rounded-full bg-plantain px-9 py-4 text-sm font-bold text-forest transition-transform duration-300 hover:scale-[1.03]"
            >
              Shop the Crunch
            </Link>
            {categories.length > 0 ? (
              <Link
                href="/#story"
                className="rounded-full border border-cream/25 px-9 py-4 text-sm font-semibold transition-colors hover:bg-cream/10"
              >
                Why TT Brothers?
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── Featured products ── */}
      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-toast">
                The line-up
              </p>
              <h2 className="mt-2 font-display text-4xl text-forest">
                Featured crunch
              </h2>
            </div>
            <Link
              href="/shop"
              className="shrink-0 text-sm font-semibold text-forest underline-offset-4 hover:underline"
            >
              View all →
            </Link>
          </div>

          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Story / values ── */}
      <section id="story" className="bg-cream-dark">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-lg">
            <Image
              src="/images/products/tt-original-open.svg"
              alt="TT Brothers plantain chips served in a bowl"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-toast">
              Our story
            </p>
            <h2 className="mt-2 font-display text-4xl leading-tight text-forest">
              Real plantains. Real crunch. No shortcuts.
            </h2>
            <p className="mt-5 leading-relaxed text-charcoal/70">
              We buy ripe plantains from local farmers, slice them by hand and
              fry them the same day. That is the whole secret — no additives,
              no compromises.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                {
                  title: "Farm-direct plantains",
                  body: "Sourced weekly from trusted growers across southern Ghana.",
                },
                {
                  title: "Small-batch frying",
                  body: "Cooked in manageable batches so every chip comes out golden.",
                },
                {
                  title: "Sealed at peak freshness",
                  body: "Packed within hours of frying for maximum shelf-side crunch.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-4">
                  <span
                    aria-hidden
                    className="mt-1 h-6 w-6 shrink-0 rounded-full bg-plantain/25 p-1 text-center text-xs leading-4"
                  >
                    ✓
                  </span>
                  <div>
                    <p className="font-semibold text-forest">{item.title}</p>
                    <p className="text-sm text-charcoal/60">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h2 className="font-display text-4xl text-forest">
          Ready to taste the difference?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-charcoal/70">
          Pick a flavour, choose your size, and we will handle the rest.
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-block rounded-full bg-forest px-10 py-4 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          Browse all products
        </Link>
      </section>
    </>
  );
}
