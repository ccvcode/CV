import { config, llmEnabled } from "../../core/config";
import { db, logEvent } from "../../core/db";
import type { CategorySlug } from "../../core/types";
import { httpGetBuffer } from "../http";
import { chatJson } from "../llm";
import { IMAGE_PICK_SYSTEM, ImagePickSchema, ImagePickShape } from "../prompts";
import { makeCard } from "./card";
import { byCentrality, keywords, properNames } from "../text";
import { commonsSearch, foldName, pexelsSearch, unsplashSearch, unsplashTrackDownload, wikidataImage, type OpenImage } from "./open";
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

  // 1. Poza unei surse (când e permis), începând cu articolul cel mai reprezentativ pentru subiect:
  //    un articol prins la marginea grupului nu trebuie să dea poza întregului subiect.
  const all = d
    .prepare(
      `SELECT i.id, i.title, i.summary, i.published_at, i.duplicate_of, i.thumb_image_id, s.tier, s.hero_images
       FROM items i JOIN sources s ON s.id = i.source_id WHERE i.story_id = ? ORDER BY s.tier, i.published_at`
    )
    .all(storyId) as { id: string; title: string; summary: string; published_at: number; duplicate_of: string | null; thumb_image_id: number | null; tier: number; hero_images: number }[];
  const items = byCentrality(all.filter((i) => !i.duplicate_of).length ? all.filter((i) => !i.duplicate_of) : all);
  // Poza principală vine de la unul dintre primele 8 articole centrale. Preferăm, în ordine:
  //   1. o poză mare (≥1000px) al cărei nume de fișier se potrivește cu subiectul
  //      („fragment-drona-agigea.jpg”) — semn că e poza articolului, nu una generică („19s_p.webp”);
  //   2. o poză mare a celui mai central articol; 3–4. la fel, pentru poze reale mai mici (≥600px).
  // Poza reală a articolului, chiar mai mică, e mai relevantă decât un portret generic din Wikidata.
  if (config.images.sourceImages === "hero" || items.some((i) => i.hero_images === 1)) {
    const topic = new Set(items.slice(0, 5).flatMap((i) => keywords(i.title)).filter((k) => !/^\d+$/.test(k)));
    const found: { imgId: number; big: boolean; named: boolean; rank: number; archive: boolean }[] = [];
    for (const [rank, it] of items.slice(0, 8).entries()) {
      if (config.images.sourceImages !== "hero" && it.hero_images !== 1) continue;
      const imgId = it.thumb_image_id ?? (await makeSourceThumb(it.id).catch(() => null));
      if (!imgId) continue;
      const img = d.prepare("SELECT width, widths, status, original_url FROM images WHERE id = ?").get(imgId) as { width: number; widths: string; status: string; original_url: string };
      const widths = JSON.parse(img.widths) as number[];
      if (img.status !== "ok") continue;
      // Logo-uri și embleme ascunse în numele fișierului codat de CDN (ex. „manchester-city-emblema.png”).
      if (/(logo|sigl[aăe]|emblem|crest\b|stem[aă]\b)/i.test(imageName(img.original_url))) continue;
      const big = img.width >= 1000 && widths.includes(1200);
      // Poze reale mai mici (≥600px) doar dacă au o variantă la mărimea lor (nu mărite de la 400px).
      if (!big && !(img.width >= 600 && Math.max(...widths) >= 600)) continue;
      const named = keywords(imageName(img.original_url)).some((k) => topic.has(k));
      const archive = isArchivePhoto(img.original_url);
      found.push({ imgId, big, named, rank, archive });
      if (big && named && !archive) break;
    }
    // Ordinea: poză mare, apoi poză recentă (nu din arhiva publicației), apoi numele fișierului
    // potrivit cu subiectul, apoi articolul cel mai central.
    found.sort(
      (a, b) => Number(b.big) - Number(a.big) || Number(a.archive) - Number(b.archive) || Number(b.named) - Number(a.named) || a.rank - b.rank
    );
    if (found.length) return setHero(storyId, found[0].imgId);
  }

  // Entitățile: de la redactorul AI sau, fără AI, numele proprii din titlurile subiectului.
  const entities = article ? (JSON.parse(article.entities) as { name: string; type: string }[]) : guessEntities(items.map((i) => i.title));
  const dek = article ? ((d.prepare("SELECT dek FROM articles WHERE id = ?").get(article.id) as { dek: string | null }).dek ?? "") : "";
  // `pick`: rezultatele unei căutări trec prin editorul foto AI (relevanța față de articol);
  // imaginea oficială Wikidata a unei entități numite exact în articol nu mai are nevoie de verificare.
  const tryOpen = async (label: string, fn: () => Promise<OpenImage[] | OpenImage | undefined>, pick = true, name?: string) => {
    try {
      const r = await fn();
      let list = (Array.isArray(r) ? r : r ? [r] : []).filter((x) => !recentlyUsed.has(x.url));
      if (pick && list.length) list = llmEnabled() || !name ? await pickRelevant(headline, dek, list.slice(0, 8)) : namedIn(list, name);
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
    const id = await tryOpen("commons", () => commonsSearch(e.name, 8), true, e.name);
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
  // Fără AI, o căutare liberă nu poate fi verificată: nu publicăm rezultatele ei.
  if (!llmEnabled()) return [];
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

/**
 * Fără AI: rezultatele unei căutări Commons după un nume se păstrează doar dacă numele apare întreg
 * în titlul sau descrierea fișierului („Sorin Grindeanu 2023.jpg”), nu doar un cuvânt din el.
 */
function namedIn(list: OpenImage[], name: string): OpenImage[] {
  const want = foldName(name);
  return list.filter((x) => ` ${foldName(x.title ?? "")} `.includes(` ${want} `));
}

/**
 * Entitățile unui subiect fără articol AI: numele proprii (≥2 cuvinte) din titlul principal care apar și în
 * titlurile altor publicații (la subiectele cu o singură sursă, numele din titlu), cele mai citate primele.
 */
export function guessEntities(titles: string[]): { name: string; type: string }[] {
  if (!titles.length) return [];
  const folded = titles.map((t) => ` ${foldName(t)} `);
  // Doar nume din cel puțin două cuvinte („Oana Țoiu”, „Via Transilvanica”): un singur cuvânt e
  // prea ambiguu fără AI („Alba” din „pavele din Alba” a găsit planta Nymphaea alba).
  const counts = properNames(titles[0])
    .filter((name) => name.split(" ").length >= 2)
    .map((name) => ({ name, n: folded.filter((t) => t.includes(` ${foldName(name)} `)).length }))
    .filter((x) => titles.length === 1 || x.n >= 2);
  return counts.sort((a, b) => b.n - a.n || b.name.split(" ").length - a.name.split(" ").length).map((x) => ({ name: x.name, type: "necunoscut" }));
}

/**
 * Poză „de arhivă”: încărcată de publicație cu peste 60 de zile în urmă (calea WordPress /2025/04/...
 * sau numele codat al Digi24). De obicei e o poză generică a unei persoane, nu a evenimentului.
 */
export function isArchivePhoto(url: string, now = Date.now()): boolean {
  const m = /\/(20\d\d)\/(0[1-9]|1[0-2])\//.exec(gatewaySource(url) ?? url);
  if (!m) return false;
  const uploaded = Date.UTC(Number(m[1]), Number(m[2]) - 1, 28);
  return now - uploaded > 60 * 86400_000;
}

/**
 * Numele fișierului unei imagini, ca text („fragment drona agigea 5”). Unele CDN-uri (ex. Digi24)
 * codează adresa originală în base64 în cale; o decodăm ca să ajungem la numele real.
 */
export function imageName(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "";
  }
  let name = decodeURIComponent(u.pathname.split("/").pop() ?? "");
  const src = gatewaySource(url);
  if (src) name = src.split("/").pop() ?? name;
  return name
    .replace(/\.\w{2,4}$/, "")
    .replace(/\b(\d+x\d+|scaled|thumb|image|img|foto|photo|inquam|photos|profimedia|shutterstock|getty|gettyimages|agerpres|hepta|mediafax|captura|screenshot)\b/gi, " ")
    .replace(/[-_.]+/g, " ");
}

/** Adresa originală codată în base64 de CDN-ul Digi24 („/gateway/g/<base64>.jpg”), dacă e cazul. */
function gatewaySource(url: string): string | undefined {
  const gw = /\/gateway\/g\/(.+?)(?:\.\w+)?(?:\?|$)/.exec(url);
  if (!gw) return undefined;
  try {
    const decoded = decodeURIComponent(Buffer.from(gw[1].replace(/\//g, ""), "base64").toString("latin1"));
    return /fileSource=([^&]+)/.exec(decoded)?.[1];
  } catch {
    return undefined;
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
