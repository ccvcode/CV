import probe from "probe-image-size";
import { config } from "../../core/config";
import { db } from "../../core/db";
import type { ImageCandidate } from "../../core/types";
import { httpGetBuffer } from "../http";
import { processImage, saveImageRow, type Processed } from "./store";

const REJECT_URL = /(logo|favicon|placeholder|default[-_]?(image|img|share|og)?|avatar|sprite|pixel|1x1|spacer|blank|\/ads?\/|banner|share-default|no-image|noimage|icon)/i;

export interface ScoredCandidate extends ImageCandidate {
  score: number;
}

/** Citește doar antetul fișierului pentru a afla dimensiunile (fără a descărca toată imaginea). */
async function probeSize(url: string, referer: string): Promise<{ width: number; height: number; type: string } | undefined> {
  try {
    const r = await probe(url, { timeout: 6000, headers: { "user-agent": config.userAgent, referer } });
    return { width: r.width, height: r.height, type: r.type };
  } catch {
    return undefined;
  }
}

/** Încercăm varianta originală a imaginilor WordPress redimensionate („poza-300x169.jpg” → „poza.jpg”). */
function upgradeWordpressUrl(url: string): string | undefined {
  const m = /^(.*)-\d{2,4}x\d{2,4}(\.(?:jpe?g|png|webp))(\?.*)?$/i.exec(url);
  return m ? m[1] + m[2] + (m[3] ?? "") : undefined;
}

/**
 * Evaluează candidații: dimensiuni reale, raport de aspect, tipul sursei. Întoarce candidații
 * acceptabili în ordinea scorului. Respinge logo-urile, pixelii, imaginile mici și formatele ciudate.
 */
export async function rankCandidates(candidates: ImageCandidate[], referer: string, minWidth = 600): Promise<ScoredCandidate[]> {
  const list: ImageCandidate[] = [];
  for (const c of candidates.slice(0, 8)) {
    if (REJECT_URL.test(c.url) || /\.(svg|gif)(\?|$)/i.test(c.url)) continue;
    list.push(c);
    const up = upgradeWordpressUrl(c.url);
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
      if (ratio < 1.1 || ratio > 2.4) return;
      const fromBonus = { og: 1.5, jsonld: 1.5, "rss-media": 1.2, "rss-enclosure": 1.2, twitter: 1, "rss-html": 0.8, body: 0.6 }[c.from] ?? 0.5;
      const score = Math.log(width * height) + fromBonus - Math.abs(ratio - 16 / 9) * 1.2;
      out.push({ ...c, width, height, score });
    })
  );
  return out.sort((a, b) => b.score - a.score);
}

/** O imagine care apare la ≥3 articole diferite ale aceleiași surse este considerată „implicită” (logo/generic). */
function isDefaultImage(sourceId: string, ahash: string, url: string): boolean {
  const d = db();
  const now = Date.now();
  for (const h of [ahash, "url:" + url]) {
    d.prepare(
      `INSERT INTO source_image_hashes(source_id, hash, seen, first_at, last_at) VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(source_id, hash) DO UPDATE SET seen = seen + 1, last_at = excluded.last_at`
    ).run(sourceId, h, now, now);
  }
  const row = d
    .prepare("SELECT MAX(seen) AS seen FROM source_image_hashes WHERE source_id = ? AND hash IN (?, ?) AND last_at > ?")
    .get(sourceId, ahash, "url:" + url, now - 30 * 86400_000) as { seen: number | null };
  return (row.seen ?? 0) >= 3;
}

export function knownDefault(sourceId: string, url: string): boolean {
  const row = db().prepare("SELECT seen FROM source_image_hashes WHERE source_id = ? AND hash = ?").get(sourceId, "url:" + url) as { seen: number } | undefined;
  return (row?.seen ?? 0) >= 3;
}

/**
 * Jobul „thumb”: alege cea mai bună poză a unui articol-sursă și o salvează ca miniatură
 * (400px; +1200px dacă pozele surselor pot fi folosite ca poză principală), cu credit.
 */
export async function makeSourceThumb(itemId: string): Promise<number | null> {
  const d = db();
  const item = d
    .prepare("SELECT i.id, i.url, i.image_candidates, i.source_id, s.name, s.hero_images FROM items i JOIN sources s ON s.id = i.source_id WHERE i.id = ?")
    .get(itemId) as { id: string; url: string; image_candidates: string; source_id: string; name: string; hero_images: number } | undefined;
  if (!item) return null;
  const candidates = (JSON.parse(item.image_candidates) as ImageCandidate[]).filter((c) => !knownDefault(item.source_id, c.url));
  const ranked = await rankCandidates(candidates, item.url, 400);
  const heroAllowed = config.images.sourceImages === "hero" || item.hero_images === 1;
  for (const c of ranked.slice(0, 3)) {
    let processed: Processed;
    try {
      const { buffer } = await httpGetBuffer(c.url, { referer: item.url, maxBytes: 15_000_000 });
      processed = await processImage(buffer, heroAllowed ? [400, 800, 1200, 1600] : [400], { minWidth: 400 });
    } catch {
      continue;
    }
    if (isDefaultImage(item.source_id, processed.ahash, c.url)) {
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
