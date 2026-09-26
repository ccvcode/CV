import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { adminEnabled, checkPassword, createSession } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Autentificare", robots: { index: false } };

const attempts = new Map<string, number[]>();

async function login(formData: FormData) {
  "use server";
  const now = Date.now();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "necunoscut";
  const recent = (attempts.get(ip) ?? []).filter((t) => t > now - 15 * 60_000);
  // Limită per IP: 10 încercări greșite în 15 minute. O parolă corectă nu e blocată de încercările altora.
  if (recent.length >= 10) redirect("/admin/login?e=limit");
  if (!checkPassword(String(formData.get("password") ?? ""))) {
    if (attempts.size > 10_000) attempts.clear();
    attempts.set(ip, [...recent, now]);
    redirect("/admin/login?e=1");
  }
  await createSession();
  redirect("/admin");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const e = (await searchParams).e;
  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <h1 className="section-head text-[44px]">Redacție</h1>
      {!adminEnabled() ? (
        <p className="ui mt-4 text-[15px] text-ink-2">
          Panoul de administrare este dezactivat. Setează variabila <code className="mono">ADMIN_PASSWORD</code> (minimum 8 caractere) și repornește
          site-ul.
        </p>
      ) : (
        <form action={login} className="ui mt-6 space-y-4">
          <label className="block text-[14px]">
            Parolă
            <input name="password" type="password" required autoFocus className="mt-1 block w-full rounded-[2px] border border-rule bg-paper px-3 py-2 text-[16px]" />
          </label>
          {e && <p className="text-[14px] text-accent-ink">{e === "limit" ? "Prea multe încercări. Așteaptă 15 minute." : "Parolă greșită."}</p>}
          <button className="bg-ink px-5 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-on-ink">Intră</button>
        </form>
      )}
    </main>
  );
}
