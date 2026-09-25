"use client";

import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { articleHref } from "@/lib/utils";
import { readSaved, writeSaved, type SavedArticle } from "./ArticleActions";
import { ArticleImage } from "./ArticleImage";
import { TimeAgo } from "./TimeAgo";

export function SavedList() {
  const [list, setList] = useState<SavedArticle[] | null>(null);
  useEffect(() => {
    const load = () => setList(readSaved());
    load();
    window.addEventListener("median-saved", load);
    return () => window.removeEventListener("median-saved", load);
  }, []);

  if (list === null) return <div className="skeleton mt-8 h-24" />;
  if (!list.length)
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-line p-10 text-center">
        <Bookmark className="mx-auto h-10 w-10 text-ink-faint" />
        <p className="mt-3 font-semibold">Nu ai salvat încă niciun articol</p>
        <p className="mt-1 text-sm text-ink-muted">Apasă „Salvează” pe orice articol ca să-l citești mai târziu.</p>
        <Link href="/" className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg">
          Descoperă știri
        </Link>
      </div>
    );

  return (
    <ul className="mt-6 divide-y divide-line">
      {list.map((a) => (
        <li key={a.id} className="group relative flex gap-4 py-4">
          <ArticleImage src={a.image} alt="" category={a.category} className="h-20 w-24 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Link href={articleHref(a)} className="headline line-clamp-2 font-semibold leading-snug hover:text-brand">
              {a.title}
            </Link>
            <div className="mt-1 text-xs text-ink-muted">
              {a.sourceName} · <TimeAgo ts={a.published} />
            </div>
          </div>
          <button
            onClick={() => {
              const next = list.filter((x) => x.id !== a.id);
              writeSaved(next);
              setList(next);
            }}
            className="self-start rounded-full p-2 text-ink-faint hover:bg-surface-2 hover:text-breaking"
            aria-label="Elimină din salvate"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
