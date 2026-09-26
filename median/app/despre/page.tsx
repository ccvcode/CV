import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { config } from "@/lib/core/config";

export const metadata: Metadata = { title: "Despre Median" };

export default function About() {
  return (
    <PageShell kicker="Redacția" title="Despre Median" dek="Știrile zilei, cântărite. Un singur articol complet pe subiect, cu toate sursele la vedere.">
      <p className="dropcap">
        Median pornește de la o idee simplă: aceeași știre apare în zeci de publicații, cu titluri diferite și detalii răspândite. Median
        urmărește fluxurile publice ale publicațiilor românești, recunoaște când mai multe redacții relatează același eveniment și redactează o
        singură sinteză completă, care reunește faptele din toate sursele și trimite la fiecare dintre ele.
      </p>
      <h2>Cum funcționează</h2>
      <ul>
        <li>La fiecare 5 minute, sistemul verifică fluxurile RSS ale publicațiilor (lista completă e pe pagina <Link href="/surse">Surse</Link>).</li>
        <li>Articolele despre același eveniment sunt grupate într-un subiect. Contează câte redacții diferite îl relatează.</li>
        <li>Pentru subiectele relatate de cel puțin două publicații, un model de inteligență artificială redactează o sinteză originală, folosind exclusiv faptele din surse.</li>
        <li>Fiecare text este verificat automat: cifrele, numele și citatele trebuie să se regăsească în surse, iar formularea nu are voie să copieze textele originale.</li>
        <li>Subiectele sensibile (decese, minori, justiție) sunt aprobate de un om înainte de publicare.</li>
      </ul>
      <h2>Ce nu facem</h2>
      <ul>
        <li>Nu copiem articolele altor publicații și nu folosim fotografiile lor ca imagini principale.</li>
        <li>Nu inventăm autori. Articolele sunt semnate „Redacția Median” și sunt marcate ca redactate cu AI.</li>
        <li>Nu folosim imagini generate de AI pentru știri.</li>
      </ul>
      <p>
        Detalii în <Link href="/politica-editoriala">Politica editorială</Link> și <Link href="/politica-ai">Politica de utilizare a AI</Link>. Contact:{" "}
        <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
        {config.company ? `. Editor: ${config.company}.` : "."}
      </p>
    </PageShell>
  );
}
