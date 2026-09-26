/* Teste de regresie pentru problemele găsite la code review. */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import sharp from "sharp";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "median-reg-"));
process.env.MEDIAN_DATA_DIR = tmp;
process.env.MEDIAN_DEMO = "1"; // permite serverul local de imagini
process.env.LLM_BASE_URL = "mock";
let server: http.Server;
let base = "";

before(async () => {
  const W = 1200, H = 675, raw = Buffer.alloc(W * H * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.random() * 255;
  const photo = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).blur(1).jpeg().toBuffer();
  server = http.createServer((_q, r) => r.writeHead(200, { "content-type": "image/jpeg" }).end(photo));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  server.close();
  (await import("../lib/core/db")).closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function setup() {
  const { db } = await import("../lib/core/db");
  const { syncSources, insertItems, clusterPending } = await import("../lib/pipeline/ingest");
  syncSources([
    { id: "a", name: "A", site: base, url: `${base}/a`, category: "economie", tier: 1 },
    { id: "b", name: "B", site: base, url: `${base}/b`, category: "economie", tier: 1 },
  ]);
  const now = Date.now();
  const img = [{ url: `${base}/foto.jpg`, from: "rss-media" as const, width: 1200, height: 675 }];
  insertItems({ id: "a", category: "economie" }, [{ id: "ia1", url: `${base}/x1`, title: "Banca Națională a păstrat dobânda cheie la 6,50%", summary: "BNR a menținut dobânda de politică monetară la 6,50% pe an.", published: now - 60_000, images: img }], now);
  insertItems({ id: "b", category: "economie" }, [{ id: "ib1", url: `${base}/y1`, title: "BNR menține dobânda cheie la 6,50% pe an", summary: "Consiliul BNR a decis menținerea dobânzii la 6,50%.", published: now - 30_000, images: img }], now);
  clusterPending(now);
  return { db: db(), storyId: (db().prepare("SELECT story_id FROM items WHERE id = 'ia1'").get() as { story_id: string }).story_id };
}

test("un articol aflat la aprobare nu declanșează rescrieri la fiecare actualizare", async () => {
  const { db, storyId } = await setup();
  const { refreshStory } = await import("../lib/pipeline/ingest");
  const { claim, complete } = await import("../lib/pipeline/jobs");
  assert.equal((db.prepare("SELECT source_count FROM stories WHERE id = ?").get(storyId) as { source_count: number }).source_count, 2, "cele două articole formează un subiect");
  db.prepare("UPDATE jobs SET run_after = 0").run();
  const w = claim("write");
  assert.ok(w, "primul articol e programat");
  db.prepare("INSERT INTO articles(story_id, kind, status, headline, created_at, updated_at) VALUES (?, 'full', 'review', 'H', ?, ?)").run(storyId, Date.now(), Date.now());
  db.prepare("UPDATE stories SET written_source_count = 2, written_at = ? WHERE id = ?").run(Date.now(), storyId);
  complete(w!);
  refreshStory(storyId);
  const queued = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE type = 'write' AND status = 'queued'").get() as { n: number };
  assert.equal(queued.n, 0);
  const thumbs = db.prepare("SELECT status FROM jobs WHERE type = 'thumb'").all() as { status: string }[];
  assert.ok(thumbs.every((t) => t.status === "queued"), "joburile nu se dublează");
});

test("aceeași poză procesată de mai multe ori pentru același articol nu devine „implicită”", async () => {
  const { makeSourceThumb } = await import("../lib/pipeline/images/source");
  const { db } = await import("../lib/core/db");
  for (let i = 0; i < 4; i++) {
    db().prepare("UPDATE items SET thumb_image_id = NULL WHERE id = 'ia1'").run(); // forțăm reprocesarea
    assert.ok(await makeSourceThumb("ia1"), `rularea ${i + 1} păstrează poza`);
  }
});

test("o știre scurtă nu poate înlocui un articol complet publicat", async () => {
  const { db } = await import("../lib/core/db");
  const { publishArticle } = await import("../lib/pipeline/writer");
  const storyId = (db().prepare("SELECT story_id FROM items WHERE id = 'ia1'").get() as { story_id: string }).story_id;
  const ins = db().prepare("INSERT INTO articles(story_id, version, kind, status, headline, created_at, updated_at) VALUES (?, ?, ?, 'review', ?, ?, ?)");
  const full = Number(ins.run(storyId, 10, "full", "Articol complet", Date.now(), Date.now()).lastInsertRowid);
  assert.equal(publishArticle(storyId, full, "Articol complet", "economie", null), true);
  const brief = Number(ins.run(storyId, 11, "brief", "Știre scurtă", Date.now(), Date.now()).lastInsertRowid);
  assert.equal(publishArticle(storyId, brief, "Știre scurtă", "economie", null), false);
  const s = db().prepare("SELECT article_id FROM stories WHERE id = ?").get(storyId) as { article_id: number };
  assert.equal(s.article_id, full);
});
