# Median — planul de refacere

Planul se bazează pe research făcut cu 8 agenți paraleli: design editorial, media24.ro și anunțul de pe OLX,
agregatoare similare, sistem automat de imagini, cadrul legal (RO/UE), SEO și calitatea AI, arhitectură și hosting,
extragerea textului complet.

---

## 1. Ce am aflat și de ce contează

| Constatare | Consecință pentru Median |
|---|---|
| **Operațiunea Jupiter (27 apr. 2026):** 185 de percheziții la rețele de site-uri care republicau automat știri din RSS, fără atribuire corectă. | Nu avem voie să fim „oglindă RSS”. Fiecare articol complet trebuie să fie o **sinteză originală**, cu surse vizibile. |
| **Legea 8/1996, modificată de Legea 69/2022 (dreptul editorilor de presă):** faptele sunt libere, formularea nu. Se pot prelua **maximum ~120 de caractere** din textul unei publicații. | Claude extrage doar **faptele** și scrie cu propriile cuvinte. Citate exacte se folosesc doar pentru declarațiile persoanelor, cu atribuire. Un filtru automat blochează textele copiate. |
| **Agerpres** este agenție cu abonament plătit. **HotNews** interzice reutilizarea comercială a conținutului. | Agerpres iese din lista de surse până există un contract. HotNews rămâne sursă de **fapte și link**, nu de text preluat. |
| **Fotografiile surselor** sunt protejate, iar agențiile foto (Inquam, AFP, EPA) chiar dau în judecată. | Poza principală a unui articol Median **nu** vine de la publicații. Vine din surse cu licență liberă (Wikimedia Commons, Unsplash, Pexels) sau dintr-o copertă generată de noi. Pozele publicațiilor apar doar ca miniaturi mici, cu credit, lângă link. |
| **AI Act, art. 50 (în vigoare din 2 aug. 2026):** textele generate cu AI despre subiecte de interes public trebuie etichetate. | Fiecare articol afișează vizibil „Redactat cu AI pe baza surselor…” și trimite la o pagină „Politica AI”. |
| **Google:** „scaled content abuse” penalizează rescrierile în masă ale unei singure surse. Actualizarea Discover din februarie 2026 penalizează simplele rezumate. | Scriem **un singur articol per subiect**, actualizat în timp ce apar surse noi, cu valoare adăugată: context, cronologie, „De ce contează”, toate sursele. media24 publică de 5 ori aceeași știre reformulată; noi nu. |
| **Eșecuri AI** (NewsBreak, MSN, Apple Intelligence, CNET): fapte inventate și titluri greșite. | Reguli stricte de fidelitate față de surse, o **a doua verificare automată** (alt apel AI plus verificări în cod pentru cifre, nume și citate) și filtru pentru subiecte sensibile. |
| **Design:** site-ul actual are „tells” de AI: colțuri rotunjite peste tot, gradiente, pastile colorate, indigo, glassmorphism, carduri identice. | Redesign complet în stil editorial european (FT, The Verge, Guardian, NZZ): hârtie și cerneală, tipografie puternică, linii fine, ierarhie clară. |
| **Arhitectură:** memoria RAM și un fișier JSON nu pot susține coada AI, istoricul, adminul și imaginile. | Bază de date SQLite, **proces separat de colectare** (worker), coadă de joburi și panou de administrare. |

---

## 2. Cum va funcționa (fluxul automat)

```
la fiecare 5 min ─► 1. COLECTARE RSS (≈70 fluxuri, cereri condiționate ETag/Last-Modified, back-off pe erori)
                    2. DEDUPLICARE (URL canonic + amprentă de text: prinde preluările din agenții)
                    3. GRUPARE PE SUBIECTE (cuvinte-cheie + entități: persoane, instituții, locuri; fereastră 36h)
                    4. SCOR DE IMPORTANȚĂ = nr. de publicații distincte × autoritate × viteză / vechime
                         │
            subiect cu ≥2 surse │ sau 1 sursă oficială (Guvern, BNR…)
                         ▼
                    5. TEXT COMPLET din paginile surselor (Readability + curățare RO:
                       „Citește și”, reclame, newsletter)
                    6. POARTĂ: sursă prea scurtă / paywall / opinie / subiect sensibil ─► doar știre scurtă
                       sau revizuire umană
                    7. REDACTARE CU CLAUDE: articol original de 400–800 de cuvinte în JSON (titlu, lead, „Pe scurt”,
                       secțiuni cu subtitluri, „Context”, citate exacte cu atribuire, surse pe paragraf)
                    8. VERIFICARE: cod (cifre, date, nume, citate prezente în surse; fără >120 caractere copiate)
                       + al doilea apel AI (afirmații nesusținute) ─► publicare / regenerare / blocare
                    9. IMAGINE (vezi §3) ─► 10. PUBLICARE + ACTUALIZARE PAGINI (+ Telegram/push în etapa 2)
                   11. SUBIECTUL CREȘTE (surse noi) ─► articolul se ACTUALIZEAZĂ pe același URL
                       („Actualizat la 14:32”)
```

