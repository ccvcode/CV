/*
 * Test de integrare al pipeline-ului: un mini-server local cu 3 publicații fictive → colectare →
 * grupare pe subiecte → text complet → redactare (AI simulat) → verificare → imagini.
 * Rulare: npm test
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import sharp from "sharp";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "median-test-"));
process.env.MEDIAN_DATA_DIR = tmp;
process.env.LLM_BASE_URL = "mock";
process.env.MEDIAN_DEMO = "1"; // sursele de test sunt ale noastre: redactorul simulat le poate cita integral
process.env.MEDIAN_WIKIMEDIA = "0";
process.env.MEDIAN_SOURCE_IMAGES = "thumb"; // politica implicită din producție
process.env.MEDIAN_REVIEW_SENSITIVE = "1";

let server: http.Server;
let base = "";
let photo: Buffer;
let logo: Buffer;
const now = Date.now();

const P = (t: string) => `<p>${t}</p>`;
const pages: Record<string, string> = {};

function article(slug: string, title: string, paras: string[], opts: { og?: string } = {}) {
  pages[`/art/${slug}`] = `<!doctype html><html><head><title>${title}</title>
    <meta property="og:title" content="${title}">${opts.og ? `<meta property="og:image" content="${opts.og}">` : ""}
    </head><body><header>Meniu</header><article><h1>${title}</h1><div class="entry-content">
    ${paras.map(P).join("\n")}<div class="related-posts"><p>Citește și: altceva</p></div></div></article><footer>Contact</footer></body></html>`;
}

function rss(items: { slug: string; title: string; desc: string; minutesAgo: number; img?: string }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>t</title>
  ${items
    .map(
      (i) => `<item><title>${i.title}</title><link>${base}/art/${i.slug}</link><pubDate>${new Date(now - i.minutesAgo * 60_000).toUTCString()}</pubDate>
      <description><![CDATA[${i.desc}]]></description>${i.img ? `<media:content url="${i.img}" medium="image" width="1600" height="900"/>` : ""}</item>`
    )
    .join("\n")}</channel></rss>`;
}

const BUDGET_A = [
  "Guvernul a aprobat joi rectificarea bugetară, care alocă 4,2 miliarde de lei suplimentar pentru sănătate și educație, a anunțat ministrul Finanțelor, Andrei Pavel.",
  "Potrivit documentului adoptat în ședința de guvern, spitalele județene vor primi 1,8 miliarde de lei pentru echipamente și reabilitări până la finalul anului.",
  "„Este o rectificare prudentă, care nu pune în pericol ținta de deficit”, a declarat ministrul Andrei Pavel la finalul ședinței.",
  "Deficitul bugetar estimat pentru acest an rămâne la 6,4% din PIB, potrivit proiectului publicat de Ministerul Finanțelor.",
];
const BUDGET_B = [
  "Executivul a adoptat rectificarea bugetară, iar sănătatea și educația primesc împreună 4,2 miliarde de lei în plus, conform ministrului Andrei Pavel.",
  "Suma cea mai mare, 1,8 miliarde de lei, merge către spitalele județene, pentru aparatură medicală și lucrări de modernizare.",
  "Sindicatele din educație au cerut ca banii să ajungă și la salariile personalului auxiliar, arată un comunicat al federației.",
  "Ținta de deficit de 6,4% din PIB nu se modifică, au precizat reprezentanții ministerului.",
];

before(async () => {
  // O „fotografie” de test: zgomot + gradient (entropie ridicată, ca o poză reală).
  const W = 1600, H = 900;
  const raw = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = Math.floor(i / W);
    raw[i * 3] = (x / W) * 200 + Math.random() * 55;
    raw[i * 3 + 1] = (y / H) * 180 + Math.random() * 60;
    raw[i * 3 + 2] = 120 + Math.random() * 100;
  }
  photo = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).blur(1.2).jpeg({ quality: 80 }).toBuffer();
  logo = await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#cc0000" } }).jpeg().toBuffer();
  server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/robots.txt") return res.end("User-agent: *\nAllow: /\n");
    if (url.startsWith("/img/photo")) return res.writeHead(200, { "content-type": "image/jpeg" }).end(photo);
    if (url.startsWith("/img/logo")) return res.writeHead(200, { "content-type": "image/jpeg" }).end(logo);
    if (url === "/a/feed")
      return res.end(
        rss([
          { slug: "buget-a", title: "Guvernul a aprobat rectificarea bugetară: 4,2 miliarde de lei pentru sănătate și educație", desc: BUDGET_A[0], minutesAgo: 30, img: `${base}/img/photo-a.jpg` },
          { slug: "meteo-a", title: "Cod galben de ploi în 12 județe până duminică seară", desc: "Meteorologii au emis un cod galben de ploi pentru 12 județe din vestul țării.", minutesAgo: 50, img: `${base}/img/logo.jpg` },
        ])
      );
    if (url === "/b/feed")
      return res.end(
        rss([
          { slug: "buget-b", title: "Rectificarea bugetară aprobată de Guvern: sănătatea și educația primesc 4,2 miliarde de lei", desc: BUDGET_B[0], minutesAgo: 20, img: `${base}/img/photo-b.jpg` },
          { slug: "tenis-b", title: "Maria Stan s-a calificat în finala turneului de la Cluj-Napoca", desc: "Jucătoarea de tenis Maria Stan a câștigat semifinala în două seturi, scor 6-3, 6-4.", minutesAgo: 70 },
        ])
      );
    if (url === "/c/feed")
      return res.end(
        rss([{ slug: "accident-c", title: "Accident grav pe DN1: doi morți după ce un autoturism a intrat pe contrasens", desc: "Doi oameni au murit într-un accident pe DN1, în apropiere de Ploiești.", minutesAgo: 10 }])
      );
    const page = pages[url.split("?")[0]];
    if (page) return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page);
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  article("buget-a", "Guvernul a aprobat rectificarea bugetară", BUDGET_A, { og: `${base}/img/photo-a.jpg` });
  article("buget-b", "Rectificarea bugetară aprobată de Guvern", BUDGET_B);
  article("meteo-a", "Cod galben de ploi", ["Meteorologii au emis un cod galben de ploi pentru 12 județe din vestul țării, valabil până duminică seară, când sunt așteptate cantități de 40 de litri pe metru pătrat."]);
  article("tenis-b", "Maria Stan în finală", ["Jucătoarea de tenis Maria Stan a câștigat semifinala turneului de la Cluj-Napoca în două seturi, scor 6-3, 6-4, și va juca duminică finala competiției."]);
  article("accident-c", "Accident grav pe DN1", ["Doi oameni au murit într-un accident pe DN1, în apropiere de Ploiești, după ce un autoturism a intrat pe contrasens, au anunțat reprezentanții poliției."]);
});

after(async () => {
  server?.close();
  const { closeDb } = await import("../lib/core/db");
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("pipeline complet: colectare → grupare → articol → imagini", async () => {
  const { db } = await import("../lib/core/db");
  const { syncSources, ingestDue } = await import("../lib/pipeline/ingest");
  const { claim, complete } = await import("../lib/pipeline/jobs");
  const { fetchFullText } = await import("../lib/pipeline/fulltext");
  const { writeStory, writeBrief } = await import("../lib/pipeline/writer");
  const { makeSourceThumb } = await import("../lib/pipeline/images/source");
  const { chooseHero } = await import("../lib/pipeline/images/hero");
  const q = await import("../lib/data/queries");

  syncSources([
    { id: "pub-a", name: "Publicația A", site: base, url: `${base}/a/feed`, category: "national", tier: 1 },
    { id: "pub-b", name: "Publicația B", site: base, url: `${base}/b/feed`, category: "economie", tier: 2 },
    { id: "pub-c", name: "Publicația C", site: base, url: `${base}/c/feed`, category: "national", tier: 2 },
  ]);
  const r = await ingestDue(Date.now());
  assert.equal(r.failed, 0, "toate fluxurile se preiau");
  assert.equal(r.newItems, 5);

  // Cele două articole despre buget sunt grupate în același subiect, cu 2 surse; categoria specifică câștigă.
  const budget = db().prepare("SELECT * FROM stories WHERE source_count = 2").all() as { id: string; category: string }[];
  assert.equal(budget.length, 1, "un singur subiect cu 2 surse");
  assert.equal(budget[0].category, "economie");
  const storyCount = (db().prepare("SELECT COUNT(*) AS n FROM stories").get() as { n: number }).n;
  assert.equal(storyCount, 4);
  const accident = db().prepare("SELECT sensitive FROM stories WHERE title LIKE 'Accident%'").get() as { sensitive: string };
  assert.match(accident.sensitive, /deces/);

  // A doua colectare imediată nu dublează nimic.
  db().prepare("UPDATE sources SET next_fetch_at = 0").run();
  const r2 = await ingestDue(Date.now());
  assert.equal(r2.newItems, 0);

  // Joburile: miniaturi, text complet, articol, știri scurte, imagini.
  const types = new Set((db().prepare("SELECT DISTINCT type FROM jobs").all() as { type: string }[]).map((x) => x.type));
  for (const t of ["thumb", "extract", "write", "brief"]) assert.ok(types.has(t), `job ${t} programat`);

  let job;
  while ((job = claim("thumb"))) {
    await makeSourceThumb(JSON.parse(job.payload).itemId);
    complete(job);
  }
  const thumbs = db().prepare("SELECT COUNT(*) AS n FROM items WHERE thumb_image_id IS NOT NULL").get() as { n: number };
  assert.equal(thumbs.n, 2, "doar pozele reale devin miniaturi (logo-ul roșu uniform e respins)");

  while ((job = claim("extract"))) {
    assert.equal(await fetchFullText(JSON.parse(job.payload).itemId), "ok");
    complete(job);
  }
  const ft = db().prepare("SELECT fulltext FROM items WHERE url LIKE '%buget-a'").get() as { fulltext: string };
  assert.ok(!ft.fulltext.includes("Citește și"), "textul complet e curățat");

  const outcome = await writeStory(budget[0].id);
  const reason = (db().prepare("SELECT review_reason FROM articles WHERE story_id = ?").get(budget[0].id) as { review_reason: string } | undefined)?.review_reason;
  assert.equal(outcome, "published", reason);
  const art = db().prepare("SELECT * FROM articles WHERE story_id = ?").get(budget[0].id) as { kind: string; sources: string; headline: string; status: string };
  assert.equal(art.kind, "full");
  assert.equal(JSON.parse(art.sources).length, 2);

  // Știrea cu decese așteaptă aprobarea (subiect sensibil); cea despre tenis se publică.
  const acc = db().prepare("SELECT id FROM stories WHERE title LIKE 'Accident%'").get() as { id: string };
  assert.equal(await writeBrief(acc.id), true);
  assert.equal((db().prepare("SELECT status FROM articles WHERE story_id = ?").get(acc.id) as { status: string }).status, "review");
  const ten = db().prepare("SELECT id FROM stories WHERE title LIKE '%Maria Stan%'").get() as { id: string };
  assert.equal(await writeBrief(ten.id), true);

  // Poza principală: fără surse externe → copertă generată; fiecare articol publicat are imagine.
  const heroId = await chooseHero(budget[0].id);
  assert.ok(heroId);
  const hero = db().prepare("SELECT kind, file_base FROM images WHERE id = ?").get(heroId) as { kind: string; file_base: string };
  assert.equal(hero.kind, "card");
  assert.ok(fs.existsSync(path.join(tmp, "media", hero.file_base + "-1200.webp")));

  // Site-ul vede doar articolele publicate (cel sensibil nu apare).
  const top = q.topStories({ limit: 10 });
  assert.ok(top.some((c) => c.id === budget[0].id && c.kind === "full" && c.hero));
  assert.ok(!top.some((c) => c.id === acc.id));
  const detail = q.getStory(budget[0].id);
  assert.ok(detail?.article && detail.article.sections.length > 0);
  assert.equal(detail!.sources.length, 2);
  assert.ok(q.searchStories("rectificare bugetara").some((c) => c.id === budget[0].id), "căutare fără diacritice");
});

test("verificările din cod prind cifre inventate, citate modificate și text copiat", async () => {
  const { checkAgainstSources } = await import("../lib/pipeline/verify");
  const src = [BUDGET_A.join(" ")];
  const ok = checkAgainstSources({ text: "Cabinetul a alocat 4,2 miliarde de lei suplimentar, cu 1,8 miliarde pentru spitale.", quotes: [], sources: src });
  assert.deepEqual(ok, []);
  const bad = checkAgainstSources({
    text: "Guvernul a alocat 5,7 miliarde de lei. „Este o rectificare curajoasă”, a spus ministrul. " + BUDGET_A[1],
    quotes: [{ text: "Este o rectificare curajoasă" }],
    tags: ["Ion Necunoscutescu"],
    sources: src,
  });
  const types = bad.map((i) => i.type).sort();
  assert.deepEqual(types, ["citat", "citat", "cifra", "copiat", "entitate"].sort());
});
