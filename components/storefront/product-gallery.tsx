"use client";

import { useState } from "react";
import Image from "next/image";

interface GalleryImage {
  id: string;
  image_url: string;
  alt_text: string | null;
}

export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? null;

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-3xl bg-cream-dark text-xs uppercase tracking-widest text-charcoal/40">
        Photo coming soon
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-cream-dark shadow-sm">
        <Image
          key={active.id}
          src={active.image_url}
          alt={active.alt_text ?? productName}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === activeIndex}
                className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 transition-colors ${
                  index === activeIndex
                    ? "border-forest"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Image
                  src={image.image_url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
