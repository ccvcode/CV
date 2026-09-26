# Median — Știrile zilei, cântărite

Median este o redacție de știri automată pentru România. La fiecare 5 minute urmărește fluxurile a
~50 de publicații. Recunoaște când mai multe redacții relatează același subiect. Apoi un model AI
scrie **un singur articol complet și original** pentru subiect, cu toate sursele la vedere. Fiecare
articol primește automat o fotografie.

> Planul complet și concluziile research-ului sunt în [PLAN.md](PLAN.md).

## Ce face, pe scurt

| | |
|---|---|
| **Colectare** | ~70 de fluxuri RSS, la 5 minute. Folosește cereri condiționate (ETag), iar sursele căzute sunt reîncercate automat mai rar. |
| **Grupare pe subiecte** | Articolele despre același eveniment devin un singur subiect. Precizie măsurată: 100% pe datele de test. |
| **Articole complete** | Pentru subiectele cu ≥2 publicații, AI-ul citește textul integral al surselor și scrie o sinteză de 400–800 de cuvinte. Sinteza are titlu, „Pe scurt”, secțiuni, „De ce contează”, citate și sursele. |
| **Verificare** | Cifrele, citatele și numele trebuie să existe în surse. Textul nu are voie să copieze fraze din surse. Un al doilea apel AI caută afirmații nesusținute. |
| **Subiecte sensibile** | Decesele, minorii și cazurile de justiție așteaptă aprobarea ta în `/admin`. |
| **Știri scurte** | Subiectele cu o singură sursă primesc o știre scurtă originală, cu link către sursă. |
| **Poze automate** | Poza vine, în ordine, din: Wikidata/Wikimedia Commons (persoane, instituții, locuri), apoi Unsplash/Pexels, apoi o copertă grafică generată. Pozele publicațiilor apar doar ca miniaturi, cu credit. |
| **Design** | Stil editorial „hârtie și cerneală”, cu temă luminoasă și întunecată. Funcționează pe mobil. |
| **Transparență** | Eticheta AI apare pe fiecare articol (AI Act). Site-ul are pagini de politică editorială, politică AI, corecturi publice și formular pentru drepturi de autor. |
| **SEO** | NewsArticle JSON-LD, sitemap Google News, RSS general și pe categorii. |
| **Administrare** | Din `/admin`: aprobare, ascundere, fixare, „Ultima oră”, corecturi, surse, costuri AI și jurnal. |

## Pornire rapidă (demo, pe calculatorul tău)