- **Știri cu o singură sursă:** apar în fluxul „Pe scurt” ca știre scurtă originală (2–3 fraze scrise de AI, cu link).
  Devin articol complet imediat ce le preia și a doua publicație.
- **Fără cheie AI:** site-ul funcționează ca agregator: titlu, un rezumat scurt, poza de la sursă ca miniatură, link.

---

## 3. Sistemul automat de imagini (fiecare articol are poză)

1. **Candidați:** din RSS (`media:content`, `enclosure`, `<img>` cu atribute lazy și `srcset`) și din pagina articolului
   (`og:image`, JSON-LD `NewsArticle.image`, `twitter:image`, prima imagine mare din articol).
2. **Filtrare automată:** se citesc dimensiunile descărcând doar primii ~1 KB. Se resping:
   - imaginile sub 600px lățime;
   - raporturile ciudate;
   - logo-urile, placeholderele și pixelii de tracking;
   - **poza „implicită” a fiecărui site**, detectată automat: aceeași imagine la 3 sau mai multe articole.
   Candidații rămași primesc un scor (mărime, apropiere de 16:9, tipul sursei).
3. **Poza principală (hero) a articolului Median**, în ordine:
   1. **Wikimedia Commons / Wikidata:** Claude extrage entitățile (ex. „Palatul Victoria”, „Nicușor Dan”, „Cluj-Napoca”).
      Imaginea oficială a entității vine din Wikidata (proprietatea P18) sau dintr-o căutare Commons, doar cu licențe
      CC0, PD, CC BY sau CC BY-SA. Nu necesită cheie.
   2. **Unsplash, apoi Pexels:** pentru subiecte conceptuale (economie, vreme, sănătate). Claude generează interogarea.
      Cheile sunt gratuite.
   3. **Poza sursei** doar dacă publicația e pe lista „permis” (parteneriat sau acord).
   4. **Copertă tipografică generată automat** (1200×630): titlu, secțiune, sigla Median. Nu eșuează niciodată.
4. **Procesare:** sharp creează variante WebP de 320, 640 și 1200px, plus un placeholder (thumbhash) și culoarea
   dominantă. Imaginile se salvează local (`/data/media`) și se servesc rapid.
5. **Credit afișat mereu:** „Foto: Autor / Wikimedia Commons / CC BY-SA 4.0” sau „Foto: X pe Unsplash”.
   Miniaturile surselor au „Foto: Digi24” și link.
6. **Verificare săptămânală** a imaginilor externe; cele stricate trec automat pe coperta generată.
7. **Nicio imagine AI fotorealistă la știri.** Regula e aceeași ca la AP și Reuters.

---

## 4. Design nou: „Hârtie și cerneală”

- **Referințe:** Financial Times (densitate, linii fine, supratitluri), The Verge (titluri condensate uriașe),
  Guardian 2025 și NZZ (compoziție asimetrică, sobrietate).
- **Fonturi:**
  - **Newsreader** (serif cu mărime optică) pentru titluri și text;
  - **Archivo** condensat pentru logo, secțiuni și interfață;
  - **JetBrains Mono** pentru ore, curs valutar și ticker.
  Toate suportă ș, ț, ă, â, î.
- **Culori:**
  - fundal hârtie `#F4F1EA`, cerneală `#111110`, linii `#D6D0C2`;
  - **un singur accent: vermilion `#E23B1E`**, folosit rar (■ din logo, ULTIMA ORĂ, bara știrii principale);
  - mod întunecat complet;
  - fără culori diferite pe categorii.
