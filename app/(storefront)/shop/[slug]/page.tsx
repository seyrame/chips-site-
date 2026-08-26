import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductGallery } from "@/components/storefront/product-gallery";
import { VariantPicker } from "@/components/storefront/variant-picker";
import { BRAND, buildWhatsAppLink } from "@/lib/config/site";
import { getProductBySlug } from "@/services/storefront";

/** Revalidate product pages every 60 seconds (ISR). */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description:
      product.short_description ??
      product.description?.slice(0, 160) ??
      undefined,
    openGraph: {
      title: product.name,
      description: product.short_description ?? undefined,
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/shop/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const whatsappLink = buildWhatsAppLink(
    `Hello ${BRAND.name}, I would like to order ${product.name}.`
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-charcoal/50">
        <Link href="/shop" className="hover:text-forest">
          Shop
        </Link>
        <span aria-hidden> / </span>
        <Link
          href={`/shop?category=${product.categorySlug}`}
          className="hover:text-forest"
        >
          {product.categoryName}
        </Link>
        <span aria-hidden> / </span>
        <span className="text-charcoal">{product.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.images.map((i) => ({
            id: i.id,
            image_url: i.image_url,
            alt_text: i.alt_text,
          }))}
          productName={product.name}
        />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-toast">
            {product.categoryName}
          </p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-forest sm:text-5xl">
            {product.name}
          </h1>

          <div className="mt-6">
            <VariantPicker
              productId={product.id}
              productSlug={product.slug}
              productName={product.name}
              imageUrl={product.imageUrl}
              variants={product.variants}
            />
          </div>

          {whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex rounded-full bg-[#25d366] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Order on WhatsApp
            </a>
          ) : null}

          {product.short_description || product.description ? (
            <section className="mt-10 border-t border-toast/15 pt-8">
              <h2 className="font-display text-2xl text-forest">About</h2>
              {product.short_description ? (
                <p className="mt-3 font-medium text-charcoal/80">
                  {product.short_description}
                </p>
              ) : null}
              {product.description ? (
                <p className="mt-3 leading-relaxed whitespace-pre-line break-words text-charcoal/70">
                  {product.description}
                </p>
              ) : null}
            </section>
          ) : null}

          {product.ingredients ? (
            <section className="mt-8 border-t border-toast/15 pt-8">
              <h2 className="font-display text-2xl text-forest">Ingredients</h2>
              <p className="mt-3 leading-relaxed break-words text-charcoal/70">
                {product.ingredients}
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
