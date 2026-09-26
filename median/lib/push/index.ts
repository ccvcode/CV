import fs from "fs";
import path from "path";
import webpush from "web-push";
import { config } from "../core/config";
import { db } from "../core/db";
import { fold } from "../pipeline/text";

/*
 * Notificări web push, fără cont: browserul ne dă un „abonament” (adresă + chei de criptare), iar noi
 * păstrăm doar atât și subiectele alese. Cheile VAPID vin din mediu sau se generează o singură dată
 * în directorul de date.
 */

export const TOPICS = {
  dimineata: "Ce trebuie să știi azi, la 7:00",
  alerte: "Alerte: cod portocaliu sau roșu ANM, cutremure de peste 4",
  majore: "Știri majore (relatate de cel puțin 10 publicații)",
} as const;
export type Topic = keyof typeof TOPICS;

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

let keys: { publicKey: string; privateKey: string } | null = null;

export function vapidKeys(): { publicKey: string; privateKey: string } {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const file = path.join(config.dataDir, "vapid.json");
    try {
      keys = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      keys = webpush.generateVAPIDKeys();
      fs.mkdirSync(config.dataDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
    }
  }
  webpush.setVapidDetails(`mailto:${config.contactEmail}`, keys!.publicKey, keys!.privateKey);
  return keys!;
}

export interface SubInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Adrese de push acceptate (serviciile browserelor), ca să nu trimitem cereri oriunde. */
const PUSH_HOSTS = /(^|\.)(googleapis\.com|mozilla\.com|mozaws\.net|push\.apple\.com|notify\.windows\.com|push\.services\.mozilla\.com)$/;

export function validSub(s: unknown): s is SubInput {
  const x = s as SubInput;
  if (!x || typeof x.endpoint !== "string" || x.endpoint.length > 1000) return false;
  try {
    const u = new URL(x.endpoint);
    if (u.protocol !== "https:" || !PUSH_HOSTS.test(u.hostname)) return false;
  } catch {
    return false;
  }
  return typeof x.keys?.p256dh === "string" && typeof x.keys?.auth === "string" && x.keys.p256dh.length < 200 && x.keys.auth.length < 100;
}

export function cleanFollows(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((x): x is string => typeof x === "string").map((x) => x.replace(/\s+/g, " ").trim().slice(0, 60)).filter((x) => x.length >= 3))].slice(0, 20);
}

export function saveSubscription(sub: SubInput, topics: Topic[], follows: string[]) {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO push_subs(endpoint, p256dh, auth, topics, follows, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, topics = excluded.topics,
         follows = excluded.follows, updated_at = excluded.updated_at, fails = 0`
    )
    .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, JSON.stringify(topics), JSON.stringify(follows), now, now);
}

export function removeSubscription(endpoint: string) {
  const d = db();
  d.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(endpoint);
  d.prepare("DELETE FROM push_sent WHERE endpoint = ?").run(endpoint);
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  topics: string;
  follows: string;
}

async function send(sub: SubRow, payload: PushPayload): Promise<boolean> {
  vapidKeys();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      TTL: 6 * 3600,
      urgency: "normal",
    });
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    // 404/410: abonamentul a expirat sau a fost retras din browser — îl ștergem (GDPR: nu păstrăm date inutile).
    if (status === 404 || status === 410) removeSubscription(sub.endpoint);
    else db().prepare("UPDATE push_subs SET fails = fails + 1 WHERE endpoint = ?").run(sub.endpoint);
    return false;
  }
}

/** A fost deja trimis? (cheie globală sau per abonat). Dacă nu, o marchează. */
function claim(key: string, endpoint = ""): boolean {
  const r = db().prepare("INSERT OR IGNORE INTO push_sent(key, endpoint, at) VALUES (?, ?, ?)").run(key, endpoint, Date.now());
  return r.changes > 0;
}

export function wasSent(key: string): boolean {
  return Boolean(db().prepare("SELECT 1 FROM push_sent WHERE key = ? AND endpoint = ''").get(key));
}

/** Trimite o notificare tuturor celor abonați la un subiect, o singură dată pentru `key`. */
export async function sendTopic(topic: Topic, key: string, payload: PushPayload): Promise<number> {
  if (!claim(key)) return 0;
  const subs = db().prepare("SELECT * FROM push_subs WHERE topics LIKE ? AND fails < 20").all(`%"${topic}"%`) as SubRow[];
  let ok = 0;
  for (const s of subs) if (await send(s, payload)) ok++;
  return ok;
}

/**
 * Persoane și subiecte urmărite: pentru fiecare abonat, subiectele recente (≥2 publicații) al căror
 * titlu conține un nume urmărit. Cel mult trei notificări pe rulare și abonat; fiecare subiect o dată.
 */
export async function sendFollows(stories: { id: string; title: string; href: string; sourceCount: number }[]): Promise<number> {
  const subs = db().prepare("SELECT * FROM push_subs WHERE follows != '[]' AND fails < 20").all() as SubRow[];
  let ok = 0;
  for (const s of subs) {
    const follows = (JSON.parse(s.follows) as string[]).map((f) => ({ f, re: new RegExp(`\\b${fold(f).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`) }));
    let n = 0;
    for (const st of stories) {
      const hit = follows.find((x) => x.re.test(fold(st.title)));
      if (!hit || !claim(`story:${st.id}`, s.endpoint)) continue;
      if (await send(s, { title: `Urmărești: ${hit.f}`, body: st.title, url: `${config.siteUrl}${st.href}`, tag: `story-${st.id}` })) ok++;
      if (++n >= 3) break;
    }
  }
  return ok;
}

export function pruneSent() {
  db().prepare("DELETE FROM push_sent WHERE at < ?").run(Date.now() - 14 * 86400_000);
}
