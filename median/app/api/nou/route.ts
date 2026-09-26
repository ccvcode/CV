import { NextResponse } from "next/server";
import { countNewSince } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

/** GET /api/nou?since=<ms> — câte subiecte noi au apărut (pentru butonul „N știri noi”). */
export function GET(req: Request) {
  const since = Number(new URL(req.url).searchParams.get("since")) || Date.now();
  return NextResponse.json({ count: countNewSince(since) }, { headers: { "cache-control": "no-store" } });
}
