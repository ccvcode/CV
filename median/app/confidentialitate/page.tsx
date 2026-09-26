import type { Metadata } from "next";
import Link from "next/link";
import { Operator } from "@/components/operator";
import { PageShell } from "@/components/page-shell";
import { config } from "@/lib/core/config";

export const metadata: Metadata = {
  title: "Politica de confidențialitate",
  description: "Ce date personale prelucrează Median, de ce, cât timp le păstrează și ce drepturi ai (GDPR).",
};

export default function Privacy() {
  const mail = <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>;
  return (
    <PageShell kicker="Protecția datelor" title="Confidențialitate" dek="Median se citește fără cont, fără reclame și fără urmărire. Aici afli exact ce date ajung la noi și ce drepturi ai.">
      <p className="meta">Ultima actualizare: 26 septembrie 2026</p>

      <h2>Cine suntem</h2>
      <Operator />
      <p>
        Această politică se aplică site-ului Median și respectă Regulamentul (UE) 2016/679 („GDPR”) și Legea nr. 190/2018. Nu avem obligația de
        a numi un responsabil cu protecția datelor; pentru orice întrebare ne scrii la {mail}.
      </p>

      <h2>Pe scurt</h2>
      <ul>
        <li>Nu ai nevoie de cont și nu îți cerem date ca să citești.</li>
        <li>Nu folosim reclame, pixeli de urmărire, Google Analytics sau alte servicii de analiză.</li>
        <li>Nu vindem și nu închiriem date nimănui.</li>
        <li>Fonturile, pozele și scripturile sunt servite de pe serverul nostru: browserul tău nu contactează alte companii când citești Median.</li>
      </ul>

      <h2>Ce date prelucrăm</h2>
      <h3 className="ui mt-6 text-[17px] font-semibold">1. Când citești site-ul</h3>
      <p>
        Ca orice site, serverul primește adresa IP, tipul browserului și pagina cerută. Le folosim doar ca să trimitem pagina și ca să protejăm
        serviciul împotriva abuzurilor (temei: interes legitim, art. 6 alin. 1 lit. f GDPR). Jurnalele tehnice ale serverului se păstrează cel
        mult 30 de zile.
      </p>
      <p>
        Pentru lista „Cele mai citite” numărăm vizualizările fiecărui articol. Adresa IP stă doar în memoria serverului, cel mult o oră, ca să nu
        numărăm de mai multe ori aceeași vizită; în baza de date rămâne doar numărul total de vizualizări, fără nicio legătură cu tine.
      </p>

      <h3 className="ui mt-6 text-[17px] font-semibold">2. Când ne trimiți o semnalare sau o cerere</h3>
      <p>
        Prin formularul de <Link href="/corecturi">corecturi</Link> sau de <Link href="/contact">drepturi de autor</Link> primim mesajul tău,
        articolul la care se referă și, dacă alegi să o scrii, adresa ta de e-mail, ca să îți putem răspunde. Temeiul este interesul nostru
        legitim de a corecta erorile și de a răspunde titularilor de drepturi (art. 6 alin. 1 lit. f). Adresa de e-mail se șterge automat după
        12 luni; textul corecturii poate rămâne public în lista de corecturi, fără numele sau adresa ta. Pentru a opri trimiterile automate, adresa
        IP este ținută în memorie cel mult o oră.
      </p>

      <h3 className="ui mt-6 text-[17px] font-semibold">3. Date păstrate doar pe dispozitivul tău</h3>
      <p>
        Tema aleasă (luminoasă sau întunecată), articolele salvate pentru mai târziu, momentul ultimei vizite și subiectele deschise (ca să
        marcăm ce e nou) și preferințele de notificare sunt păstrate în memoria browserului tău (localStorage).
        Nu ajung niciodată la noi și le poți șterge oricând din setările browserului. Detalii în <Link href="/cookies">Politica privind cookie-urile</Link>.
      </p>

      <h3 className="ui mt-6 text-[17px] font-semibold">4. Notificări (doar dacă le activezi)</h3>
      <p>
        Dacă activezi notificările pe pagina <Link href="/notificari">Notificări</Link>, browserul ne transmite o adresă tehnică de
        notificare și două chei de criptare. Le păstrăm împreună cu subiectele alese (ex. rezumatul de dimineață, alertele) și cu numele
        pe care alegi să le urmărești. Nu le putem lega de identitatea ta. Temeiul este consimțământul tău (art. 6 alin. 1 lit. a GDPR),
        pe care îl retragi oricând cu „Dezabonează-mă de tot” sau din setările browserului; atunci ștergem abonamentul. Abonamentele pe
        care browserul le declară expirate se șterg automat, iar evidența notificărilor trimise se șterge după 14 zile.
      </p>
      <p>
        Mesajele ajung la tine prin serviciul de notificări al browserului (Google pentru Chrome și Edge pe Android, Mozilla pentru Firefox,
        Apple pentru Safari, Microsoft pentru Edge pe Windows), criptate: aceste servicii nu pot citi conținutul, dar pot funcționa și în
        afara Spațiului Economic European, în baza garanțiilor contractuale ale furnizorilor.
      </p>

      <h3 className="ui mt-6 text-[17px] font-semibold">5. Datele din știri</h3>
      <p>
        Știrile agregate pot conține numele unor persoane publice sau implicate în evenimente de interes public. Le prelucrăm în scop jurnalistic
        (art. 85 GDPR și art. 7 din Legea nr. 190/2018), cu trimitere la publicația care le-a relatat. Dacă o știre te privește și crezi că nu
        ar trebui să apară, scrie-ne la {mail}; analizăm fiecare cerere.
      </p>

      <h2>Cine mai are acces la date</h2>
      <p>
        Doar furnizorul de găzduire al serverului, care acționează ca persoană împuternicită, în baza unui contract, în Uniunea Europeană. Datele
        pot fi comunicate autorităților doar dacă legea ne obligă. Nu transferăm date în afara Spațiului Economic European, cu excepția
        notificărilor, dacă le activezi (vezi mai sus).
      </p>
      <p>
        Butoanele de distribuire (WhatsApp, Facebook, X) sunt simple legături: nu încarcă nimic de la aceste rețele până nu apeși pe ele. După ce
        apeși, se aplică politica rețelei respective.
      </p>

      <h2>Drepturile tale</h2>
      <p>Poți cere oricând, gratuit, la {mail}:</p>
      <ul>
        <li>accesul la datele tale și o copie a lor;</li>
        <li>corectarea sau ștergerea lor;</li>
        <li>restricționarea prelucrării sau portabilitatea datelor;</li>
        <li>să te opui prelucrării bazate pe interesul nostru legitim.</li>
      </ul>
      <p>
        Răspundem în cel mult o lună. Dacă nu ești mulțumit, poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor
        cu Caracter Personal (ANSPDCP), B-dul G-ral. Gheorghe Magheru nr. 28-30, sector 1, București,{" "}
        <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer">
          dataprotection.ro
        </a>
        .
      </p>

      <h2>Modificări</h2>
      <p>Dacă schimbăm modul în care prelucrăm datele, actualizăm această pagină și data de mai sus înainte ca schimbarea să se aplice.</p>
    </PageShell>
  );
}
