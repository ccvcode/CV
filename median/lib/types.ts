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

export interface Source {
  id: string;
  name: string;
  site: string;
  url: string;
  category: CategorySlug;
  /** Tipul sursei, folosit pentru bara de acoperire. */
  kind?: "tv" | "online" | "agentie" | "presa" | "international";
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content?: string;
  link: string;
  image?: string;
  published: number;
  fetched: number;
  sourceId: string;
  sourceName: string;
  sourceSite: string;
  category: CategorySlug;
  author?: string;
  readingTime: number;
  /** ID-ul grupului de știri similare (story cluster). */
  clusterId?: string;
}

export interface Cluster {
  id: string;
  lead: Article;
  articles: Article[];
  sources: string[];
}

export interface NewsState {
  articles: Article[];
  updatedAt: number;
  demo: boolean;
  sourcesOk: number;
  sourcesTotal: number;
}
