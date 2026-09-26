import type { CategorySlug } from "./types";

export interface Category {
  slug: CategorySlug;
  label: string;
  short: string;
  color: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  { slug: "national", label: "Național", short: "Național", color: "#1E5EFF", description: "Actualitate din toată România: societate, justiție, administrație, evenimente." },
  { slug: "politica", label: "Politică", short: "Politică", color: "#C81D4E", description: "Guvern, Parlament, partide și alegeri — tot ce mișcă pe scena politică." },
  { slug: "economie", label: "Economie", short: "Economie", color: "#0E9F6E", description: "Bani, afaceri, burse, taxe și prețuri. Economia pe înțelesul tuturor." },
  { slug: "international", label: "Internațional", short: "Extern", color: "#0891B2", description: "Știri din lume: Europa, SUA, Ucraina, Orientul Mijlociu și nu numai." },
  { slug: "sport", label: "Sport", short: "Sport", color: "#F97316", description: "Fotbal, tenis, handbal, Formula 1 și toate rezultatele importante." },
  { slug: "tech", label: "Tech & Știință", short: "Tech", color: "#7C3AED", description: "Tehnologie, gadgeturi, inteligență artificială, spațiu și descoperiri." },
  { slug: "lifestyle", label: "Lifestyle", short: "Lifestyle", color: "#EC4899", description: "Stil de viață, călătorii, casă, rețete și relații." },
  { slug: "sanatate", label: "Sănătate", short: "Sănătate", color: "#14B8A6", description: "Medicină, nutriție, sport pentru sănătate și sfaturi utile." },
  { slug: "auto", label: "Auto", short: "Auto", color: "#475569", description: "Mașini noi, teste, piața auto, electrice și legislație rutieră." },
  { slug: "cultura", label: "Cultură", short: "Cultură", color: "#B45309", description: "Film, carte, muzică, teatru, expoziții și evenimente culturale." },
  { slug: "monden", label: "Monden", short: "Monden", color: "#DB2777", description: "Vedete, showbiz și cele mai discutate momente din lumea mondenă." },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c])) as Record<CategorySlug, Category>;

export function getCategory(slug: string): Category | undefined {
  return CATEGORY_MAP[slug as CategorySlug];
}
