import { db } from "../core/db";
import type { ImageCandidate } from "../core/types";
import { extractArticle, type Block } from "./extract";
import { httpGet, isAllowed } from "./http";

export interface FullText {
  blocks: Block[];
  author?: string;
  published?: number;
  words: number;
}

/**
 * Descarcă pagina unui articol-sursă și extrage textul complet (folosit doar ca materie primă
 * pentru redactorul AI; nu se afișează niciodată). Respectă robots.txt și rezervările TDM.
 */
export async function fetchFullText(itemId: string): Promise<"ok" | "blocked" | "failed"> {
  const d = db();
  const item = d.prepare("SELECT i.url, i.image_candidates, s.site FROM items i JOIN sources s ON s.id = i.source_id WHERE i.id = ?").get(itemId) as
    | { url: string; image_candidates: string; site: string }
    | undefined;
  if (!item) return "failed";
  const allowed = await isAllowed(item.url);
  if (!allowed.allowed) {
    d.prepare("UPDATE items SET fulltext_status = 'blocked' WHERE id = ?").run(itemId);
    return "blocked";
  }
  const res = await httpGet(item.url, { timeoutMs: 15_000, maxBytes: 2_500_000, accept: "text/html,application/xhtml+xml" });
  const art = await extractArticle(res.text, res.url);
  // Imaginile găsite în pagină devin candidați suplimentari pentru miniatură.
  const candidates = JSON.parse(item.image_candidates) as ImageCandidate[];
  const meta = pageImageMeta(res.text, res.url);
  for (const c of [...meta, ...(art?.images ?? []).slice(0, 3).map((i) => ({ url: i.src, from: "body" as const, caption: i.caption }))]) {
    if (!candidates.some((x) => x.url === c.url)) candidates.push(c);
  }
  if (!art) {
    d.prepare("UPDATE items SET fulltext_status = 'failed', image_candidates = ? WHERE id = ?").run(JSON.stringify(candidates), itemId);
    return "failed";
  }
  const blocks = (art.blocks ?? art.paragraphs.map((text) => ({ type: "p" as const, text }))).slice(0, 80);
  const full: FullText = { blocks, author: art.author, published: art.published, words: art.text.split(/\s+/).length };
  d.prepare("UPDATE items SET fulltext = ?, fulltext_status = 'ok', image_candidates = ?, author = COALESCE(author, ?) WHERE id = ?").run(
    JSON.stringify(full),
    JSON.stringify(candidates),
    art.author ?? null,
    itemId
  );
  return "ok";
}

/** og:image (cu dimensiuni), JSON-LD image și twitter:image din HTML. */
export function pageImageMeta(html: string, base: string): ImageCandidate[] {
  const head = html.slice(0, 300_000);
  const out: ImageCandidate[] = [];
  const metaContent = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
    const m = re.exec(head);
    return m ? (m[1] || m[2]).replace(/&amp;/g, "&") : undefined;
  };
  const abs = (u?: string) => {
    if (!u) return undefined;
    try {
      const url = new URL(u, base);
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  };
  const og = abs(metaContent("og:image:secure_url") || metaContent("og:image"));
  if (og) out.push({ url: og, from: "og", width: Number(metaContent("og:image:width")) || undefined, height: Number(metaContent("og:image:height")) || undefined });
  for (const m of head.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].replace(/[\u0000-\u001f]+/g, " "));
      const nodes = ([] as unknown[]).concat(data, (data as { "@graph"?: unknown[] })["@graph"] ?? []);
      for (const n of nodes as { image?: unknown }[]) {
        const imgs = ([] as unknown[]).concat(n?.image ?? []);
        for (const im of imgs) {
          const o = typeof im === "string" ? { url: im } : (im as { url?: string; width?: number | string; height?: number | string });
          const url = abs(o.url);
          if (url && !out.some((c) => c.url === url)) out.push({ url, from: "jsonld", width: Number(o.width) || undefined, height: Number(o.height) || undefined });
        }
      }
    } catch {
      /* JSON-LD invalid e frecvent */
    }
  }
  const tw = abs(metaContent("twitter:image") || metaContent("twitter:image:src"));
  if (tw && !out.some((c) => c.url === tw)) out.push({ url: tw, from: "twitter" });
  return out;
}
