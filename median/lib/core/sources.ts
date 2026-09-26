import type { CategorySlug, Source } from "./types";

type Row = [name: string, site: string, url: string, category: CategorySlug, kind?: Source["kind"]];

/*
 * Verificate pe 26.09.2026 cu `npx tsx scripts/check/feeds.ts`. Scoase: Europa Liberă (fluxuri goale),
 * TVR Info și Wall-Street (pagină anti-bot Cloudflare), Bursa (fără RSS), Observator Cultural (flux
 * compromis cu spam), 0-100.ro (inactiv), fluxurile ProTV „pe secțiuni” (întorc fluxul general).
 *
 * Agerpres NU este inclus: este agenție cu abonament plătit, iar condițiile sale limitează
 * preluarea. Se poate adăuga doar pe baza unui contract.
 */

/** Publicații cu redacții mari și standarde editoriale verificabile (cântăresc mai mult în scor). */
const TIER1 = new Set([
  "Digi24", "HotNews", "G4Media", "Știrile ProTV", "Libertatea", "Adevărul", "Mediafax", "News.ro",
  "Europa Liberă", "RFI România", "Ziarul Financiar", "Recorder", "Observator", "TVR Info", "Profit.ro", "GSP",
]);

/*
 * Lista surselor RSS agregate de Median. Fluxurile pe secțiuni (ex. Digi24 Economie)
 * au prioritate față de fluxul general al aceleiași publicații atunci când un articol
 * apare în ambele, astfel încât categoria să fie cât mai precisă.
 * Pentru a adăuga o sursă nouă, adaugă un rând mai jos.
 */
