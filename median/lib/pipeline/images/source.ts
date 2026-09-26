import probe from "probe-image-size";
import { config } from "../../core/config";
import { db } from "../../core/db";
import type { ImageCandidate } from "../../core/types";
import { pageImageMeta } from "../fulltext";
import { httpGet, httpGetBuffer, isAllowed } from "../http";
import { processImage, saveImageRow, type Processed } from "./store";

const REJECT_URL = /(logo|sigl[aăe]|favicon|placeholder|default[-_]?(image|img|share|og)?|avatar|sprite|pixel|1x1|spacer|blank|\/ads?\/|banner|share-default|no-image|noimage|icon)/i;

export interface ScoredCandidate extends ImageCandidate {
  score: number;
}

/** Citește doar antetul fișierului pentru a afla dimensiunile (fără a descărca toată imaginea). */
async function probeSize(url: string, referer: string): Promise<{ width: number; height: number; type: string } | undefined> {
  try {
    // Descărcăm doar începutul fișierului, prin clientul HTTP protejat (fără redirecționări necontrolate).
    const { buffer } = await httpGetBuffer(url, { referer, maxBytes: 256_000, timeoutMs: 15_000 });
    const r = probe.sync(buffer);
    if (!r) return undefined;
    return { width: r.width, height: r.height, type: r.type };
  } catch {
    return undefined;
  }
}

/**
 * Varianta mai mare a unei imagini redimensionate de CDN-ul publicației:
 *  - WordPress: „poza-300x169.jpg” → „poza.jpg”;
 *  - parametru de lățime: „poza.jpg?width=800” → „?width=1600” (1616.ro, mpinteractiv, Imgix etc.);
 *  - reperio (Adevărul, Click!): „?p=w=1000&h=600…” → „w=1600&h=900”.
 */
export function largerVariant(url: string): string | undefined {
  const wp = /^(.*)-\d{2,4}x\d{2,4}(\.(?:jpe?g|png|webp))(\?.*)?$/i.exec(url);
  if (wp) return wp[1] + wp[2] + (wp[3] ?? "");
  const w = /([?&](?:width|w)=)(\d{2,4})(?=&|$)/i.exec(url);
  if (w && Number(w[2]) < 1200) return url.replace(w[0], w[1] + "1600");
  const rp = /p=w%3D(\d{2,4})%26h%3D(\d{2,4})/i.exec(url);
  if (rp && Number(rp[1]) < 1200) return url.replace(rp[0], "p=w%3D1600%26h%3D900");
  return undefined;
}

/**
 * Evaluează candidații: dimensiuni reale, raport de aspect, tipul sursei. Întoarce candidații
 * acceptabili în ordinea scorului. Respinge logo-urile, pixelii, imaginile mici și formatele ciudate.
 */
export async function rankCandidates(candidates: ImageCandidate[], referer: string, minWidth = 600): Promise<ScoredCandidate[]> {
  const list: ImageCandidate[] = [];
  for (const raw of candidates.slice(0, 8)) {
    const c = { ...raw, url: raw.url.replace(/&amp;/g, "&") };
    if (REJECT_URL.test(c.url) || /\.(svg|gif)(\?|$)/i.test(c.url)) continue;
    list.push(c);
    const up = largerVariant(c.url);
    if (up && !candidates.some((x) => x.url === up)) list.push({ ...c, url: up, width: undefined, height: undefined });
  }
  const out: ScoredCandidate[] = [];
  await Promise.all(
    list.map(async (c) => {
      const size = c.width && c.height ? { width: c.width, height: c.height, type: "" } : await probeSize(c.url, referer);
      if (!size || size.type === "svg" || size.type === "gif") return;
      const { width, height } = size;
      const ratio = width / Math.max(1, height);
      if (width < minWidth || width * height < minWidth * minWidth * 0.5) return;
      if (ratio < 0.9 || ratio > 2.4) return; // fără portrete înguste și benzi panoramice
      const fromBonus = { og: 1.5, jsonld: 1.5, "rss-media": 1.2, "rss-enclosure": 1.2, twitter: 1, "rss-html": 0.8, body: 0.6 }[c.from] ?? 0.5;
      const score = Math.log(width * height) + fromBonus - Math.abs(ratio - 16 / 9) * 1.2;
      out.push({ ...c, width, height, score });
    })
  );
  return out.sort((a, b) => b.score - a.score);
}