Ai nevoie de [Node.js 22](https://nodejs.org).

```bash
cd median
npm install
npm run build
npm run demo          # pornește rețeaua de știri simulată + colectarea (lasă-l deschis)
# în alt terminal:
MEDIAN_DEMO=1 npm start   # site-ul, la http://localhost:3000
```

Modul demo folosește **10 publicații fictive** și un redactor AI simulat. Nu are nevoie de internet
sau de chei, iar site-ul arată un banner „Mod demonstrativ”.

## Publicare online (recomandat: server propriu cu Docker)

1. **Închiriază un server** Linux în UE, de exemplu Hetzner sau DigitalOcean. Ajung 2 vCPU și 4 GB RAM,
   la circa €6–25/lună. Instalează [Docker](https://docs.docker.com/engine/install/).
2. **Îndreaptă domeniul** spre IP-ul serverului: o înregistrare DNS de tip A.
3. **Pe server:**
   ```bash
   git clone <repo> && cd <repo>/median
   cp .env.example .env
   nano .env        # completează domeniul, parola de admin și cheia AI
   docker compose up -d --build
   ```
4. Gata:
   - site-ul rulează pe `https://domeniul-tau.ro`, iar certificatul HTTPS e automat;
   - panoul de administrare e la `/admin`;
   - bazele de date sunt salvate zilnic în `backups/`.

**Actualizare:** `git pull && docker compose up -d --build`.

**Monitorizare:** adaugă `https://domeniul-tau.ro/api/health` într-un serviciu gratuit precum
UptimeRobot. Răspunde cu eroare dacă nicio colectare nu a reușit în ultimele 20 de minute.

## Redactorul AI

Median funcționează cu orice API compatibil OpenAI. Totul se configurează în `.env`.

| Opțiune | Setări | Cost estimat, 100 articole/zi |
|---|---|---|
| **DeepSeek** (implicit) | `LLM_BASE_URL=https://api.deepseek.com`, `LLM_MODEL=deepseek-flash` | ~$8–17/lună |
| **Scaleway** (Paris, date în UE) | `LLM_BASE_URL=https://api.scaleway.ai/v1`, `LLM_MODEL=deepseek-v4-flash-0731`, `LLM_JSON_MODE=json_schema` | ~€18/lună |
| **Local (Ollama)** | `LLM_BASE_URL=http://ollama:11434/v1`, `LLM_MODEL=gemma4:26b`, `LLM_JSON_MODE=json_schema` | serverul: €230+/lună; recomandat cu placă video |

- **DeepSeek și GDPR:** datele sunt procesate în China. Pentru articole de presă publice riscul e mic,
  dar dacă vrei date exclusiv în UE, folosește Scaleway.
- **Bugetul zilnic:** `LLM_DAILY_BUDGET_USD` oprește automat redactarea când e atins și o reia a doua zi.
- **Costul la zi** apare în `/admin`.
- **Fără cheie AI**, site-ul funcționează ca agregator: titluri, miniaturi și linkuri către surse.

## Imagini

| Sursă | Cheie | Folosire |
|---|---|---|
| Wikidata / Wikimedia Commons | nu | Portrete oficiale, instituții, locuri. Doar licențe libere, cu autor și licență afișate. |
| Unsplash | [gratuită](https://unsplash.com/developers) | Subiecte generale (economie, vreme, sănătate). |
| Pexels | [gratuită](https://www.pexels.com/api/) | Rezervă pentru Unsplash. |
| Copertă generată | nu | Ultima variantă; nu eșuează niciodată. |

Pozele publicațiilor-sursă se folosesc **doar ca miniaturi**, cu credit („Foto: Digi24”). Poți permite
folosirea lor ca poză principală, pentru publicațiile cu care ai un acord, din `/admin` → Surse.

## Aspecte legale (pe scurt, nu este consultanță juridică)

- **Median nu copiază articole.** Faptele sunt libere, formularea nu. Textele sunt originale, iar
  verificarea automată respinge orice secvență copiată. Citatele exacte se folosesc doar pentru
  declarațiile persoanelor.
- **Sursele sunt listate la fiecare articol,** cu titlul original și link.
- **Agerpres nu este inclus.** Este serviciu cu abonament; se poate adăuga doar pe bază de contract.
- **Sunt respectate robots.txt și rezervările TDM** ale fiecărui site.
- **Eticheta AI** apare pe fiecare articol, conform AI Act (art. 50).
- **Recomandare:** verifică politica cu un avocat înainte de lansare. Monetizarea cu reclame
  necesită banner de cookie-uri.

## Structură

| Director | Rol |
|---|---|
| `worker/` | Procesul permanent: colectare, text complet, AI, imagini. |
| `lib/pipeline/` | Colectare RSS, grupare, extragere text, redactor AI, verificare, imagini. |
| `lib/core/` | Configurare, baza de date SQLite, surse, categorii. |
| `lib/data/` | Interogările folosite de site. |
| `app/` | Paginile site-ului și `/admin`. |
| `scripts/demo-network/` | Rețeaua de știri simulată (demo și teste). |
| `scripts/eval/` | Măsurarea calității grupării și a clasificării. |
| `test/` | Teste automate (`npm test`). |

Sursele se editează în `lib/core/sources.ts`. Fiecare sursă e un rând: nume, site, flux, categorie.
