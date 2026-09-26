import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { config } from "@/lib/core/config";

export const metadata: Metadata = {
  title: "Politica privind cookie-urile",
  description: "Median nu folosește cookie-uri de urmărire sau de publicitate pentru cititori.",
};

export default function Cookies() {
  return (
    <PageShell kicker="Protecția datelor" title="Cookie-uri" dek="Pentru cititori, Median nu folosește cookie-uri. De aceea nu îți cerem acordul printr-un banner.">
      <p className="meta">Ultima actualizare: 26 septembrie 2026</p>

      <h2>Ce folosim</h2>
      <table className="ui w-full text-[14px]">
        <thead>
          <tr className="border-b border-rule text-left">
            <th className="py-2 pr-3">Nume</th>
            <th className="py-2 pr-3">Tip</th>
            <th className="py-2 pr-3">Scop</th>
            <th className="py-2">Durată</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-rule align-top">
            <td className="mono py-2 pr-3 text-[13px]">median-theme</td>
            <td className="py-2 pr-3">localStorage</td>
            <td className="py-2 pr-3">Ține minte tema aleasă (luminoasă sau întunecată).</td>
            <td className="py-2">până o ștergi</td>
          </tr>
          <tr className="border-b border-rule align-top">
            <td className="mono py-2 pr-3 text-[13px]">median-salvate</td>
            <td className="py-2 pr-3">localStorage</td>
            <td className="py-2 pr-3">Lista articolelor pe care le-ai salvat pentru mai târziu.</td>
            <td className="py-2">până o ștergi</td>
          </tr>
          <tr className="border-b border-rule align-top">
            <td className="mono py-2 pr-3 text-[13px]">median-vizita, median-vazute</td>
            <td className="py-2 pr-3">localStorage</td>
            <td className="py-2 pr-3">Momentul ultimei vizite și subiectele deschise, ca să marcăm știrile apărute între timp.</td>
            <td className="py-2">până o ștergi</td>
          </tr>
          <tr className="border-b border-rule align-top">
            <td className="mono py-2 pr-3 text-[13px]">median-notificari</td>
            <td className="py-2 pr-3">localStorage</td>
            <td className="py-2 pr-3">Ce notificări ai ales (o copie a preferințelor, pentru pagina de setări).</td>
            <td className="py-2">până o ștergi</td>
          </tr>
          <tr className="border-b border-rule align-top">
            <td className="mono py-2 pr-3 text-[13px]">median_admin</td>
            <td className="py-2 pr-3">cookie</td>
            <td className="py-2 pr-3">Sesiunea editorilor în panoul de administrare. Nu se setează pentru cititori.</td>
            <td className="py-2">7 zile</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-6">
        Datele din localStorage rămân în browserul tău și nu sunt trimise către noi. Sunt strict necesare pentru funcțiile pe care le ceri
        explicit (tema, salvarea), așa că, potrivit art. 4 alin. (5) din Legea nr. 506/2004, nu necesită consimțământ.
      </p>

      <h2>Ce nu folosim</h2>
      <ul>
        <li>cookie-uri de publicitate sau de retargeting;</li>
        <li>servicii de analiză (Google Analytics, Meta Pixel etc.);</li>
        <li>butoane sociale încărcate de la rețelele de socializare, fonturi sau scripturi de la terți.</li>
      </ul>
      <p>
        Dacă vom adăuga vreodată astfel de instrumente, vom cere mai întâi acordul tău și vom actualiza această pagină.
      </p>

      <h2>Cum ștergi datele</h2>
      <p>
        Din setările browserului: „Confidențialitate” → „Date site-uri” (sau „Cookie-uri și date ale site-urilor”) → Median → Șterge. Întrebări:{" "}
        <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>. Vezi și <Link href="/confidentialitate">Politica de confidențialitate</Link>.
      </p>
    </PageShell>
  );
}
