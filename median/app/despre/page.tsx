import type { Metadata } from "next";
import Link from "next/link";
import { Layers, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Despre Median" };

const FEATURES = [
  { icon: RefreshCw, title: "Actualizat la 5 minute", text: "Un colector automat verifică toate sursele la fiecare 5 minute și aduce știrile noi fără să reîncarci pagina." },
  { icon: Layers, title: "Grupare pe subiecte", text: "Articolele despre același eveniment sunt grupate, ca să vezi câte surse relatează și cine a scris primul." },
  { icon: ShieldCheck, title: "Respect pentru surse", text: "Afișăm doar titlul, un scurt extras și imaginea din fluxul public, cu link direct către articolul original." },
  { icon: Zap, title: "Rapid și modern", text: "Temă luminoasă și întunecată, căutare instantă, articole salvate și o interfață gândită mai întâi pentru telefon." },
];

export default function About() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-10 pt-12 sm:px-6">
      <Logo size="lg" />
      <h1 className="font-display mt-6 text-4xl font-black leading-tight sm:text-6xl">Toate sursele. Un singur loc.</h1>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted">
        Median este un agregator de știri din România și din lume. Numele vine de la <i>mediană</i> — valoarea din mijloc: vrem să-ți arătăm
        imaginea completă a unui subiect, așa cum este relatat de publicații diferite.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-3xl border border-line bg-surface p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-display text-xl font-bold">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 rounded-3xl bg-surface-2 p-6 text-sm leading-relaxed text-ink-muted">
        <h2 className="font-display text-lg font-bold text-ink">Drepturi de autor</h2>
        <p className="mt-2">
          Conținutul articolelor aparține publicațiilor care le-au scris. Dacă reprezinți o publicație și dorești eliminarea fluxului tău din Median,
          scrie-ne și îl scoatem imediat. Vezi <Link href="/surse" className="font-semibold text-brand">lista completă a surselor</Link>.
        </p>
      </div>
    </main>
  );
}
