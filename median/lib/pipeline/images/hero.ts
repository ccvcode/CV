import { config, llmEnabled } from "../../core/config";
import { db, logEvent } from "../../core/db";
import type { CategorySlug } from "../../core/types";
import { httpGetBuffer } from "../http";
import { chatJson } from "../llm";
import { IMAGE_PICK_SYSTEM, ImagePickSchema, ImagePickShape } from "../prompts";
import { makeCard } from "./card";
import { commonsSearch, pexelsSearch, unsplashSearch, unsplashTrackDownload, wikidataImage, type OpenImage } from "./open";
import { makeSourceThumb } from "./source";
import { processImage, saveImageRow } from "./store";

/*
 * Alegerea automată a pozei principale pentru un subiect (articol Median):
 *   1. poza unei publicații-sursă — doar dacă este permis (MEDIAN_SOURCE_IMAGES=hero sau sursa are acord);
 *   2. imaginea oficială din Wikidata a entității principale (persoană, instituție, loc);
 *   3. căutare Wikimedia Commons după entități;
 *   4. Commons, apoi Unsplash / Pexels (dacă există chei) după interogarea generată de AI;
 *   5. copertă tipografică generată (nu eșuează niciodată).
 * Fiecare imagine are credit și licență, afișate sub poză.
 */

interface ArticleRow {
  id: number;
  kind: string;
  headline: string;
  entities: string;
  image_query: string;
  sources: string;
}

export async function chooseHero(storyId: string): Promise<number | null> {
  const d = db();
  const story = d.prepare("SELECT id, category, region, source_count, article_id, hero_image_id FROM stories WHERE id = ?").get(storyId) as
    | { id: string; category: CategorySlug; region: string | null; source_count: number; article_id: number | null; hero_image_id: number | null }
    | undefined;
  if (!story) return null;
  const article = (story.article_id
    ? d.prepare("SELECT id, kind, headline, entities, image_query, sources FROM articles WHERE id = ?").get(story.article_id)
    : d.prepare("SELECT id, kind, headline, entities, image_query, sources FROM articles WHERE story_id = ? ORDER BY version DESC LIMIT 1").get(storyId)) as
    | ArticleRow
    | undefined;
  const headline = article?.headline ?? (d.prepare("SELECT title FROM stories WHERE id = ?").get(storyId) as { title: string }).title;

  // Păstrăm o poză deja aleasă, dacă nu e o copertă generată (aceea se poate îmbunătăți).
  if (story.hero_image_id) {
    const cur = d.prepare("SELECT kind, status FROM images WHERE id = ?").get(story.hero_image_id) as { kind: string; status: string } | undefined;
    if (cur && cur.kind !== "card" && cur.status === "ok") return story.hero_image_id;
  }

  const recentlyUsed = new Set(
    (
      d
        .prepare("SELECT i.original_url FROM stories s JOIN images i ON i.id = s.hero_image_id WHERE s.id != ? AND s.last_published_at > ? AND i.kind IN ('unsplash','pexels','commons')")
        .all(storyId, Date.now() - 48 * 3600_000) as { original_url: string }[]
    ).map((r) => r.original_url)
  );

  // 1. Poza unei surse (când e permis).
  const items = d
    .prepare("SELECT i.id, i.thumb_image_id, s.hero_images FROM items i JOIN sources s ON s.id = i.source_id WHERE i.story_id = ? ORDER BY s.tier, i.published_at")
    .all(storyId) as { id: string; thumb_image_id: number | null; hero_images: number }[];
  for (const it of items) {
    if (config.images.sourceImages !== "hero" && it.hero_images !== 1) continue;
    const imgId = it.thumb_image_id ?? (await makeSourceThumb(it.id).catch(() => null));
    if (!imgId) continue;
    const img = d.prepare("SELECT width, widths, status FROM images WHERE id = ?").get(imgId) as { width: number; widths: string; status: string };
    if (img.status === "ok" && img.width >= 1000 && (JSON.parse(img.widths) as number[]).includes(1200)) return setHero(storyId, imgId);
  }

  const entities = article ? (JSON.parse(article.entities) as { name: string; type: string }[]) : [];
  const dek = article ? ((d.prepare("SELECT dek FROM articles WHERE id = ?").get(article.id) as { dek: string | null }).dek ?? "") : "";
  // `pick`: rezultatele unei căutări trec prin editorul foto AI (relevanța față de articol);
  // imaginea oficială Wikidata a unei entități numite exact în articol nu mai are nevoie de verificare.
  const tryOpen = async (label: string, fn: () => Promise<OpenImage[] | OpenImage | undefined>, pick = true) => {
    try {
      const r = await fn();
      let list = (Array.isArray(r) ? r : r ? [r] : []).filter((x) => !recentlyUsed.has(x.url));
      if (pick && list.length) list = await pickRelevant(headline, dek, list.slice(0, 8));
      for (const cand of list.slice(0, 3)) {
        const id = await storeOpen(cand).catch(() => null);
        if (id) return id;
      }
    } catch (e) {
      logEvent("warn", `imagini (${label}): ${(e as Error).message}`);
    }
    return null;
  };

  // 2–3. Wikidata / Commons după entități (persoane și locuri primele).
  const ordered = [...entities].sort((a, b) => rank(a.type) - rank(b.type)).slice(0, 3);
  for (const e of ordered) {
    const id = await tryOpen("wikidata", () => wikidataImage(e.name), false);
    if (id) return setHero(storyId, id);
  }
  for (const e of ordered.slice(0, 2)) {
    const id = await tryOpen("commons", () => commonsSearch(e.name, 5));
    if (id) return setHero(storyId, id);
  }

  // 4. Fotografii de ilustrare după interogarea generată de AI (Commons, apoi Unsplash / Pexels).
  // Se ajunge aici doar când sursele nu au o poză utilizabilă, deci cota de stoc nu se consumă des.
  const query = article?.image_query?.trim() ?? "";
  if (query) {
    const c = await tryOpen("commons", () => commonsSearch(query, 5));
    if (c) return setHero(storyId, c);
    const u = await tryOpen("unsplash", () => unsplashSearch(query));
    if (u) return setHero(storyId, u);
    const p = await tryOpen("pexels", () => pexelsSearch(query));
    if (p) return setHero(storyId, p);
  }

  // 5. Copertă generată.
  if (story.hero_image_id) return story.hero_image_id;
  const card = await makeCard(storyId, { headline, category: story.category, sources: story.source_count, region: story.region });
  return setHero(storyId, card);
}

