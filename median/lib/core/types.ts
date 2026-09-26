export type CategorySlug =
  | "national"
  | "politica"
  | "economie"
  | "international"
  | "sport"
  | "tech"
  | "lifestyle"
  | "sanatate"
  | "auto"
  | "cultura"
  | "monden";

export type RegionSlug = "europa" | "sua" | "ucraina" | "orientul-mijlociu" | "asia" | "moldova" | "lume";

export interface Source {
  id: string;
  name: string;
  site: string;
  url: string;
  category: CategorySlug;
  kind?: "tv" | "online" | "agentie" | "presa" | "international";
  /** 1 = redacție mare, standarde verificabile; 2 = restul. */
  tier: number;
}

export interface ImageCandidate {
  url: string;
  from: "rss-media" | "rss-enclosure" | "rss-html" | "og" | "jsonld" | "twitter" | "body";
  width?: number;
  height?: number;
  caption?: string;
}

/** Un articol preluat dintr-un flux RSS (materie primă, nu se afișează integral). */
export interface ParsedItem {
  id: string;
  url: string;
  title: string;
  summary: string;
  author?: string;
  published: number;
  images: ImageCandidate[];
}

export interface ArticleSection {
  heading?: string;
  paragraphs: string[];
}

export interface ArticleQuote {
  text: string;
  speaker: string;
  source: string;
}

export interface ArticleSourceRef {
  itemId: string;
  sourceName: string;
  site: string;
  title: string;
  url: string;
  published: number;
}

export interface ImageRow {
  id: number;
  kind: "source" | "commons" | "unsplash" | "pexels" | "card";
  original_url: string;
  file_base: string | null;
  widths: string;
  width: number | null;
  height: number | null;
  thumbhash: string | null;
  color: string | null;
  credit: string;
  credit_url: string | null;
  license: string | null;
  license_url: string | null;
}

export interface Img {
  src: string;
  srcSet?: string;
  width: number;
  height: number;
  color?: string;
  credit: string;
  creditUrl?: string;
  license?: string;
  licenseUrl?: string;
  kind: ImageRow["kind"];
}
