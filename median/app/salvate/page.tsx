import type { Metadata } from "next";
import { SavedList } from "@/components/SavedList";

export const metadata: Metadata = { title: "Articole salvate", robots: { index: false } };

export default function Saved() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:px-6">
      <h1 className="font-display text-4xl font-black">Salvate</h1>
      <p className="mt-2 text-ink-muted">Articolele salvate sunt păstrate doar în acest browser.</p>
      <SavedList />
    </main>
  );
}
