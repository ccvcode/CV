# CLAUDE.md — Firme noi România (ANAF) → bază de date + Excel

Context pentru Claude (și pentru oameni) care continuă proiectul. Detaliile de
utilizare sunt în `README.md`; aici sunt starea, arhitectura și deciziile
care nu se văd din cod.

## Scop

Colectează automat firmele nou înființate în România, cu cât mai multe date
(CAEN, adresă, TVA, stare, **telefon**), într-o bază SQLite, și livrează Excel
pe ani: toate firmele noi active + doar cele cu telefon propriu verificat.
Proprietar: utilizator român, prospectare comercială. Comunicarea e în română.

## Stare (26 septembrie 2026)

| An | Înregistrări ANAF | Firme noi active | Cu telefon propriu verificat |
|---|---|---|---|
| 2024 | 173.219 | 69.681 | 46.671 (67%) |
| 2025 | 211.750 | 88.380 | 59.138 (67%) |
| 2026 (până la 25 sept) | 243.152 | 54.939 | 36.335 (66%) |

- 2020–2023: colectarea a fost pornită pe GitHub Actions pe 26.09.2026
  (`dupa=2020-01-01`, tranșe de 4.000 de loturi). Când se termină, rezultatele
  sunt în branch-urile `rezultate-2020` … `rezultate-2023`.
- Rezultatele pe ani sunt în repository-ul **privat** `ccvcode/web-development`,
  branch-urile `rezultate` (anul curent), `rezultate-2025`, `rezultate-2024`
  (…): `Firme-noi-AN.xlsx`, `Firme-noi-AN-cu-telefon.xlsx`,
  `Toate-inregistrarile-AN.csv.gz`, `STATISTICI.txt`.
- Codul: `ccvcode/web-development` (branch `main`, proiectul e la rădăcină) și
  `ccvcode/CV` (branch `claude/automat-colectare-companii-ji60wt`, folderul
  `firme-noi/`). Cele două copii sunt identice.

## Rulare locală (fără GitHub)

```bash
pip install -r requirements.txt            # Python 3.10+; doar requests + openpyxl
python -m unittest discover -s tests -q    # testele (fără rețea)

# 1. Refă baza de date din rezultatele deja colectate (nu mai interoghează ANAF):
python run.py restore Toate-inregistrarile-2024.csv.gz Toate-inregistrarile-2025.csv.gz ...
# 2. Continuă colectarea de unde a rămas (în sus = firme noi; în jos = până la data cerută):
python run.py collect --source anaf_scan --dupa 2020-01-01
python run.py verifica-telefoane
# 3. Export pe ani:
bash scripts/run_daily.sh 2020        # Linux/Mac (colectare + export 2020..azi)
scripts\colecteaza.bat 2020           # Windows (la fel)
```

- Baza de date: `data/firme.db` (sau variabila `FIRME_DB`). Configurare în
  `.env` (vezi `.env.example`).
- Fișierele `Toate-inregistrarile-AN.csv.gz` se descarcă din branch-urile
  `rezultate-*` (GitHub → branch → fișier → Download).
- Fără `restore`, `collect` pornește de la CUI-ul implicit (septembrie 2026) și
  scanează din nou tot intervalul (~1–2 ore pe an).
- Din România, și sursa `onrc` (data.gov.ro) funcționează; nu e necesară.

## Arhitectură

```
run.py                     CLI: collect, enrich, verifica-telefoane, restore, stats, filter, export …
firme/models.py            Company (~55 câmpuri); schema SQLite se generează din el
firme/db.py                SQLite: migrare automată a coloanelor, insert_many (INSERT OR IGNORE),
                           query (motorul de filtre), recheck_phones, cui_range
firme/sources/anaf_scan.py sursa principală: parcurge CUI-uri consecutive prin ANAF
firme/sources/onrc_opendata.py  lista ONRC de pe data.gov.ro (merge doar din România)
firme/enrich/anaf.py       client ANAF (loturi de 100, ~1 cerere/s, parsare date_generale)
firme/classify.py          tip entitate (Firmă / Sediu secundar / PFA / …), activă, calitate telefon
firme/util.py              normalizare telefon, detectare numere false, firma_key, sesiune HTTP cu throttle
firme/excel.py             Excel (write-only): foile Firme, Sumar, Telefoane comune
firme/importers.py         import din fișiere străine + restaurare din exporturile proprii
scripts/                   export_ani.sh + publica_rezultate.sh (GitHub), run_daily.sh, colecteaza.bat
.github/workflows/colectare.yml  rularea zilnică pe GitHub (opțională)
```

