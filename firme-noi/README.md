# Firme Noi — colectare automată + îmbogățire ANAF

Sistem automat care:

1. **Colectează** firmele nou înființate din România (sursă principală: datele
   deschise ONRC de pe [data.gov.ro](https://data.gov.ro); secundar, best-effort:
   Monitorul Oficial Partea a IV-a).
2. **Îmbogățește** fiecare firmă cu datele oficiale de la **ANAF** (denumire,
   nr. reg. com., adresă, cod CAEN, stare TVA, data înmatriculării).
3. **Caută** numere de telefon (best-effort — vezi avertismentul de mai jos).
4. **Stochează** totul într-o **bază de date SQLite**, cu deduplicare automată.

---

## De reținut: de unde vin numerele de telefon

| Sursă | Ce oferă | Telefon? |
|-------|----------|----------|
| ONRC (data.gov.ro) | denumire, CUI, nr. reg. com., adresă, stare | ❌ nu |
| **ANAF API public** | denumire, adresă, CAEN, stare TVA, + câmpul `telefon` din `date_generale` | ✅ **da, când firma l-a declarat** (acoperire variabilă) |
| Google Places API | telefon, website (dacă firma e listată) | ✅ parțial, **necesită cheie plătită** |
| Căutare web | orice apare public pe site-uri | ⚠️ fragil, orientativ |

**Ce e important de știut, corect:** API-ul public ANAF (`PlatitorTvaRest`)
returnează în `date_generale` un câmp `telefon` (și adresa completă), gratuit,
după CUI. Acoperirea depinde de ce a declarat fiecare firmă la ANAF — nu toate
au telefon, dar multe au. Acesta este providerul principal de telefon din
sistem (`PHONE_PROVIDERS=anaf`). Pentru firmele fără telefon în ANAF, se pot
adăuga surse suplimentare (Google Places, căutare web).

Sistemul **nu inventează niciodată** un număr — dacă nicio sursă nu întoarce
unul, câmpul rămâne gol. Câmpul ANAF e completat liber de firme, deci:
dacă are mai multe numere se păstrează primul valid, numerele din străinătate
(ex. `+373…`) se păstrează, iar cele de formă (ex. `0770000000`) sunt marcate
în coloana **„Tel. suspect"** (nu se șterg). Comanda `probe` arată dacă ANAF
răspunde și dacă întoarce câmpul `telefon`, fără să afișeze datele.

---

## Cum obții firmele din 2026 cu telefoane — alege o variantă

Sistemul are nevoie de acces la internet către `data.gov.ro` (lista ONRC) și
`webservicesp.anaf.ro` (telefon + date ANAF). Prima rulare pe un an întreg
durează ~30–40 de minute (ANAF acceptă o cerere pe secundă, 100 de firme per
cerere); rulările următoare interoghează doar firmele nou apărute.

**A. Automat, zilnic, pe GitHub (recomandat)**
1. Creează un repository **privat** (ex. `firme-noi`) și copiază în el conținutul
   acestui folder (`firme-noi/` devine rădăcina repository-ului).
2. În tab-ul **Actions** pornește „Colectare firme noi" (*Run workflow*).
3. Excel-urile apar pe ani: anul curent în branch-ul **`rezultate`**, anii
   încheiați în **`rezultate-2025`**, **`rezultate-2024`** etc., plus în secțiunea
   **Artifacts** a rulării. Pentru ani anteriori, pornește workflow-ul cu data de
   început dorită (ex. `2024-01-01`); scanarea continuă de unde a rămas. De atunci rulează singur în fiecare
   dimineață; o rulare suplimentară pornește și la modificarea fișierului
   `rulare.txt`. Workflow-ul refuză să ruleze într-un repository public, ca
   datele de contact să nu devină publice.

**B. Pe calculatorul tău (Windows)** — instalează Python, apoi dublu-click pe
`scripts\colecteaza.bat` (anul curent) sau rulează `scripts\colecteaza.bat 2020`
(toți anii de la 2020). Excel-urile apar în `export\<AN>\`. Ca să nu iei
colectarea de la zero, refă întâi baza de date din rezultatele existente:
`python run.py restore Toate-inregistrarile-2025.csv.gz …` (fișierele sunt în
branch-urile `rezultate-*`).

**C. Linux / Mac / server** — `bash scripts/run_daily.sh [AN_DE_START]` (sau
programat cu cron, vezi `scripts/crontab.example`).

Rezultatul: `Firme-noi-2026.xlsx` (toate firmele noi active) și
`Firme-noi-2026-cu-telefon.xlsx` (doar cele cu telefon propriu valid — vezi
„Verificarea telefoanelor").

---

## Instalare

```bash
cd firme-noi
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # apoi editează .env după nevoie
```

Necesită Python 3.10+.

---

## Utilizare rapidă

```bash
# 0. Verifică accesul la ANAF și ONRC (și dacă ANAF întoarce telefonul)
python run.py probe

# 1. Colectează firmele înmatriculate în 2026 din ONRC (data.gov.ro)
python run.py collect --source onrc --an 2026

# 2. Completează cu date oficiale de la ANAF
python run.py enrich

# 3. Caută telefoane (best-effort, după providerii din .env)
python run.py phones

# 4. (opțional) indicatori financiari din bilanț – util pentru firme cu vechime
python run.py bilant --an 2024

# — sau tot fluxul de bază dintr-o comandă —
python run.py run --source onrc

# Statistici detaliate (pe secțiuni CAEN, pe județe, acoperire contact)
python run.py stats

# Filtrează și afișează
python run.py filter --sectiune F --with-phone --judet Cluj   # construcții cu telefon, Cluj
python run.py filter --caen-prefix 62 --active                # tot IT-ul, doar active
python run.py filter --without-phone                          # ce mai are nevoie de telefon

# Export (filtrele de mai jos merg și la export)
python run.py export --out export/firme.csv --with-phone
python run.py export --out export/iasi.xlsx --format xlsx --judet Iași --sectiune F
```

### Import dintr-un fișier existent

Dacă ai deja o listă (Excel/CSV primit sau exportat de undeva):

```bash
python run.py import --file lista.xlsx
```

Datele importate sunt marcate ca **neverificate**. Ca să afli ce e real:

```bash
python run.py verify --limit 100
```

`verify` interoghează API-ul oficial ANAF pentru fiecare firmă și raportează
dacă denumirea se confirmă și dacă ANAF chiar returnează un telefon. Așa
demaști rapid datele inventate (nume care nu se potrivesc, CUI-uri inexistente,
telefoane care nu vin din nicio sursă oficială).

---

## Cum sunt detectate „firmele noi"

ONRC nu publică un flux „doar firmele de azi", ci un fișier cu **toate** firmele
(`OD_FIRME.csv`), actualizat periodic (de regulă lunar). Filtrarea se face după
coloana `DATA_INMATRICULARE`: `--an 2026` păstrează doar firmele înmatriculate
în 2026. Dacă o versiune a fișierului nu are această coloană, comanda se
oprește cu un mesaj clar în loc să ia toate cele ~3 milioane de firme; atunci
folosește `--cui-min` (CUI-urile se alocă crescător).

În plus, baza de date ține minte CUI-urile deja văzute, deci rulările repetate
nu creează duplicate și ANAF e interogat doar pentru firmele noi.

Firmele înmatriculate după data ultimului set ONRC publicat apar abia la
următoarea actualizare ONRC.

**Sursa `anaf_scan` (implicită pe GitHub).** `data.gov.ro` nu răspunde
serverelor din afara României, deci pe GitHub lista se ia direct de la ANAF:
CUI-urile se alocă în ordine (număr de bază + cifră de control), iar sistemul
interoghează ANAF în loturi de 100 de CUI-uri consecutive — în sus până la cele
mai noi, în jos până la firmele înregistrate înainte de `--dupa`. Fiecare firmă
găsită vine direct cu datele ANAF (inclusiv telefonul), iar datele sunt la zi,
nu cu întârzierea lunară a ONRC. Rulările următoare scanează doar CUI-urile noi.

```bash
python run.py collect --source anaf_scan --an 2026
```

---

## Ce conține baza de date

Pentru fiecare firmă se rețin (când sursa le oferă):

| Grup | Câmpuri |
|------|---------|
| **Identificare** | CUI, denumire, nr. reg. com., EUID, formă juridică / organizare / proprietate |
| **Activitate** | cod CAEN, descrierea CAEN, secțiunea economică (A–U) și denumirea ei |
| **Stare & fiscal** | stare înregistrare, data înmatriculării, actul de înființare, inactiv/radiat (+ date), plătitor TVA (+ perioadă), TVA la încasare, split TVA, RO e-Factura, organ fiscal, IBAN |
| **Adresă** | județ, localitate, stradă, număr, cod poștal, țară, adresă completă + domiciliu fiscal |
| **Contact** | telefon (+ sursa lui), fax, email, website |
| **Financiar (bilanț)** | an, cifră de afaceri, profit net, pierdere netă, nr. salariați, active, datorii, capitaluri |
| **Metadate** | sursa descoperirii, data colectării/actualizării, ce etape au rulat |

Există și un tabel de referință `caen_ref` (cod → descriere + secțiune) și un
tabel `runs` cu jurnalul fiecărei rulări.

## Tipuri de entitate

ANAF alocă CUI și sediilor secundare / punctelor de lucru ale firmelor
existente, persoanelor fizice autorizate (PFA/II/IF), profesiilor liberale și
asociațiilor. Fiecare înregistrare primește în export coloana **„Tip
entitate"** (Firmă · Sediu secundar / punct de lucru · PFA / II / IF ·
Profesie liberală / cabinet · Asociație / ONG / altele) și **„Activă"** (Nu
pentru radiate/dizolvate/inactive).

O firmă nouă are număr de Registrul Comerțului (J...) chiar din ziua
înmatriculării. Un CUI cu denumire de firmă, dar **fără număr J**, este al unui
punct de lucru înregistrat fiscal: poartă numele firmei-mamă și de obicei
același telefon (ex. „OASIS CONFORT S.R.L." 55623502 = punct de lucru al firmei
54213946). În ianuarie–martie 2026 au fost ~30.000 de astfel de înregistrări;
ele nu sunt numărate ca firme noi.

Firme noi active (cu număr J): **2020: 47.465 · 2021: 63.666 · 2022: 75.079 ·
2023: 68.007 · 2024: 69.681 · 2025: 88.380 · 2026 (până la 25 sept): 54.939**. Fișierele principale (`Firme-noi-AN*.xlsx`) conțin doar
firmele noi active; `Toate-inregistrarile-AN.csv.gz` le conține pe toate.

## Verificarea telefoanelor

`python run.py verifica-telefoane` (rulează automat înainte de export):

- **numere false** — ultimele 7 cifre identice (0722222222), secvențe
  (0712345678), 6+ zerouri (0780000001), prefixe invalide (+00000000). Nu se
  șterg, se marchează „Suspect";
- **numere comune** — același număr la **3+ firme diferite** este aproape
  întotdeauna al contabilului / firmei de consultanță care le-a înființat (ex.
  un singur număr apare la 2.164 de firme). Firma și propriile puncte de lucru
  (aceeași denumire) contează o singură dată. Marcate „Comun"; foaia
  **„Telefoane comune"** din Excel le listează;
- același număr la **2 firme** rămâne valid (de regulă același antreprenor).

Coloana **„Calitate telefon"**: OK · Străin · Comun · Suspect. Fișierul
`*-cu-telefon.xlsx` conține doar OK și Străin (`--with-phone --fara-suspecte
--fara-comune`). Firme noi active cu telefon propriu valid: 2020: 13.434 (28%) ·
2021: 16.596 (26%) · 2022: 19.547 (26%) · 2023: 42.092 (62%) · 2024: 44.778 (64%) ·
2025: 57.154 (65%) · 2026: 35.226 (64%). ANAF are telefonul mult mai rar pentru
firmele înființate înainte de decembrie 2022.

## Filtre disponibile (comenzile `filter` și `export`)

`--judet` · `--localitate` · `--caen` (cod exact) · `--caen-prefix` (ex. `62` =
tot IT-ul) · `--sectiune` (A–U, ex. `F` = construcții) · `--denumire` ·
`--with-phone` / `--without-phone` · `--with-email` · `--platitor-tva` ·
`--active` (exclude radiate/inactive) · `--doar-firme` (doar firme noi active) · `--fara-suspecte` ·
`--fara-comune` (fără numere folosite de 3+ firme) · `--max-utilizari N` · `--min-salariati N` · `--min-cifra X` ·
`--dupa YYYY-MM-DD` / `--inainte YYYY-MM-DD` · `--order-by` · `--desc` · `--limit`

Secțiunile CAEN utile: **F** construcții, **G** comerț, **J** IT & comunicații,
**H** transport, **M** servicii profesionale, **I** hoteluri/restaurante,
**Q** sănătate, **C** producție.

---

## Automatizare (rulare zilnică)

Pe GitHub: workflow-ul `.github/workflows/colectare.yml` (varianta A de mai sus)
rulează zilnic și păstrează baza de date între rulări. Pe un server propriu:

```bash
chmod +x scripts/run_daily.sh
crontab -e     # adaugă linia din scripts/crontab.example
```

---

## Arhitectură

```
firme-noi/
├── .github/workflows/        # colectare zilnică pe GitHub Actions (doar repo privat)
├── run.py                    # CLI (probe/collect/enrich/phones/bilant/run/import/verify/stats/filter/export/page)
├── firme/
│   ├── config.py             # configurare din .env
│   ├── models.py             # modelul Company (schema bogată)
│   ├── db.py                 # SQLite: schemă auto, migrare, deduplicare, filtre, statistici
│   ├── caen.py               # nomenclator CAEN (cod → descriere + secțiune A–U)
│   ├── util.py               # HTTP cu throttling+retry, normalizare telefoane
│   ├── importers.py          # import din .xlsx / .csv
│   ├── pipeline.py           # orchestrarea fluxului
│   ├── sources/              # de UNDE luăm firmele
│   │   ├── onrc_opendata.py  #   ONRC / data.gov.ro (recomandat)
│   │   └── monitorul_oficial.py  # Monitorul Oficial Partea IV (best-effort, PDF)
│   └── enrich/               # cu CE le completăm
│       ├── anaf.py           #   API oficial ANAF (adresă, CAEN, TVA, stare…)
│       ├── bilant.py         #   indicatori financiari (cifră afaceri, profit, salariați)
│       └── phone.py          #   telefoane: anaf / google / web
├── scripts/                  # colecteaza.bat (Windows), run_daily.sh, exemplu cron
└── tests/                    # teste (fără rețea)
```

Baza de date e SQLite (un singur fișier, `data/firme.db`) — zero configurare.
Migrarea la PostgreSQL e simplă, schema fiind aproape identică.

---

## Notă legală / GDPR

Datele despre firme (denumire, CUI, sediu) sunt publice. Numerele de telefon,
mai ales cele legate de persoane fizice autorizate, pot intra sub incidența
GDPR. Folosește datele **doar** în scop legitim și declarat (ex. B2B), respectă
cererile de dezabonare și legislația privind comunicările comerciale
(ex. consimțământ pentru marketing). Sursele oficiale au propriile condiții de
licențiere (ONRC: Licența pentru Guvernare Deschisă; ANAF: serviciu public).
