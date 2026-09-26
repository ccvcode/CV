import type { CategorySlug, RegionSlug } from "./types";

export interface Category {
  slug: CategorySlug;
  label: string;
  short: string;
  description: string;
}

/** Ordinea din navigație. Categoriile se disting prin tipografie, nu prin culori. */
export const CATEGORIES: Category[] = [
  { slug: "national", label: "Național", short: "Național", description: "Actualitate din toată România: societate, justiție, administrație, evenimente." },
  { slug: "politica", label: "Politică", short: "Politică", description: "Guvern, Parlament, partide și alegeri." },
  { slug: "international", label: "Internațional", short: "Extern", description: "Europa, SUA, Ucraina, Orientul Mijlociu, Asia și Republica Moldova." },
  { slug: "economie", label: "Economie", short: "Economie", description: "Bani, afaceri, taxe, prețuri și piețe." },
  { slug: "sport", label: "Sport", short: "Sport", description: "Fotbal, tenis, handbal și toate rezultatele importante." },
  { slug: "tech", label: "Tech & Știință", short: "Tech", description: "Tehnologie, inteligență artificială, spațiu și descoperiri." },
  { slug: "sanatate", label: "Sănătate", short: "Sănătate", description: "Medicină, sistemul sanitar, prevenție și nutriție." },
  { slug: "auto", label: "Auto", short: "Auto", description: "Mașini, trafic, infrastructură și legislație rutieră." },
  { slug: "cultura", label: "Cultură", short: "Cultură", description: "Film, carte, muzică, teatru și expoziții." },
  { slug: "lifestyle", label: "Lifestyle", short: "Lifestyle", description: "Călătorii, casă, rețete și stil de viață." },
  { slug: "monden", label: "Monden", short: "Monden", description: "Vedete, showbiz și evenimente mondene." },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c])) as Record<CategorySlug, Category>;

export function getCategory(slug: string): Category | undefined {
  return CATEGORY_MAP[slug as CategorySlug];
}

export const REGIONS: { slug: RegionSlug; label: string }[] = [
  { slug: "europa", label: "Europa" },
  { slug: "ucraina", label: "Ucraina" },
  { slug: "sua", label: "SUA" },
  { slug: "orientul-mijlociu", label: "Orientul Mijlociu" },
  { slug: "moldova", label: "R. Moldova" },
  { slug: "asia", label: "Asia" },
  { slug: "lume", label: "Lume" },
];

export const REGION_MAP = Object.fromEntries(REGIONS.map((r) => [r.slug, r])) as Record<RegionSlug, { slug: RegionSlug; label: string }>;
