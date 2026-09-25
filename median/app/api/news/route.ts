import { NextResponse } from "next/server";
import { getArticles, getState } from "@/lib/store";
import { getCategory } from "@/lib/categories";

export const dynamic = "force-dynamic";

/** GET /api/news?since=<ms>&category=<slug>&limit=<n>&fields=id — ultimele știri, în format JSON. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since")) || undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const cat = url.searchParams.get("category");
  const category = cat && getCategory(cat) ? getCategory(cat)!.slug : undefined;
  const state = await getState();
  const all = await getArticles({ since, category });
  const items = all.slice(0, limit);
  const idsOnly = url.searchParams.get("fields") === "id";
  return NextResponse.json(
    {
      updatedAt: state.updatedAt,
      demo: state.demo,
      count: all.length,
      items: idsOnly
        ? items.map((a) => a.id)
        : items.map(({ id, title, summary, link, image, published, sourceName, category }) => ({ id, title, summary, link, image, published, source: sourceName, category })),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
