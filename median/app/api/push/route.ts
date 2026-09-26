import { cleanFollows, removeSubscription, saveSubscription, TOPICS, type Topic, validSub, vapidKeys } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Cheia publică VAPID, de care browserul are nevoie ca să creeze abonamentul. */
export async function GET() {
  return Response.json({ publicKey: vapidKeys().publicKey, topics: TOPICS });
}

const recent = new Map<string, number[]>();
function limited(req: Request): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "anon";
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => t > now - 600_000);
  recent.set(ip, [...hits, now]);
  if (recent.size > 50_000) recent.clear();
  return hits.length >= 30;
}

/** Creează sau actualizează abonamentul: { subscription, topics, follows }. */
export async function POST(req: Request) {
  if (limited(req)) return new Response("Prea multe cereri", { status: 429 });
  try {
    const body = (await req.json()) as { subscription?: unknown; topics?: unknown; follows?: unknown };
    if (!validSub(body.subscription)) return new Response("Abonament invalid", { status: 400 });
    const topics = (Array.isArray(body.topics) ? body.topics : []).filter((t): t is Topic => typeof t === "string" && t in TOPICS);
    const follows = cleanFollows(body.follows);
    if (!topics.length && !follows.length) {
      removeSubscription(body.subscription.endpoint);
      return Response.json({ ok: true, removed: true });
    }
    saveSubscription(body.subscription, topics, follows);
    return Response.json({ ok: true });
  } catch {
    return new Response("Cerere invalidă", { status: 400 });
  }
}

/** Dezabonare: șterge tot ce știm despre acest browser. */
export async function DELETE(req: Request) {
  try {
    const { endpoint } = (await req.json()) as { endpoint?: string };
    if (typeof endpoint === "string") removeSubscription(endpoint);
  } catch {}
  return Response.json({ ok: true });
}
