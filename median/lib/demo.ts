import type { Article, CategorySlug } from "./types";
import { hashId, readingTime, slugify } from "./utils";

/*
 * Conținut demonstrativ folosit DOAR când nicio sursă RSS nu poate fi accesată
 * (de ex. la rularea locală fără internet). Site-ul afișează un banner „Mod demo”
 * atunci când aceste articole sunt folosite. Sursele sunt fictive.
 */
const DEMO_SOURCES = [
  { id: "demo-agentie", name: "Agenția Demo", site: "https://example.com" },
  { id: "demo-tv", name: "Televiziunea Demo", site: "https://example.org" },
  { id: "demo-cotidian", name: "Cotidianul Demo", site: "https://example.net" },
];

const ITEMS: [CategorySlug, string, string][] = [
  ["national", "Cod galben de ploi și vânt în mai multe județe până la sfârșitul săptămânii", "Meteorologii anunță precipitații însemnate cantitativ și intensificări ale vântului în vestul și centrul țării. Autoritățile recomandă prudență în trafic."],
  ["national", "Noul an universitar începe cu peste 500.000 de studenți înscriși", "Universitățile din marile centre au raportat un număr record de candidați la programele de licență din domeniile tehnice și medicale."],
  ["national", "Autostrada de centură: încă un tronson deschis circulației", "Șoferii pot circula de astăzi pe un nou segment de autostradă, care scurtează semnificativ timpul de traversare a zonei metropolitane."],
  ["politica", "Parlamentul dezbate astăzi proiectul privind digitalizarea administrației", "Proiectul prevede ca majoritatea documentelor să poată fi obținute online, fără deplasări la ghișeu, până la finalul anului viitor."],
  ["politica", "Guvernul pregătește un pachet de măsuri pentru reducerea birocrației", "Executivul a anunțat consultări publice pe un set de peste 100 de proceduri administrative care urmează să fie simplificate."],
  ["economie", "Inflația anuală a coborât pentru a treia lună consecutiv", "Datele publicate de statistică arată o temperare a prețurilor la alimente și energie, în timp ce serviciile continuă să se scumpească."],
  ["economie", "Leul rămâne stabil în raport cu euro, arată cursul BNR", "Moneda națională a înregistrat variații minime în ultima săptămână, în linie cu așteptările analiștilor."],
  ["economie", "Start-up-urile românești au atras finanțări record în acest trimestru", "Companiile din domeniul software și fintech au condus topul investițiilor, potrivit unui raport al industriei."],
  ["international", "Liderii europeni se reunesc la Bruxelles pentru un summit dedicat competitivității", "Pe agenda discuțiilor se află energia, industria de apărare și simplificarea regulilor pentru companii."],
  ["international", "Acord comercial nou între Uniunea Europeană și statele din America de Sud", "Documentul, negociat timp de mai mulți ani, urmează să fie ratificat de parlamentele naționale."],
  ["international", "Val de căldură neobișnuit pentru această perioadă în sudul Europei", "Temperaturile au depășit 35 de grade în mai multe regiuni, iar autoritățile au emis avertizări pentru populație."],
  ["sport", "Naționala de fotbal a României se pregătește pentru meciurile decisive din preliminarii", "Selecționerul a anunțat lotul lărgit, cu câteva surprize din campionatul intern și două debuturi."],
  ["sport", "Victorie spectaculoasă pentru handbalistele românești în Liga Campionilor", "Echipa a întors rezultatul în ultimele minute, după o repriză secundă excelentă a portarului."],
  ["sport", "Tenis: jucătoarele românești avansează în turul doi la turneul WTA", "Ambele sportive au câștigat în două seturi și vor juca în optimi în cazul unor noi victorii."],
  ["tech", "Inteligența artificială schimbă modul în care lucrează companiile românești", "Un studiu recent arată că aproape jumătate dintre firmele mari folosesc deja instrumente AI în activitatea zilnică."],
  ["tech", "Telescopul spațial a surprins imagini inedite ale unei galaxii îndepărtate", "Astronomii spun că observațiile ajută la înțelegerea formării primelor stele din univers."],
  ["tech", "5G: acoperirea s-a extins în încă zece orașe din România", "Operatorii au anunțat investiții suplimentare în infrastructură pentru a îmbunătăți viteza internetului mobil."],
  ["lifestyle", "Destinații de toamnă în România: cele mai frumoase trasee montane", "De la Bucegi la Apuseni, am selectat traseele ideale pentru o excursie de weekend, cu grad de dificultate mediu."],
  ["lifestyle", "Rețeta săptămânii: supă cremă de dovleac cu ghimbir", "Un preparat simplu, sățios și perfect pentru serile răcoroase, gata în mai puțin de 40 de minute."],
  ["sanatate", "Medicii recomandă vaccinarea antigripală înainte de sezonul rece", "Specialiștii spun că perioada optimă pentru vaccinare este toamna, înaintea creșterii numărului de cazuri."],
  ["sanatate", "Cât de mult contează somnul pentru sănătatea inimii", "Un studiu amplu arată că adulții care dorm mai puțin de șase ore pe noapte au un risc cardiovascular crescut."],
  ["auto", "Vânzările de mașini electrice au crescut semnificativ în acest an", "Programul de sprijin pentru achiziția de autoturisme nepoluante a contribuit la creșterea înmatriculărilor."],
  ["auto", "Test drive: noul SUV compact care vrea să cucerească piața din România", "Am condus timp de o săptămână modelul hibrid și am analizat consumul real, confortul și dotările."],
  ["cultura", "Festivalul de film de toamnă aduce peste 100 de producții în cinematografe", "Programul include premiere internaționale, filme românești independente și întâlniri cu regizorii."],
  ["cultura", "Târgul de carte își deschide porțile cu sute de lansări editoriale", "Vizitatorii se pot bucura de reduceri, sesiuni de autografe și dezbateri cu autori români și străini."],
  ["monden", "Gala premiilor muzicale: cine sunt marii câștigători ai serii", "Artiștii au urcat pe scenă în ținute spectaculoase, iar momentele live au ridicat sala în picioare."],
  ["monden", "Cuplurile din showbiz care și-au anunțat nunta în această toamnă", "Mai multe vedete autohtone au făcut marele pas, iar fanii au fost impresionați de detaliile evenimentelor."],
];

export function buildDemoArticles(now: number): Article[] {
  const out: Article[] = [];
  ITEMS.forEach(([category, title, summary], i) => {
    // Primele subiecte sunt „relatate” de mai multe surse, pentru a demonstra gruparea.
    const copies = i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1;
    for (let k = 0; k < copies; k++) {
      const src = DEMO_SOURCES[(i + k) % DEMO_SOURCES.length];
      const link = `${src.site}/demo/${slugify(title)}-${k}`;
      const published = now - (i * 23 + k * 7 + 3) * 60_000;
      out.push({
        id: hashId(link),
        slug: slugify(title, 70),
        title,
        summary,
        content: summary + "\n\n" + "Acesta este un articol demonstrativ. În funcționare normală, Median afișează aici rezumatul articolului preluat automat din sursa originală, împreună cu link către publicația care l-a scris.",
        link,
        published,
        fetched: now,
        sourceId: src.id,
        sourceName: src.name,
        sourceSite: src.site,
        category,
        readingTime: readingTime(summary) + 1,
      });
    }
  });
  return out;
}
