# Median — predare pentru lucrul local

Stare la 26.09.2026. Proiectul e în `median/` din repo-ul `ccvcode/CV`, pe ramura `claude/great-turing-96qrax`
(PR deschis: https://github.com/ccvcode/CV/pull/2). Documentație completă: `README.md` (instalare, publicare,
AI, imagini, aspecte legale) și `PLAN.md` (arhitectură, decizii, istoricul review-urilor).

## Ce este

Agregator de știri în limba română: ~105 fluxuri RSS de la ~60 de publicații (România + R. Moldova),
grupate automat pe subiecte, cu pagina fiecărui subiect (extras scurt, cronologia relatărilor, cine a
relatat și cine nu), secțiuni pe categorii, curs BNR, vreme, alerte ANM și cutremure. Fără AI deocamdată
(nu e setată nicio cheie LLM): site-ul arată știrile reale, fără rescriere.

## Tehnic

- **Next.js 16** (app router) + Tailwind 4. Atenție: `AGENTS.md` — „This is NOT the Next.js you know”;
  citește ghidurile din `node_modules/next/dist/docs/` înainte de a scrie cod Next.
- **SQLite** (better-sqlite3), migrații în `lib/core/db.ts` (ultima: 5, notificări push). Baza și pozele
  stau în `data/` (ignorat de git; se creează singur).
- **Worker separat** (`worker/index.ts`): colectează fluxurile la 5 minute, grupează, alege poze
  (sharp → WebP), trimite notificări. Joburi: thumb / extract / write / brief / image.
- Surse: `lib/core/sources.ts` (verificare: `npx tsx scripts/check/feeds.ts`).
- Grupare și clasificare: `lib/pipeline/text.ts`, `lib/pipeline/ingest.ts`.
- Poze: `lib/pipeline/images/*` (poza din sursă, Wikimedia Commons/Wikidata, fără alegere manuală).
- Interogări pentru pagini: `lib/data/queries.ts`; acoperire/„unghi mort”: `lib/data/coverage.ts`;
  alerte ANM + EMSC: `lib/data/alerts.ts`; curs + vreme: `lib/data/widgets.ts`.
- Notificări web push fără cont: `lib/push/index.ts`, `app/api/push/route.ts`, `public/sw.js`,
  `components/push.tsx`, trimiterea automată în `lib/pipeline/notify.ts`.
- „De la ultima vizită”: `public/visit.js` (doar localStorage) + `components/visit-marks.tsx`.

## Pornire locală (știri reale)

```bash
cd median
npm install
cp .env.example .env       # opțional; implicit merge fără nimic setat
npm run build
MEDIAN_SOURCE_IMAGES=hero npm run worker   # terminal 1: colectarea (prima rulare durează câteva minute)
npm start                                  # terminal 2: http://localhost:3000
npm test                                   # 22 de teste
npx tsc --noEmit                           # verificare tipuri
```

Mod demo (fără internet, publicații fictive): `npm run demo` + `MEDIAN_DEMO=1 npm start`.

## Variabile de mediu importante (`.env.example` are lista completă)

- `MEDIAN_SOURCE_IMAGES=hero` — folosește poza articolului-sursă ca poză mare (altfel doar miniaturi).
- `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` — redactorul AI (API compatibil OpenAI). Decizie amânată;
  opțiunea cea mai ieftină găsită: DeepInfra DeepSeek-V4-Flash (~6 $/lună la volumul estimat).
- `MEDIAN_COMPANY`, `MEDIAN_COMPANY_ADDRESS`, `MEDIAN_COMPANY_ID` — datele operatorului, **obligatorii
  înainte de lansare** (apar în Politica de confidențialitate, GDPR art. 13).
- `MEDIAN_CONTACT_EMAIL`, `MEDIAN_SITE_URL`, `ADMIN_PASSWORD`, `MEDIAN_SECRET`.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — opțional; altfel se generează în `data/vapid.json`.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_CHANNEL_URL` — rezumatul de la 7:00 pe Telegram.

## Pagini

`/` prima pagină · `/stire/<slug>-<id>` subiect · `/categorie/<slug>` (+ `?regiune=` la Internațional) ·
`/pe-scurt` · `/azi` (Ce trebuie să știi azi) · `/unghi-mort` · `/alerte` · `/notificari` · `/cauta` ·
`/salvate` · `/surse` · `/despre` · `/politica-editoriala` · `/politica-ai` · `/corecturi` · `/contact` ·
`/confidentialitate` · `/cookies` · `/termeni` · `/admin` (parolă).

## Copie statică (artifact)

Există o copie publicată la https://claude.ai/artifact/Mam7wSaHgFQab4dCErkNZV. Se generează cu serverul
pornit: `INLINE=1 LIMIT=440 STAMP="…" node scripts/export/static.mjs out` (pozele intră în pagini ca
data URI, pentru că un artifact are limită de ~500 de fișiere; ~160 MB, se publică în loturi ≤255 fișiere
și ≤64 MB). În copia statică nu merg notificările, căutarea și butoanele care au nevoie de server.

## Reguli de lucru stabilite

- Răspunsurile către proprietar: **în română**.
- Nu se aleg poze de mână: se repară sistemul automat.
- Extrase din surse: sub ~120 de caractere, cu sursa (Legea 8/1996, modificată de Legea 69/2022).
- Fără etichete politice pentru publicații: doar criterii factuale (tipul redacției).
- Commit-uri mici și descrise; ramura de lucru: `claude/great-turing-96qrax` (fără PR nou).
- Verificare vizuală cu capturi (desktop + mobil, temă luminoasă + întunecată) după schimbări de interfață.

## Probleme cunoscute / de făcut

- B1 TV, Libertatea, TVmania, VIVA! răspund 429 (limitare) de la IP-ul serverului de test; EVZ dă 500.
  De verificat de pe IP-ul tău; dacă persistă, de scos sau de redus frecvența.
- Unele clasificări greșite (ex. gimnastică la Internațional); unele subiecte despre același eveniment
  rămân separate (Hagi „Gică”/„Gheorghe”, explozia din Atena).
- Livrarea reală a notificărilor push nu a putut fi testată în container (Chromium headless nu are
  serviciu de push) — de testat local în Chrome/Firefox, apoi pe iPhone (site adăugat pe ecranul principal).
- Redactorul AI nu e activat (lipsește cheia); după activare: quiz zilnic, explicația „Subiectul zilei”.
- Idei din research încă neimplementate: pagini pe județe (+ calitatea aerului Open-Meteo), prețul
  energiei (ENTSO-E), canal WhatsApp, optimizare Google Discover/News.
- Scroll-ul care deschidea articolele la subsol: reparat în site; nu a putut fi verificat în artifact.
