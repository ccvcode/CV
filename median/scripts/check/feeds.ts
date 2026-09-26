/**
 * Verifică fluxurile RSS reale din lib/core/sources.ts: stare HTTP, număr de articole,
 * vârsta celui mai nou articol și câte au poză. Rulare: npx tsx scripts/check/feeds.ts
 */
import { SOURCES } from "../../lib/core/sources";
import { httpGet } from "../../lib/pipeline/http";
import { parseFeed } from "../../lib/pipeline/rss";

const only = process.argv.slice(2);
const list = only.length ? SOURCES.filter((s) => only.some((o) => s.id.includes(o) || s.url.includes(o))) : SOURCES;

async function check(s: (typeof SOURCES)[number]) {
  const t0 = Date.now();
  try {
    const r = await httpGet(s.url, { timeoutMs: 20_000 });
    const items = parseFeed(r.text, s.url);
    const newest = items.reduce((m, i) => Math.max(m, i.published), 0);
    const ageH = newest ? ((Date.now() - newest) / 3600_000).toFixed(1) : "?";
    const withImg = items.filter((i) => i.images.length).length;
    const ok = items.length > 0 && (ageH === "?" || Number(ageH) < 72);
    return `${ok ? "OK  " : "RĂU "} ${s.id.padEnd(28)} ${String(items.length).padStart(3)} art · nou ${ageH}h · poze ${withImg} · ${Date.now() - t0}ms · ${r.url !== s.url ? "→ " + r.url : ""}`;
  } catch (e) {
    return `EȘEC ${s.id.padEnd(28)} ${(e as Error).message} · ${s.url}`;
  }
}

// Cererile spre același site merg una câte una (unele site-uri răspund cu 429 la rafale).
const byHost = new Map<string, typeof list>();
for (const s of list) byHost.set(new URL(s.url).host, [...(byHost.get(new URL(s.url).host) ?? []), s]);
void Promise.all(
  [...byHost.values()].map(async (group) => {
    const res: string[] = [];
    for (const s of group) {
      res.push(await check(s));
      await new Promise((r) => setTimeout(r, 1500));
    }
    return res;
  })
).then((out) => console.log(out.flat().sort().join("\n")));
