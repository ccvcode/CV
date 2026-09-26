import { NextResponse } from "next/server";
import { siteStatus } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

/** Pentru monitorizare (UptimeRobot etc.): 500 dacă nicio colectare nu a reușit în ultimele 20 de minute. */
export function GET() {
  const s = siteStatus();
  const fresh = Date.now() - s.lastFetch < 20 * 60_000;
  return NextResponse.json({ ok: fresh, lastFetch: s.lastFetch, lastArticle: s.lastArticle, sourcesOk: s.sourcesOk }, { status: fresh ? 200 : 500 });
}
