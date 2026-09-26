/*
 * Rețea de știri SIMULATĂ pentru testarea pipeline-ului de preluare și pentru modul demo.
 *
 * Toate publicațiile (.test), autorii și persoanele citate sunt FICTIVE. Instituțiile și
 * locurile reale (Guvernul, BNR, București, UE, NATO etc.) apar doar în contexte neutre.
 * Fiecare „poveste” este relatată de 1–4 publicații, fiecare cu titlu și text proprii
 * (aceleași fapte, cifre și citate), ca în presa reală.
 */
import type { CategorySlug, RegionSlug } from "../../lib/core/types";
import { STORIES_A } from "./stories-a";
import { STORIES_B } from "./stories-b";
import { STORIES_C } from "./stories-c";
import { STORIES_D, BREAKING_STORIES } from "./stories-d";

export type OutletId =
  | "stiricarpatice"
  | "jurnaluldevest"
  | "radareconomic"
  | "sporttotal"
  | "techzona"
  | "cotidianulnational"
  | "infoest"
  | "actualitateatv"
  | "mondenplus"
  | "magazincultural";

/** Cum își publică fiecare redacție fluxul și paginile. */
export type FeedFormat =
  | "rss-enclosure" // <enclosure url=… type="image/jpeg">
  | "rss-media" // <media:content> + <media:thumbnail>
  | "rss-html" // doar <img data-src=…> în <content:encoded>
  | "atom"; // flux Atom, imagine în <media:thumbnail> și în <content type="html">

export type PageTemplate = "wordpress" | "newsroom";

export interface OutletSection {
  category: CategorySlug;
  /** Calea fluxului, relativă la rădăcina publicației (ex. "feed.xml", "feed/politica.xml"). */
  path: string;
  /** Categoriile incluse în flux; lipsă = toate. */
  includes?: CategorySlug[];
}

export interface Outlet {
  id: OutletId;
  name: string;
  domain: string;
  kind: "tv" | "online" | "agentie" | "presa" | "international";
  tier: number;
  tagline: string;
  feedFormat: FeedFormat;
  template: PageTemplate;
  /** Culoarea de brand (logo, imaginea implicită). */
  color: string;
  accent: string;
  sections: OutletSection[];
  /** robots.txt interzice /articol/ (pentru testarea respectării robots). */
  disallowArticles?: boolean;
}

export type Scene =
  | "city"
  | "night"
  | "sky"
  | "mountain"
  | "landscape"
  | "sea"
  | "stadium"
  | "road"
  | "interior"
  | "tech"
  | "crowd"
  | "stage";

export interface ImageSpec {
  scene: Scene;
  caption: string;
  /** Nuanța dominantă (0–360); lipsă = derivată din id. */
  hue?: number;
}

export interface StoryVersion {
  outlet: OutletId;
  title: string;
  subheading?: string;
  /** 4–8 paragrafe; unul dintre ele conține citatul direct în „…”. */
  paragraphs: string[];
  /** Persoana căreia îi aparține citatul direct din text. */
  quoteBy: string;
  author: string;
  /** Minute înainte de pornirea serverului. */
  offsetMin: number;
  /** Suprascrie imaginea poveștii pentru această versiune. */
  image?: Partial<ImageSpec>;
}

export interface Story {
  id: string;
  category: CategorySlug;
  region?: RegionSlug;
  /** Subiect sensibil (victime, persoane reținute) — tratat responsabil în text. */
  sensitive?: boolean;
  image: ImageSpec;
  versions: StoryVersion[];
}

