import { config } from "@/lib/core/config";
import { CATEGORY_MAP, getCategory } from "@/lib/core/categories";
import { latestStories } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fluxul RSS Median (general sau pe categorie: /rss.xml?categorie=economie). */
export function GET(req: Request) {
  const cat = getCategory(new URL(req.url).searchParams.get("categorie") ?? "");
  const list = latestStories({ limit: 60, category: cat?.slug }).filter((s) => s.kind !== "raw");
  const site = config.siteUrl;
  const items = list
    .map((s) => {
      const img = s.hero ?? s.thumb;
      return `    <item>
      <title>${esc(s.title)}</title>
      <link>${site}${s.href}</link>
      <guid isPermaLink="true">${site}${s.href}</guid>
      <pubDate>${new Date(s.published).toUTCString()}</pubDate>
      <category>${esc(CATEGORY_MAP[s.category]?.label ?? s.category)}</category>
      <description>${esc(s.dek)}</description>${img ? `\n      <enclosure url="${esc(new URL(img.src, site).toString())}" type="image/webp" length="0" />` : ""}
    </item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Median${cat ? ` — ${esc(cat.label)}` : ""}</title>
    <link>${site}${cat ? `/categorie/${cat.slug}` : ""}</link>
    <description>Știrile zilei, cântărite. Sinteze din publicațiile românești, cu toate sursele la vedere.</description>
    <language>ro</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=120" } });
}
