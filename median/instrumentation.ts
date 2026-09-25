/**
 * Colectare automată în fundal: la pornirea serverului (next start / Docker / VPS)
 * pornim un ceas care preia știrile din toate sursele la fiecare 5 minute,
 * independent de trafic. Pe platforme serverless (Vercel), colectarea pornește
 * la prima cerere după 5 minute, plus un cron opțional care apelează /api/refresh.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.MEDIAN_DISABLE_CRON === "1") return;
  const { refresh, REFRESH_MS } = await import("./lib/store");
  const g = globalThis as unknown as { __medianTimer?: ReturnType<typeof setInterval> };
  if (g.__medianTimer) return;
  const run = () => refresh().catch((e) => console.error("[median] eroare la colectare:", e));
  setTimeout(run, 2000);
  g.__medianTimer = setInterval(run, REFRESH_MS);
}
