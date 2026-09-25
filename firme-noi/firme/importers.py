"""Import de firme dintr-un fișier existent (Excel .xlsx sau CSV).

Util când ai deja o listă (export dintr-un serviciu, fișier primit etc.) și vrei
să o încarci în baza de date pentru a o gestiona, deduplica și — important —
a o VERIFICA ulterior față de sursa oficială ANAF (comanda `enrich`).

Datele importate sunt marcate cu sursa 'import' și NU sunt considerate
verificate ANAF, tocmai ca să poată fi confruntate cu realitatea la o rulare
`enrich`. Așa se vede imediat ce informații se confirmă și ce nu.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from pathlib import Path
from typing import Iterator, Optional

from . import caen as caen_ref
from .models import Company

log = logging.getLogger("firme")


def _strip_diacritics(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch))


def _norm_header(text: str) -> str:
    return _strip_diacritics(str(text)).strip().lower()


# Mapare antet -> câmp intern (după cuvinte-cheie, tolerantă la variații).
def _map_header(header: str) -> Optional[str]:
    h = _norm_header(header)
    if "cui" in h or "cod fiscal" in h:
        return "cui"
    if "denumire" in h or "firma" in h or h == "nume":
        return "denumire"
    if "reg" in h and "com" in h:
        return "nr_reg_com"
    if "caen" in h:
        return "cod_caen"
    if "judet" in h:
        return "judet"
    if "localitate" in h or "oras" in h:
        return "localitate"
    if "telefon" in h or "tel." in h or h == "tel":
        return "telefon"
    if "adres" in h:
        return "adresa"
    if "email" in h or "e-mail" in h:
        return "email"
    if "web" in h or "site" in h:
        return "website"
    if "data" in h and ("inreg" in h or "reg" in h):
        return "data_inregistrare"
    return None


def _parse_cui(raw) -> Optional[int]:
    if raw is None:
        return None
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    return int(digits) if digits else None


def _rows_from_xlsx(path: Path) -> Iterator[list]:
    try:
        import openpyxl  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "Pentru import .xlsx e nevoie de openpyxl: pip install openpyxl"
        ) from exc

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            yield list(row)


def _rows_from_csv(path: Path) -> Iterator[list]:
    import csv

    with path.open(encoding="utf-8", errors="replace", newline="") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        try:
            delimiter = csv.Sniffer().sniff(sample, delimiters=";,\t|").delimiter
        except csv.Error:
            delimiter = ","
        for row in csv.reader(fh, delimiter=delimiter):
            yield row


def iter_companies_from_file(path: Path | str, sursa: str = "import") -> Iterator[Company]:
    """Citește un fișier și produce Company-uri. Detectează antetul automat."""
    path = Path(path)
    if path.suffix.lower() in (".xlsx", ".xlsm"):
        rows = _rows_from_xlsx(path)
    else:
        rows = _rows_from_csv(path)

    col_map: dict[int, str] = {}
    for row in rows:
        if not col_map:
            # Căutăm rândul de antet: cel care conține o coloană CUI + una denumire.
            candidate = {i: _map_header(v) for i, v in enumerate(row) if v is not None}
            fields = set(candidate.values())
            if "cui" in fields and "denumire" in fields:
                col_map = {i: f for i, f in candidate.items() if f}
            continue

        record: dict[str, object] = {}
        for i, value in enumerate(row):
            field = col_map.get(i)
            if field and value not in (None, ""):
                record[field] = value

        cui = _parse_cui(record.get("cui"))
        if cui is None:
            continue

        record.pop("cui", None)
        # Curățăm textul
        clean = {
            k: (str(v).strip() if isinstance(v, str) else v) for k, v in record.items()
        }
        telefon = clean.get("telefon")
        cod_caen = str(clean.get("cod_caen")).strip() if clean.get("cod_caen") is not None else None
        caen_info = caen_ref.enrich_caen(cod_caen)
        yield Company(
            cui=cui,
            denumire=clean.get("denumire"),
            nr_reg_com=clean.get("nr_reg_com"),
            cod_caen=cod_caen,
            caen_descriere=caen_info["caen_descriere"],
            caen_sectiune=caen_info["caen_sectiune"],
            caen_sectiune_nume=caen_info["caen_sectiune_nume"],
            judet=clean.get("judet"),
            localitate=clean.get("localitate"),
            adresa=clean.get("adresa"),
            data_inregistrare=str(clean.get("data_inregistrare")) if clean.get("data_inregistrare") else None,
            telefon=str(telefon).strip() if telefon else None,
            telefon_sursa="import" if telefon else None,
            telefon_cautat=bool(telefon),
            email=clean.get("email"),
            website=clean.get("website"),
            sursa=sursa,
        )