const ROWS: Row[] = [
  // Național / actualitate
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss", "national", "tv"],
  ["HotNews", "https://hotnews.ro", "https://hotnews.ro/feed", "national", "online"],
  ["G4Media", "https://www.g4media.ro", "https://www.g4media.ro/feed", "national", "online"],
  ["Știrile ProTV", "https://stirileprotv.ro", "https://stirileprotv.ro/rss/", "national", "tv"],
  ["Libertatea", "https://www.libertatea.ro", "https://www.libertatea.ro/feed", "national", "presa"],
  ["Adevărul", "https://adevarul.ro", "https://adevarul.ro/rss/index", "national", "presa"],
  ["Mediafax", "https://www.mediafax.ro", "https://www.mediafax.ro/feed", "national", "agentie"],
  ["News.ro", "https://www.news.ro", "https://www.news.ro/rss", "national", "agentie"],
  ["Antena 3 CNN", "https://www.antena3.ro", "https://www.antena3.ro/rss", "national", "tv"],
  ["Observator", "https://observatornews.ro", "https://observatornews.ro/rss", "national", "tv"],
  ["Gândul", "https://www.gandul.ro", "https://www.gandul.ro/feed", "national", "online"],
  ["Recorder", "https://recorder.ro", "https://recorder.ro/feed/", "national", "online"],
  ["SpotMedia", "https://spotmedia.ro", "https://spotmedia.ro/feed", "national", "online"],
  ["Biziday", "https://www.biziday.ro", "https://www.biziday.ro/feed/", "national", "online"],
  ["PressOne", "https://pressone.ro", "https://pressone.ro/api/rss", "national", "online"],
  ["EVZ", "https://evz.ro", "https://evz.ro/feed", "national", "presa"],

  // Politică
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/stiri/actualitate/politica", "politica", "tv"],
  ["HotNews", "https://hotnews.ro", "https://hotnews.ro/c/actualitate/politic/feed", "politica", "online"],
  ["Mediafax", "https://www.mediafax.ro", "https://www.mediafax.ro/politic/feed", "politica", "agentie"],
  ["B1 TV", "https://www.b1tv.ro", "https://www.b1tv.ro/politica/rss", "politica", "tv"],

  // Economie
  ["Ziarul Financiar", "https://www.zf.ro", "https://www.zf.ro/rss/", "economie", "presa"],
  ["Profit.ro", "https://www.profit.ro", "https://www.profit.ro/rss", "economie", "online"],
  ["Economica.net", "https://www.economica.net", "https://www.economica.net/feed", "economie", "online"],
  ["Economedia", "https://economedia.ro", "https://economedia.ro/feed/", "economie", "online"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/stiri/economie", "economie", "tv"],
  ["HotNews", "https://hotnews.ro", "https://hotnews.ro/c/economie/feed", "economie", "online"],
  ["Start-up.ro", "https://start-up.ro", "https://start-up.ro/feed/", "economie", "online"],
  ["Forbes România", "https://www.forbes.ro", "https://www.forbes.ro/feed", "economie", "presa"],
  ["Mediafax", "https://www.mediafax.ro", "https://www.mediafax.ro/economic/feed", "economie", "agentie"],

  // Internațional
  ["RFI România", "https://www.rfi.fr/ro", "https://www.rfi.fr/ro/rss", "international", "international"],
  ["Mediafax", "https://www.mediafax.ro", "https://www.mediafax.ro/externe/feed", "international", "agentie"],
  ["News.ro", "https://www.news.ro", "https://www.news.ro/externe/rss", "international", "agentie"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/stiri/externe", "international", "tv"],
  ["HotNews", "https://hotnews.ro", "https://hotnews.ro/c/actualitate/international/feed", "international", "online"],
  ["B1 TV", "https://www.b1tv.ro", "https://www.b1tv.ro/externe/rss", "international", "tv"],

  // Sport
  ["GSP", "https://www.gsp.ro", "https://www.gsp.ro/rss.xml", "sport", "presa"],
  ["Digi Sport", "https://www.digisport.ro", "https://www.digisport.ro/rss", "sport", "tv"],
  ["ProSport", "https://www.prosport.ro", "https://www.prosport.ro/feed", "sport", "online"],
  ["Sport.ro", "https://www.sport.ro", "https://www.sport.ro/rss", "sport", "online"],
  ["Fanatik", "https://www.fanatik.ro", "https://www.fanatik.ro/feed", "sport", "online"],
  ["iAMsport", "https://iamsport.ro", "https://iamsport.ro/rss", "sport", "online"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/stiri/sport", "sport", "tv"],

  // Tech & știință
  ["Playtech", "https://playtech.ro", "https://playtech.ro/feed/", "tech", "online"],
  ["Go4IT", "https://www.go4it.ro", "https://www.go4it.ro/feed/", "tech", "online"],
  ["ArenaIT", "https://arenait.ro", "https://arenait.ro/feed/", "tech", "online"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/stiri/sci-tech", "tech", "tv"],
  ["HotNews", "https://hotnews.ro", "https://hotnews.ro/c/science/feed", "tech", "online"],
  ["Descoperă", "https://www.descopera.ro", "https://www.descopera.ro/feed", "tech", "presa"],
  ["B1 TV", "https://www.b1tv.ro", "https://www.b1tv.ro/high-tech/rss", "tech", "tv"],

  // Lifestyle
  ["VIVA!", "https://www.viva.ro", "https://www.viva.ro/feed", "lifestyle", "presa"],
  ["Click!", "https://click.ro", "https://click.ro/rss/index", "national", "presa"], // tabloid general: categoria după conținut
  ["Adevărul", "https://adevarul.ro", "https://adevarul.ro/rss/showbiz", "lifestyle", "presa"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/magazin", "lifestyle", "tv"],

  // Sănătate
  ["Mediafax", "https://www.mediafax.ro", "https://www.mediafax.ro/sanatate/feed", "sanatate", "agentie"],
  ["HotNews", "https://hotnews.ro", "https://hotnews.ro/c/actualitate/sanatate-actualitate/feed", "sanatate", "online"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/stiri/actualitate/sanatate", "sanatate", "tv"],

  // Auto
  ["Promotor", "https://www.promotor.ro", "https://www.promotor.ro/feed", "auto", "online"],
  ["Autocritica", "https://www.autocritica.ro", "https://www.autocritica.ro/feed/", "auto", "online"],
  ["Automarket", "https://www.automarket.ro", "https://www.automarket.ro/rss/", "auto", "online"],
  ["B1 TV", "https://www.b1tv.ro", "https://www.b1tv.ro/auto/rss", "auto", "tv"],

  // Cultură
  ["Scena9", "https://www.scena9.ro", "https://www.scena9.ro/feed", "cultura", "online"],
  ["Mediafax", "https://www.mediafax.ro", "https://www.mediafax.ro/cultura-media/feed", "cultura", "agentie"],
  ["MovieNews", "https://www.movienews.ro", "https://www.movienews.ro/feed", "cultura", "online"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/magazin/timp-liber/cultura", "cultura", "tv"],

  // Monden
  ["Cancan", "https://www.cancan.ro", "https://www.cancan.ro/feed", "monden", "presa"],
  ["Libertatea", "https://www.libertatea.ro", "https://www.libertatea.ro/entertainment/feed", "monden", "presa"],
  ["TVmania", "https://tvmania.libertatea.ro", "https://tvmania.libertatea.ro/feed", "monden", "online"],
];

function sourceId(name: string, url: string, category: string) {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return ROWS.filter((r) => r[0] === name).length > 1 ? `${base}-${category}` : base;
}

export const SOURCES: Source[] = ROWS.map(([name, site, url, category, kind]) => ({
  id: sourceId(name, url, category),
  name,
  site,
  url,
  category,
  kind,
  tier: TIER1.has(name) ? 1 : 2,
}));

/** Publicațiile unice (o intrare per nume), pentru pagina „Surse”. */
export const OUTLETS = Object.values(
  SOURCES.reduce<Record<string, { name: string; site: string; kind?: Source["kind"]; feeds: Source[] }>>((acc, s) => {
    (acc[s.name] ??= { name: s.name, site: s.site, kind: s.kind, feeds: [] }).feeds.push(s);
    return acc;
  }, {})
).sort((a, b) => a.name.localeCompare(b.name, "ro"));
