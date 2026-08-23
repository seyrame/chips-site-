import Image from "next/image";
import Link from "next/link";

import type { ShopProduct } from "@/services/storefront";
import { formatMoney } from "@/utils/money";

export function ProductCard({ product }: { product: ShopProduct }) {
  const priceRange =
    product.minPrice !== null &&
    product.maxPrice !== null &&
    product.minPrice !== product.maxPrice
      ? `${formatMoney(product.minPrice)} – ${formatMoney(product.maxPrice)}`
      : product.minPrice !== null
        ? formatMoney(product.minPrice)
        : null;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-toast/15 bg-white transition-shadow duration-300 hover:shadow-xl"
    >
      <div className="relative aspect-square overflow-hidden bg-cream-dark">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest text-charcoal/40">
            Coming soon
          </span>
        )}
        {!product.inStock ? (
          <span className="absolute top-3 right-3 rounded-full bg-charcoal/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream">
            Sold out
          </span>
        ) : (
          <span className="absolute top-3 right-3 rounded-full bg-forest px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream">
            In stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-toast">
          {product.categoryName}
        </p>
        <h2 className="font-display text-xl leading-snug text-forest">
          {product.name}
        </h2>
        {product.short_description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-charcoal/60">
            {product.short_description}
          </p>
        ) : null}
        {priceRange ? (
          <p className="mt-auto pt-2 text-sm font-bold text-forest">
            {priceRange}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
