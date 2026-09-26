import type { Story } from "./content";

/* Lifestyle, sănătate, cultură, monden + știrile „de ultimă oră” injectate live. Persoanele sunt fictive. */
export const STORIES_D: Story[] = [
  {
    id: "maramures-turism-toamna",
    category: "lifestyle",
    image: { scene: "mountain", caption: "Dealurile din Țara Maramureșului, toamna", hue: 28 },
    versions: [
      {
        outlet: "stiricarpatice",
        title: "Weekend de toamnă în Maramureș: trasee, sate și ce să guști în sezonul recoltelor",
        author: "Ilinca Bârsan",
        offsetMin: 1260,
        quoteBy: "Maria Hotea",
        paragraphs: [
          "Toamna este una dintre cele mai frumoase perioade pentru a vizita Maramureșul. Pădurile de fag de pe Valea Izei își schimbă culoarea la începutul lui octombrie, iar în sate au loc târguri tradiționale și sărbători ale recoltei.",
          "Pentru un weekend, localnicii recomandă traseul Sighetu Marmației – Bârsana – Rozavlea – Ieud, cu opriri la bisericile de lemn și la atelierele meșterilor. Drumul are aproximativ 60 de kilometri și poate fi parcurs într-o zi.",
          "„Oamenii vin pentru biserici, dar rămân pentru mâncare și pentru poveștile gazdelor. Toamna facem țuică, pâine în cuptor și balmoș, iar turiștii pot participa la fiecare dintre ele”, spune Maria Hotea, care administrează o pensiune în Botiza.",
          "O noapte de cazare într-o pensiune tradițională costă între 250 și 400 de lei pentru două persoane, cu micul dejun inclus. Pensiunile din zonă spun că weekendurile din octombrie sunt deja rezervate în proporție de peste 70%.",
          "Cei care preferă drumețiile pot urca în Munții Rodnei, pe traseul spre Vârful Pietrosul, însă doar pe vreme bună și cu echipament adecvat, pentru că temperaturile scad sub zero noaptea.",
        ],
      },
    ],
  },
  {
    id: "vacante-iarna-early-booking",
    category: "lifestyle",
    image: { scene: "mountain", caption: "Pârtie de schi în Poiana Brașov", hue: 205 },
    versions: [
      {
        outlet: "infoest",
        title: "Vacanțele de iarnă se scumpesc cu până la 12%. Reducerile de early booking expiră la sfârșitul lui octombrie",
        author: "Mihaela Rusu",
        offsetMin: 1560,
        quoteBy: "Daniela Radu",
        paragraphs: [
          "Pachetele pentru vacanțele de iarnă din stațiunile montane românești sunt cu 8–12% mai scumpe decât anul trecut, potrivit agențiilor de turism. Reducerile de înscriere timpurie, de până la 20%, sunt valabile până la 31 octombrie.",
          "Un sejur de cinci nopți în Poiana Brașov, cu demipensiune, costă în medie 3.600 de lei de persoană în perioada sărbătorilor. În Sinaia și Predeal, prețurile sunt cu aproximativ 15% mai mici.",
          "„Vedem o cerere foarte bună pentru Revelion, dar și o creștere a interesului pentru stațiunile din Austria și Italia, unde diferența de preț față de România s-a redus”, a explicat Daniela Radu, reprezentantă a unei agenții de turism din Iași.",
          "Pentru turiștii din Moldova, Vatra Dornei rămâne o alternativă mai accesibilă, cu pachete de la 1.900 de lei de persoană pentru cinci nopți.",
        ],
      },
      {
        outlet: "jurnaluldevest",
        title: "Cât costă Revelionul la munte anul acesta: prețuri de la 1.900 la peste 3.600 de lei de persoană",
        author: "Vlad Mureșan",
        offsetMin: 1600,
        quoteBy: "Daniela Radu",
        paragraphs: [
          "Românii care vor să petreacă sărbătorile de iarnă la munte trebuie să plătească anul acesta cu până la 12% mai mult decât în urmă cu un an, arată ofertele agențiilor de turism.",
          "Cele mai scumpe rămân stațiunile de pe Valea Prahovei și Poiana Brașov, unde un pachet de cinci nopți ajunge în medie la 3.600 de lei de persoană. Pentru turiștii din vest, Stâna de Vale și Muntele Mic sunt variante mai ieftine, cu prețuri de la 2.100 de lei.",
          "„Vedem o cerere foarte bună pentru Revelion, dar și o creștere a interesului pentru stațiunile din Austria și Italia, unde diferența de preț față de România s-a redus”, a declarat Daniela Radu, agent de turism.",
          "Agențiile recomandă rezervarea până la finalul lui octombrie, când expiră reducerile de early booking, de până la 20%.",
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ sănătate */
  {
    id: "vaccinare-antigripala",
    category: "sanatate",
    image: { scene: "interior", caption: "Cabinet de medicină de familie", hue: 185 },
    versions: [
      {
        outlet: "cotidianulnational",
        title: "Campania de vaccinare antigripală începe luni. Vaccinul este gratuit pentru 3,2 milioane de persoane din grupele de risc",
        author: "Raluca Tănase",
        offsetMin: 400,
        quoteBy: "Gheorghe Matei",
        paragraphs: [
          "Campania națională de vaccinare antigripală începe luni, 29 septembrie, a anunțat Ministerul Sănătății. Primele 1,5 milioane de doze au fost deja distribuite către direcțiile de sănătate publică județene.",
          "Vaccinul este gratuit pentru persoanele cu vârsta de peste 65 de ani, pentru bolnavii cronici, femeile însărcinate, personalul medical și rezidenții din centrele sociale. În total, ministerul estimează 3,2 milioane de beneficiari.",
          "„Perioada optimă pentru vaccinare este octombrie–noiembrie, înainte de începutul sezonului gripal. Imunitatea se instalează în aproximativ două săptămâni”, a explicat dr. Gheorghe Matei, medic infecționist.",
          "Vaccinul se administrează la medicul de familie, pe baza unei programări. Persoanele care nu fac parte din grupele de risc îl pot cumpăra din farmacii, la un preț de aproximativ 60 de lei, iar în unele farmacii îl pot face pe loc.",
        ],
      },
      {
        outlet: "actualitateatv",
        title: "Gripa: de luni, vaccinul poate fi făcut gratuit la medicul de familie. Cine are dreptul",
        author: "Radu Ciobanu",
        offsetMin: 430,
        quoteBy: "Gheorghe Matei",
        paragraphs: [
          "De luni, persoanele din grupele de risc se pot vaccina gratuit împotriva gripei la medicul de familie. Ministerul Sănătății a distribuit deja primele 1,5 milioane de doze.",
          "Vaccinul este gratuit pentru vârstnicii de peste 65 de ani, bolnavii cronici, gravide și personalul medical. Ceilalți îl pot cumpăra din farmacie, cu aproximativ 60 de lei.",
          "„Perioada optimă pentru vaccinare este octombrie–noiembrie, înainte de începutul sezonului gripal. Imunitatea se instalează în aproximativ două săptămâni”, a spus medicul infecționist Gheorghe Matei.",
          "Anul trecut, în România au fost raportate peste 9.000 de cazuri de gripă confirmate, iar medicii spun că numărul real este mult mai mare.",
        ],
      },
      {
        outlet: "infoest",
        title: "Iași: medicii de familie au primit primele doze de vaccin antigripal",
        author: "Tudor Apostol",
        offsetMin: 470,
        quoteBy: "Gheorghe Matei",
        paragraphs: [
          "Direcția de Sănătate Publică Iași a primit 38.000 de doze de vaccin antigripal, care vor fi distribuite în această săptămână către medicii de familie din județ. Campania națională începe luni.",
          "Reprezentanții DSP Iași spun că anul trecut rata de vaccinare în rândul vârstnicilor din județ a fost de doar 23%, sub media națională.",
          "„Perioada optimă pentru vaccinare este octombrie–noiembrie, înainte de începutul sezonului gripal. Imunitatea se instalează în aproximativ două săptămâni”, a precizat dr. Gheorghe Matei, medic infecționist.",
          "Persoanele cu vârsta peste 65 de ani, bolnavii cronici, gravidele și personalul medical se pot vaccina gratuit, pe bază de programare. Ceilalți pacienți pot cumpăra vaccinul din farmacii.",
        ],
      },
    ],
  },
  {
    id: "spital-regional-cluj",
    category: "sanatate",
    image: { scene: "city", caption: "Șantierul Spitalului Regional de Urgență Cluj", hue: 70 },
    versions: [
      {
        outlet: "jurnaluldevest",
        title: "Spitalul Regional de Urgență Cluj: contractul de execuție a fost semnat, lucrările încep în noiembrie",
        author: "Vlad Mureșan",
        offsetMin: 1080,
        quoteBy: "Liviu Hossu",
        paragraphs: [
          "Ministerul Sănătății a semnat contractul de proiectare și execuție pentru Spitalul Regional de Urgență Cluj, cea mai mare investiție în infrastructura medicală din nord-vestul țării. Valoarea contractului este de aproximativ 2,4 miliarde de lei.",
          "Spitalul va avea 850 de paturi, 24 de săli de operație și un heliport și va deservi aproximativ 2,7 milioane de locuitori din șase județe.",
          "„Este un proiect pe care clujenii îl așteaptă de 15 ani. Constructorul are la dispoziție 48 de luni, iar noi vom publica lunar stadiul lucrărilor”, a declarat Liviu Hossu, managerul unității de implementare a proiectului.",
          "Finanțarea este asigurată din fonduri europene și de la bugetul de stat. Terenul, situat în zona de nord a orașului, a fost deja predat constructorului.",
        ],
      },
      {
        outlet: "stiricarpatice",
        title: "Cluj: 850 de paturi, 24 de săli de operație. S-a semnat contractul pentru noul spital regional",
        author: "Ilinca Bârsan",
        offsetMin: 1120,
        quoteBy: "Liviu Hossu",
        paragraphs: [
          "După mai multe amânări, contractul pentru construirea Spitalului Regional de Urgență din Cluj a fost semnat. Lucrările ar urma să înceapă în noiembrie și să dureze patru ani.",
          "Noul spital va avea 850 de paturi, 24 de săli de operație și heliport propriu. Investiția totală este estimată la 2,4 miliarde de lei.",
          "„Este un proiect pe care clujenii îl așteaptă de 15 ani. Constructorul are la dispoziție 48 de luni, iar noi vom publica lunar stadiul lucrărilor”, a spus Liviu Hossu, manager de proiect.",
          "Spitalul regional va prelua cazurile grave din județele Cluj, Bihor, Sălaj, Satu Mare, Maramureș și Bistrița-Năsăud.",
        ],
      },
    ],
  },
  {
    id: "studiu-sare-insp",
    category: "sanatate",
    image: { scene: "interior", caption: "Masă de prânz într-o cantină școlară", hue: 45 },
    versions: [
      {
        outlet: "infoest",
        title: "Românii consumă aproape dublu față de cantitatea de sare recomandată, arată un studiu INSP",
        author: "Mihaela Rusu",
        offsetMin: 1780,
        quoteBy: "Corina Andrei",
        paragraphs: [
          "Un adult din România consumă, în medie, 9,6 grame de sare pe zi, aproape dublu față de limita de 5 grame recomandată de Organizația Mondială a Sănătății, arată un studiu al Institutului Național de Sănătate Publică.",
          "Cercetarea a inclus 2.400 de persoane din 16 județe. Cele mai mari cantități provin din pâine, mezeluri, brânzeturi și mâncarea gătită în afara casei.",
          "„Nu sarea pe care o punem în farfurie este problema principală, ci sarea ascunsă în produsele procesate. O felie de pâine poate avea aproape o jumătate de gram”, a explicat dr. Corina Andrei, coordonatoarea studiului.",
          "Specialiștii recomandă citirea etichetelor și alegerea produselor cu conținut redus de sare. Hipertensiunea arterială afectează aproximativ 45% dintre adulții din România.",
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ cultură */
  {
    id: "mnar-expozitie",
    category: "cultura",
    image: { scene: "interior", caption: "Sala de expoziție a Muzeului Național de Artă", hue: 30 },
    versions: [
      {
        outlet: "magazincultural",
        title: "„Lumina Sudului”: 140 de lucrări ale pictorilor români de la începutul secolului XX, expuse la MNAR",
        author: "Irina Coman",
        offsetMin: 560,
        quoteBy: "Ana-Maria Dinu",
        paragraphs: [
          "Muzeul Național de Artă al României deschide joi expoziția „Lumina Sudului”, care reunește 140 de picturi și desene realizate de artiști români între 1900 și 1940, în timpul călătoriilor lor în Balcic, Italia și Grecia.",
          "Lucrările provin din colecția muzeului, dar și de la muzee județene și din colecții private, iar aproximativ o treime dintre ele nu au mai fost expuse publicului în ultimii 50 de ani.",
          "„Ne-am întrebat ce anume căutau pictorii români în sud. Răspunsul nu este doar lumina, ci și o anumită libertate a privirii pe care o regăsim apoi în operele lor de acasă”, a declarat Ana-Maria Dinu, curatoarea expoziției.",
          "Expoziția poate fi vizitată până pe 1 martie, de miercuri până duminică. Biletul costă 30 de lei, iar în prima miercuri a fiecărei luni accesul este gratuit.",
          "Muzeul organizează și tururi ghidate în limba română și engleză, în weekend, precum și ateliere pentru copii.",
        ],
      },
      {
        outlet: "cotidianulnational",
        title: "Expoziție nouă la Muzeul Național de Artă: pictori români pe drumurile sudului",
        author: "Raluca Tănase",
        offsetMin: 610,
        quoteBy: "Ana-Maria Dinu",
        paragraphs: [
          "O expoziție dedicată călătoriilor pictorilor români în sudul Europei se deschide joi la Muzeul Național de Artă al României. Sunt expuse 140 de lucrări din perioada 1900–1940.",
          "Aproximativ o treime dintre picturi provin din colecții private și din muzee din țară și nu au mai fost văzute de public de o jumătate de secol.",
          "„Ne-am întrebat ce anume căutau pictorii români în sud. Răspunsul nu este doar lumina, ci și o anumită libertate a privirii pe care o regăsim apoi în operele lor de acasă”, a explicat curatoarea Ana-Maria Dinu.",
          "Expoziția rămâne deschisă până la 1 martie. Prețul biletului este de 30 de lei.",
        ],
      },
    ],
  },
  {
    id: "targ-carte-toamna",
    category: "cultura",
    image: { scene: "crowd", caption: "Vizitatori la standurile unui târg de carte", hue: 15 },
    versions: [
      {
        outlet: "magazincultural",
        title: "Târgul de carte de toamnă de la Romexpo: 220 de edituri și peste 600 de lansări în cinci zile",
        author: "Tudor Gavrilă",
        offsetMin: 1400,
        quoteBy: "Simona Pătrașcu",
        paragraphs: [
          "Peste 220 de edituri din România și din Republica Moldova participă la târgul de carte de toamnă, care se deschide miercuri în pavilionul central Romexpo din București și durează cinci zile.",
          "Programul include peste 600 de lansări, dezbateri și sesiuni de autografe, precum și o secțiune dedicată cărților pentru copii și adolescenți, cu ateliere de lectură în fiecare dimineață.",
          "„Anul acesta am mărit spațiul pentru edituri mici și independente, care au de multe ori cele mai interesante apariții, dar nu își permit standuri mari”, a declarat Simona Pătrașcu, directoarea târgului.",
          "Accesul costă 15 lei pe zi, iar elevii, studenții și pensionarii intră gratuit. Organizatorii estimează peste 120.000 de vizitatori.",
        ],
      },
      {
        outlet: "stiricarpatice",
        title: "Târg de carte la București: program, prețuri și cum ajungi la Romexpo",
        author: "Ilinca Bârsan",
        offsetMin: 1430,
        quoteBy: "Simona Pătrașcu",
        paragraphs: [
          "Târgul de carte de toamnă își deschide porțile miercuri, la Romexpo, cu peste 220 de edituri și un program de peste 600 de evenimente.",
          "Biletul de intrare costă 15 lei, iar accesul este gratuit pentru elevi, studenți și pensionari. Târgul este deschis zilnic între orele 10:00 și 20:00.",
          "„Anul acesta am mărit spațiul pentru edituri mici și independente, care au de multe ori cele mai interesante apariții, dar nu își permit standuri mari”, a spus directoarea evenimentului, Simona Pătrașcu.",
          "Organizatorii recomandă folosirea transportului public: liniile de autobuz care opresc la Piața Presei Libere și stația de metrou Aurel Vlaicu sunt cele mai apropiate.",
        ],
      },
    ],
  },
  {
    id: "biserica-lemn-restaurare",
    category: "cultura",
    image: { scene: "landscape", caption: "Biserica de lemn din Maramureș, în timpul restaurării", hue: 35 },
    versions: [
      {
        outlet: "magazincultural",
        title: "Pictura murală a unei biserici de lemn din Maramureș, salvată după trei ani de restaurare",
        author: "Irina Coman",
        offsetMin: 1680,
        quoteBy: "Gavril Pop",
        paragraphs: [
          "O echipă de restauratori a finalizat lucrările la pictura murală a unei biserici de lemn din secolul al XVIII-lea din Maramureș, după trei ani de muncă. Proiectul a costat 1,9 milioane de lei, finanțați din fonduri europene și de Ministerul Culturii.",
          "Pictura, realizată de un zugrav local în 1782, era afectată de umezeală și de fumul lumânărilor. Restauratorii au consolidat peste 180 de metri pătrați de suprafață pictată și au descoperit o inscripție care nu era cunoscută.",
          "„Am lucrat centimetru cu centimetru, cu bisturiul și cu tampoane de vată. Inscripția descoperită pe peretele de nord ne ajută să datăm mai precis întreaga pictură”, a explicat Gavril Pop, restaurator-șef al proiectului.",
          "Biserica va fi redeschisă pentru credincioși și vizitatori la sfârșitul lunii octombrie. Accesul va fi limitat la grupuri mici, pentru a proteja pictura.",
        ],
      },
    ],
  },
  {
    id: "filarmonica-stagiune",
    category: "cultura",
    image: { scene: "stage", caption: "Sala de concerte a Filarmonicii din Timișoara", hue: 40 },
    versions: [
      {
        outlet: "jurnaluldevest",
        title: "Filarmonica Banatul deschide stagiunea cu un concert dedicat lui Enescu și o premieră absolută",
        author: "Sorina Balint",
        offsetMin: 1500,
        quoteBy: "Radu Petrescu",
        paragraphs: [
          "Filarmonica Banatul din Timișoara își deschide vineri noua stagiune cu un program care include Rapsodia română nr. 1 de George Enescu și prima audiție absolută a unei lucrări semnate de un tânăr compozitor timișorean.",
          "Stagiunea cuprinde 38 de concerte simfonice, 12 concerte camerale și un ciclu dedicat muzicii de film. Pentru prima dată, șase concerte vor fi transmise live online, gratuit.",
          "„Vrem să aducem în sală un public nou, fără să renunțăm la repertoriul clasic. Tinerii vin la concerte dacă le oferim și lucrări care vorbesc despre lumea lor”, a spus dirijorul Radu Petrescu, directorul artistic al filarmonicii.",
          "Abonamentele pentru întreaga stagiune costă între 350 și 600 de lei, iar biletele individuale pot fi cumpărate online sau de la casieria filarmonicii.",
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ monden */
  {
    id: "prezentatoare-nunta",
    category: "monden",
    image: { scene: "landscape", caption: "Grădina conacului în care a avut loc petrecerea", hue: 330 },
    versions: [
      {
        outlet: "mondenplus",
        title: "Prezentatoarea Andreea Vlad s-a căsătorit în secret, într-un conac de lângă Sibiu",
        author: "Delia Florea",
        offsetMin: 90,
        quoteBy: "Andreea Vlad",
        paragraphs: [
          "Prezentatoarea de televiziune Andreea Vlad s-a căsătorit sâmbătă cu partenerul ei, arhitectul Matei Iordache, într-o ceremonie restrânsă organizată într-un conac din apropierea Sibiului.",
          "La eveniment au participat doar aproximativ 60 de invitați, familia și prietenii apropiați. Mireasa a purtat o rochie simplă, realizată de o designeriță din Cluj, iar meniul a fost pregătit cu produse de la fermele din zonă.",
          "„Ne-am dorit o zi liniștită, fără presiune, alături de oamenii care contează cu adevărat pentru noi. A fost exact cum ne-am imaginat”, a scris Andreea Vlad pe rețelele sociale, unde a publicat câteva fotografii de la eveniment.",
          "Cei doi sunt împreună de patru ani. Prezentatoarea revine la pupitrul emisiunii sale de dimineață după o scurtă vacanță.",
        ],
      },
      {
        outlet: "actualitateatv",
        title: "Nuntă discretă pentru Andreea Vlad: prezentatoarea și-a unit destinul cu arhitectul Matei Iordache",
        author: "Ioana Marin",
        offsetMin: 125,
        quoteBy: "Andreea Vlad",
        paragraphs: [
          "Andreea Vlad a devenit soția arhitectului Matei Iordache, în cadrul unei ceremonii private care a avut loc în weekend, lângă Sibiu.",
          "Vestea a fost dată chiar de prezentatoare, care a publicat pe rețelele sociale mai multe imagini de la eveniment. Cei doi au ales o petrecere cu aproximativ 60 de invitați.",
          "„Ne-am dorit o zi liniștită, fără presiune, alături de oamenii care contează cu adevărat pentru noi. A fost exact cum ne-am imaginat”, a transmis Andreea Vlad.",
          "Colegii din redacție i-au transmis felicitări în direct, la finalul emisiunii de duminică.",
        ],
      },
    ],
  },
  {
    id: "album-concert-sala-palatului",
    category: "monden",
    image: { scene: "stage", caption: "Scena Sălii Palatului, înaintea unui concert", hue: 290 },
    versions: [
      {
        outlet: "mondenplus",
        title: "Cântărețul Victor Sălăjan lansează un album nou și anunță un concert la Sala Palatului",
        author: "Delia Florea",
        offsetMin: 980,
        quoteBy: "Victor Sălăjan",
        paragraphs: [
          "Cântărețul Victor Sălăjan a lansat vineri „Drumuri de întors”, al cincilea album din carieră, care cuprinde 11 piese compuse în ultimii doi ani. Albumul este disponibil pe platformele de streaming și în ediție pe vinil.",
          "Artistul a anunțat totodată un concert aniversar la Sala Palatului, pe 14 decembrie, la 15 ani de la debutul său. Biletele au fost puse în vânzare la prețuri între 120 și 450 de lei.",
          "„Este cel mai personal disc pe care l-am făcut. Multe dintre piese au fost scrise noaptea, în bucătărie, după ce se culcau copiii”, a povestit Victor Sălăjan într-un interviu radio.",
          "Pe album apar și două duete, cu o cântăreață din Republica Moldova și cu un grup de muzică tradițională din Bucovina.",
        ],
      },
    ],
  },
  {
    id: "gala-premiilor-media",
    category: "monden",
    image: { scene: "stage", caption: "Covorul roșu de la gala premiilor", hue: 345 },
    versions: [
      {
        outlet: "mondenplus",
        title: "Ținutele serii la Gala Premiilor Media: cine a strălucit pe covorul roșu",
        author: "Bianca Gheorghiu",
        offsetMin: 1720,
        quoteBy: "Elisa Marinescu",
        paragraphs: [
          "Gala Premiilor Media a adus sâmbătă seară, la Ateneul Român, aproape 400 de invitați: jurnaliști, prezentatori, actori și oameni de cultură. Covorul roșu a fost dominat de nuanțele de verde smarald și de croielile minimaliste.",
          "Actrița Elisa Marinescu, care a prezentat gala, a purtat o rochie din catifea neagră semnată de un designer român, iar prezentatorul Tudor Anghel a ales un costum bleumarin cu papion clasic.",
          "„Mi-am dorit o ținută care să nu fure atenția de la premiați. În seara asta, vedetele au fost jurnaliștii din regiuni, care fac o muncă imensă cu resurse puține”, a spus Elisa Marinescu.",
          "Marele premiu al serii a fost acordat unei echipe de reporteri de la un post de radio regional, pentru o serie despre școlile din satele izolate.",
        ],
      },
      {
        outlet: "magazincultural",
        title: "Gala Premiilor Media: jurnaliștii din regiuni, marii câștigători ai serii",
        author: "Tudor Gavrilă",
        offsetMin: 1760,
        quoteBy: "Elisa Marinescu",
        paragraphs: [
          "O echipă de reporteri a unui post de radio regional a câștigat marele premiu la Gala Premiilor Media, desfășurată sâmbătă la Ateneul Român. Serialul lor, despre școlile din satele greu accesibile, a fost difuzat pe parcursul a șase luni.",
          "Juriul a acordat în total 14 premii, la categorii precum investigație, reportaj video, podcast și fotojurnalism. La categoria debut a fost premiată o jurnalistă de 24 de ani din Craiova.",
          "„Mi-am dorit o ținută care să nu fure atenția de la premiați. În seara asta, vedetele au fost jurnaliștii din regiuni, care fac o muncă imensă cu resurse puține”, a declarat actrița Elisa Marinescu, gazda serii.",
          "Gala a reunit aproximativ 400 de invitați. Organizatorii au anunțat că de anul viitor va fi introdusă și o categorie dedicată jurnalismului local de date.",
        ],
      },
    ],
  },
];

/**
 * Știri „de ultimă oră” injectate prin /_control/add-breaking (câte una la fiecare apel,
 * în fluxurile a două publicații). offsetMin este ignorat: data publicării = momentul injectării.
 */
export const BREAKING_STORIES: Story[] = [
  {
    id: "cutremur-vrancea",
    category: "national",
    image: { scene: "night", caption: "Harta epicentrului, publicată de INFP", hue: 10 },
    versions: [
      {
        outlet: "actualitateatv",
        title: "ULTIMA ORĂ Cutremur de magnitudine 4,8 în zona Vrancea, resimțit în București și Brașov",
        author: "Cristian Popa",
        offsetMin: 0,
        quoteBy: "Mircea Tănase",
        paragraphs: [
          "Un cutremur cu magnitudinea 4,8 pe scara Richter s-a produs în zona seismică Vrancea, județul Buzău, la o adâncime de 132 de kilometri, anunță Institutul Național pentru Fizica Pământului.",
          "Seismul a fost resimțit în mai multe orașe, inclusiv în București, Brașov, Focșani și Buzău. Până în acest moment nu au fost raportate victime sau pagube materiale.",
          "„Este un cutremur obișnuit pentru zona Vrancea, care produce anual câteva seisme de această magnitudine. Nu există motive de îngrijorare”, a declarat Mircea Tănase, seismolog la INFP.",
          "Inspectoratul General pentru Situații de Urgență monitorizează situația. Revenim cu detalii.",
        ],
      },
      {
        outlet: "stiricarpatice",
        title: "Seism de 4,8 în Vrancea. INFP: nu au fost semnalate pagube",
        author: "Andreea Stoica",
        offsetMin: 0,
        quoteBy: "Mircea Tănase",
        paragraphs: [
          "Un cutremur de magnitudine 4,8 a avut loc în urmă cu puțin timp în zona Vrancea, la 132 de kilometri adâncime, potrivit datelor preliminare ale INFP.",
          "Mai mulți cititori ne-au semnalat că seismul a fost resimțit în Capitală, în special la etajele superioare ale blocurilor.",
          "„Este un cutremur obișnuit pentru zona Vrancea, care produce anual câteva seisme de această magnitudine. Nu există motive de îngrijorare”, a spus seismologul Mircea Tănase.",
          "Autoritățile nu au primit, deocamdată, apeluri privind pagube sau persoane rănite. Știre în curs de actualizare.",
        ],
      },
    ],
  },
  {
    id: "incendiu-depozit-chitila",
    category: "national",
    sensitive: false,
    image: { scene: "sky", caption: "Nor de fum deasupra zonei industriale", hue: 20 },
    versions: [
      {
        outlet: "cotidianulnational",
        title: "ULTIMA ORĂ Incendiu puternic la un depozit de mobilă din Chitila. Mesaj RO-Alert pentru locuitori",
        author: "Laura Dima",
        offsetMin: 0,
        quoteBy: "Daniel Oprișan",
        paragraphs: [
          "Un incendiu de proporții a izbucnit la un depozit de mobilă din orașul Chitila, județul Ilfov. Flăcările s-au extins pe o suprafață de aproximativ 2.000 de metri pătrați.",
          "La fața locului intervin 14 autospeciale de stingere. Autoritățile au emis un mesaj RO-Alert pentru locuitorii din zonă, cărora li se recomandă să țină ferestrele închise din cauza fumului.",
          "„Nu sunt persoane surprinse în clădire. Toți angajații s-au autoevacuat. Intervenția va dura mai multe ore”, a declarat Daniel Oprișan, purtător de cuvânt al ISU București-Ilfov.",
          "Știre în curs de actualizare.",
        ],
      },
      {
        outlet: "actualitateatv",
        title: "Nor de fum deasupra Chitilei după ce un depozit a luat foc. ISU: toți angajații s-au autoevacuat",
        author: "Radu Ciobanu",
        offsetMin: 0,
        quoteBy: "Daniel Oprișan",
        paragraphs: [
          "Un depozit de mobilă din Chitila a fost cuprins de flăcări, iar fumul dens se vede din mai multe cartiere din nord-vestul Capitalei.",
          "Pompierii au trimis 14 autospeciale. Incendiul afectează aproximativ 2.000 de metri pătrați din hală.",
          "„Nu sunt persoane surprinse în clădire. Toți angajații s-au autoevacuat. Intervenția va dura mai multe ore”, a transmis Daniel Oprișan, de la ISU București-Ilfov.",
          "Locuitorii din zonă au primit mesaj RO-Alert. Revenim cu informații.",
        ],
      },
    ],
  },
  {
    id: "handbal-feminin-calificare",
    category: "sport",
    image: { scene: "stadium", caption: "Sala de handbal, la finalul meciului", hue: 0 },
    versions: [
      {
        outlet: "sporttotal",
        title: "ULTIMA ORĂ România s-a calificat la Campionatul European de handbal feminin!",
        author: "Marius Oprea",
        offsetMin: 0,
        quoteBy: "Carmen Olaru",
        paragraphs: [
          "Naționala feminină de handbal a României s-a calificat la Campionatul European, după o victorie cu 29-26 în ultimul meci al grupei preliminare.",
          "Tricolorele au condus aproape tot meciul, iar portarul Bianca Rusu a avut 16 intervenții decisive.",
          "„Am jucat cu inima. Fetele au meritat această calificare după o campanie foarte grea, cu multe accidentări”, a declarat selecționera Carmen Olaru.",
          "Turneul final va avea loc în decembrie.",
        ],
      },
      {
        outlet: "stiricarpatice",
        title: "Handbal: naționala feminină merge la Euro după 29-26 în meciul decisiv",
        author: "Gabriel Stan",
        offsetMin: 0,
        quoteBy: "Carmen Olaru",
        paragraphs: [
          "Echipa națională de handbal feminin a obținut calificarea la turneul final al Campionatului European, după ce a câștigat cu 29-26 meciul decisiv din grupă.",
          "Portarul Bianca Rusu a fost desemnată jucătoarea meciului, cu 16 parade.",
          "„Am jucat cu inima. Fetele au meritat această calificare după o campanie foarte grea, cu multe accidentări”, a spus Carmen Olaru, selecționera echipei.",
          "Campionatul European se desfășoară în luna decembrie.",
        ],
      },
    ],
  },
];
