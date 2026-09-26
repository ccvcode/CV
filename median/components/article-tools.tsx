"use client";

import { Bookmark, BookmarkCheck, Check, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "median-salvate";

export interface Saved {
  id: string;
  href: string;
  title: string;
  ts: number;
}

export function readSaved(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

// Siglele rețelelor nu mai sunt incluse în lucide; le desenăm simplu, într-o singură culoare.
const BRAND: Record<string, string> = {
  whatsapp:
    "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z",
  facebook:
    "M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z",
  x: "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.2L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z",
};

function Brand({ name }: { name: keyof typeof BRAND }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="currentColor">
      <path d={BRAND[name]} />
    </svg>
  );
}

/** Distribuire (sistemul telefonului, link, WhatsApp, Facebook, X) + salvare pentru mai târziu. */
export function ArticleTools({ item, vertical }: { item: Saved; vertical?: boolean }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
    setSaved(readSaved().some((s) => s.id === item.id));
    setCanShare(typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches);
  }, [item.id]);

  const toggle = () => {
    const list = readSaved().filter((s) => s.id !== item.id);
    const next = saved ? list : [item, ...list].slice(0, 200);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    setSaved(!saved);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  const share = () => navigator.share?.({ title: item.title, url }).catch(() => {});
  const enc = encodeURIComponent(url);
  const t = encodeURIComponent(item.title);
  const btn =
    "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-rule text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2";
  const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
  return (
    <div data-tools className={vertical ? "flex flex-col items-center gap-2" : "flex flex-wrap items-center gap-2"}>
      {canShare && (
        <button onClick={share} className={btn} aria-label="Distribuie" title="Distribuie">
          <Share2 size={17} aria-hidden />
        </button>
      )}
      <button onClick={copy} className={btn} aria-label={copied ? "Link copiat" : "Copiază linkul"} title={copied ? "Link copiat" : "Copiază linkul"}>
        {copied ? <Check size={17} aria-hidden /> : <Link2 size={17} aria-hidden />}
      </button>
      <a className={btn} href={`https://wa.me/?text=${t}%20${enc}`} {...ext} aria-label="Trimite pe WhatsApp" title="WhatsApp">
        <Brand name="whatsapp" />
      </a>
      <a className={btn} href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`} {...ext} aria-label="Distribuie pe Facebook" title="Facebook">
        <Brand name="facebook" />
      </a>
      <a className={btn} href={`https://x.com/intent/post?url=${enc}&text=${t}`} {...ext} aria-label="Distribuie pe X" title="X">
        <Brand name="x" />
      </a>
      <button
        onClick={toggle}
        className={btn + (saved ? " border-ink bg-ink text-on-ink hover:text-on-ink" : "")}
        aria-pressed={saved}
        aria-label={saved ? "Salvat pentru mai târziu" : "Salvează pentru mai târziu"}
        title={saved ? "Salvat" : "Salvează"}
      >
        {saved ? <BookmarkCheck size={17} aria-hidden /> : <Bookmark size={17} aria-hidden />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copiat" : ""}
      </span>
    </div>
  );
}

export function ViewBeacon({ id }: { id: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      navigator.sendBeacon?.("/api/view", JSON.stringify({ id })) ||
        fetch("/api/view", { method: "POST", body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
    }, 4000); // contează doar vizitele de cel puțin câteva secunde
    return () => clearTimeout(t);
  }, [id]);
  return null;
}

export function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[2px]">
      <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}
