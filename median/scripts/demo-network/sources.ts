import type { CategorySlug } from "../../lib/core/types";
import { OUTLETS } from "./content";

/** Aceeași formă ca `Source` din lib/core/types.ts. */
export interface DemoSource {
  id: string;
  name: string;
  site: string;
  url: string;
  category: CategorySlug;
  kind?: "tv" | "online" | "agentie" | "presa" | "international";
  tier: number;
}

/**
 * Sursele rețelei demo (una sau două fluxuri per publicație), pentru un server pornit la `baseUrl`
 * (ex. "http://localhost:4010"). Fiecare publicație trăiește sub /<id-publicație>/.
 */
export function demoSources(baseUrl: string): DemoSource[] {
  const base = baseUrl.replace(/\/+$/, "");
  return OUTLETS.flatMap((o) =>
    o.sections.map((s, i) => ({
      id: i === 0 ? `demo-${o.id}` : `demo-${o.id}-${s.category}`,
      name: o.name,
      site: `${base}/${o.id}`,
      url: `${base}/${o.id}/${s.path}`,
      category: s.category,
      kind: o.kind,
      tier: o.tier,
    }))
  );
}
