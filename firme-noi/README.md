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
unul, câmpul rămâne gol. Comanda `verify` reinteroghează ANAF și îți arată
exact ce se confirmă, ca să poți valida orice listă.

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
# 1. Colectează firmele noi din ONRC (data.gov.ro)
python run.py collect --source onrc

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
(`OD_FIRME.csv`), actualizat periodic. Sistemul folosește baza de date ca
memorie: **orice CUI care apare în fișier și nu există încă la noi este o firmă
nouă**. La prima rulare se creează baza de referință; de la a doua rulare
încolo obții doar noutățile. Rulările repetate nu creează duplicate.

Pentru confirmarea că o firmă e într-adevăr recentă, folosește
`data_inregistrare` adusă de ANAF (data reală a înmatriculării).

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

```bash
chmod +x scripts/run_daily.sh
crontab -e     # adaugă linia din scripts/crontab.example
```

---

## Arhitectură

```
firme-noi/
├── run.py                    # CLI (collect/enrich/phones/bilant/run/import/verify/stats/filter/export)
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
├── scripts/                  # rulare zilnică + exemplu cron
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
