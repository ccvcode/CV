import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { config } from "@/lib/core/config";
import { aiMode } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Termeni de utilizare", description: "Condițiile în care poți folosi Median." };
export const dynamic = "force-dynamic";

export default function Terms() {
  const ai = aiMode();
  return (
    <PageShell kicker="Informații legale" title="Termeni de utilizare" dek="Regulile simple după care funcționează Median și după care îl poți folosi.">
      <p className="meta">Ultima actualizare: 26 septembrie 2026</p>

      <h2>1. Ce este Median</h2>
      <p>
        Median este un serviciu gratuit care urmărește fluxurile RSS publice ale publicațiilor, grupează articolele despre același eveniment și
        trimite la fiecare sursă.{" "}
        {ai
          ? "Pentru subiectele relatate de mai multe publicații, Median publică sinteze redactate cu ajutorul inteligenței artificiale, marcate ca atare, pe baza faptelor din surse."
          : "Median afișează titlul, un extras scurt și legătura către textul complet al fiecărei publicații."}{" "}
        Folosirea site-ului înseamnă că accepți acești termeni.
      </p>

      <h2>2. Conținutul publicațiilor</h2>
      <p>
        Titlurile, extrasele și fotografiile preluate aparțin publicațiilor citate, care sunt indicate la fiecare știre. Extrasele sunt scurte (sub
        120 de caractere) și sunt folosite cu indicarea sursei, în limitele art. 35 din Legea nr. 8/1996 privind dreptul de autor. Textul complet
        se citește pe site-ul publicației. Dacă deții drepturi asupra unui material și vrei să fie retras sau corectat, folosește{" "}
        <Link href="/contact">formularul de contact</Link>; răspundem în cel mult 48 de ore.
      </p>

      <h2>3. Conținutul Median</h2>
      <p>
        Designul site-ului, selecția și organizarea știrilor{ai ? " și textele sintezelor" : ""} aparțin Median. Le poți cita cu trimitere la
        pagina Median; nu le poți republica integral sau prelua automat fără acordul nostru scris.
      </p>

      <h2>4. Acuratețe și corecturi</h2>
      <p>
        Median preia automat informații publicate de alte redacții și nu garantează că acestea sunt complete sau lipsite de erori. Faptele aparțin
        surselor citate. Corectăm rapid greșelile semnalate; lista corecturilor este publică pe pagina <Link href="/corecturi">Corecturi</Link>.
      </p>

      <h2>5. Legături către alte site-uri</h2>
      <p>
        Site-urile publicațiilor și ale rețelelor sociale au propriile condiții și politici de confidențialitate. Median nu răspunde de conținutul
        lor.
      </p>

      <h2>6. Utilizare corectă</h2>
      <p>
        Nu este permisă colectarea automată masivă a paginilor, încercarea de a ocoli măsurile de securitate sau folosirea formularelor pentru mesaje
        abuzive sau publicitare. Putem limita accesul celor care nu respectă aceste reguli.
      </p>

      <h2>7. Date personale</h2>
      <p>
        Modul în care prelucrăm datele este descris în <Link href="/confidentialitate">Politica de confidențialitate</Link> și în{" "}
        <Link href="/cookies">Politica privind cookie-urile</Link>.
      </p>

      <h2>8. Legea aplicabilă</h2>
      <p>
        Acești termeni sunt guvernați de legea română. Putem actualiza termenii; data ultimei modificări apare mai sus. Întrebări:{" "}
        <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
        {config.company ? ` · ${config.company}` : ""}.
      </p>
    </PageShell>
  );
}
