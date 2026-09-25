import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getState, refresh } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Declanșează o colectare. Folosit de cron-ul extern (Vercel Cron, GitHub Actions,
 * cron-job.org) la fiecare 5 minute. Dacă e setat CRON_SECRET, cererea trebuie să
 * trimită „Authorization: Bearer <CRON_SECRET>” sau ?secret=<CRON_SECRET>.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const before = (await getState()).updatedAt;
  await refresh();
  const after = await getState();
  // Invalidăm paginile ISR doar la cereri autorizate și doar dacă s-au adus știri noi.
  if (secret && after.updatedAt !== before) revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, updatedAt: after.updatedAt, articles: after.articles.length, sourcesOk: after.sourcesOk, sourcesTotal: after.sourcesTotal });
}
