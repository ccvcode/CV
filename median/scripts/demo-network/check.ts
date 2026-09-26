/*
 * Verificare rapidă a rețelei demo: pornește serverul pe un port aleator, descarcă toate
 * fluxurile și câteva pagini/imagini și afișează numărătorile.
 *   npx tsx scripts/demo-network/check.ts
 */
import { BREAKING_STORIES, OUTLETS, STORIES, quoteOf } from "./content";
import { startDemoNetwork } from "./server";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("Verificare eșuată: " + msg);
}

async function main() {
  // --- conținut
  const versions = STORIES.flatMap((s) => s.versions);
  const multi = STORIES.filter((s) => s.versions.length >= 2).length;
  const byCat = new Map<string, number>();
  for (const s of STORIES) byCat.set(s.category, (byCat.get(s.category) ?? 0) + 1);
  const intl = STORIES.filter((s) => s.category === "international");
  console.log(`Povești: ${STORIES.length} (${multi} cu ≥2 surse = ${Math.round((multi / STORIES.length) * 100)}%), versiuni: ${versions.length}, de ultimă oră: ${BREAKING_STORIES.length}`);
  console.log(`Pe categorii: ${[...byCat].map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`Internațional pe regiuni: ${[...new Set(intl.map((s) => s.region))].join(", ")}`);
  console.log(`Sensibile: ${STORIES.filter((s) => s.sensitive).map((s) => s.id).join(", ")}`);
  const ids = new Set<string>();
  for (const s of [...STORIES, ...BREAKING_STORIES]) {
    assert(!ids.has(s.id), `id duplicat ${s.id}`);
    ids.add(s.id);
    const outlets = new Set(s.versions.map((v) => v.outlet));
    assert(outlets.size === s.versions.length, `${s.id}: aceeași publicație de două ori`);
    const titles = new Set(s.versions.map((v) => v.title));
    assert(titles.size === s.versions.length, `${s.id}: titluri identice`);
    for (const v of s.versions) {
      assert(v.paragraphs.length >= 4 && v.paragraphs.length <= 8, `${s.id}/${v.outlet}: ${v.paragraphs.length} paragrafe`);
      assert(quoteOf(v), `${s.id}/${v.outlet}: lipsește citatul „…”`);
      const txt = v.title + v.paragraphs.join(" ");
      assert(!/[şţŞŢ]/.test(txt), `${s.id}/${v.outlet}: diacritice cu sedilă`);
      assert(!/"[^"]*"/.test(v.paragraphs.join(" ")), `${s.id}/${v.outlet}: ghilimele drepte`);
    }
    if (s.versions.length > 1) {
      const bodies = new Set(s.versions.map((v) => v.paragraphs[0]));
      assert(bodies.size === s.versions.length, `${s.id}: primul paragraf identic între publicații`);
    }
  }

  // --- server
  const t0 = Date.now();
  const net = await startDemoNetwork(0);
  console.log(`\nServer: ${net.baseUrl} (${net.sources.length} fluxuri, ${OUTLETS.length} publicații)`);
  try {
    const modes = new Map<string, number>();
    for (const a of net.network.articles) modes.set(a.imageMode, (modes.get(a.imageMode) ?? 0) + 1);
    console.log(`Moduri imagine: ${[...modes].map(([k, v]) => `${k}=${v}`).join(", ")}`);

    let totalItems = 0;
    const links: string[] = [];
    for (const s of net.sources) {
      const r = await fetch(s.url);
      assert(r.ok, `${s.url} -> ${r.status}`);
      const xml = await r.text();
      const n = (xml.match(/<item>|<entry>/g) ?? []).length;
      const imgs = (xml.match(/<enclosure |<media:content |<media:thumbnail |data-src=|<img /g) ?? []).length;
      totalItems += n;
      const etag = r.headers.get("etag");
      assert(etag, `${s.url}: fără ETag`);
      const r304 = await fetch(s.url, { headers: { "If-None-Match": etag } });
      assert(r304.status === 304, `${s.url}: If-None-Match -> ${r304.status}`);
      const lm = r.headers.get("last-modified");
      const r304b = await fetch(s.url, { headers: { "If-Modified-Since": lm ?? "" } });
      assert(r304b.status === 304, `${s.url}: If-Modified-Since -> ${r304b.status}`);
      console.log(`  ${s.id.padEnd(34)} ${String(n).padStart(3)} articole, ${String(imgs).padStart(3)} referințe imagine, ${r.headers.get("content-type")}`);
      const first = /<link>([^<]*\/articol\/[^<]+)<\/link>|<link rel="alternate" type="text\/html" href="([^"]*\/articol\/[^"]+)"/.exec(xml);
      if (first) links.push(first[1] ?? first[2]);
    }
    console.log(`Total itemi în fluxuri: ${totalItems}`);

    const robots = await (await fetch(`${net.baseUrl}/robots.txt`)).text();
    assert(robots.includes("Disallow: /techzona/articol/"), "robots.txt");
    console.log(`robots.txt: ${robots.split("\n").filter((l) => l.startsWith("Disallow")).join(" | ")}`);

    let pages = 0;
    for (const url of links.slice(0, 8)) {
      const r = await fetch(url);
      assert(r.ok, `${url} -> ${r.status}`);
      const html = await r.text();
      const og = /property="og:image" content="([^"]+)"/.exec(html)?.[1];
      assert(og, `${url}: fără og:image`);
      const ld = html.includes('"@type":"NewsArticle"') ? "NewsArticle" : html.includes("yoast-schema-graph") ? "Yoast" : "-";
      const ri = await fetch(og);
      assert(ri.ok && ri.headers.get("content-type") === "image/jpeg", `${og} -> ${ri.status}`);
      const size = (await ri.arrayBuffer()).byteLength;
      console.log(`  pagină ${(html.length / 1024).toFixed(0).padStart(3)} KB, JSON-LD ${ld.padEnd(11)} og:image ${(size / 1024).toFixed(0)} KB  ${url.replace(net.baseUrl, "")}`);
      pages++;
    }

    const before = (await (await fetch(net.sources[0].url)).text()).match(/<item>/g)?.length ?? 0;
    const added = (await (await fetch(`${net.baseUrl}/_control/add-breaking`)).json()) as { added: { outlet: string; title: string }[] };
    const after = (await (await fetch(net.sources[0].url)).text()).match(/<item>/g)?.length ?? 0;
    console.log(`add-breaking: ${added.added.map((a) => `${a.outlet}: ${a.title}`).join(" / ")}`);
    console.log(`  ${net.sources[0].id}: ${before} -> ${after} articole`);
    assert(added.added.length === 2, "add-breaking");

    console.log(`\nOK — ${pages} pagini verificate în ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } finally {
    await net.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
