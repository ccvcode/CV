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
3. Descarcă Excel-ul din secțiunea **Artifacts** a rulării. De atunci rulează
   singur în fiecare dimineață. Workflow-ul refuză să ruleze într-un repository
   public, ca datele de contact să nu devină publice.

**B. Pe calculatorul tău (Windows)** — instalează Python, apoi dublu-click pe
`scripts\colecteaza.bat`. Excel-urile apar în folderul `export`.

**C. Linux / Mac / server** — `bash scripts/run_daily.sh` (sau programat cu cron,
vezi `scripts/crontab.example`).

Rezultatul: `Firme-noi-2026.xlsx` (toate firmele) și
`Firme-noi-2026-cu-telefon.xlsx` (doar cele cu telefon valid).

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

## Filtre disponibile (comenzile `filter` și `export`)

`--judet` · `--localitate` · `--caen` (cod exact) · `--caen-prefix` (ex. `62` =
tot IT-ul) · `--sectiune` (A–U, ex. `F` = construcții) · `--denumire` ·
`--with-phone` / `--without-phone` · `--with-email` · `--platitor-tva` ·
`--active` (exclude radiate/inactive) · `--min-salariati N` · `--min-cifra X` ·
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
