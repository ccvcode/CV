"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readSaved, type Saved } from "./article-tools";

export function SavedList() {
  const [list, setList] = useState<Saved[] | null>(null);
  useEffect(() => setList(readSaved()), []);
  if (!list) return null;
  if (!list.length) return <p className="dek py-12 text-[19px]">Nu ai salvat încă niciun articol. Folosește „Salvează” de pe pagina oricărui articol.</p>;
  const remove = (id: string) => {
    const next = list.filter((s) => s.id !== id);
    try {
      localStorage.setItem("median-salvate", JSON.stringify(next));
    } catch {}
    setList(next);
  };
  return (
    <ul className="max-w-3xl">
      {list.map((s) => (
        <li key={s.id} className="flex items-start justify-between gap-6 border-b border-rule py-4">
          <Link href={s.href} className="hl hl-md hl-link">
            {s.title}
          </Link>
          <button onClick={() => remove(s.id)} className="ui shrink-0 text-[12px] font-semibold uppercase tracking-wider text-ink-3 hover:text-ink">
            Elimină
          </button>
        </li>
      ))}
    </ul>
  );
}
