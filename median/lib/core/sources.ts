import type { CategorySlug, Source } from "./types";

type Row = [name: string, site: string, url: string, category: CategorySlug, kind?: Source["kind"]];

/*
 * Verificate pe 26.09.2026 cu `npx tsx scripts/check/feeds.ts` (+ 44 fluxuri noi: internațional, R. Moldova, secțiuni). Scoase: Europa Liberă (fluxuri goale),
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
  "DW Română", "Europa Liberă Moldova", "Newsweek România", "Ziarul de Gardă",
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

  ["Newsweek România", "https://newsweek.ro", "https://newsweek.ro/rss", "national", "presa"],
  ["Europa FM", "https://www.europafm.ro", "https://www.europafm.ro/feed/", "national", "online"],
  ["Ziare.com", "https://ziare.com", "https://ziare.com/rss/actualitate.xml", "national", "online"],
  ["Context", "https://www.context.ro", "https://www.context.ro/feed/", "national", "online"],
  ["DefenseRomania", "https://www.defenseromania.ro", "https://www.defenseromania.ro/feed", "national", "online"], // apărare: categoria după conținut
  ["G4Media", "https://www.g4media.ro", "https://www.g4media.ro/green-news/feed", "national", "online"],

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
  ["Observator", "https://observatornews.ro", "https://observatornews.ro/rss/economic", "economie", "tv"],
  ["Gândul", "https://www.gandul.ro", "https://www.gandul.ro/financiar/feed", "economie", "online"],
  ["SpotMedia", "https://spotmedia.ro", "https://spotmedia.ro/economie/feed", "economie", "online"],
  ["CursDeGuvernare", "https://cursdeguvernare.ro", "https://cursdeguvernare.ro/feed", "economie", "online"],

  // Internațional
  ["RFI România", "https://www.rfi.fr/ro", "https://www.rfi.fr/ro/rss", "international", "international"],
  ["Mediafax", "https://www.mediafax.ro", "https://www.mediafax.ro/externe/feed", "international", "agentie"],
  ["News.ro", "https://www.news.ro", "https://www.news.ro/externe/rss", "international", "agentie"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/stiri/externe", "international", "tv"],
  ["HotNews", "https://hotnews.ro", "https://hotnews.ro/c/actualitate/international/feed", "international", "online"],
  ["B1 TV", "https://www.b1tv.ro", "https://www.b1tv.ro/externe/rss", "international", "tv"],

  ["DW Română", "https://www.dw.com/ro", "https://rss.dw.com/xml/rss-rom-all", "international", "international"],
  ["Adevărul", "https://adevarul.ro", "https://adevarul.ro/rss/stiri-externe", "international", "presa"],
  ["Observator", "https://observatornews.ro", "https://observatornews.ro/rss/extern", "international", "tv"],
  ["Gândul", "https://www.gandul.ro", "https://www.gandul.ro/international/feed", "international", "online"],
  ["Ziare.com", "https://ziare.com", "https://ziare.com/rss/international.xml", "international", "online"],
  ["Veridica", "https://www.veridica.ro", "https://www.veridica.ro/feeds", "international", "online"],

  // Republica Moldova (publicații de limbă română)
  ["Europa Liberă Moldova", "https://moldova.europalibera.org", "https://moldova.europalibera.org/api/", "international", "international"],
  ["Europa Liberă Moldova", "https://moldova.europalibera.org", "https://moldova.europalibera.org/api/zkmotl-vomx-tpej-pr", "international", "international"],
  ["Ziarul de Gardă", "https://www.zdg.md", "https://www.zdg.md/feed/", "international", "online"],
  ["NewsMaker", "https://newsmaker.md/ro", "https://newsmaker.md/ro/feed/", "international", "online"],
  ["TVR Moldova", "https://tvrmoldova.md", "https://tvrmoldova.md/rss/all", "international", "tv"],
  ["Moldova 1", "https://moldova1.md", "https://moldova1.md/rss", "international", "tv"],
  ["Radio Chișinău", "https://radiochisinau.md", "https://radiochisinau.md/feed/", "international", "online"],
  ["Unimedia", "https://unimedia.info", "https://unimedia.info/rss/news.xml", "international", "online"],
  ["TV8", "https://tv8.md", "https://tv8.md/feed", "international", "tv"],

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
  ["Gândul", "https://www.gandul.ro", "https://www.gandul.ro/tehnologie/feed", "tech", "online"],

  // Lifestyle
  ["VIVA!", "https://www.viva.ro", "https://www.viva.ro/feed", "lifestyle", "presa"],
  ["Click!", "https://click.ro", "https://click.ro/rss/index", "national", "presa"], // tabloid general: categoria după conținut
  ["Adevărul", "https://adevarul.ro", "https://adevarul.ro/rss/showbiz", "lifestyle", "presa"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/magazin", "lifestyle", "tv"],
  ["Adevărul", "https://adevarul.ro", "https://adevarul.ro/rss/stil-de-viata", "lifestyle", "presa"],
  ["HotNews", "https://hotnews.ro", "https://hotnews.ro/c/life/feed", "lifestyle", "online"],
  ["Mediafax", "https://www.mediafax.ro", "https://www.mediafax.ro/life-inedit/feed", "lifestyle", "agentie"],
  ["G4Media", "https://www.g4media.ro", "https://www.g4media.ro/travel/feed", "lifestyle", "online"],

  // Sănătate
  ["Mediafax", "https://www.mediafax.ro", "https://www.mediafax.ro/sanatate/feed", "sanatate", "agentie"],
  ["HotNews", "https://hotnews.ro", "https://hotnews.ro/c/actualitate/sanatate-actualitate/feed", "sanatate", "online"],
  ["Digi24", "https://www.digi24.ro", "https://www.digi24.ro/rss/stiri/actualitate/sanatate", "sanatate", "tv"],
  ["Adevărul", "https://adevarul.ro", "https://adevarul.ro/rss/sanatate", "sanatate", "presa"],
  ["Observator", "https://observatornews.ro", "https://observatornews.ro/rss/sanatate", "sanatate", "tv"],
  ["Gândul", "https://www.gandul.ro", "https://www.gandul.ro/sanatate/feed", "sanatate", "online"],
  ["G4Media", "https://www.g4media.ro", "https://www.g4media.ro/healthylife/feed", "sanatate", "online"],
  ["SpotMedia", "https://spotmedia.ro", "https://spotmedia.ro/sanatate/feed", "sanatate", "online"],
  ["CSID", "https://www.csid.ro", "https://www.csid.ro/feed/", "sanatate", "online"],

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
  ["Adevărul", "https://adevarul.ro", "https://adevarul.ro/rss/cultura", "cultura", "presa"],
  ["Gândul", "https://www.gandul.ro", "https://www.gandul.ro/cultura/feed", "cultura", "online"],
  ["G4Media", "https://www.g4media.ro", "https://www.g4media.ro/timp-liber/feed", "cultura", "online"],

  // Monden
  ["Cancan", "https://www.cancan.ro", "https://www.cancan.ro/feed", "monden", "presa"],
  ["Libertatea", "https://www.libertatea.ro", "https://www.libertatea.ro/entertainment/feed", "monden", "presa"],
  ["TVmania", "https://tvmania.libertatea.ro", "https://tvmania.libertatea.ro/feed", "monden", "online"],
];

function sourceId(name: string, url: string, category: string) {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = ROWS.filter((r) => r[0] === name).length > 1 ? `${base}-${category}` : base;
  // Mai multe fluxuri ale aceleiași publicații în aceeași categorie: primul păstrează ID-ul
  // (stabil în baza de date), următoarele primesc un sufix din adresa fluxului.
  const same = ROWS.filter((r) => r[0] === name && r[3] === category);
  if (same.length < 2 || same[0][2] === url) return id;
  const path = new URL(url).pathname.replace(/\/(feed|rss|api)\/?$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${id}-${path || same.findIndex((r) => r[2] === url)}`;
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
