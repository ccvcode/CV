import { config } from "@/lib/core/config";
import { db } from "@/lib/core/db";
import { storyHref } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Sitemap Google News: articolele complete din ultimele 48 de ore (max. 1000). */
export function GET() {
  const rows = db()
    .prepare(
      `SELECT s.id, s.slug, a.headline, a.published_at FROM stories s JOIN articles a ON a.id = s.article_id
       WHERE a.status = 'published' AND a.kind = 'full' AND s.status = 'active' AND a.published_at > ? ORDER BY a.published_at DESC LIMIT 1000`
    )
    .all(Date.now() - 48 * 3600_000) as { id: string; slug: string; headline: string; published_at: number }[];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${rows
  .map(
    (r) => `  <url>
    <loc>${config.siteUrl}${storyHref(r)}</loc>
    <news:news>
      <news:publication><news:name>Median</news:name><news:language>ro</news:language></news:publication>
      <news:publication_date>${new Date(r.published_at).toISOString()}</news:publication_date>
      <news:title>${esc(r.headline)}</news:title>
    </news:news>
  </url>`
  )
  .join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
