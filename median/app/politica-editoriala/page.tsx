import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Politica editorială" };

export default function Editorial() {
  return (
    <PageShell kicker="Redacția" title="Politica editorială">
      <h2>Acuratețe</h2>
      <p>
        Median redă doar fapte relatate de publicații identificabile și le atribuie explicit („potrivit…”, „a anunțat…”). Când sursele se
        contrazic, articolul prezintă ambele versiuni, fiecare cu sursa ei. Nu adăugăm informații care nu apar în surse.
      </p>
      <h2>Neutralitate</h2>
      <p>Folosim un ton neutru, fără adjective evaluative, fără titluri senzaționaliste și fără întrebări-capcană. Opiniile nu sunt prezentate ca fapte.</p>
      <h2>Protecția persoanelor</h2>
      <ul>
        <li>Respectăm prezumția de nevinovăție: o persoană cercetată este „suspectată” sau „acuzată”, nu „vinovată”.</li>
        <li>Nu identificăm minori, victime ale infracțiunilor sexuale sau persoane private implicate incidental.</li>
        <li>În cazurile de sinucidere nu descriem metode și includem linia de sprijin 0800 801 200 (Alianța Română de Prevenție a Suicidului).</li>
        <li>Subiectele sensibile sunt aprobate de un editor înainte de publicare.</li>
      </ul>
      <h2>Surse și drepturi</h2>
      <p>
        Fiecare articol listează toate sursele, cu titlul original, ora publicării și link. Nu preluăm text din articolele originale peste
        limitele legale (Legea nr. 8/1996), cu excepția declarațiilor persoanelor, redate exact și atribuite. Fotografiile principale provin din
        surse cu licență liberă (Wikimedia Commons, Unsplash, Pexels) sau sunt grafice proprii.
      </p>
      <h2>Corecturi</h2>
      <p>
        Erorile se corectează vizibil, cu o notă datată în articol, și sunt listate pe pagina <Link href="/corecturi">Corecturi</Link>. Ținta noastră
        este ca orice semnalare întemeiată să fie rezolvată în 48 de ore.
      </p>
    </PageShell>
  );
}
