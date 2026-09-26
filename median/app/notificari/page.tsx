import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { PushSettings } from "@/components/push";
import { TOPICS } from "@/lib/push";

export const metadata: Metadata = {
  title: "Notificări",
  description: "Primește pe telefon sau calculator rezumatul de dimineață, alertele și știrile despre persoanele pe care le urmărești. Fără cont.",
};

export default function Notifications() {
  return (
    <PageShell kicker="Urmărește" title="Notificări" dek="Fără cont, fără e-mail. Alegi ce vrei să primești, iar notificările vin direct în browser, pe telefon sau pe calculator.">
      <div className="not-prose">
        <PushSettings topics={{ ...TOPICS }} />
      </div>
      <h2>Ce păstrăm</h2>
      <p>
        Doar adresa tehnică de notificare pe care ne-o dă browserul și subiectele alese. Nu știm cine ești. Când te dezabonezi (sau retragi
        permisiunea din browser), ștergem abonamentul. Detalii în <Link href="/confidentialitate">Politica de confidențialitate</Link>.
      </p>
      <h2>Pe iPhone</h2>
      <p>
        Apple permite notificările web doar pentru site-urile adăugate pe ecranul principal: în Safari, apasă Partajează → Adaugă pe ecranul
        principal, deschide Median de acolo și revino pe această pagină.
      </p>
    </PageShell>
  );
}
