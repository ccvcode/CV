import { config } from "../core/config";
import { db, logEvent } from "../core/db";
import type { ArticleSection, ArticleSourceRef, CategorySlug } from "../core/types";
import { slugify } from "../core/utils";
import type { FullText } from "./fulltext";
import { fetchFullText } from "./fulltext";
import { enqueue } from "./jobs";
import { assertBudget, chatJson, recordOutput } from "./llm";
import {
  ArticleSchema,
  ArticleShape,
  BRIEF_SYSTEM,
  BriefSchema,
  BriefShape,
  formatSources,
  VERIFY_SYSTEM,
  VerifySchema,
  VerifyShape,
  WRITER_SYSTEM,
  type ArticleDraft,
  type PromptSource,
} from "./prompts";
import { checkAgainstSources, tidy, type CodeIssue } from "./verify";

/** Etichetele care trimit articolul la aprobare în /admin (dacă MEDIAN_REVIEW_SENSITIVE=1). */
const REVIEW_TAGS = new Set(["deces", "sinucidere", "minori", "viol", "justitie"]);

interface StoryItem {
  id: string;
  url: string;
  title: string;
  summary: string;
  published_at: number;
  fulltext: string | null;
  fulltext_status: string;
  duplicate_of: string | null;
  source_name: string;
  site: string;
  tier: number;
}

function storyItems(storyId: string): StoryItem[] {
  return db()
    .prepare(
      `SELECT i.id, i.url, i.title, i.summary, i.published_at, i.fulltext, i.fulltext_status, i.duplicate_of, s.name AS source_name, s.site, s.tier
       FROM items i JOIN sources s ON s.id = i.source_id WHERE i.story_id = ? ORDER BY s.tier, i.published_at`
    )
    .all(storyId) as StoryItem[];
}

function textOf(it: StoryItem, maxWords: number): string {
  let text = "";
  if (it.fulltext) {
    const ft = JSON.parse(it.fulltext) as FullText;
    text = ft.blocks.map((b) => (b.type === "h" ? `## ${b.text}` : b.type === "li" ? `- ${b.text}` : b.text)).join("\n\n");
  }
  if (text.split(/\s+/).length < 60 && it.summary) text = it.summary;
  const words = text.split(/\s+/);
  return words.length > maxWords ? words.slice(0, maxWords).join(" ") + " […]" : text;
}

const fmtDate = (ts: number) =>
  new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(ts);

/** Alege cel mult 4 surse: câte una per publicație, preferând textul complet și publicațiile de nivel 1. */
function pickSources(items: StoryItem[]): StoryItem[] {
  const byOutlet = new Map<string, StoryItem>();
  for (const it of items) {
    if (it.duplicate_of) continue;
    const cur = byOutlet.get(it.source_name);
    const len = (x: StoryItem) => (x.fulltext ? 10000 : 0) + x.summary.length;
    if (!cur || len(it) > len(cur)) byOutlet.set(it.source_name, it);
  }
  return [...byOutlet.values()].sort((a, b) => a.tier - b.tier || (b.fulltext ? 1 : 0) - (a.fulltext ? 1 : 0)).slice(0, 4);
}

function toPromptSources(list: StoryItem[], maxWords: number): PromptSource[] {
  return list.map((it, i) => ({ n: i + 1, publication: it.source_name, url: it.url, published: fmtDate(it.published_at), title: it.title, text: textOf(it, maxWords) }));
}

function draftText(d: ArticleDraft): string {
  return [d.headline, d.dek, ...d.key_points, ...d.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs.map((p) => p.text)]), d.why_it_matters, d.context].join("\n");
}

function sourceRefs(list: StoryItem[]): ArticleSourceRef[] {
  return list.map((it) => ({ itemId: it.id, sourceName: it.source_name, site: it.site, title: it.title, url: it.url, published: it.published_at }));
}

/* ------------------------------------------------------------------ articol complet */

export type WriteOutcome = "published" | "review" | "brief" | "skipped";

