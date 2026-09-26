import { recordView } from "@/lib/data/queries";

const seen = new Map<string, number>();

/** Înregistrează o vizualizare (o dată pe oră per vizitator și articol), pentru „Cele mai citite”. */
export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id?: unknown };
    if (typeof id !== "string" || !/^s[a-z0-9]{6,12}$/.test(id)) return new Response(null, { status: 204 });
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
    const key = ip + ":" + id;
    const now = Date.now();
    if ((seen.get(key) ?? 0) > now - 3600_000) return new Response(null, { status: 204 });
    if (seen.size > 100_000) seen.clear();
    seen.set(key, now);
    recordView(id);
  } catch {}
  return new Response(null, { status: 204 });
}
