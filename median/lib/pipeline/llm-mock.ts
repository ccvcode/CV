/*
 * Redactor AI SIMULAT — folosit exclusiv în modul demo (MEDIAN_DEMO=1) și în teste, când nu există
 * o cheie API. Construiește răspunsuri JSON din sursele primite (care, în demo, sunt texte fictive
 * create de noi), ca întregul flux să poată fi testat cap-coadă. Nu se folosește niciodată în producție.
 */

import { STORIES } from "../../scripts/demo-network/content";

/** Un AI real ar clasifica textul corect; simulatorul citește categoria din datele demo. */
function demoTruth(titles: string[]): { category?: string; region?: string | null } {
  for (const st of STORIES) if (st.versions.some((v) => titles.includes(v.title))) return { category: st.category, region: st.region ?? null };
  return {};
}

interface MockSource {
  n: number;
  publication: string;
  title: string;
  paragraphs: string[];
  headings: string[];
}

function parseSources(user: string): MockSource[] {
  const out: MockSource[] = [];
  for (const m of user.matchAll(/<sursa id="(\d+)" publicatie="([^"]*)"[^>]*>\s*TITLU: ([^\n]*)\n([\s\S]*?)<\/sursa>/g)) {
    const blocks = m[4].split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    out.push({
      n: Number(m[1]),
      publication: m[2],
      title: m[3].trim(),
      paragraphs: blocks.filter((b) => !b.startsWith("## ") && !b.startsWith("- ") && b.length > 40).map((b) => b.replace(/ \[…\]$/, "")),
      headings: blocks.filter((b) => b.startsWith("## ")).map((b) => b.slice(3)),
    });
  }
  return out;
}

const firstSentence = (s: string) => (/^.*?[.!?](\s|$)/.exec(s)?.[0] ?? s).trim();

function capitalized(text: string): string[] {
  const out = new Map<string, number>();
  for (const m of text.matchAll(/(?<![.!?]\s)(?<!^)\b([A-ZĂÂÎȘȚ][a-zăâîșț]+(?:\s+[A-ZĂÂÎȘȚ][a-zăâîșț]+){0,2})/g)) {
    const w = m[1];
    if (w.length < 4 || /^(Potrivit|Acesta|Aceasta|Astfel|Totodată|Însă|Pentru|După|Conform|Până|Printre)$/.test(w)) continue;
    out.set(w, (out.get(w) ?? 0) + 1);
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

const IMAGE_QUERY: Record<string, string> = {
  national: "romania city street",
  politica: "parliament building",
  economie: "euro banknotes finance",
  international: "european union flags",
  sport: "football stadium",
  tech: "technology laptop",
  lifestyle: "mountain travel",
  sanatate: "hospital doctor",
  auto: "cars highway",
  cultura: "theatre stage",
  monden: "concert stage lights",
};

export function mockChat(target: "write" | "verify", schemaName: string, _system: string, user: string) {
  const reply = (obj: unknown) => {
    const content = JSON.stringify(obj);
    return { content, model: "median-demo-mock", tokensIn: Math.round(user.length / 3.5), tokensOut: Math.round(content.length / 3.5) };
  };
  if (target === "verify") return reply({ ok: true, issues: [] });
  if (schemaName === "alegere_poza") return reply({ index: 1, reason: "demo" });

  const sources = parseSources(user);
  const truth = demoTruth(sources.map((s) => s.title));
  const category = truth.category ?? /Categoria preliminară: ([a-z]+)/.exec(user)?.[1] ?? "national";
  const region = truth.region ?? null;
  const allText = sources.flatMap((s) => [s.title, ...s.paragraphs]).join(" ");
  const tags = capitalized(allText).slice(0, 5);
  const entities = tags.slice(0, 4).map((name) => ({ name, type: "organizatie" }));
  const quotes = [...allText.matchAll(/„([^”]{15,300})”/g)].slice(0, 2).map((m) => ({ text: m[1], speaker: "declarație citată în surse", source: 1 }));

  if (schemaName === "stire_scurta") {
    const s = sources[0];
    if (!s) return reply({ status: "insuficient" });
    const summary = [firstSentence(s.paragraphs[0] ?? s.title), s.paragraphs[1] ? firstSentence(s.paragraphs[1]) : ""].filter(Boolean).join(" ") + ` (potrivit ${s.publication})`;
    return reply({ status: "ok", headline: s.title, summary, category, region, tags, entities, image_query: IMAGE_QUERY[category] ?? "news", sensitive: [] });
  }

  if (sources.length < 1) return reply({ status: "insuficient" });
  const [a, ...rest] = sources;
  const sections: { heading: string | null; paragraphs: { text: string; sources: number[] }[] }[] = [
    { heading: null, paragraphs: a.paragraphs.slice(0, 3).map((text) => ({ text, sources: [a.n] })) },
  ];
  rest.forEach((s, i) => {
    const heading = s.headings[0] ?? (i === 0 ? `Ce relatează ${s.publication}` : `Alte detalii`);
    sections.push({ heading, paragraphs: s.paragraphs.slice(0, 3).map((text) => ({ text, sources: [s.n] })) });
  });
  if (a.paragraphs.length > 3) sections.push({ heading: a.headings[0] ?? "Ce urmează", paragraphs: a.paragraphs.slice(3, 6).map((text) => ({ text, sources: [a.n] })) });
  return reply({
    status: "ok",
    headline: a.title,
    dek: firstSentence(a.paragraphs[0] ?? a.title),
    category,
    region,
    key_points: sources.map((s) => firstSentence(s.paragraphs[1] ?? s.paragraphs[0] ?? s.title)).slice(0, 4),
    sections,
    why_it_matters: rest[0] ? firstSentence(rest[0].paragraphs[0] ?? "") : "",
    context: "",
    quotes,
    tags,
    entities,
    image_query: IMAGE_QUERY[category] ?? "news",
    sensitive: [],
  });
}