## Sursa de date: API-ul public ANAF

- `POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva`, corp
  `[{"cui": 123, "data": "YYYY-MM-DD"}, …]`, maxim 100 CUI/cerere, ~1 cerere/s,
  fără cheie. Răspunsul are `found` / `notFound`; **HTTP 404 = niciun CUI din lot
  nu există** (nu e eroare).
- `date_generale.telefon` **există și e completat pentru majoritatea firmelor**
  (~66% din firmele noi active au un număr propriu valid). Nu afirma că ANAF nu
  are telefoane — s-a verificat pe date reale.
- CUI-urile se alocă crescător: `baza * 10 + cifră de control` (cheia
  `753217532`). `anaf_scan` scanează **în sus** până la 10 loturi goale la rând
  (firmele cele mai noi) și **în jos** până la 10 loturi la rând în care sub 30%
  din firme sunt după `--dupa`. Reia de la `cui_range("anaf_scan")` din bază;
  `--max-batches` limitează o rulare. Un an ≈ 2.000 de loturi ≈ 1–1,5 ore.
- data.gov.ro (ONRC) nu răspunde serverelor din afara României (GitHub, cloud).

## Reguli de business (decizii luate cu utilizatorul)

- **Firmă nouă** = denumire/formă de societate **și număr de Registrul
  Comerțului (J…)**. Un CUI cu nume de firmă dar fără număr J este un punct de
  lucru înregistrat fiscal (poartă numele firmei-mamă și același telefon); în
  ian.–mar. 2026 au fost ~30.000. Numărul J apare din ziua înmatriculării.
- Tipuri (`classify.tip_entitate`): Firmă · Sediu secundar / punct de lucru ·
  PFA / II / IF · Profesie liberală / cabinet · Asociație / ONG. „Activă" = nu e
  radiată/dizolvată/inactivă. Fișierele `Firme-noi-*` conțin doar firme noi active.
- **Telefoane** (`verifica-telefoane`, rulat înainte de export):
  - „Suspect": ultimele 7 cifre identice, secvențe, 6+ zerouri, prefixe
    invalide — marcate, nu șterse;
  - „Comun": același număr la **3+ firme diferite** (după `firma_key`, deci firma
    și punctele ei de lucru contează o dată) = contabil/consultant;
  - 2 firme cu același număr = valid (de regulă același antreprenor);
  - `*-cu-telefon.xlsx` = doar OK + Străin (`--with-phone --fara-suspecte --fara-comune`).

## Reguli stricte

- **Nu pune date de contact (telefoane reale, exporturi, baze de date) în
  `ccvcode/CV` — e public.** Rezultatele stau doar în `web-development`
  (privat) sau local. Testele folosesc numere fictive. `.gitignore` exclude
  `data/`, `export/`, `out/`, `*.db`.
- Nu publica date prin criptare cu chei private în repository (abordare
  respinsă anterior).
- GDPR: telefoanele sunt ale persoanelor juridice, dar pot identifica persoane;
  folosirea pentru marketing trebuie să respecte legislația.

## GitHub Actions (opțional)

`colectare.yml` rulează zilnic (`23 4 * * *`), manual (Actions → Run workflow,
cu `dupa`, `max_batches`) sau la modificarea `rulare.txt`. Baza de date se
păstrează în cache-ul Actions (`data/firme.db`); scanările lungi continuă automat
în tranșe (`gh workflow run`). Exportul și publicarea în branch-urile
`rezultate*` se fac doar la finalul scanării. Pentru oprire: Actions → Colectare
firme noi → „Disable workflow".