- **Structură:** grilă de 12 coloane, **zero colțuri rotunjite, zero umbre, zero gradiente**, separatoare cu linii
  de 1px, ierarhie clară în fiecare secțiune (1 principal → secundare → titluri text).
- **Prima pagină:**
  1. Ticker „ULTIMA ORĂ”.
  2. Știrea principală (foto 7 coloane + titlu mare, cu 3 subiecte legate).
  3. 4 știri secundare.
  4. Flux live + „Cele mai citite”.
  5. **INTERNAȚIONAL, pe toată lățimea**, cu regiuni: Europa · SUA · Ucraina · Orientul Mijlociu · Asia.
  6. Politică și Național.
  7. Economie, cu cursul BNR.
  8. Sport.
  9. Tech, Sănătate, Auto.
  10. Cultură și Lifestyle (bandă „revistă”).
  11. Monden.
- **Pagina de articol:**
  - titlu mare și sub-titlu italic;
  - etichetă AI și surse vizibile sub titlu;
  - foto 16:9 cu credit;
  - text de 680px cu literă inițială mare, subtitluri, citate scoase în evidență și casetă „Pe scurt”;
  - **caseta „SURSE”** (publicație, titlul original, ora, link);
  - „Cronologia subiectului” (cine a relatat și când);
  - articole legate;
  - buton de corectură.
- **Mobil:** bară compactă, secțiuni derulabile orizontal, meniu complet pe tot ecranul.

---

## 5. Arhitectură tehnică

- **Next.js 16** (site) și **worker Node** separat (colectare, text complet, AI, imagini), din același cod.
- **SQLite:**
  - better-sqlite3 în mod WAL, schema administrată cu Drizzle;
  - căutare **FTS5** fără diacritice (verificat: „sedinta” găsește „ședința”);
  - tabele: `sources`, `raw_articles`, `stories`, `articles` (versiuni AI), `images`, `jobs`, `ai_usage_daily`,
    `settings`, `views`.
- **Coada de joburi** stă în baza de date, cu reîncercări, deduplicare și **plafon zilnic de cost AI**.
- **Cache:** paginile se reîmprospătează la fiecare colectare (tag-uri de cache plus stale-while-revalidate).
- **Admin (`/admin`, cu parolă):**
  - surse (activare / categorie / permisiune poze);
  - subiecte (fixare, ascundere, marcare ca breaking);
  - articole (editare, depublicare, regenerare);
  - buget AI;
  - pagină de stare cu fluxuri, erori și cost azi.
- **Hosting recomandat:**
  - un VPS în UE (Hetzner sau DigitalOcean, ~€6–25/lună) cu Docker Compose: Caddy (HTTPS automat) + web + worker;
  - backup zilnic al bazei de date;
  - rămâne și varianta Vercel, dar fără worker permanent.

---

## 6. SEO, transparență și conformitate

- JSON-LD `NewsArticle` (inclusiv `isBasedOn` cu sursele), sitemap Google News (ultimele 48h), `max-image-preview:large`,
  canonical propriu, fluxuri RSS pe categorii.
- **Pagini obligatorii:** Despre, Politica editorială, **Politica AI**, Corecturi (jurnal public), Contact / drepturi de
  autor (retragere în 48h), date firmă.
- **Semnătura articolelor:** „Redacția Median”, **fără jurnaliști inventați**.
- **Analytics fără cookie-uri** (Umami sau Plausible), deci fără banner complicat. Dacă se adaugă AdSense mai târziu,
  e nevoie de banner de consimțământ.
- Respectăm `robots.txt` și rezervările TDM ale fiecărui site (registru pe domeniu).

---

## 7. Etape de implementare

