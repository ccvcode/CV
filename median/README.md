# Median — știri din România și din lume

**Median** este un agregator modern de știri, inspirat de media24.ro. Colectează automat,
**la fiecare 5 minute**, știrile din peste 70 de fluxuri RSS ale publicațiilor românești
(Digi24, HotNews, G4Media, Știrile ProTV, Libertatea, Adevărul, ZF, Profit, GSP, Digi Sport,
Europa Liberă, RFI și multe altele). Le grupează pe subiecte și le afișează cu imagini, rezumate
și link către sursa originală.

## Ce include

- **Colectare automată la 5 minute**, cu imagini (din RSS sau `og:image` din pagina articolului),
  deduplicare, normalizarea diacriticelor (ş/ţ → ș/ț) și arhivă locală de 7 zile.
- **Categorii:** Național, Politică, Economie, Internațional, Sport, Tech & Știință, Lifestyle,
  Sănătate, Auto, Cultură, Monden.
- **Gruparea pe subiecte:** „3 surse relatează”, cronologie „cine a scris primul”.
- **Prima pagină modernă:** bandă „Ultima oră”, hero bento, „Subiectele zilei”, flux live
  „Pe scurt”, „Cele mai citite / mediatizate”, secțiuni pe categorii, galerie „Ziua în imagini”.
- **Widget-uri:** vremea în 7 orașe (Open-Meteo), curs valutar BNR cu grafice, cutremure recente (USGS).
- **Știri noi fără refresh:** un buton discret „↑ 5 știri noi” apare când serverul a adus noutăți.
- Temă luminoasă/întunecată, căutare (⌘K), articole salvate, bară de progres la citire,
  navigare de jos pe mobil, PWA, flux RSS propriu (`/feed.xml`), sitemap și SEO.

## Pornire locală

```bash
cd median
npm install
npm run dev        # http://localhost:3000
```

Pentru producție: `npm run build && npm start`.

Dacă serverul nu are acces la internet, site-ul afișează un banner **„Mod demo”** cu articole
demonstrative. Știrile reale apar automat când sursele devin accesibile.

## Publicare online

### Varianta 1: VPS sau Docker (recomandat)

Pe un server care rulează permanent, colectarea la 5 minute pornește singură
(vezi `instrumentation.ts`).

```bash
docker build -t median .
docker run -d -p 3000:3000 -v median-data:/data -e NEXT_PUBLIC_SITE_URL=https://domeniul-tau.ro median
```

Merge la fel pe Railway, Render sau Fly.io. Setează directorul rădăcină la `median`.

### Varianta 2: Vercel

1. Importă repository-ul în Vercel și setează **Root Directory** = `median`.
2. Adaugă variabilele `NEXT_PUBLIC_SITE_URL` și, opțional, `CRON_SECRET`.
3. Paginile se regenerează automat la cel mult 5 minute (ISR, `revalidate = 300`).
4. Opțional, pentru colectare strict la 5 minute indiferent de trafic, setează în GitHub secretele
   `MEDIAN_URL` și `CRON_SECRET`. Workflow-ul `.github/workflows/median-refresh.yml` va apela
   `/api/refresh` la fiecare 5 minute.

## Structură

| Fișier | Rol |
|---|---|
| `lib/sources.ts` | lista surselor RSS. Adaugă un rând ca să adaugi o sursă. |
| `lib/rss.ts` | parser RSS/Atom, extragerea imaginilor și a rezumatelor |
| `lib/store.ts` | colectare, cache, arhivă pe disc, căutare, clasamente |
| `lib/cluster.ts` | gruparea articolelor pe subiecte |
| `lib/widgets.ts` | vreme, curs BNR, cutremure |
| `app/` | paginile: `/`, `/categorie/[slug]`, `/articol/[id]`, `/live`, `/cauta`, `/salvate`, `/surse`, `/despre` |
| `app/api/news` | JSON cu ultimele știri (`?since=`, `?category=`, `?limit=`) |
| `app/api/refresh` | declanșează o colectare (pentru cron extern) |

## Notă legală

Median afișează doar titlul, un scurt extras și imaginea din fluxurile RSS publice, cu link
către articolul original, care rămâne sursa canonică. Verifică termenii fiecărei publicații
înainte de lansarea publică.
