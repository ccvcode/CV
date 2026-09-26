import type { Story } from "./content";

/* Sport, tehnologie și auto. Persoanele (inclusiv sportivii) sunt fictive. */
export const STORIES_C: Story[] = [
  {
    id: "nationala-lot",
    category: "sport",
    image: { scene: "stadium", caption: "Arena Națională, înaintea unui meci al echipei naționale", hue: 120 },
    versions: [
      {
        outlet: "sporttotal",
        title: "Dorin Marcu a anunțat lotul pentru meciurile cu Bosnia și Cipru. Trei debutanți pe listă",
        subheading: "Lotul complet",
        author: "Marius Oprea",
        offsetMin: 200,
        quoteBy: "Dorin Marcu",
        paragraphs: [
          "Selecționerul Dorin Marcu a anunțat vineri lotul de 25 de jucători convocați pentru meciurile din preliminariile Campionatului Mondial cu Bosnia și Herțegovina, pe 10 octombrie, la Zenica, și cu Cipru, pe 13 octombrie, pe Arena Națională.",
          "Pe listă apar trei jucători neconvocați până acum la echipa mare: portarul Rareș Bratu, fundașul central Ionuț Sârbu și mijlocașul Luca Diaconu, toți sub 23 de ani.",
          "„Nu am chemat pe nimeni doar ca să-l răsplătesc pentru un sezon bun. Cei trei au jucat constant la un nivel ridicat și merită să vadă cum se lucrează la națională”, a spus selecționerul în conferința de presă de la Mogoșoaia.",
          "Căpitanul Alexandru Vlaicu revine în lot după accidentarea la gleznă care l-a ținut departe de teren o lună. În schimb, atacantul Cosmin Tudose lipsește, fiind încă în recuperare.",
          "România ocupă locul doi în grupă, cu 10 puncte după cinci meciuri, la două puncte de liderul Austria. Primele două clasate merg direct la turneul final sau la baraj, în funcție de clasamentul general.",
          "Jucătorii se reunesc luni la centrul național de pregătire, iar echipa pleacă spre Bosnia miercuri, cu o cursă charter.",
        ],
      },
      {
        outlet: "actualitateatv",
        title: "Lotul României pentru dubla cu Bosnia și Cipru: surprizele lui Dorin Marcu",
        author: "Cristian Popa",
        offsetMin: 220,
        quoteBy: "Dorin Marcu",
        paragraphs: [
          "Echipa națională de fotbal a României va juca în octombrie două meciuri decisive în preliminariile Cupei Mondiale: pe 10 octombrie, în deplasare, cu Bosnia și Herțegovina, și pe 13 octombrie, acasă, cu Cipru.",
          "Selecționerul Dorin Marcu a convocat 25 de jucători, printre care trei debutanți: Rareș Bratu, Ionuț Sârbu și Luca Diaconu.",
          "„Nu am chemat pe nimeni doar ca să-l răsplătesc pentru un sezon bun. Cei trei au jucat constant la un nivel ridicat și merită să vadă cum se lucrează la națională”, a explicat tehnicianul.",
          "Tricolorii sunt pe locul al doilea în grupă, cu 10 puncte, în urma Austriei.",
        ],
      },
      {
        outlet: "stiricarpatice",
        title: "Naționala, în căutarea calificării: Vlaicu revine, Tudose ratează meciurile din octombrie",
        author: "Gabriel Stan",
        offsetMin: 290,
        quoteBy: "Dorin Marcu",
        paragraphs: [
          "Căpitanul naționalei, Alexandru Vlaicu, se numără printre cei 25 de jucători convocați de Dorin Marcu pentru meciurile din octombrie, cu Bosnia și Herțegovina și Cipru. În schimb, atacantul Cosmin Tudose nu și-a revenit complet după accidentare.",
          "Lotul include trei nume noi, toate sub 23 de ani. Selecționerul a explicat că alegerea lor nu este una simbolică. „Nu am chemat pe nimeni doar ca să-l răsplătesc pentru un sezon bun. Cei trei au jucat constant la un nivel ridicat și merită să vadă cum se lucrează la națională”, a declarat Marcu.",
          "Meciul cu Bosnia se joacă pe 10 octombrie, la Zenica, iar cel cu Cipru pe 13 octombrie, pe Arena Națională. Federația a anunțat că biletele pentru meciul de acasă s-au vândut în proporție de 80% în primele 24 de ore.",
          "România are 10 puncte după cinci etape și ocupă locul doi în grupă.",
        ],
      },
    ],
  },
  {
    id: "liga1-derby",
    category: "sport",
    image: { scene: "stadium", caption: "Tribunele pline la derby-ul etapei", hue: 350 },
    versions: [
      {
        outlet: "sporttotal",
        title: "Universitatea Cluj câștigă derby-ul etapei cu Rapid, scor 2-1, și urcă pe primul loc",
        author: "Marius Oprea",
        offsetMin: 40,
        quoteBy: "Horia Pintea",
        paragraphs: [
          "Universitatea Cluj a învins-o pe Rapid cu 2-1, sâmbătă seară, pe Cluj Arena, în derby-ul etapei a 11-a din Superliga. Cu acest rezultat, echipa ardeleană urcă pe primul loc în clasament.",
          "Gazdele au deschis scorul în minutul 23, prin Sergiu Moga, cu un șut de la marginea careului. Oaspeții au egalat în minutul 58, după o lovitură liberă executată de Paul Irimia. Golul victoriei a fost marcat în minutul 86 de Andrei Borș, la o fază fixă.",
          "„A fost un meci greu, cu un adversar care ne-a pus multe probleme după pauză. Băieții au crezut până la final și asta a făcut diferența”, a declarat antrenorul clujenilor, Horia Pintea.",
          "Meciul s-a jucat în fața a 21.400 de spectatori, un record al sezonului pe Cluj Arena. În etapa următoare, Universitatea Cluj joacă în deplasare, iar Rapid primește vizita unei echipe din a doua jumătate a clasamentului.",
        ],
      },
    ],
  },
  {
    id: "tenis-beijing",
    category: "sport",
    image: { scene: "stadium", caption: "Terenul central al turneului de la Beijing", hue: 165 },
    versions: [
      {
        outlet: "sporttotal",
        title: "Ioana Stanciu, calificare istorică în sferturi la Beijing după o victorie în trei seturi",
        author: "Cătălina Pop",
        offsetMin: 660,
        quoteBy: "Ioana Stanciu",
        paragraphs: [
          "Ioana Stanciu s-a calificat în sferturile de finală ale turneului WTA 1000 de la Beijing, după ce a trecut în optimi de o jucătoare aflată pe locul 9 în clasamentul mondial, scor 6-4, 3-6, 7-5.",
          "Partida a durat două ore și 41 de minute. Jucătoarea în vârstă de 22 de ani a salvat două mingi de meci în setul decisiv, la scorul de 4-5, și a câștigat apoi trei game-uri consecutive.",
          "„Nu mă gândeam la scor, doar la următoarea minge. Am simțit că publicul a fost de partea mea în ultimele game-uri și asta m-a ajutat enorm”, a declarat Stanciu la finalul meciului.",
          "Este cel mai bun rezultat al carierei sale la un turneu de categorie WTA 1000. Grație acestei performanțe, românca va urca cel puțin până pe locul 34 în clasamentul mondial.",
          "În sferturi, Stanciu va juca împotriva câștigătoarei meciului dintre o jucătoare din Kazahstan și una din Statele Unite.",
        ],
      },
      {
        outlet: "jurnaluldevest",
        title: "Timișoreanca Ioana Stanciu salvează două mingi de meci și ajunge în sferturi la Beijing",
        author: "Sorina Balint",
        offsetMin: 700,
        quoteBy: "Ioana Stanciu",
        paragraphs: [
          "Sportiva legitimată la un club din Timișoara, Ioana Stanciu, a obținut cea mai importantă victorie a carierei, în optimile turneului de la Beijing: 6-4, 3-6, 7-5 cu a noua jucătoare a lumii.",
          "Stanciu a fost la un pas de eliminare, când adversara a servit pentru meci la 5-4 în setul al treilea. Românca a salvat două mingi de meci și a câștigat apoi trei game-uri la rând.",
          "„Nu mă gândeam la scor, doar la următoarea minge. Am simțit că publicul a fost de partea mea în ultimele game-uri și asta m-a ajutat enorm”, a spus tenismena.",
          "Antrenorul ei de la juniori, contactat de Jurnalul de Vest, a spus că Ioana a început tenisul la 6 ani, pe terenurile din Parcul Rozelor, și că a fost mereu remarcată pentru puterea mentală.",
          "În urma rezultatului de la Beijing, sportiva va urca în primele 35 de jucătoare ale lumii.",
        ],
      },
    ],
  },
  {
    id: "maraton-bucuresti",
    category: "sport",
    image: { scene: "crowd", caption: "Alergători pe bulevardul Unirii, la startul maratonului", hue: 30 },
    versions: [
      {
        outlet: "sporttotal",
        title: "Record de participare la maratonul Bucureștiului: 16.000 de alergători la start",
        author: "Cătălina Pop",
        offsetMin: 1320,
        quoteBy: "Silviu Grigore",
        paragraphs: [
          "Aproximativ 16.000 de alergători s-au înscris în acest an la maratonul internațional al Bucureștiului, un record absolut pentru competiție. Participanții vin din 58 de țări.",
          "Pe lângă proba de maraton, sunt organizate cursa de semimaraton, ștafeta și o cursă de 5 kilometri pentru amatori. Pentru copii este pregătită o cursă separată, sâmbătă, în Parcul Izvor.",
          "„Numărul de alergători s-a dublat în ultimii cinci ani. Avem tot mai mulți oameni care încep să alerge după 40 de ani și care fac din maraton un obiectiv personal”, a declarat Silviu Grigore, directorul competiției.",
          "Duminică, între orele 7:00 și 15:00, mai multe bulevarde din centrul Capitalei vor fi închise traficului. Organizatorii recomandă folosirea metroului, care va circula cu frecvență crescută.",
        ],
      },
      {
        outlet: "stiricarpatice",
        title: "Maratonul București: restricții de trafic duminică în centrul Capitalei",
        author: "Gabriel Stan",
        offsetMin: 1350,
        quoteBy: "Silviu Grigore",
        paragraphs: [
          "Mai multe bulevarde din centrul Bucureștiului vor fi închise circulației duminică, între orele 7:00 și 15:00, pe durata maratonului internațional, anunță Brigada Rutieră.",
          "Restricțiile vizează bulevardele Unirii, Regina Elisabeta, Kogălniceanu și Kiseleff, precum și zona Pieței Victoriei. Liniile de autobuz care traversează zona vor fi deviate.",
          "Organizatorii au anunțat un număr-record de participanți: 16.000 de alergători din 58 de țări.",
          "„Numărul de alergători s-a dublat în ultimii cinci ani. Avem tot mai mulți oameni care încep să alerge după 40 de ani și care fac din maraton un obiectiv personal”, a spus directorul competiției, Silviu Grigore.",
          "Metrorex va suplimenta numărul de trenuri pe magistralele M1 și M2 în intervalul orar al cursei.",
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ tech */
  {
    id: "ci-electronica",
    category: "tech",
    image: { scene: "tech", caption: "Cartea electronică de identitate", hue: 250 },
    versions: [
      {
        outlet: "techzona",
        title: "Două milioane de cărți electronice de identitate emise. Cum folosești cipul pentru autentificare online",
        author: "Radu Bălan",
        offsetMin: 480,
        quoteBy: "Cristina Ene",
        paragraphs: [
          "Numărul cărților electronice de identitate emise în România a depășit pragul de două milioane, potrivit datelor Ministerului Afacerilor Interne. Documentul conține un cip care permite autentificarea online în platformele statului.",
          "Pentru a folosi funcția de autentificare, titularul are nevoie de un telefon cu NFC și de aplicația oficială a ministerului, disponibilă pentru Android și iOS. Codul PIN se setează la ridicarea documentului.",
          "„Deja peste 400.000 de oameni și-au activat identitatea electronică și o folosesc lunar pentru plata taxelor sau pentru programări. Din anul viitor, tot mai multe servicii vor accepta doar această metodă de autentificare”, a declarat Cristina Ene, director în cadrul Ministerului Afacerilor Interne.",
          "Cartea electronică de identitate costă 70 de lei și are o valabilitate de 10 ani pentru persoanele cu vârsta între 25 și 55 de ani. Programările se fac online, pe platforma de servicii a ministerului.",
        ],
      },
    ],
  },
  {
    id: "startup-cluj-ai",
    category: "tech",
    image: { scene: "interior", caption: "Biroul din Cluj-Napoca al companiei Nexora", hue: 260 },
    versions: [
      {
        outlet: "techzona",
        title: "Start-up-ul clujean Nexora atrage 12 milioane de euro pentru platforma sa de AI pentru fabrici",
        author: "Radu Bălan",
        offsetMin: 850,
        quoteBy: "Andra Cozma",
        paragraphs: [
          "Nexora, un start-up din Cluj-Napoca care dezvoltă software de inteligență artificială pentru controlul calității în fabrici, a atras o finanțare de 12 milioane de euro într-o rundă de tip Series A.",
          "Runda a fost condusă de un fond de investiții din Europa de Nord, cu participarea a doi investitori din România. Compania are în prezent 64 de angajați și clienți în Germania, Polonia și Italia.",
          "Platforma analizează imagini de pe liniile de producție și detectează defectele în timp real, reducând numărul pieselor rebutate. Potrivit companiei, un client din industria auto și-a redus pierderile cu 18% în primele șase luni.",
          "„Vrem să rămânem o companie construită în România, dar cu clienți pe tot continentul. Banii merg în principal în echipa de cercetare și în deschiderea unui birou la München”, a declarat Andra Cozma, cofondatoare și CEO.",
          "Nexora plănuiește să ajungă la 120 de angajați până la finalul anului viitor.",
        ],
      },
      {
        outlet: "radareconomic",
        title: "Rundă de 12 mil. euro pentru Nexora, una dintre cele mai mari finanțări Series A din acest an",
        author: "Diana Voicu",
        offsetMin: 890,
        quoteBy: "Andra Cozma",
        paragraphs: [
          "Compania clujeană Nexora a anunțat închiderea unei runde de finanțare de 12 milioane de euro, una dintre cele mai mari tranzacții de tip Series A pentru un start-up românesc în acest an.",
          "Nexora a înregistrat anul trecut venituri de 2,9 milioane de euro, în creștere de trei ori față de anul precedent, potrivit datelor publicate de companie.",
          "„Vrem să rămânem o companie construită în România, dar cu clienți pe tot continentul. Banii merg în principal în echipa de cercetare și în deschiderea unui birou la München”, a spus Andra Cozma, CEO-ul companiei.",
          "Potrivit unui raport al industriei, start-up-urile românești au atras în primele nouă luni ale anului aproximativ 310 milioane de euro, cu aproape 20% mai mult decât în aceeași perioadă a anului trecut.",
        ],
      },
    ],
  },
  {
    id: "ancom-5g",
    category: "tech",
    image: { scene: "sky", caption: "Antenă de telefonie mobilă", hue: 270 },
    versions: [
      {
        outlet: "techzona",
        title: "ANCOM: rețelele 5G acoperă acum 60 de orașe, dar doar 38% din populație",
        author: "Oana Lazăr",
        offsetMin: 1440,
        quoteBy: "Emil Vasilescu",
        paragraphs: [
          "Rețelele 5G ale operatorilor de telefonie mobilă sunt disponibile în prezent în 60 de orașe din România, arată cel mai recent raport al ANCOM. Acoperirea la nivelul populației este însă de doar 38%.",
          "Potrivit raportului, viteza medie de descărcare în rețelele 5G a fost de 312 Mbps, de aproape patru ori mai mare decât în rețelele 4G. Numărul de cartele SIM active în rețelele 5G a ajuns la 3,4 milioane.",
          "„Diferențele între mediul urban și cel rural rămân mari. Obligațiile de acoperire asumate la licitație vor accelera extinderea în localitățile mici începând de anul viitor”, a declarat Emil Vasilescu, vicepreședinte al ANCOM.",
          "Utilizatorii pot verifica acoperirea reală în zona lor prin aplicația de măsurare a calității serviciilor pusă la dispoziție de autoritate.",
        ],
      },
    ],
  },
  {
    id: "atac-cibernetic-spitale",
    category: "tech",
    image: { scene: "tech", caption: "Server într-un centru de date", hue: 280 },
    versions: [
      {
        outlet: "techzona",
        title: "Atac ransomware asupra sistemului informatic al unor spitale. DNSC: datele pacienților, în analiză",
        author: "Oana Lazăr",
        offsetMin: 340,
        quoteBy: "Sebastian Oprea",
        paragraphs: [
          "Directoratul Național de Securitate Cibernetică a anunțat că investighează un atac de tip ransomware care a afectat un furnizor de software pentru gestiunea spitalelor. Sistemele a nouă unități sanitare au fost scoase temporar din funcțiune.",
          "Spitalele afectate lucrează de miercuri pe hârtie, pentru internări și eliberarea rețetelor, iar urgențele sunt preluate normal. Nu există, deocamdată, indicii că datele pacienților ar fi fost copiate.",
          "„Recomandăm tuturor unităților sanitare care folosesc aceeași platformă să deconecteze serverele de la internet până la aplicarea actualizărilor de securitate. Nu plătiți răscumpărarea”, a declarat Sebastian Oprea, director tehnic la DNSC.",
          "Furnizorul de software a transmis că lucrează împreună cu specialiștii DNSC pentru restaurarea sistemelor din copiile de siguranță. Estimarea pentru revenirea completă este de 48–72 de ore.",
          "Cazul a fost sesizat și autorităților de aplicare a legii.",
        ],
      },
      {
        outlet: "actualitateatv",
        title: "Nouă spitale lucrează pe hârtie după un atac informatic. Urgențele funcționează normal",
        author: "Ioana Marin",
        offsetMin: 310,
        quoteBy: "Sebastian Oprea",
        paragraphs: [
          "Nouă spitale din țară au fost nevoite să treacă la evidența pe hârtie după ce furnizorul lor de software a fost victima unui atac informatic de tip ransomware.",
          "Ministerul Sănătății a transmis că activitatea medicală continuă, iar serviciile de urgență nu sunt afectate. Pacienții programați pentru consultații ar putea înregistra întârzieri.",
          "„Recomandăm tuturor unităților sanitare care folosesc aceeași platformă să deconecteze serverele de la internet până la aplicarea actualizărilor de securitate. Nu plătiți răscumpărarea”, a spus Sebastian Oprea, directorul tehnic al DNSC.",
          "Specialiștii estimează că sistemele vor fi repuse în funcțiune în două-trei zile.",
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ auto */
  {
    id: "rabla-2026",
    category: "auto",
    image: { scene: "road", caption: "Stație de încărcare pentru mașini electrice", hue: 150 },
    versions: [
      {
        outlet: "radareconomic",
        title: "Rabla pentru persoane fizice se relansează în noiembrie: 5.000 de euro pentru o mașină electrică",
        author: "Paul Nistor",
        offsetMin: 1000,
        quoteBy: "Laurențiu Ghiță",
        paragraphs: [
          "Administrația Fondului pentru Mediu a anunțat relansarea programului Rabla pentru persoane fizice în luna noiembrie, cu un buget de 150 de milioane de lei. Tichetul pentru o mașină complet electrică va fi de 5.000 de euro.",
          "Pentru mașinile hibride plug-in, ecobonusul va fi de 2.500 de euro, iar pentru casarea unui autoturism mai vechi de 15 ani se acordă suplimentar 1.000 de euro. Prețul maxim al mașinii electrice eligibile va fi plafonat la 45.000 de euro.",
          "„Am redus sumele față de anii trecuți, pentru că vrem ca bugetul să ajungă la mai mulți oameni. Estimăm că vor beneficia aproximativ 6.000 de cumpărători”, a declarat Laurențiu Ghiță, președintele AFM.",
          "Înscrierile se vor face online, prin dealerii validați în program. Ghidul de finanțare urmează să fie publicat în dezbatere publică săptămâna viitoare.",
        ],
      },
      {
        outlet: "stiricarpatice",
        title: "Programul Rabla revine în noiembrie. Cât primești pentru o mașină electrică sau hibridă",
        author: "Andreea Stoica",
        offsetMin: 1040,
        quoteBy: "Laurențiu Ghiță",
        paragraphs: [
          "Românii care vor să-și cumpere o mașină electrică vor putea primi din noiembrie un ecobonus de 5.000 de euro, prin programul Rabla, a anunțat Administrația Fondului pentru Mediu.",
          "Pentru un autoturism hibrid plug-in, sprijinul va fi de 2.500 de euro. La acestea se adaugă 1.000 de euro dacă cumpărătorul predă la casare o mașină mai veche de 15 ani.",
          "Bugetul programului este de 150 de milioane de lei. „Am redus sumele față de anii trecuți, pentru că vrem ca bugetul să ajungă la mai mulți oameni. Estimăm că vor beneficia aproximativ 6.000 de cumpărători”, a explicat Laurențiu Ghiță, președintele AFM.",
          "O noutate este plafonarea prețului: mașinile electrice mai scumpe de 45.000 de euro nu vor fi eligibile.",
          "Dosarele se depun prin dealeri, iar AFM spune că plățile vor fi făcute în cel mult 60 de zile de la validare.",
        ],
      },
    ],
  },
  {
    id: "a7-tronson-nou",
    category: "auto",
    image: { scene: "road", caption: "Tronsonul nou al Autostrăzii Moldovei, la inaugurare", hue: 55 },
    versions: [
      {
        outlet: "infoest",
        title: "A7: încă 26 de kilometri de autostradă deschiși circulației între Bacău și Săbăoani",
        author: "Tudor Apostol",
        offsetMin: 1150,
        quoteBy: "Nicoleta Pîrvu",
        paragraphs: [
          "Șoferii pot circula de sâmbătă pe un nou tronson de 26 de kilometri al Autostrăzii Moldovei, între Bacău și Săbăoani, a anunțat Compania Națională de Administrare a Infrastructurii Rutiere.",
          "Odată cu deschiderea acestui tronson, distanța dintre Ploiești și Săbăoani poate fi parcursă integral pe autostradă, pe aproape 300 de kilometri. Timpul de călătorie între București și Roman scade la aproximativ patru ore.",
          "„Constructorul a terminat lucrările cu trei luni înainte de termen. Pe acest tronson avem două noduri rutiere, 21 de poduri și o parcare de scurtă durată”, a declarat Nicoleta Pîrvu, directoare regională în cadrul CNAIR.",
          "Viteza maximă admisă va fi temporar de 100 de kilometri pe oră, până la finalizarea marcajelor definitive.",
        ],
      },
    ],
  },
  {
    id: "inmatriculari-electrice",
    category: "auto",
    image: { scene: "road", caption: "Mașini electrice într-o parcare din Cluj-Napoca", hue: 175 },
    versions: [
      {
        outlet: "techzona",
        title: "Înmatriculările de mașini electrice au crescut cu 31% în primele opt luni. Ce modele s-au vândut cel mai bine",
        author: "Radu Bălan",
        offsetMin: 1700,
        quoteBy: "Valentin Cojocaru",
        paragraphs: [
          "În primele opt luni ale anului au fost înmatriculate în România 14.200 de autoturisme complet electrice noi, cu 31% mai multe decât în aceeași perioadă a anului trecut, potrivit datelor DRPCIV.",
          "Mașinile electrice reprezintă acum 12% din totalul autoturismelor noi înmatriculate. Cele mai vândute au fost modelele compacte din segmentul de preț 25.000–35.000 de euro, inclusiv mai multe mărci chinezești nou intrate pe piață.",
          "„Creșterea vine mai ales din partea firmelor, care au flote tot mai mari de mașini electrice. Persoanele fizice așteaptă în continuare relansarea programului Rabla”, a explicat Valentin Cojocaru, analist al pieței auto.",
          "Numărul stațiilor publice de încărcare a ajuns la aproximativ 5.300, dintre care 900 sunt stații rapide, amplasate în principal pe autostrăzi și în marile orașe.",
        ],
      },
    ],
  },
];