export async function writeStory(storyId: string, opts: { force?: boolean } = {}): Promise<WriteOutcome> {
  const d = db();
  const story = d.prepare("SELECT * FROM stories WHERE id = ?").get(storyId) as
    | { id: string; status: string; sensitive: string | null; source_count: number; article_id: number | null; category: CategorySlug; written_source_count: number }
    | undefined;
  if (!story || story.status !== "active") return "skipped";
  // Reverificăm: între programare și rulare, alt job poate să fi scris deja articolul.
  if (!opts.force) {
    const existing = d.prepare("SELECT kind FROM articles WHERE story_id = ? AND status IN ('published','review') ORDER BY version DESC LIMIT 1").get(storyId) as
      | { kind: string }
      | undefined;
    if (existing?.kind === "full" && story.source_count < story.written_source_count + 2) return "skipped";
  }

  const items = storyItems(storyId);
  // Ne asigurăm că avem textul complet (jobul de extragere poate să nu fi rulat încă).
  for (const it of items) {
    if (it.fulltext_status === "none") {
      try {
        await fetchFullText(it.id);
      } catch {
        /* rămâne rezumatul din RSS */
      }
    }
  }
  const fresh = storyItems(storyId);
  const chosen = pickSources(fresh);
  const sources = toPromptSources(chosen, 1500);
  const totalWords = sources.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
  if (chosen.length < 2 || totalWords < 150) return (await writeBrief(storyId)) ? "brief" : "skipped";

  assertBudget("article");
  const user = `Subiect: ${fresh[0].title}\nCategoria preliminară: ${story.category}\nNumăr de publicații care relatează: ${story.source_count}\n\nSURSE:\n\n${formatSources(sources)}\n\nScrie articolul în formatul JSON cerut.`;
  const sourceTexts = sources.map((s) => s.title + "\n" + s.text);

  let usageIn = 0;
  let usageOut = 0;
  let cost = 0;
  let model = "";
  let draft: ArticleDraft | undefined;
  let codeIssues: CodeIssue[] = [];
  let aiIssues: { type: string; text: string; detail: string }[] = [];
  let feedback = "";

  for (let round = 0; round < 2; round++) {
    const res = await chatJson({
      target: "write",
      system: WRITER_SYSTEM,
      user: user + feedback,
      schema: ArticleSchema,
      shape: ArticleShape,
      schemaName: "articol",
      maxTokens: 6000,
    });
    usageIn += res.tokensIn;
    usageOut += res.tokensOut;
    cost += res.costUsd;
    model = res.model;
    draft = normalizeDraft(res.data);
    if (draft.status === "insuficient") return (await writeBrief(storyId)) ? "brief" : "skipped";

    codeIssues = checkAgainstSources({
      text: draftText(draft),
      quotes: draft.quotes,
      tags: draft.tags,
      sources: sourceTexts,
      outlets: chosen.map((c) => c.source_name),
      dates: chosen.map((c) => c.published_at),
      minWords: 220,
      maxCopiedWords: config.demo ? 100000 : 14,
    });
    // Verificarea cu al doilea model (doar dacă verificările din cod au trecut).
    aiIssues = [];
    if (!codeIssues.length) {
      const v = await chatJson({
        target: "verify",
        system: VERIFY_SYSTEM,
        user: `SURSE:\n\n${formatSources(sources)}\n\nARTICOL:\n${JSON.stringify({ headline: draft.headline, dek: draft.dek, key_points: draft.key_points, sections: draft.sections, why_it_matters: draft.why_it_matters, context: draft.context, quotes: draft.quotes })}`,
        schema: VerifySchema,
        shape: VerifyShape,
        schemaName: "verificare",
        maxTokens: 1500,
        temperature: 0,
      });
      usageIn += v.tokensIn;
      usageOut += v.tokensOut;
      cost += v.costUsd;
      // „ok: false” fără detalii contează tot ca problemă (nu trecem articolul pe tăcute).
      aiIssues = v.data.ok && !v.data.issues.length ? [] : v.data.issues.length ? v.data.issues : [{ type: "verificare", text: "", detail: "verificatorul a respins articolul fără detalii" }];
    }
    if (!codeIssues.length && !aiIssues.length) break;
    feedback =
      "\n\nVARIANTA ANTERIOARĂ A AVUT URMĂTOARELE PROBLEME. Rescrie articolul corectându-le (elimină orice informație care nu apare în surse):\n" +
      [...codeIssues, ...aiIssues].map((i) => `- [${i.type}] ${i.text}: ${i.detail}`).join("\n");
  }
  if (!draft) return "skipped";

  const sensitive = [...new Set([...(story.sensitive?.split(",").filter(Boolean) ?? []), ...draft.sensitive])];
  const unresolved = [...codeIssues, ...aiIssues];
  let status: "published" | "review" = "published";
  let reviewReason: string | null = null;
  if (unresolved.length) {
    status = "review";
    reviewReason = "verificare nereușită: " + unresolved.map((i) => `${i.type}: ${i.text}`).join("; ").slice(0, 500);
  } else if (config.reviewSensitive && sensitive.some((s) => REVIEW_TAGS.has(s))) {
    status = "review";
    reviewReason = "subiect sensibil: " + sensitive.join(", ");
  }

  const articleId = saveArticle({
    storyId,
    kind: "full",
    status,
    draft,
    sources: sourceRefs(chosen),
    model,
    usageIn,
    usageOut,
    cost,
    verification: { codeIssues, aiIssues, sourcesUsed: chosen.length },
    reviewReason,
    sensitive,
  });
  recordOutput("article");
  d.prepare("UPDATE stories SET written_source_count = ?, written_at = ? WHERE id = ?").run(story.source_count, Date.now(), storyId);
  logEvent(status === "published" ? "info" : "warn", `articol ${status === "published" ? "publicat" : "la aprobare"}: „${draft.headline}” (${chosen.length} surse, $${cost.toFixed(4)})${reviewReason ? " — " + reviewReason : ""}`);
  enqueue("image", `image:${storyId}:${articleId}`, { storyId }, { priority: 5 });
  return status;
}