/** O imagine care apare la ≥3 articole DIFERITE ale aceleiași surse este considerată „implicită” (logo/generic). */
function isDefaultImage(sourceId: string, itemId: string, ahash: string, url: string): boolean {
  const d = db();
  const now = Date.now();
  const ins = d.prepare("INSERT OR IGNORE INTO source_image_items(source_id, hash, item_id, at) VALUES (?, ?, ?, ?)");
  for (const h of [ahash, "url:" + url]) ins.run(sourceId, h, itemId, now);
  const row = d
    .prepare("SELECT MAX(n) AS n FROM (SELECT COUNT(DISTINCT item_id) AS n FROM source_image_items WHERE source_id = ? AND hash IN (?, ?) AND at > ? GROUP BY hash)")
    .get(sourceId, ahash, "url:" + url, now - 30 * 86400_000) as { n: number | null };
  return (row.n ?? 0) >= 3;
}

export function knownDefault(sourceId: string, url: string): boolean {
  const row = db().prepare("SELECT COUNT(DISTINCT item_id) AS n FROM source_image_items WHERE source_id = ? AND hash = ?").get(sourceId, "url:" + url) as { n: number };
  return row.n >= 3;
}

/**
 * Jobul „thumb”: alege cea mai bună poză a unui articol-sursă și o salvează ca miniatură
 * (400px; +1200px dacă pozele surselor pot fi folosite ca poză principală), cu credit.
 */
export async function makeSourceThumb(itemId: string): Promise<number | null> {
  const d = db();
  const item = d
    .prepare(
      "SELECT i.id, i.url, i.image_candidates, i.source_id, i.thumb_image_id, i.page_meta, i.fulltext_status, s.name, s.hero_images FROM items i JOIN sources s ON s.id = i.source_id WHERE i.id = ?"
    )
    .get(itemId) as
    | { id: string; url: string; image_candidates: string; source_id: string; thumb_image_id: number | null; page_meta: number; fulltext_status: string; name: string; hero_images: number }
    | undefined;
  if (!item) return null;
  if (item.thumb_image_id) return item.thumb_image_id; // deja procesat
  const heroAllowed = config.images.sourceImages === "hero" || item.hero_images === 1;
  let candidates = (JSON.parse(item.image_candidates) as ImageCandidate[]).filter((c) => !knownDefault(item.source_id, c.url));
  let ranked = await rankCandidates(candidates, item.url, 400);
  // RSS-ul nu are poză (sau are doar una mică, iar poza poate deveni principală): citim o singură
  // dată metadatele paginii articolului (og:image, JSON-LD, twitter:image), cu respectarea robots.txt.
  const wantBig = heroAllowed && !ranked.some((c) => (c.width ?? 0) >= 1000);
  if ((!ranked.length || wantBig) && !item.page_meta && item.fulltext_status === "none") {
    d.prepare("UPDATE items SET page_meta = 1 WHERE id = ?").run(itemId);
    const extra = await pageCandidates(item.url);
    const fresh = extra.filter((c) => !candidates.some((x) => x.url === c.url) && !knownDefault(item.source_id, c.url));
    if (fresh.length) {
      candidates = [...fresh, ...candidates];
      d.prepare("UPDATE items SET image_candidates = ? WHERE id = ?").run(JSON.stringify(candidates), itemId);
      ranked = await rankCandidates(candidates, item.url, 400);
    }
  }
  for (const c of ranked.slice(0, 3)) {
    let processed: Processed;
    try {
      const { buffer } = await httpGetBuffer(c.url, { referer: item.url, maxBytes: 30_000_000 }); // originalele Digi24 au ~20 MB
      processed = await processImage(buffer, heroAllowed ? [400, 800, 1200, 1600] : [400], { minWidth: 400 });
    } catch {
      continue;
    }
    if (isDefaultImage(item.source_id, itemId, processed.ahash, c.url)) {
      // Retragem retroactiv poza implicită de la articolele anterioare ale sursei.
      d.prepare(
        "UPDATE items SET thumb_image_id = NULL WHERE thumb_image_id IN (SELECT id FROM images WHERE source_id = ? AND (ahash = ? OR original_url = ?))"
      ).run(item.source_id, processed.ahash, c.url);
      d.prepare("UPDATE images SET status = 'default' WHERE source_id = ? AND (ahash = ? OR original_url = ?)").run(item.source_id, processed.ahash, c.url);
      continue;
    }
    if (processed.entropy < 3) continue; // imagine aproape uniformă (grafică, nu fotografie)
    const id = saveImageRow({
      kind: "source",
      originalUrl: c.url,
      processed,
      credit: `Foto: ${item.name}`,
      creditUrl: item.url,
      sourceId: item.source_id,
    });
    d.prepare("UPDATE items SET thumb_image_id = ? WHERE id = ?").run(id, itemId);
    return id;
  }
  return null;
}

async function pageCandidates(url: string): Promise<ImageCandidate[]> {
  try {
    if (!(await isAllowed(url)).allowed) return [];
    const res = await httpGet(url, { timeoutMs: 12_000, maxBytes: 600_000, stopAtHead: true, accept: "text/html,application/xhtml+xml" });
    return pageImageMeta(res.text, res.url);
  } catch {
    return [];
  }
}
