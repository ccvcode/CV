import { fetch as undiciFetch } from "undici";
import { z } from "zod";
import { config } from "../core/config";
import { db, today } from "../core/db";
import { mockChat } from "./llm-mock";

/*
 * Client AI universal pentru orice API compatibil OpenAI (/v1/chat/completions):
 * DeepSeek, Scaleway, OVH, Nebius, OpenRouter, Ollama, llama.cpp etc.
 * Răspunsurile sunt cerute în JSON și validate strict; la JSON invalid se reîncearcă o dată.
 */

export type Target = "write" | "verify";

export interface ChatResult<T> {
  data: T;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export class BudgetExceeded extends Error {}
export class LlmError extends Error {
  constructor(message: string, public retryable: boolean) {
    super(message);
  }
}

function endpoint(target: Target) {
  const c = config.llm;
  return target === "verify"
    ? { baseUrl: c.verify.baseUrl, apiKey: c.verify.apiKey, model: c.verify.model, extra: c.verify.extra }
    : { baseUrl: c.baseUrl, apiKey: c.apiKey, model: c.model, extra: c.extra };
}

export interface Usage {
  calls: number;
  articles: number;
  briefs: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}

export function usageToday(): Usage {
  return (
    (db().prepare("SELECT calls, articles, briefs, tokens_in, tokens_out, cost_usd FROM ai_usage WHERE day = ?").get(today()) as Usage | undefined) ?? {
      calls: 0,
      articles: 0,
      briefs: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
    }
  );
}

/** Verifică plafonul zilnic înainte de un apel. */
export function assertBudget(kind: "article" | "brief") {
  const u = usageToday();
  const c = config.llm;
  if (u.cost_usd >= c.dailyBudgetUsd) throw new BudgetExceeded(`buget zilnic atins ($${u.cost_usd.toFixed(2)} / $${c.dailyBudgetUsd})`);
  if (kind === "article" && u.articles >= c.maxArticlesPerDay) throw new BudgetExceeded(`limita zilnică de articole atinsă (${u.articles})`);
  if (kind === "brief" && u.briefs >= c.maxBriefsPerDay) throw new BudgetExceeded(`limita zilnică de știri scurte atinsă (${u.briefs})`);
}

export function recordOutput(kind: "article" | "brief") {
  db()
    .prepare(`INSERT INTO ai_usage(day, ${kind === "article" ? "articles" : "briefs"}) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET ${kind === "article" ? "articles = articles + 1" : "briefs = briefs + 1"}`)
    .run(today());
}

function recordUsage(tokensIn: number, tokensOut: number, cost: number) {
  db()
    .prepare(
      `INSERT INTO ai_usage(day, calls, tokens_in, tokens_out, cost_usd) VALUES (@day, 1, @i, @o, @c)
       ON CONFLICT(day) DO UPDATE SET calls = calls + 1, tokens_in = tokens_in + @i, tokens_out = tokens_out + @o, cost_usd = cost_usd + @c`
    )
    .run({ day: today(), i: tokensIn, o: tokensOut, c: cost });
}

/**
 * Trimite o cerere de chat și întoarce JSON-ul validat de schema zod.
 * `schema` este folosită atât pentru validare, cât și (în modul json_schema) pentru constrângerea modelului.
 */
export async function chatJson<S extends z.ZodTypeAny>(opts: {
  target: Target;
  system: string;
  user: string;
  schema: S;
  schemaName: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatResult<z.infer<S>>> {
  const ep = endpoint(opts.target);
  if (!ep.baseUrl) throw new LlmError("AI neconfigurat (LLM_BASE_URL lipsește)", false);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const extraUser = attempt > 0 ? `\n\nATENȚIE: răspunsul anterior nu a fost JSON valid conform schemei (${String((lastErr as Error)?.message).slice(0, 300)}). Răspunde DOAR cu JSON valid.` : "";
    const { content, model, tokensIn, tokensOut } = await rawChat(ep, opts, opts.user + extraUser);
    const cost = (tokensIn * config.llm.priceIn + tokensOut * config.llm.priceOut) / 1_000_000;
    recordUsage(tokensIn, tokensOut, cost);
    try {
      const parsed = opts.schema.parse(JSON.parse(extractJson(content)));
      return { data: parsed, model, tokensIn, tokensOut, costUsd: cost };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new LlmError(`JSON invalid de la model: ${String((lastErr as Error)?.message).slice(0, 300)}`, true);
}

async function rawChat(
  ep: ReturnType<typeof endpoint>,
  opts: { system: string; schema: z.ZodTypeAny; schemaName: string; maxTokens?: number; temperature?: number; target: Target },
  user: string
): Promise<{ content: string; model: string; tokensIn: number; tokensOut: number }> {
  if (ep.baseUrl === "mock") return mockChat(opts.target, opts.schemaName, opts.system, user);

  const body: Record<string, unknown> = {
    model: ep.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: user },
    ],
    max_tokens: opts.maxTokens ?? 6000,
    temperature: opts.temperature ?? 0.3,
    stream: false,
    ...ep.extra,
  };
  if (config.llm.jsonMode === "json_object") body.response_format = { type: "json_object" };
  else if (config.llm.jsonMode === "json_schema")
    body.response_format = { type: "json_schema", json_schema: { name: opts.schemaName, strict: true, schema: z.toJSONSchema(opts.schema) } };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.llm.timeoutMs);
  let res: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    res = await undiciFetch(chatUrl(ep.baseUrl), {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", ...(ep.apiKey ? { authorization: `Bearer ${ep.apiKey}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch (e) {
    clearTimeout(timer);
    throw new LlmError(`conexiune eșuată: ${(e as Error).message}`, true);
  }
  clearTimeout(timer);
  const text = await res.text();
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    throw new LlmError(`HTTP ${res.status}: ${text.slice(0, 300)}`, retryable);
  }
  let data: { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new LlmError("răspuns invalid de la API", true);
  }
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new LlmError("răspuns gol de la model", true);
  return {
    content,
    model: data.model ?? ep.model,
    tokensIn: data.usage?.prompt_tokens ?? Math.round((opts.system.length + user.length) / 3.2),
    tokensOut: data.usage?.completion_tokens ?? Math.round(content.length / 3.2),
  };
}

/** Acceptă atât „https://api.deepseek.com”, cât și „…/v1” sau URL-ul complet. */
export function chatUrl(base: string): string {
  if (/\/chat\/completions$/.test(base)) return base;
  if (/\/v\d+$/.test(base) || /api\.deepseek\.com$/.test(base)) return base + "/chat/completions";
  return base + "/v1/chat/completions";
}

/** Unele modele înconjoară JSON-ul cu ```json … ``` sau text; extragem obiectul. */
export function extractJson(s: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  const t = (fenced ? fenced[1] : s).trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}
