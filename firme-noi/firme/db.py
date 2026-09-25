"""Stratul de bază de date (SQLite).

SQLite e ales pentru că nu necesită server: totul stă într-un singur fișier
(`data/firme.db` implicit). Pentru volume mari se poate migra ușor la PostgreSQL,
schema fiind aproape identică.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable, Iterator, Optional

from .models import Company
from .util import now_iso

SCHEMA = """
CREATE TABLE IF NOT EXISTS companies (
    cui                INTEGER PRIMARY KEY,
    denumire           TEXT,
    nr_reg_com         TEXT,
    cod_caen           TEXT,
    judet              TEXT,
    localitate         TEXT,
    adresa             TEXT,
    cod_postal         TEXT,
    stare_inregistrare TEXT,
    data_inregistrare  TEXT,
    scop_tva           INTEGER,
    telefon            TEXT,
    telefon_sursa      TEXT,
    email              TEXT,
    website            TEXT,
    sursa              TEXT,
    data_colectare     TEXT,
    data_actualizare   TEXT,
    anaf_verificat     INTEGER DEFAULT 0,
    telefon_cautat     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_companies_anaf     ON companies(anaf_verificat);
CREATE INDEX IF NOT EXISTS idx_companies_tel      ON companies(telefon_cautat);
CREATE INDEX IF NOT EXISTS idx_companies_judet    ON companies(judet);
CREATE INDEX IF NOT EXISTS idx_companies_colectare ON companies(data_colectare);

CREATE TABLE IF NOT EXISTS runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    inceput        TEXT,
    sfarsit        TEXT,
    etapa          TEXT,     -- collect / enrich / phone
    sursa          TEXT,
    firme_noi      INTEGER DEFAULT 0,
    firme_procesate INTEGER DEFAULT 0,
    detalii        TEXT
);
"""

# Coloanele actualizabile la un UPSERT (toate în afară de cheia primară `cui`).
_UPDATABLE = [
    "denumire", "nr_reg_com", "cod_caen", "judet", "localitate", "adresa",
    "cod_postal", "stare_inregistrare", "data_inregistrare", "scop_tva",
    "telefon", "telefon_sursa", "email", "website", "sursa",
    "data_colectare", "data_actualizare", "anaf_verificat", "telefon_cautat",
]


class Database:
    def __init__(self, path: Path | str) -> None:
        self.path = str(path)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> "Database":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # ---------------------------------------------------------------- #
    # Scriere                                                           #
    # ---------------------------------------------------------------- #

    def exists(self, cui: int) -> bool:
        cur = self.conn.execute("SELECT 1 FROM companies WHERE cui = ?", (cui,))
        return cur.fetchone() is not None

    def insert_new(self, company: Company) -> bool:
        """Inserează o firmă doar dacă CUI-ul nu există deja.

        Întoarce True dacă a fost inserată (firmă nou descoperită), False dacă
        exista deja. Aceasta este logica de detectare a „firmelor noi": tot ce
        apare în sursă și nu e încă în baza noastră de date este nou.
        """
        if company.data_colectare is None:
            company.data_colectare = now_iso()
        company.data_actualizare = now_iso()
        row = company.to_row()
        placeholders = ", ".join("?" for _ in row)
        columns = ", ".join(row.keys())
        try:
            self.conn.execute(
                f"INSERT INTO companies ({columns}) VALUES ({placeholders})",
                tuple(row.values()),
            )
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def update(self, company: Company) -> None:
        """Actualizează câmpurile ne-nule ale unei firme existente.

        Nu suprascrie o valoare existentă cu None (păstrăm ce am colectat deja).
        """
        company.data_actualizare = now_iso()
        row = company.to_row()
        set_cols = []
        values = []
        for col in _UPDATABLE:
            value = row.get(col)
            if value is None:
                continue
            set_cols.append(f"{col} = ?")
            values.append(value)
        if not set_cols:
            return
        values.append(company.cui)
        self.conn.execute(
            f"UPDATE companies SET {', '.join(set_cols)} WHERE cui = ?",
            values,
        )
        self.conn.commit()

    # ---------------------------------------------------------------- #
    # Citire                                                            #
    # ---------------------------------------------------------------- #

    def get(self, cui: int) -> Optional[Company]:
        cur = self.conn.execute("SELECT * FROM companies WHERE cui = ?", (cui,))
        row = cur.fetchone()
        return Company.from_row(dict(row)) if row else None

    def iter_needing_anaf(self, limit: Optional[int] = None) -> Iterator[Company]:
        sql = "SELECT * FROM companies WHERE anaf_verificat = 0 ORDER BY data_colectare"
        if limit:
            sql += f" LIMIT {int(limit)}"
        for row in self.conn.execute(sql):
            yield Company.from_row(dict(row))

    def iter_needing_phone(self, limit: Optional[int] = None) -> Iterator[Company]:
        sql = (
            "SELECT * FROM companies "
            "WHERE telefon IS NULL AND telefon_cautat = 0 "
            "ORDER BY data_colectare"
        )
        if limit:
            sql += f" LIMIT {int(limit)}"
        for row in self.conn.execute(sql):
            yield Company.from_row(dict(row))

    def iter_all(self) -> Iterator[Company]:
        for row in self.conn.execute("SELECT * FROM companies ORDER BY data_colectare"):
            yield Company.from_row(dict(row))

    # ---------------------------------------------------------------- #
    # Statistici + jurnal de rulări                                     #
    # ---------------------------------------------------------------- #

    def stats(self) -> dict[str, int]:
        c = self.conn
        one = lambda sql: c.execute(sql).fetchone()[0]  # noqa: E731
        return {
            "total": one("SELECT COUNT(*) FROM companies"),
            "verificate_anaf": one("SELECT COUNT(*) FROM companies WHERE anaf_verificat = 1"),
            "cu_telefon": one("SELECT COUNT(*) FROM companies WHERE telefon IS NOT NULL"),
            "telefon_cautat": one("SELECT COUNT(*) FROM companies WHERE telefon_cautat = 1"),
            "platitori_tva": one("SELECT COUNT(*) FROM companies WHERE scop_tva = 1"),
        }

    def log_run(
        self,
        etapa: str,
        sursa: str,
        inceput: str,
        firme_noi: int = 0,
        firme_procesate: int = 0,
        detalii: str = "",
    ) -> None:
        self.conn.execute(
            "INSERT INTO runs (inceput, sfarsit, etapa, sursa, firme_noi, "
            "firme_procesate, detalii) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (inceput, now_iso(), etapa, sursa, firme_noi, firme_procesate, detalii),
        )
        self.conn.commit()