/**
 * Editorul foto AI: alege dintre candidați fotografia relevantă pentru articol, după titlul și
 * descrierea fiecărui fișier. Întoarce lista cu alegerea pe primul loc sau goală dacă nimic nu se potrivește.
 * Fără AI configurat, lista rămâne neschimbată.
 */
async function pickRelevant(headline: string, dek: string, list: OpenImage[]): Promise<OpenImage[]> {
  if (!llmEnabled()) return list;
  const described = list.filter((x) => x.title?.trim());
  if (!described.length) return [];
  const user = `ARTICOL\nTitlu: ${headline}\nRezumat: ${dek.slice(0, 500)}\n\nFOTOGRAFII CANDIDATE\n${described
    .map((x, i) => `${i + 1}. ${x.title!.slice(0, 300)}`)
    .join("\n")}`;
  try {
    const { data } = await chatJson({
      target: "verify",
      system: IMAGE_PICK_SYSTEM,
      user,
      schema: ImagePickSchema,
      shape: ImagePickShape,
      schemaName: "alegere_poza",
      maxTokens: 200,
      temperature: 0,
    });
    const chosen = described[data.index - 1];
    return chosen ? [chosen] : [];
  } catch (e) {
    // Dacă AI-ul nu răspunde, nu publicăm o poză neverificată: se trece la următoarea variantă.
    logEvent("warn", `imagini (relevanță): ${(e as Error).message}`);
    return [];
  }
}

function rank(type: string): number {
  return type === "persoana" ? 0 : type === "loc" ? 1 : type === "organizatie" ? 2 : 3;
}

function setHero(storyId: string, imageId: number): number {
  db().prepare("UPDATE stories SET hero_image_id = ? WHERE id = ?").run(imageId, storyId);
  return imageId;
}

/** Salvează o imagine cu licență liberă: Commons se descarcă și se procesează; Unsplash/Pexels se servesc direct. */
async function storeOpen(img: OpenImage): Promise<number | null> {
  if (img.kind === "commons") {
    const { buffer } = await httpGetBuffer(img.url, { maxBytes: 20_000_000 });
    const processed = await processImage(buffer, [400, 800, 1200, 1600], { minWidth: 1000 });
    return saveImageRow({ kind: "commons", originalUrl: img.url, processed, credit: img.credit, creditUrl: img.creditUrl, license: img.license, licenseUrl: img.licenseUrl });
  }
  if (img.width < 1200) return null;
  if (img.downloadLocation) await unsplashTrackDownload(img.downloadLocation);
  return saveImageRow({
    kind: img.kind,
    originalUrl: img.url,
    width: img.width,
    height: img.height,
    color: img.color,
    credit: img.credit,
    creditUrl: img.creditUrl,
    license: img.license,
    licenseUrl: img.licenseUrl,
  });
}
