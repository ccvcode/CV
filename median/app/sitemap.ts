import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return [
    { url: site, changeFrequency: "always", priority: 1 },
    { url: `${site}/live`, changeFrequency: "always", priority: 0.9 },
    ...CATEGORIES.map((c) => ({ url: `${site}/categorie/${c.slug}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    { url: `${site}/surse`, changeFrequency: "daily", priority: 0.4 },
    { url: `${site}/despre`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
