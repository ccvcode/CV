import { db } from "../core/db";

/*
 * Coadă de joburi simplă, stocată în SQLite: fiecare job are o cheie unică (idempotență),
 * reîncercări cu back-off exponențial și poate fi inspectat din /admin.
 */

export type JobType = "extract" | "write" | "brief" | "image" | "thumb";

export interface Job {
  id: number;
  locked_at: number;
  type: JobType;
  key: string;
  payload: string;
  attempts: number;
  max_attempts: number;
}

/**
 * Pune un job în coadă. Un job cu aceeași cheie care e deja în coadă sau rulează nu se dublează.
 * Un job terminat („done”) sau abandonat („dead”) se reia DOAR cu `requeue: true` (ex. rescrierea
 * unui articol când au apărut surse noi) — altfel s-ar relua la fiecare actualizare a subiectului.
 */
export function enqueue(
  type: JobType,
  key: string,
  payload: object = {},
  opts: { priority?: number; delayMs?: number; maxAttempts?: number; requeue?: boolean } = {}
) {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO jobs(type, key, payload, status, priority, run_after, max_attempts, created_at, updated_at)
       VALUES (@type, @key, @payload, 'queued', @priority, @runAfter, @max, @now, @now)
       ON CONFLICT(key) DO UPDATE SET
         status = CASE WHEN @requeue = 1 AND jobs.status IN ('done','dead') THEN 'queued' ELSE jobs.status END,
         attempts = CASE WHEN @requeue = 1 AND jobs.status IN ('done','dead') THEN 0 ELSE jobs.attempts END,
         run_after = CASE WHEN @requeue = 1 AND jobs.status IN ('done','dead') THEN excluded.run_after ELSE jobs.run_after END,
         payload = CASE WHEN jobs.status = 'running' THEN jobs.payload ELSE excluded.payload END,
         priority = MAX(jobs.priority, excluded.priority),
         updated_at = excluded.updated_at`
    )
    .run({ type, key, payload: JSON.stringify(payload), priority: opts.priority ?? 0, runAfter: now + (opts.delayMs ?? 0), max: opts.maxAttempts ?? 3, now, requeue: opts.requeue ? 1 : 0 });
}

/** Revendică atomic următorul job gata de rulat de tipul dat. */
export function claim(type: JobType): Job | undefined {
  const now = Date.now();
  return db()
    .prepare(
      `UPDATE jobs SET status = 'running', locked_at = @now, attempts = attempts + 1, updated_at = @now
       WHERE id = (SELECT id FROM jobs WHERE status = 'queued' AND type = @type AND run_after <= @now
                   ORDER BY priority DESC, id LIMIT 1)
       RETURNING id, type, key, payload, attempts, max_attempts, locked_at`
    )
    .get({ type, now }) as Job | undefined;
}

export function complete(job: Job) {
  // Doar deținătorul curent al jobului îl poate închide (un job reluat după blocare nu e suprascris).
  db().prepare("UPDATE jobs SET status = 'done', last_error = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND locked_at = ?").run(Date.now(), job.id, job.locked_at);
}

export function fail(job: Job, err: unknown, opts: { retryInMs?: number; permanent?: boolean } = {}) {
  const msg = err instanceof Error ? err.message : String(err);
  const dead = opts.permanent || job.attempts >= job.max_attempts;
  const backoff = opts.retryInMs ?? Math.min(60 * 60_000, 30_000 * 2 ** job.attempts);
  db()
    .prepare("UPDATE jobs SET status = ?, last_error = ?, run_after = ?, updated_at = ? WHERE id = ? AND status = 'running' AND locked_at = ?")
    .run(dead ? "dead" : "queued", msg.slice(0, 500), Date.now() + backoff, Date.now(), job.id, job.locked_at);
}

/** Amână un job fără să consume o încercare (ex. buget zilnic epuizat). */
export function postpone(job: Job, untilMs: number, reason: string) {
  db()
    .prepare("UPDATE jobs SET status = 'queued', attempts = attempts - 1, run_after = ?, last_error = ?, updated_at = ? WHERE id = ? AND locked_at = ?")
    .run(untilMs, reason, Date.now(), job.id, job.locked_at);
}

/** Joburile blocate (proces oprit în timpul lucrului) sunt eliberate după 45 de minute. */
export function reclaimStale() {
  db()
    .prepare("UPDATE jobs SET status = 'queued', updated_at = ? WHERE status = 'running' AND locked_at < ?")
    .run(Date.now(), Date.now() - 45 * 60_000);
}

/** La pornirea worker-ului: joburile rămase „running” de la procesul anterior se reiau imediat. */
export function releaseAllRunning() {
  db().prepare("UPDATE jobs SET status = 'queued', updated_at = ? WHERE status = 'running'").run(Date.now());
}

/** Curățenie: joburile terminate mai vechi de 3 zile. */
export function pruneJobs() {
  db().prepare("DELETE FROM jobs WHERE status = 'done' AND updated_at < ?").run(Date.now() - 3 * 86400_000);
  // Politica de confidențialitate: adresele de e-mail din semnalări se șterg după 12 luni.
  db().prepare("UPDATE reports SET email = NULL WHERE email IS NOT NULL AND created_at < ?").run(Date.now() - 365 * 86400_000);
}
