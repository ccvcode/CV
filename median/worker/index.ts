/*
 * Worker-ul Median: rulează permanent, separat de site.
 *   - la fiecare minut verifică ce fluxuri RSS sunt scadente (fiecare flux e preluat la 5 minute);
 *   - procesează coada de joburi: text complet, redactare AI, știri scurte, imagini.
 * Pornire: `npm run worker` (sau serviciul „worker” din docker-compose).
 */
import { config, llmEnabled } from "../lib/core/config";
import { db, logEvent } from "../lib/core/db";
import { SOURCES } from "../lib/core/sources";
import type { Source } from "../lib/core/types";
import { ingestDue, rescoreRecent, syncSources } from "../lib/pipeline/ingest";
import { claim, complete, fail, postpone, pruneJobs, reclaimStale, type Job, type JobType } from "../lib/pipeline/jobs";
import { fetchFullText } from "../lib/pipeline/fulltext";
import { chooseHero } from "../lib/pipeline/images/hero";
import { makeSourceThumb } from "../lib/pipeline/images/source";
import { BudgetExceeded, LlmError } from "../lib/pipeline/llm";
import { writeBrief, writeStory } from "../lib/pipeline/writer";

type Handler = (payload: Record<string, string>) => Promise<unknown>;

const HANDLERS: Record<JobType, Handler> = {
  thumb: (p) => makeSourceThumb(p.itemId),
  extract: (p) => fetchFullText(p.itemId),
  write: (p) => writeStory(p.storyId),
  brief: (p) => writeBrief(p.storyId),
  image: (p) => chooseHero(p.storyId),
};

/** Concurență per tip de job (cererile AI sunt cele mai scumpe și lente). */
const CONCURRENCY: Record<JobType, number> = { thumb: 4, extract: 4, write: config.llm.concurrency, brief: config.llm.concurrency, image: 2 };

let stopping = false;

async function runJob(job: Job) {
  const handler = HANDLERS[job.type];
  try {
    await handler(JSON.parse(job.payload));
    complete(job);
  } catch (e) {
    if (e instanceof BudgetExceeded) {
      // Bugetul se resetează la miezul nopții (ora României); reîncercăm peste o oră.
      postpone(job, Date.now() + 3600_000, e.message);
      return;
    }
    const permanent = e instanceof LlmError && !e.retryable;
    fail(job, e, { permanent });
    logEvent("warn", `job ${job.type} ${job.key} eșuat (încercarea ${job.attempts}): ${(e as Error).message}`);
  }
}

async function jobLoop(type: JobType) {
  while (!stopping) {
    if ((type === "write" || type === "brief") && !llmEnabled()) {
      await sleep(30_000);
      continue;
    }
    const job = claim(type);
    if (!job) {
      await sleep(2000);
      continue;
    }
    await runJob(job);
  }
}

async function schedulerLoop() {
  while (!stopping) {
    try {
      await ingestDue();
      rescoreRecent();
      reclaimStale();
    } catch (e) {
      logEvent("error", `eroare la colectare: ${(e as Error).message}`);
    }
    await sleep(60_000);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function startWorker(sources: Source[] = SOURCES) {
  db();
  syncSources(sources);
  // Dezactivăm sursele care nu mai sunt în listă (fără a le șterge istoricul).
  db()
    .prepare(`UPDATE sources SET enabled = 0 WHERE id NOT IN (${sources.map(() => "?").join(",")})`)
    .run(...sources.map((s) => s.id));
  logEvent(
    "info",
    `worker pornit: ${sources.length} fluxuri, AI ${llmEnabled() ? `activ (${config.llm.model} @ ${config.llm.baseUrl})` : "dezactivat (setează LLM_BASE_URL)"}${config.demo ? " — MOD DEMO" : ""}`
  );
  const loops: Promise<void>[] = [schedulerLoop()];
  for (const type of Object.keys(CONCURRENCY) as JobType[]) for (let i = 0; i < CONCURRENCY[type]; i++) loops.push(jobLoop(type));
  setInterval(pruneJobs, 6 * 3600_000).unref();
  return {
    stop: async () => {
      stopping = true;
      await Promise.race([Promise.all(loops), sleep(5000)]);
    },
  };
}

// Pornire directă (nu la import din teste).
if (process.argv[1] && /worker[\\/]index\.(ts|js)$/.test(process.argv[1])) {
  (async () => {
    let sources = SOURCES;
    if (config.demo) {
      const { startDemoNetwork } = await import("../scripts/demo-network/server");
      const port = Number(process.env.MEDIAN_DEMO_PORT ?? 4010);
      const net = await startDemoNetwork(port);
      sources = net.sources as Source[];
      logEvent("info", `rețea de știri demo pornită la ${net.baseUrl}`);
    }
    const w = await startWorker(sources);
    const shutdown = async () => {
      logEvent("info", "worker oprit");
      await w.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
