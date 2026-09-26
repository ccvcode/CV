"use client";

import { Bell, BellRing } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const KEY = "median-notificari";
type Prefs = { topics: string[]; follows: string[] };

function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { topics: Array.isArray(p.topics) ? p.topics : [], follows: Array.isArray(p.follows) ? p.follows : [] };
  } catch {
    return { topics: [], follows: [] };
  }
}
function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  window.dispatchEvent(new Event("median-notificari"));
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function supported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone/iPad: notificările web merg doar dacă site-ul e adăugat pe ecranul principal. */
function iosNeedsInstall() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  return ios && !standalone;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Salvează preferințele: creează abonamentul dacă e nevoie, sau îl șterge dacă nu a rămas nimic. */
async function apply(p: Prefs): Promise<string | null> {
  if (!p.topics.length && !p.follows.length) {
    const sub = await currentSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe().catch(() => {});
    }
    writePrefs(p);
    return null;
  }
  if (!supported()) return "Browserul tău nu permite notificări web.";
  if (iosNeedsInstall()) return "Pe iPhone, adaugă întâi Median pe ecranul principal (Partajează → Adaugă pe ecranul principal), apoi deschide-l de acolo.";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Ai refuzat notificările. Le poți permite din setările browserului, la acest site.";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await (await fetch("/api/push")).json();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  }
  const r = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), topics: p.topics, follows: p.follows }),
  });
  if (!r.ok) return "Nu am putut salva abonamentul. Încearcă din nou.";
  writePrefs(p);
  return null;
}

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>({ topics: [], follows: [] });
  useEffect(() => {
    const on = () => setPrefs(readPrefs());
    on();
    window.addEventListener("median-notificari", on);
    return () => window.removeEventListener("median-notificari", on);
  }, []);
  return prefs;
}

/** Pagina de setări: subiectele, persoanele urmărite, dezabonarea. */
export function PushSettings({ topics }: { topics: Record<string, string> }) {
  const prefs = usePrefs();
  const [draft, setDraft] = useState<Prefs | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(true);
  useEffect(() => setOk(supported()), []);
  const cur = draft ?? prefs;
  const save = useCallback(async (p: Prefs) => {
    setBusy(true);
    setMsg(null);
    try {
      const err = await apply(p);
      setMsg(err ?? (p.topics.length || p.follows.length ? "Salvat. Vei primi notificări pe acest dispozitiv." : "Te-ai dezabonat. Am șters abonamentul."));
      if (!err) setDraft(null);
    } catch {
      setMsg("Ceva nu a mers. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }, []);
  const toggle = (t: string) => setDraft({ ...cur, topics: cur.topics.includes(t) ? cur.topics.filter((x) => x !== t) : [...cur.topics, t] });
  const add = () => {
    const n = name.trim();
    if (n.length < 3 || cur.follows.includes(n)) return;
    setDraft({ ...cur, follows: [...cur.follows, n].slice(0, 20) });
    setName("");
  };
  const btn = "ui inline-flex items-center border border-rule-strong px-4 py-2 text-[14px] font-semibold hover:bg-ink hover:text-on-ink disabled:opacity-50";
  return (
    <div className="ui">
      {!ok && <p className="border-l-[3px] border-accent pl-3 text-[15px]">Browserul tău nu permite notificări web. Încearcă Chrome, Firefox, Edge sau Safari.</p>}
      <fieldset className="mt-4">
        <legend className="kicker text-ink-2">Ce vrei să primești</legend>
        {Object.entries(topics).map(([k, label]) => (
          <label key={k} className="mt-3 flex cursor-pointer items-start gap-3 text-[16px]">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={cur.topics.includes(k)} onChange={() => toggle(k)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="mt-8">
        <legend className="kicker text-ink-2">Persoane și subiecte urmărite</legend>
        <p className="mt-2 text-[14px] text-ink-2">Primești o notificare când un nume apare în titlul unui subiect relatat de cel puțin două publicații.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {cur.follows.map((f) => (
            <button key={f} type="button" onClick={() => setDraft({ ...cur, follows: cur.follows.filter((x) => x !== f) })} className="border border-ink px-2 py-0.5 text-[14px] font-semibold" aria-label={`Nu mai urmări ${f}`}>
              {f} ×
            </button>
          ))}
          {!cur.follows.length && <span className="text-[14px] text-ink-3">Nimic încă. Poți urmări un nume și din pagina unei știri.</span>}
        </div>
        <div className="mt-3 flex max-w-md gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            maxLength={60}
            placeholder="ex. Nicușor Dan, Dacia, Vrancea"
            className="min-w-0 flex-1 border border-rule bg-transparent px-3 py-2 text-[15px]"
          />
          <button type="button" onClick={add} className={btn}>
            Adaugă
          </button>
        </div>
      </fieldset>
      <div className="mt-8 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !ok} onClick={() => save(cur)} className={btn + " bg-ink text-on-ink"}>
          {busy ? "Se salvează…" : "Salvează"}
        </button>
        {(prefs.topics.length > 0 || prefs.follows.length > 0) && (
          <button type="button" disabled={busy} onClick={() => save({ topics: [], follows: [] })} className={btn}>
            Dezabonează-mă de tot
          </button>
        )}
      </div>
      <p aria-live="polite" className="mt-3 min-h-[1.5em] text-[14px]">
        {msg}
      </p>
    </div>
  );
}

/** Clopoțel lângă un nume: urmărește / nu mai urmări, direct din pagina unei știri. */
export function FollowButton({ name }: { name: string }) {
  const prefs = usePrefs();
  const [msg, setMsg] = useState<string | null>(null);
  const on = prefs.follows.includes(name);
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        aria-pressed={on}
        title={on ? `Nu mai urmări ${name}` : `Urmărește ${name}: primești o notificare la subiectele noi`}
        aria-label={on ? `Nu mai urmări ${name}` : `Urmărește ${name}`}
        className={on ? "text-accent" : "text-ink-3 hover:text-ink"}
        onClick={async () => {
          const next = { ...prefs, follows: on ? prefs.follows.filter((f) => f !== name) : [...prefs.follows, name].slice(0, 20) };
          const err = await apply(next).catch(() => "Nu a mers.");
          setMsg(err);
          if (err) setTimeout(() => setMsg(null), 6000);
        }}
      >
        {on ? <BellRing size={14} aria-hidden /> : <Bell size={14} aria-hidden />}
      </button>
      {msg && <span className="ml-2 text-[12px] text-accent-ink">{msg}</span>}
    </span>
  );
}