function normalizeDraft(d: ArticleDraft): ArticleDraft {
  const t = (s: string) => tidy(s);
  return {
    ...d,
    headline: t(d.headline).replace(/\.$/, ""),
    dek: t(d.dek),
    key_points: d.key_points.map(t).filter(Boolean),
    sections: d.sections
      .map((s) => ({ heading: s.heading ? t(s.heading) : null, paragraphs: s.paragraphs.map((p) => ({ text: t(p.text), sources: p.sources })).filter((p) => p.text) }))
      .filter((s) => s.paragraphs.length),
    why_it_matters: t(d.why_it_matters),
    context: t(d.context),
    quotes: d.quotes.map((q) => ({ ...q, text: t(q.text).replace(/^[„"]|[”"]$/g, ""), speaker: t(q.speaker) })),
    tags: [...new Set(d.tags.map(t).filter(Boolean))],
  };
}

function saveArticle(a: {
  storyId: string;
  kind: "full" | "brief";
  status: "published" | "review";
  draft: {
    headline: string;
    dek: string;
    key_points?: string[];
    sections?: ArticleDraft["sections"];
    why_it_matters?: string;
    context?: string;
    quotes?: ArticleDraft["quotes"];
    tags: string[];
    entities: ArticleDraft["entities"];
    image_query: string;
    category: string;
    region: string | null;
  };
  sources: ArticleSourceRef[];
  model: string;
  usageIn: number;
  usageOut: number;
  cost: number;
  verification: object;
  reviewReason: string | null;
  sensitive: string[];
}): number {
  const d = db();
  const now = Date.now();
  const sections: ArticleSection[] = (a.draft.sections ?? []).map((s) => ({ heading: s.heading ?? undefined, paragraphs: s.paragraphs.map((p) => p.text) }));
  const words = [a.draft.dek, ...sections.flatMap((s) => s.paragraphs)].join(" ").split(/\s+/).filter(Boolean).length;
  const prev = d.prepare("SELECT MAX(version) AS v FROM articles WHERE story_id = ?").get(a.storyId) as { v: number | null };
  const info = d
    .prepare(
      `INSERT INTO articles(story_id, version, kind, status, headline, dek, key_points, sections, context, why, quotes, tags, entities, image_query, region,
         sources, word_count, model, tokens_in, tokens_out, cost_usd, verification, review_reason, created_at, published_at, updated_at)
       VALUES (@story, @version, @kind, @status, @headline, @dek, @kp, @sections, @context, @why, @quotes, @tags, @entities, @iq, @region,
         @sources, @words, @model, @tin, @tout, @cost, @verification, @reason, @now, @published, @now)`
    )
    .run({
      story: a.storyId,
      version: (prev.v ?? 0) + 1,
      kind: a.kind,
      status: a.status,
      headline: a.draft.headline,
      dek: a.draft.dek,
      kp: JSON.stringify(a.draft.key_points ?? []),
      sections: JSON.stringify(sections),
      context: a.draft.context ?? "",
      why: a.draft.why_it_matters ?? "",
      quotes: JSON.stringify(a.draft.quotes ?? []),
      tags: JSON.stringify(a.draft.tags),
      entities: JSON.stringify(a.draft.entities),
      iq: a.draft.image_query,
      region: a.draft.region,
      sources: JSON.stringify(a.sources),
      words,
      model: a.model,
      tin: a.usageIn,
      tout: a.usageOut,
      cost: a.cost,
      verification: JSON.stringify(a.verification),
      reason: a.reviewReason,
      now,
      published: a.status === "published" ? now : null,
    });
  const articleId = Number(info.lastInsertRowid);
  if (a.status === "published") publishArticle(a.storyId, articleId, a.draft.headline, a.draft.category, a.draft.region, a.sensitive);
  else d.prepare("UPDATE stories SET sensitive = ? WHERE id = ?").run(a.sensitive.join(",") || null, a.storyId);
  return articleId;
}

