import { NextResponse } from "next/server";
import { db, logEvent } from "@/lib/core/db";

const recent = new Map<string, number[]>();

/** Semnalări de la cititori (corecturi, drepturi de autor) — apar în /admin. */
export async function POST(req: Request) {
  let body: { kind?: string; storyId?: string; email?: string; message?: string; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (body.website) return NextResponse.json({ ok: true }); // capcană pentru roboți
  const message = String(body.message ?? "").trim().slice(0, 3000);
  if (message.length < 10) return NextResponse.json({ ok: false }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "anon";
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => t > now - 3600_000);
  if (hits.length >= 5) return NextResponse.json({ ok: false }, { status: 429 });
  recent.set(ip, [...hits, now]);
  const storyId = /s[a-z0-9]{6,12}/.exec(String(body.storyId ?? ""))?.[0] ?? null;
  db()
    .prepare("INSERT INTO reports(kind, story_id, email, message, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(body.kind === "drepturi" ? "drepturi" : "corectura", storyId, String(body.email ?? "").slice(0, 200) || null, message, now);
  logEvent("info", `semnalare nouă (${body.kind}) ${storyId ?? ""}`);
  return NextResponse.json({ ok: true });
}
