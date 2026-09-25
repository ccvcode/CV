import { getState } from "@/lib/store";
import { CATEGORY_MAP } from "@/lib/categories";
import { articleHref } from "@/lib/utils";

export const revalidate = 300;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { articles, updatedAt } = await getState();
  const items = articles
    .slice(0, 80)
    .map(
      (a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${esc(site + articleHref(a))}</link>
      <guid isPermaLink="false">${a.id}</guid>
      <pubDate>${new Date(a.published).toUTCString()}</pubDate>
      <category>${esc(CATEGORY_MAP[a.category]?.label ?? a.category)}</category>
      <source url="${esc(a.sourceSite)}">${esc(a.sourceName)}</source>
      <description>${esc(a.summary)}</description>${a.image ? `\n      <enclosure url="${esc(a.image)}" type="image/jpeg" length="0" />` : ""}
    </item>`
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Median — Știri din România și din lume</title>
    <link>${site}</link>
    <description>Știri agregate automat din publicațiile românești, actualizate la 5 minute.</description>
    <language>ro</language>
    <lastBuildDate>${new Date(updatedAt || Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