export const OUTLETS: Outlet[] = [
  {
    id: "stiricarpatice", name: "Știri Carpatice", domain: "stiricarpatice.test", kind: "online", tier: 1,
    tagline: "Actualitate din toată țara", feedFormat: "rss-enclosure", template: "wordpress",
    color: "#14532d", accent: "#22c55e",
    sections: [
      { category: "national", path: "feed.xml" },
      { category: "politica", path: "feed/politica.xml", includes: ["politica"] },
    ],
  },
  {
    id: "jurnaluldevest", name: "Jurnalul de Vest", domain: "jurnaluldevest.test", kind: "presa", tier: 2,
    tagline: "Cotidian regional, Timișoara – Arad – Cluj", feedFormat: "rss-media", template: "wordpress",
    color: "#7c2d12", accent: "#f97316",
    sections: [{ category: "national", path: "feed.xml" }],
  },
  {
    id: "radareconomic", name: "Radar Economic", domain: "radareconomic.test", kind: "online", tier: 1,
    tagline: "Business, piețe, bani", feedFormat: "atom", template: "newsroom",
    color: "#1e3a8a", accent: "#3b82f6",
    sections: [{ category: "economie", path: "feed.xml" }],
  },
  {
    id: "sporttotal", name: "Sport Total", domain: "sporttotal.test", kind: "online", tier: 2,
    tagline: "Tot sportul, în timp real", feedFormat: "rss-html", template: "wordpress",
    color: "#991b1b", accent: "#ef4444",
    sections: [{ category: "sport", path: "feed.xml" }],
  },
  {
    id: "techzona", name: "TechZona", domain: "techzona.test", kind: "online", tier: 2,
    tagline: "Tehnologie pe înțelesul tuturor", feedFormat: "rss-media", template: "wordpress",
    color: "#312e81", accent: "#a78bfa", disallowArticles: true,
    sections: [{ category: "tech", path: "feed.xml" }],
  },
  {
    id: "cotidianulnational", name: "Cotidianul Național", domain: "cotidianulnational.test", kind: "presa", tier: 1,
    tagline: "Din 1994, alături de cititori", feedFormat: "rss-enclosure", template: "newsroom",
    color: "#0f172a", accent: "#eab308",
    sections: [
      { category: "national", path: "feed.xml" },
      { category: "economie", path: "feed/economie.xml", includes: ["economie"] },
    ],
  },
  {
    id: "infoest", name: "Info Est", domain: "infoest.test", kind: "online", tier: 2,
    tagline: "Știri din Moldova și de peste Prut", feedFormat: "rss-html", template: "wordpress",
    color: "#134e4a", accent: "#2dd4bf",
    sections: [{ category: "national", path: "feed.xml" }],
  },
  {
    id: "actualitateatv", name: "Actualitatea TV", domain: "actualitateatv.test", kind: "tv", tier: 1,
    tagline: "Știri 24/7", feedFormat: "rss-media", template: "newsroom",
    color: "#1d4ed8", accent: "#f43f5e",
    sections: [
      { category: "national", path: "feed.xml" },
      { category: "international", path: "feed/international.xml", includes: ["international"] },
    ],
  },
  {
    id: "mondenplus", name: "Monden Plus", domain: "mondenplus.test", kind: "online", tier: 2,
    tagline: "Vedete, stil, povești", feedFormat: "rss-enclosure", template: "wordpress",
    color: "#831843", accent: "#f472b6",
    sections: [{ category: "monden", path: "feed.xml" }],
  },
  {
    id: "magazincultural", name: "Magazin Cultural", domain: "magazincultural.test", kind: "presa", tier: 2,
    tagline: "Carte, film, teatru, muzică", feedFormat: "rss-html", template: "newsroom",
    color: "#3f3f46", accent: "#d4a373",
    sections: [{ category: "cultura", path: "feed.xml" }],
  },
];

export const STORIES: Story[] = [...STORIES_A, ...STORIES_B, ...STORIES_C, ...STORIES_D];
export { BREAKING_STORIES };

export function outletById(id: OutletId): Outlet {
  const o = OUTLETS.find((x) => x.id === id);
  if (!o) throw new Error(`Publicație necunoscută: ${id}`);
  return o;
}

/** Slug URL fără diacritice. */
export function slugify(s: string, max = 90): string {
  const out = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out.slice(0, max).replace(/-+$/, "");
}

/** Extrage citatul direct („…”) din paragrafele unei versiuni. */
export function quoteOf(v: StoryVersion): { text: string; speaker: string } | undefined {
  for (const p of v.paragraphs) {
    const m = /„([^”]+)”/.exec(p);
    if (m) return { text: m[1], speaker: v.quoteBy };
  }
  return undefined;
}
