"use server";

import { revalidatePath } from "next/cache";

import { CONFIG } from "@/lib/config/site";
import { requireManagerAccess } from "@/services/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/app/actions/admin-products";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function revalidateProduct(productId: string) {
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
}

export async function uploadProductImageAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireManagerAccess();

  const productId = String(formData.get("product_id") ?? "");
  const altText = String(formData.get("alt_text") ?? "").trim();
  const file = formData.get("file");

  if (!productId || !(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file to upload." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Images must be 5 MB or smaller." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Use a JPEG, PNG or WebP image." };
  }

  const supabase = await createClient();

  // Bucket is public-read; RLS restricts writes to OWNER/ADMIN.
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-60) || "image";
  const path = `${productId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(CONFIG.storageBucket)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[uploadProductImage]", uploadError);
    return { error: "Upload failed. Please try again." };
  }

  const { data: publicUrl } = supabase.storage
    .from(CONFIG.storageBucket)
    .getPublicUrl(path);

  // New images append to the end of the gallery.
  const { data: lastImage } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = ((lastImage?.[0]?.sort_order as number | undefined) ?? -1) + 1;

  const { error: insertError } = await supabase.from("product_images").insert({
    product_id: productId,
    image_url: publicUrl.publicUrl,
    alt_text: altText || null,
    sort_order: nextOrder,
  });

  if (insertError) {
    // Orphan cleanup — don't leave stray objects in the bucket.
    await supabase.storage.from(CONFIG.storageBucket).remove([path]);
    console.error("[uploadProductImage]", insertError);
    return { error: "Could not attach the image. Please try again." };
  }

  revalidateProduct(productId);
  return { success: "Image uploaded." };
}

export async function setPrimaryImageAction(formData: FormData) {
  await requireManagerAccess();

  const imageId = String(formData.get("image_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  if (!imageId || !productId) return;

  const supabase = await createClient();

  // Primary = lowest sort_order → move the chosen image to the front.
  const { data: minRow } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order")
    .limit(1);

  const frontOrder = ((minRow?.[0]?.sort_order as number | undefined) ?? 0) - 1;

  const { error } = await supabase
    .from("product_images")
    .update({ sort_order: frontOrder })
    .eq("id", imageId)
    .eq("product_id", productId);
  if (error) {
    console.error("[setPrimaryImage]", error);
    return;
  }

  revalidateProduct(productId);
}

export async function deleteProductImageAction(formData: FormData) {
  await requireManagerAccess();

  const imageId = String(formData.get("image_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  if (!imageId || !productId) return;

  const supabase = await createClient();

  // Grab the storage path from the URL before deleting the row.
  const { data: image } = await supabase
    .from("product_images")
    .select("image_url")
    .eq("id", imageId)
    .eq("product_id", productId)
    .maybeSingle();

  const { error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .eq("product_id", productId);
  if (error) {
    console.error("[deleteProductImage]", error);
    return;
  }

  // Best-effort object removal; row deletion is what matters.
  if (image?.image_url.includes("/product-images/")) {
    const bucketPath = image.image_url.split("/product-images/")[1];
    if (bucketPath) {
      await supabase.storage.from(CONFIG.storageBucket).remove([bucketPath]);
    }
  }

  revalidateProduct(productId);
}
