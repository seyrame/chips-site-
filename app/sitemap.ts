import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/returns`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Dynamic product pages
  try {
    const supabase = await createClient();
    const { data: products } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("active", true)
      .order("updated_at", { ascending: false });

    const productPages: MetadataRoute.Sitemap =
      products?.map((p) => ({
        url: `${baseUrl}/shop/${p.slug}`,
        lastModified: p.updated_at ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })) ?? [];

    return [...staticPages, ...productPages];
  } catch {
    return staticPages;
  }
}
