"""Sursă: datele deschise ONRC de pe data.gov.ro.

ONRC (Oficiul Național al Registrului Comerțului) publică periodic pe portalul
de date deschise data.gov.ro un set „Firme înregistrate la Registrul Comerțului
până la data de ..." care conține fișierul OD_FIRME.csv cu TOATE firmele.

Cum detectăm firmele NOI:
    Nu există un flux oficial „doar firmele de azi". În schimb, comparăm setul
    curent cu ce avem deja în baza de date: orice CUI care apare în fișier și nu
    e încă la noi este o firmă nou apărută. La prima rulare se creează baza de
    referință; de la a doua rulare încolo obținem doar noutățile.

    Pentru confirmare, etapa de îmbogățire ANAF aduce `data_inregistrare`
    (data reală a înmatriculării), pe care o poți folosi ca filtru.

Notă: fișierul este mare (sute de MB). Îl citim în flux (streaming), fără a-l
încărca tot în memorie. Poți restrânge după județ (ONRC_JUDET) sau limita
numărul de rânduri citiți (ONRC_MAX_ROWS) în timpul testelor.
"""

from __future__ import annotations

import csv
import io
import logging
import os
from typing import Iterator, Optional

from ..models import Company
from .base import Source

log = logging.getLogger("firme")

CKAN_SEARCH = "https://data.gov.ro/api/3/action/package_search"

# Cuvinte-cheie pentru maparea flexibilă a coloanelor (fișierul ONRC variază în timp).
COLUMN_ALIASES = {
    "cui": ("cui", "cod_fiscal", "codfiscal"),
    "denumire": ("denumire", "nume", "firma"),
    "nr_reg_com": ("cod_inmatriculare", "inmatriculare", "nr_reg", "numar_ordine"),
    "stare_inregistrare": ("stare_firma", "stare", "status"),
    "judet": ("judet", "cod_judet"),
    "localitate": ("localitate", "oras", "comuna"),
    "adresa": ("adresa", "sediu", "strada"),
}


def _match_column(header: str) -> Optional[str]:
    """Mapează un nume de coloană din CSV la câmpul nostru intern."""
    key = header.strip().lower().replace(" ", "_").replace("-", "_")
    for field, aliases in COLUMN_ALIASES.items():
        if key == field or any(alias in key for alias in aliases):
            return field
    return None


class OnrcOpenDataSource(Source):
    name = "onrc"

    def __init__(self, config, session) -> None:
        super().__init__(config, session)
        self.judet_filter = os.environ.get("ONRC_JUDET", "").strip().upper() or None
        try:
            self.max_rows = int(os.environ.get("ONRC_MAX_ROWS", "0")) or None
        except ValueError:
            self.max_rows = None

    # ------------------------------------------------------------------ #

    def _discover_csv_url(self) -> str:
        """Găsește pe data.gov.ro cel mai recent OD_FIRME.csv al ONRC."""
        if self.config.onrc_csv_url:
            return self.config.onrc_csv_url

        log.info("Caut cel mai recent set de date ONRC pe data.gov.ro...")
        resp = self.session.get(
            CKAN_SEARCH,
            params={
                "q": "firme registrul comertului",
                "fq": "organization:onrc",
                "sort": "metadata_modified desc",
                "rows": 10,
            },
        )
        resp.raise_for_status()
        results = resp.json().get("result", {}).get("results", [])
        for pkg in results:
            for res in pkg.get("resources", []):
                url = (res.get("url") or "")
                fmt = (res.get("format") or "").lower()
                name = (res.get("name") or "").upper()
                if ("OD_FIRME" in url.upper() or "OD_FIRME" in name) and (
                    fmt == "csv" or url.lower().endswith(".csv")
                ):
                    log.info("Set de date găsit: %s", pkg.get("title"))
                    return url
        raise RuntimeError(
            "Nu am găsit automat fișierul OD_FIRME.csv pe data.gov.ro. "
            "Setează manual ONRC_CSV_URL în .env."
        )

    def _open_stream(self, url: str) -> Iterator[str]:
        """Deschide CSV-ul în flux și întoarce un iterator de linii text."""
        resp = self.session.get(url, stream=True)
        resp.raise_for_status()
        if not resp.encoding:
            resp.encoding = "utf-8"
        yield from resp.iter_lines(decode_unicode=True)

    @staticmethod
    def _sniff_delimiter(header_line: str) -> str:
        try:
            dialect = csv.Sniffer().sniff(header_line, delimiters="^;\t,|")
            return dialect.delimiter
        except csv.Error:
            # ONRC folosește frecvent caret (^) sau punct-și-virgulă (;)
            for cand in ("^", ";", "\t", "|", ","):
                if cand in header_line:
                    return cand
            return ","

    # ------------------------------------------------------------------ #

    def collect(self) -> Iterator[Company]:
        url = self._discover_csv_url()
        log.info("Descarc și parsez %s", url)
        lines = self._open_stream(url)

        try:
            header_line = next(lines)
        except StopIteration:
            return
        delimiter = self._sniff_delimiter(header_line)
        headers = next(csv.reader([header_line], delimiter=delimiter))
        col_map = {i: _match_column(h) for i, h in enumerate(headers)}
        if "cui" not in col_map.values():
            raise RuntimeError(
                f"Nu am găsit coloana CUI în antet: {headers}. "
                "Verifică formatul fișierului sau ajustează COLUMN_ALIASES."
            )

        reader = csv.reader(_line_iter(lines), delimiter=delimiter)
        count = 0
        for fields in reader:
            record: dict[str, str] = {}
            for i, value in enumerate(fields):
                field = col_map.get(i)
                if field:
                    record[field] = value.strip()

            cui = _parse_cui(record.get("cui"))
            if cui is None:
                continue
            if self.judet_filter and record.get("judet", "").upper() != self.judet_filter:
                continue

            yield Company(
                cui=cui,
                denumire=record.get("denumire") or None,
                nr_reg_com=record.get("nr_reg_com") or None,
                judet=record.get("judet") or None,
                localitate=record.get("localitate") or None,
                adresa=record.get("adresa") or None,
                stare_inregistrare=record.get("stare_inregistrare") or None,
                sursa=self.name,
            )
            count += 1
            if self.max_rows and count >= self.max_rows:
                log.info("Am atins limita ONRC_MAX_ROWS=%s.", self.max_rows)
                break


def _line_iter(lines: Iterator[str]) -> Iterator[str]:
    for line in lines:
        if line:
            yield line


def _parse_cui(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None
