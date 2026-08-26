"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteProductImageAction,
  setPrimaryImageAction,
  uploadProductImageAction,
} from "@/app/actions/admin-product-images";
import type { ActionState } from "@/app/actions/admin-products";

interface GalleryImage {
  id: string;
  image_url: string;
  alt_text: string | null;
}

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-forest px-6 py-2.5 text-sm font-semibold text-cream hover:bg-forest-soft disabled:opacity-60"
    >
      {pending ? "Uploading…" : "Upload image"}
    </button>
  );
}

export function ImageManager({
  productId,
  images,
}: {
  productId: string;
  images: GalleryImage[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    uploadProductImageAction,
    {}
  );

  return (
    <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
      <h2 className="font-display text-2xl text-forest">Images</h2>
      <p className="mt-1 text-sm text-charcoal/60">
        The first image is the primary photo shown on cards. JPEG, PNG or WebP,
        up to 5 MB.
      </p>

      <form action={formAction} className="mt-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="product_id" value={productId} />
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-widest text-toast">
          File *
          <input
            type="file"
            name="file"
            required
            accept="image/jpeg,image/png,image/webp"
            className="block w-full max-w-xs text-sm text-charcoal file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-cream-dark file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-forest"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-widest text-toast">
          Alt text
          <input
            name="alt_text"
            maxLength={200}
            className="h-11 w-56 rounded-xl border border-forest/15 px-3.5 text-sm outline-none focus:border-forest"
            placeholder="Pack of plantain chips on kente cloth"
          />
        </label>
        <UploadButton />
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-3 text-sm text-forest">
          ✓ {state.success}
        </p>
      ) : null}

      {images.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-2xl border border-toast/15 bg-cream"
            >
              {/* Storage URLs are external hosts — plain img keeps the
                  admin panel free of next/image domain config. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.image_url}
                alt={image.alt_text ?? ""}
                className="aspect-square w-full object-cover"
              />
              <div className="flex items-center justify-between gap-1 p-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-charcoal/50">
                  {index === 0 ? "Primary" : `#${index + 1}`}
                </span>
                <div className="flex gap-1">
                  {index !== 0 ? (
                    <form action={setPrimaryImageAction}>
                      <input type="hidden" name="image_id" value={image.id} />
                      <input
                        type="hidden"
                        name="product_id"
                        value={productId}
                      />
                      <button
                        type="submit"
                        title="Make primary"
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-forest hover:bg-cream-dark"
                      >
                        ★
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteProductImageAction}>
                    <input type="hidden" name="image_id" value={image.id} />
                    <input type="hidden" name="product_id" value={productId} />
                    <button
                      type="submit"
                      title="Delete image"
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        if (!window.confirm("Delete this image? This cannot be undone.")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-2xl bg-cream p-6 text-center text-sm text-charcoal/50">
          No images yet.
        </p>
      )}
    </section>
  );
}