/**
 * Face vizibil un articol (folosit și de butonul „Aprobă” din /admin). Nu permite ca o știre scurtă
 * să înlocuiască un articol complet sau ca o versiune mai veche să înlocuiască una mai nouă;
 * în aceste cazuri articolul e marcat „superseded” și funcția întoarce false.
 */
export function publishArticle(storyId: string, articleId: number, headline: string, category: string, region: string | null, sensitive: string[] = []): boolean {
  const d = db();
  return d.transaction(() => {
    const story = d.prepare("SELECT slug, article_id FROM stories WHERE id = ?").get(storyId) as { slug: string; article_id: number | null };
    const next = d.prepare("SELECT kind, version FROM articles WHERE id = ?").get(articleId) as { kind: string; version: number };
    const cur = story.article_id ? (d.prepare("SELECT kind, version FROM articles WHERE id = ? AND status = 'published'").get(story.article_id) as { kind: string; version: number } | undefined) : undefined;
    if (cur && ((cur.kind === "full" && next.kind === "brief") || cur.version > next.version)) {
      d.prepare("UPDATE articles SET status = 'superseded', updated_at = ? WHERE id = ?").run(Date.now(), articleId);
      return false;
    }
    d.prepare("UPDATE articles SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?").run(Date.now(), Date.now(), articleId);
    // Versiunile anterioare aflate la aprobare nu mai sunt relevante.
    d.prepare("UPDATE articles SET status = 'superseded' WHERE story_id = ? AND id != ? AND status = 'review' AND version < ?").run(storyId, articleId, next.version);
    d.prepare(
      `UPDATE stories SET article_id = ?, title = ?, slug = ?, category = ?, region = ?, sensitive = ? WHERE id = ?`
    ).run(
      articleId,
      headline,
      cur ? story.slug : slugify(headline, 80),
      category,
      category === "international" ? region ?? "lume" : null,
      sensitive.join(",") || null,
      storyId
    );
    const a = d.prepare("SELECT dek, sections FROM articles WHERE id = ?").get(articleId) as { dek: string; sections: string };
    const body = [a.dek, ...(JSON.parse(a.sections) as ArticleSection[]).flatMap((s) => s.paragraphs)].join(" ");
    d.prepare("DELETE FROM search WHERE story_id = ?").run(storyId);
    d.prepare("INSERT INTO search(story_id, title, body) VALUES (?, ?, ?)").run(storyId, headline, body);
    return true;
  })();
}

