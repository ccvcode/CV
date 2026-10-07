"""Sursă: datele deschise ONRC de pe data.gov.ro.

ONRC publică periodic setul „Firme înregistrate la Registrul Comerțului până
la data de ..." cu fișierul OD_FIRME.csv (TOATE firmele, separator `^`).

Firmele NOI se obțin astfel:
  - dacă fișierul are coloana DATA_INMATRICULARE: filtrăm direct după dată
    (ex. `--dupa 2026-01-01` = toate firmele înmatriculate în 2026);
  - altfel, filtru de rezervă după CUI minim (`--cui-min`), fiindcă CUI-urile
    se alocă crescător;
  - în plus, baza de date ignoră CUI-urile deja cunoscute.

Fișierul are sute de MB; îl citim în flux, fără să-l ținem în memorie.
"""

from __future__ import annotations

import csv
import io
import logging
import os
import re
import tempfile
import zipfile
from typing import Iterable, Iterator, Optional

from ..models import Company
from ..util import parse_date
from .base import Source

log = logging.getLogger("firme")

CKAN_SEARCH = "https://data.gov.ro/api/3/action/package_search"

# Antetele cunoscute ale fișierului ONRC -> câmpul nostru.
KNOWN_COLUMNS = {
    "DENUMIRE": "denumire",
    "CUI": "cui",
    "COD_FISCAL": "cui",
    "COD_INMATRICULARE": "nr_reg_com",
    "NR_REG_COM": "nr_reg_com",
    "DATA_INMATRICULARE": "data_inregistrare",
    "DATA_INREGISTRARE": "data_inregistrare",
    "EUID": "euid",
    "FORMA_JURIDICA": "forma_juridica",
    "ADR_TARA": "tara",
    "ADR_JUDET": "judet",
    "JUDET": "judet",
    "ADR_LOCALITATE": "localitate",
    "LOCALITATE": "localitate",
    "ADR_DEN_STRADA": "strada",
    "ADR_NR_STRADA": "numar",
    "ADR_COD_POSTAL": "cod_postal",
    "ADRESA": "adresa",
    "ADRESA_COMPLETA": "adresa",
    "ADR_COMPLETA": "adresa",
}

# Componentele de adresă, în ordinea în care le compunem, cu eticheta lor.
ADDRESS_PARTS = [
    ("ADR_DEN_STRADA", ""), ("ADR_NR_STRADA", "nr. "), ("ADR_BLOC", "bl. "),
    ("ADR_SCARA", "sc. "), ("ADR_ETAJ", "et. "), ("ADR_APARTAMENT", "ap. "),
    ("ADR_SECTOR", "sector "), ("ADR_COMPLETARE", ""),
    ("ADR_LOCALITATE", ""), ("ADR_JUDET", "jud. "),
]


def normalize_header(h: str) -> str:
    return h.replace("﻿", "").strip().strip('"').upper().replace(" ", "_").replace("-", "_")


def map_column(header: str) -> Optional[str]:
    """Mapează un antet la câmpul intern; întâi exact, apoi aproximativ."""
    h = normalize_header(header)
    if h in KNOWN_COLUMNS:
        return KNOWN_COLUMNS[h]
    if "DATA" in h and "INMATRICULARE" in h:
        return "data_inregistrare"
    if "INMATRICULARE" in h:
        return "nr_reg_com"
    if h in ("CIF", "COD_UNIC") or h.endswith("_CUI"):
        return "cui"
    if h.startswith("DENUMIRE") and "STRADA" not in h:
        return "denumire"
    return None