| # | Etapă | Rezultat verificabil |
|---|---|---|
| 1 | **Fundație:** SQLite, schemă, worker, coadă de joburi, colectare cu ETag, deduplicare, grupare v2, scor | Rețea de știri simulată local (fluxuri + pagini + imagini de test): ciclul complet rulează cap-coadă, testat automat. |
| 2 | **Text complet:** modul de extragere (testat deja pe 5 tipuri de pagini: WordPress, Digi24, Libertatea, paywall ZF) | Paragrafe curate, subtitluri, autor, dată. |
| 3 | **Redacția AI:** prompt editorial în română, JSON structurat, verificare în doi pași, filtru pentru subiecte sensibile, plafon de cost, actualizare pe același URL, știri scurte pentru o sursă | Teste cu un Claude simulat; cu cheia reală, articol generat și verificat. |
| 4 | **Imagini:** candidați, filtrare, detectare a pozelor implicite, Wikidata/Commons, Unsplash/Pexels, copertă generată, variante WebP, credite | Fiecare articol din simulare are poză validă și credit. |
| 5 | **Redesign complet** după §4, desktop și mobil, luminos și întunecat | Capturi de ecran la 1440, 1024 și 390px, fără scroll orizontal. |
| 6 | **SEO și transparență:** JSON-LD, sitemap-uri, pagini legale, etichete AI, jurnal de corecturi | Validare schema și sitemap. |
| 7 | **Admin:** surse, subiecte, articole, buget, stare | Login și acțiuni testate. |
| 8 | **Deploy:** Docker Compose (Caddy + web + worker), backup, `/api/health`, documentație pas cu pas în română | `docker compose up` pornește totul. |
| 9 | Etapa 2 (după lansare): Telegram, web push pentru breaking, newsletter de dimineață, postare pe Facebook | |

**Limita mediului de lucru:** site-urile de știri și API-ul Claude nu sunt accesibile de aici. De aceea construiesc o
**rețea de știri simulată** (fluxuri, pagini HTML, imagini) care testează tot sistemul cap-coadă. Pe serverul real,
cu internet și cheile setate, sistemul folosește sursele reale.

---

## 8. Decizii luate

| Decizie | Alegere |
|---|---|
| Redactorul AI | **DeepSeek** (`deepseek-flash`, ~$8–17/lună la 100 de articole pe zi). Sistemul acceptă orice API compatibil OpenAI: Scaleway în UE sau Ollama local, schimbabil din `.env`. |
| Publicare | Automată, cu etichetă AI. Subiectele sensibile (decese, minori, justiție) așteaptă aprobare în `/admin`. |
| Hosting | VPS cu Docker Compose: Caddy (HTTPS automat), web, worker și backup zilnic. |

Cercetarea despre modele a arătat următoarele:
- Modelele locale cer un server de €230+/lună (ideal cu placă video) și scriu mai slab în română.
- DeepSeek procesează datele în China. Pentru date doar în UE, varianta e Scaleway (Paris), care servește același model.

## 9. Stare implementare

| Etapă | Stare | Verificare |
|---|---|---|
| 1. Fundație (SQLite, worker, coadă, colectare, grupare) | ✅ | Test de integrare cap-coadă; gruparea: precizie 1,00 / recall 0,80 pe rețeaua demo (`test/cluster.test.ts`) |
| 2. Text complet | ✅ | Testat pe 5 tipuri de pagini + rețeaua demo; respectă robots.txt/TDM |
| 3. Redacția AI | ✅ | Prompt editorial, verificare în cod (cifre, citate, nume, text copiat) + verificare AI, subiecte sensibile la aprobare, buget zilnic |
| 4. Imagini automate | ✅ | Miniaturi din surse (cu detectarea logo-urilor și a pozelor implicite), Wikidata/Commons, Unsplash/Pexels, copertă generată |
| 5. Redesign | ✅ | Desktop, mobil, temă întunecată; fără erori în consolă |
| 6. SEO și transparență | ✅ | JSON-LD, sitemap Google News, RSS, pagini legale, etichete AI, corecturi |
| 7. Admin | ✅ | Login, aprobare, subiecte, surse, semnalări, stare și costuri (testat în browser) |
| 8. Deploy | ✅ | `Dockerfile`, `docker-compose.yml` și `Caddyfile` validate; ghid în README |
| 9. Etapa 2 (după lansare) | ⏳ | Telegram, web push, newsletter, Facebook |

**Limita mediului de dezvoltare:** site-urile reale și API-urile AI nu sunt accesibile aici. Totul a fost
testat pe rețeaua de știri simulată și cu un redactor AI simulat. La prima pornire pe server, verifică
în `/admin` → Stare ce fluxuri reale răspund; unele adrese RSS pot fi schimbate de publicații.