/* ------------------------------------------------------------------ știre scurtă */

export async function writeBrief(storyId: string): Promise<boolean> {
  const d = db();
  const story = d.prepare("SELECT id, status, article_id, sensitive, category FROM stories WHERE id = ?").get(storyId) as
    | { id: string; status: string; article_id: number | null; sensitive: string | null; category: string }
    | undefined;
  if (!story || story.status !== "active") return false;
  // Nu înlocuim un articol complet cu o știre scurtă.
  if (story.article_id) {
    const cur = d.prepare("SELECT kind FROM articles WHERE id = ?").get(story.article_id) as { kind: string } | undefined;
    if (cur?.kind === "full") return false;
  }
  const items = storyItems(storyId);
  const lead = pickSources(items)[0] ?? items[0];
  if (!lead) return false;
  if (lead.summary.split(/\s+/).length < 30 && lead.fulltext_status === "none") {
    try {
      await fetchFullText(lead.id);
    } catch {
      /* folosim ce avem */
    }
  }
  const [it] = storyItems(storyId).filter((x) => x.id === lead.id);
  const src = toPromptSources([it], 700);
  if (src[0].text.split(/\s+/).length < 12) return false;

  assertBudget("brief");
  const res = await chatJson({
    target: "write",
    system: BRIEF_SYSTEM,
    user: `Categoria preliminară: ${story.category}\n\nSURSA:\n\n${formatSources(src)}\n\nScrie știrea scurtă în formatul JSON cerut.`,
    schema: BriefSchema,
    shape: BriefShape,
    schemaName: "stire_scurta",
    maxTokens: 900,
  });
  const b = res.data;
  if (b.status === "insuficient" || !b.headline || !b.summary) return false;
  const headline = tidy(b.headline).replace(/\.$/, "");
  const summary = tidy(b.summary);
  const issues = checkAgainstSources({
    text: headline + "\n" + summary,
    quotes: [],
    tags: b.tags,
    sources: [src[0].title + "\n" + src[0].text],
    outlets: [it.source_name],
    dates: [it.published_at],
    maxCopiedWords: config.demo ? 100000 : 12,
  });
  const sensitive = [...new Set([...(story.sensitive?.split(",").filter(Boolean) ?? []), ...b.sensitive])];
  const needsReview = issues.length > 0 || (config.reviewSensitive && sensitive.some((s) => REVIEW_TAGS.has(s)));
  const articleId = saveArticle({
    storyId,
    kind: "brief",
    status: needsReview ? "review" : "published",
    draft: { headline, dek: summary, tags: b.tags, entities: b.entities, image_query: b.image_query, category: b.category, region: b.region },
    sources: sourceRefs([it]),
    model: res.model,
    usageIn: res.tokensIn,
    usageOut: res.tokensOut,
    cost: res.costUsd,
    verification: { codeIssues: issues },
    reviewReason: issues.length ? "verificare: " + issues.map((i) => `${i.type}: ${i.text}`).join("; ") : needsReview ? "subiect sensibil: " + sensitive.join(", ") : null,
    sensitive,
  });
  recordOutput("brief");
  enqueue("image", `image:${storyId}:${articleId}`, { storyId }, { priority: 1 });
  return true;
}