def parse_cui(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None
    value = int(digits)
    return value or None


def sniff_delimiter(header_line: str) -> str:
    for cand in ("^", ";", "\t", "|", ","):
        if cand in header_line:
            return cand
    return ","


def _decode(raw: bytes) -> str:
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1250", errors="replace")


class OnrcOpenDataSource(Source):
    name = "onrc"

    def __init__(self, config, session, **options) -> None:
        super().__init__(config, session, **options)
        self.dupa = options.get("dupa") or os.environ.get("ONRC_DUPA") or None
        self.judet_filter = (options.get("judet") or os.environ.get("ONRC_JUDET") or "").upper() or None
        try:
            self.cui_min = int(options.get("cui_min") or os.environ.get("ONRC_CUI_MIN") or 0) or None
        except ValueError:
            self.cui_min = None
        try:
            self.max_rows = int(options.get("max_rows") or os.environ.get("ONRC_MAX_ROWS") or 0) or None
        except ValueError:
            self.max_rows = None
        self.dataset_title: Optional[str] = None

    # ------------------------------------------------------------------ #
    # Descoperire + descărcare                                             #
    # ------------------------------------------------------------------ #

    def discover(self) -> tuple[str, str]:
        """Găsește cel mai recent OD_FIRME pe data.gov.ro. Întoarce (url, titlu)."""
        if self.config.onrc_csv_url:
            return self.config.onrc_csv_url, "URL setat manual (ONRC_CSV_URL)"
        resp = self.session.get(
            CKAN_SEARCH,
            params={"fq": "organization:onrc", "sort": "metadata_created desc", "rows": 25},
        )
        resp.raise_for_status()
        for pkg in resp.json().get("result", {}).get("results", []):
            for res in pkg.get("resources", []):
                url = res.get("url") or ""
                label = f"{url} {res.get('name') or ''}".lower()
                path = url.lower().split("?")[0]
                if "od_firme" in label and (path.endswith(".csv") or path.endswith(".zip")
                                            or (res.get("format") or "").lower() == "csv"):
                    return url, pkg.get("title") or pkg.get("name") or ""
        raise RuntimeError(
            "Nu am găsit OD_FIRME pe data.gov.ro. Setează manual ONRC_CSV_URL în .env."
        )

    def open_lines(self, url: str) -> Iterator[str]:
        """Liniile fișierului (CSV direct sau CSV din arhivă .zip)."""
        if url.lower().split("?")[0].endswith(".zip"):
            tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
            try:
                resp = self.session.get(url, stream=True)
                resp.raise_for_status()
                for chunk in resp.iter_content(1 << 20):
                    tmp.write(chunk)
                tmp.close()
                with zipfile.ZipFile(tmp.name) as zf:
                    names = zf.namelist()
                    member = next((n for n in names if "od_firme" in n.lower()), names[0])
                    with zf.open(member) as fh:
                        for raw in fh:
                            yield _decode(raw).rstrip("\r\n")
            finally:
                os.unlink(tmp.name)
            return

        resp = self.session.get(url, stream=True)
        resp.raise_for_status()
        try:
            for raw in resp.iter_lines(chunk_size=1 << 16):
                yield _decode(raw)
        finally:
            resp.close()

    def read_header(self, url: str) -> list[str]:
        lines = self.open_lines(url)
        try:
            for line in lines:
                if line.strip():
                    return next(csv.reader([line], delimiter=sniff_delimiter(line)))
        finally:
            lines.close()
        return []

    # ------------------------------------------------------------------ #
    # Parsare (testabilă fără rețea)                                       #
    # ------------------------------------------------------------------ #

    def parse_lines(self, lines: Iterable[str]) -> Iterator[Company]:
        lines = iter(lines)
        header_line = ""
        for line in lines:
            if line.strip():
                header_line = line
                break
        if not header_line:
            return
        delimiter = sniff_delimiter(header_line)
        headers = [normalize_header(h) for h in next(csv.reader([header_line], delimiter=delimiter))]
        col_map = {i: map_column(h) for i, h in enumerate(headers)}
        fields = set(col_map.values())
        log.info("Coloane ONRC: %s", ", ".join(headers))
        if "cui" not in fields:
            raise RuntimeError(f"Nu am găsit coloana CUI în antet: {headers}")
        if self.dupa and "data_inregistrare" not in fields:
            raise RuntimeError(
                "Fișierul ONRC nu are coloana DATA_INMATRICULARE, deci nu pot filtra după "
                "dată. Folosește în schimb --cui-min (CUI-urile se alocă crescător)."
            )
        has_address_parts = any(h in headers for h, _ in ADDRESS_PARTS)

        count = 0
        for values in csv.reader((ln for ln in lines if ln), delimiter=delimiter):
            record: dict[str, str] = {}
            raw_by_header: dict[str, str] = {}
            for i, value in enumerate(values):
                value = value.strip()
                if i < len(headers):
                    raw_by_header[headers[i]] = value
                field = col_map.get(i)
                if field and value and field not in record:
                    record[field] = value

            cui = parse_cui(record.get("cui"))
            if cui is None:
                continue
            if self.cui_min and cui < self.cui_min:
                continue
            data_inreg = parse_date(record.get("data_inregistrare"))
            if self.dupa and (not data_inreg or data_inreg < self.dupa):
                continue
            if self.judet_filter and (record.get("judet") or "").upper() != self.judet_filter:
                continue

            adresa = record.get("adresa")
            if not adresa and has_address_parts:
                parts = [
                    f"{label}{raw_by_header[h]}" for h, label in ADDRESS_PARTS
                    if raw_by_header.get(h)
                ]
                adresa = ", ".join(parts) or None

            yield Company(
                cui=cui,
                denumire=record.get("denumire"),
                nr_reg_com=record.get("nr_reg_com"),
                euid=record.get("euid"),
                forma_juridica=record.get("forma_juridica"),
                data_inregistrare=data_inreg,
                judet=record.get("judet"),
                localitate=record.get("localitate"),
                strada=record.get("strada"),
                numar=record.get("numar"),
                cod_postal=record.get("cod_postal"),
                tara=record.get("tara"),
                adresa=adresa,
                sursa=self.name,
            )
            count += 1
            if self.max_rows and count >= self.max_rows:
                log.info("Am atins limita de %s rânduri.", self.max_rows)
                break

    def collect(self) -> Iterator[Company]:
        url, title = self.discover()
        self.dataset_title = title
        log.info("Set ONRC: %s", title)
        log.info("Descarc: %s", url)
        yield from self.parse_lines(self.open_lines(url))
