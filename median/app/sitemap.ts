import type { MetadataRoute } from "next";
import { config } from "@/lib/core/config";
import { CATEGORIES } from "@/lib/core/categories";
import { db } from "@/lib/core/db";
import { storyHref } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = config.siteUrl;
  const rows = db()
    .prepare(
      `SELECT s.id, s.slug, a.updated_at FROM stories s JOIN articles a ON a.id = s.article_id
       WHERE a.status = 'published' AND a.kind = 'full' AND s.status = 'active' ORDER BY a.published_at DESC LIMIT 5000`
    )
    .all() as { id: string; slug: string; updated_at: number }[];
  return [
    { url: site, changeFrequency: "always", priority: 1 },
    { url: `${site}/pe-scurt`, changeFrequency: "always", priority: 0.8 },
    ...CATEGORIES.map((c) => ({ url: `${site}/categorie/${c.slug}`, changeFrequency: "hourly" as const, priority: 0.7 })),
    ...["despre", "politica-editoriala", "politica-ai", "corecturi", "surse", "contact", "termeni", "confidentialitate", "cookies"].map((p) => ({ url: `${site}/${p}`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...rows.map((r) => ({ url: `${site}${storyHref(r)}`, lastModified: new Date(r.updated_at), priority: 0.6 })),
  ];
}
