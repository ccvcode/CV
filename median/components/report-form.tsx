"use client";

import { useState } from "react";

export function ReportForm({ kind, storyId }: { kind: "corectura" | "drepturi"; storyId?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    try {
      const r = await fetch("/api/semnalare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, storyId: f.get("storyId") || storyId, email: f.get("email"), message: f.get("message"), website: f.get("website") }),
      });
      setState(r.ok ? "ok" : "error");
    } catch {
      setState("error");
    }
  };
  if (state === "ok") return <p className="ui mt-3 border-l-[3px] border-accent pl-3 text-[15px]">Mulțumim. Am primit semnalarea și revenim în cel mult 48 de ore.</p>;
  const input = "ui mt-1 block w-full rounded-[2px] border border-rule bg-paper px-3 py-2 text-[15px] outline-none focus:border-rule-strong";
  return (
    <form onSubmit={submit} className="ui mt-3 space-y-4 text-[14px]">
      {kind === "corectura" && (
        <label className="block">
          Link sau cod articol
          <input name="storyId" defaultValue={storyId} className={input} placeholder="ex. https://median.ro/stire/..." />
        </label>
      )}
      <label className="block">
        E-mail (opțional, pentru răspuns)
        <input name="email" type="email" className={input} />
      </label>
      <label className="block">
        {kind === "corectura" ? "Ce este greșit?" : "Mesaj (materialul, publicația, cererea)"}
        <textarea name="message" required minLength={10} maxLength={3000} rows={6} className={input} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <button disabled={state === "sending"} className="bg-ink px-5 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-on-ink disabled:opacity-60">
        {state === "sending" ? "Se trimite…" : "Trimite"}
      </button>
      {state === "error" && <p className="text-accent-ink">Nu am putut trimite. Încearcă din nou sau scrie-ne pe e-mail.</p>}
    </form>
  );
}
