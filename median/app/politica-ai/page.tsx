import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Politica de utilizare a inteligenței artificiale" };

export default function AiPolicy() {
  return (
    <PageShell kicker="Transparență" title="Cum folosim AI" dek="Articolele Median sunt redactate cu ajutorul inteligenței artificiale. Iată exact ce face și ce nu face sistemul.">
      <h2>Ce face AI-ul</h2>
      <ul>
        <li>Citește textele publicate de mai multe publicații despre același subiect și redactează o sinteză originală în limba română.</li>
        <li>Propune titlul, ideile principale, secțiunile, contextul și etichetele articolului.</li>
        <li>Un al doilea model verifică textul față de surse și semnalează orice afirmație nesusținută.</li>
      </ul>
      <h2>Reguli și verificări</h2>
      <ul>
        <li>Modelul are voie să folosească doar faptele din sursele primite; nu completează din „cunoștințe generale”.</li>
        <li>Verificări automate în cod: fiecare cifră și fiecare citat trebuie să existe în surse; numele proprii trebuie să apară în surse; textul nu poate copia secvențe din articolele originale.</li>
        <li>Articolele care nu trec verificările nu se publică automat: ajung la un editor.</li>
        <li>Subiectele sensibile (decese, minori, violență sexuală, justiție, sinucidere) sunt aprobate de un om înainte de publicare.</li>
      </ul>
      <h2>Etichetare</h2>
      <p>
        Fiecare articol afișează, sub titlu, mențiunea „Sinteză redactată cu AI din N surse”, iar la final lista completă a surselor, în
        conformitate cu obligațiile de transparență din Regulamentul european privind inteligența artificială (AI Act, art. 50).
      </p>
      <h2>Imagini</h2>
      <p>Nu folosim imagini generate de AI pentru știri. Pozele provin din surse cu licență liberă, cu autor și licență menționate, sau sunt coperte grafice proprii.</p>
      <h2>Limite</h2>
      <p>
        Sistemele AI pot greși. Dacă observi o eroare, <Link href="/corecturi">semnalează-o</Link>: o verificăm și, dacă e cazul, corectăm articolul cu
        o notă vizibilă.
      </p>
    </PageShell>
  );
}
