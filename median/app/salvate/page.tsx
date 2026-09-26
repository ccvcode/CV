import type { Metadata } from "next";
import { SavedList } from "@/components/saved-list";

export const metadata: Metadata = { title: "Articole salvate", robots: { index: false } };

export default function Saved() {
  return (
    <main className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <h1 className="section-head pt-10 text-[48px] sm:text-[88px]">Salvate</h1>
      <p className="dek mt-3 max-w-2xl border-b-2 border-rule-strong pb-4 text-[19px]">Articolele salvate rămân doar în acest browser.</p>
      <SavedList />
    </main>
  );
}
