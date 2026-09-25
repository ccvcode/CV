"""Stratul de bază de date (SQLite) — schemă bogată + motor de filtrare.

Schema se generează automat din modelul `Company`, deci cele două nu pot ieși
din sincron. La deschidere se rulează o migrare ușoară care adaugă coloanele
noi într-o bază de date mai veche (fără pierderi de date).

SQLite nu necesită server (un singur fișier). Migrarea la PostgreSQL e directă.
"""

from __future__ import annotations

import sqlite3
from dataclasses import fields as dc_fields
from pathlib import Path
from typing import Iterator, Optional

from . import caen as caen_ref
from .models import FLAG_FIELDS, OPTIONAL_BOOL_FIELDS, Company
from .util import now_iso

# Tipurile coloanelor (restul sunt TEXT).
_INT_COLS = {"cui", "numar_salariati", "an_bilant"} | FLAG_FIELDS | OPTIONAL_BOOL_FIELDS
_REAL_COLS = {
    "cifra_afaceri", "profit_net", "pierdere_neta",
    "active_total", "datorii_total", "capital_total",
}

COLUMNS = [f.name for f in dc_fields(Company)]
_UPDATABLE = [c for c in COLUMNS if c != "cui"]

# Coloane pe care se pot aplica ordonări (listă albă, contra SQL injection).
_ORDERABLE = {
    "cui", "denumire", "judet", "localitate", "cod_caen", "caen_sectiune",
    "data_inregistrare", "data_colectare", "cifra_afaceri", "numar_salariati",
    "profit_net",
}


def _col_type(name: str) -> str:
    if name == "cui":
        return "INTEGER PRIMARY KEY"
    if name in _INT_COLS:
        return "INTEGER"
    if name in _REAL_COLS:
        return "REAL"
    return "TEXT"


def _create_table_sql() -> str:
    cols = ",\n    ".join(f"{name} {_col_type(name)}" for name in COLUMNS)
    return f"CREATE TABLE IF NOT EXISTS companies (\n    {cols}\n);"


_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_c_judet     ON companies(judet)",
    "CREATE INDEX IF NOT EXISTS idx_c_caen      ON companies(cod_caen)",
    "CREATE INDEX IF NOT EXISTS idx_c_sectiune  ON companies(caen_sectiune)",
    "CREATE INDEX IF NOT EXISTS idx_c_anaf      ON companies(anaf_verificat)",
    "CREATE INDEX IF NOT EXISTS idx_c_tel       ON companies(telefon)",
    "CREATE INDEX IF NOT EXISTS idx_c_colectare ON companies(data_colectare)",
    "CREATE INDEX IF NOT EXISTS idx_c_datainreg ON companies(data_inregistrare)",
]

_OTHER_TABLES = """
CREATE TABLE IF NOT EXISTS runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    inceput         TEXT,
    sfarsit         TEXT,
    etapa           TEXT,
    sursa           TEXT,
    firme_noi       INTEGER DEFAULT 0,
    firme_procesate INTEGER DEFAULT 0,
    detalii         TEXT
);

CREATE TABLE IF NOT EXISTS caen_ref (
    cod       TEXT PRIMARY KEY,
    descriere TEXT,
    sectiune  TEXT,
    sectiune_nume TEXT
);
"""


class Database:
    def __init__(self, path: Path | str) -> None:
        self.path = str(path)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        # DELETE (nu WAL): fișierul .db e mereu complet după fiecare commit, deci
        # poate fi copiat/salvat în cache oricând, chiar la o rulare întreruptă.
        self.conn.execute("PRAGMA journal_mode=DELETE;")
        self.conn.execute(_create_table_sql())
        self.conn.executescript(_OTHER_TABLES)
        for idx in _INDEXES:
            self.conn.execute(idx)
        self._migrate()
        self._seed_caen()
        self.conn.commit()

    def _migrate(self) -> None:
        """Adaugă coloanele lipsă într-o bază de date creată cu o schemă mai veche."""
        existing = {r["name"] for r in self.conn.execute("PRAGMA table_info(companies)")}
        for name in COLUMNS:
            if name not in existing:
                col_type = _col_type(name).replace(" PRIMARY KEY", "")
                self.conn.execute(f"ALTER TABLE companies ADD COLUMN {name} {col_type}")

    def _seed_caen(self) -> None:
        count = self.conn.execute("SELECT COUNT(*) FROM caen_ref").fetchone()[0]
        if count:
            return
        rows = []
        for cod, descriere in caen_ref.CAEN_DESCRIERI.items():
            letter, name = caen_ref.caen_section(cod)
            rows.append((cod, descriere, letter, name))
        self.conn.executemany(
            "INSERT OR REPLACE INTO caen_ref (cod, descriere, sectiune, sectiune_nume) "
            "VALUES (?, ?, ?, ?)",
            rows,
        )

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
        return self.conn.execute(
            "SELECT 1 FROM companies WHERE cui = ?", (cui,)
        ).fetchone() is not None

    def insert_new(self, company: Company) -> bool:
        """Inserează o firmă doar dacă CUI-ul nu există (detectarea firmelor noi)."""
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

    def insert_many(self, companies) -> int:
        """Inserează în lot; firmele deja existente (după CUI) sunt ignorate.
        Întoarce numărul de firme noi."""
        now = now_iso()
        rows = []
        for c in companies:
            c.data_colectare = c.data_colectare or now
            c.data_actualizare = now
            row = c.to_row()
            rows.append(tuple(row[col] for col in COLUMNS))
        if not rows:
            return 0
        before = self.conn.total_changes
        self.conn.executemany(
            f"INSERT OR IGNORE INTO companies ({', '.join(COLUMNS)}) "
            f"VALUES ({', '.join('?' for _ in COLUMNS)})",
            rows,
        )
        self.conn.commit()
        return self.conn.total_changes - before

    def update(self, company: Company, commit: bool = True) -> None:
        """Actualizează câmpurile ne-nule (nu suprascrie cu None ce există deja).

        Indicatorii de proces (anaf_verificat, telefon_cautat, bilant_verificat)
        doar se setează, nu se șterg niciodată printr-un update.
        """
        company.data_actualizare = now_iso()
        row = company.to_row()
        set_cols, values = [], []
        for col in _UPDATABLE:
            value = row.get(col)
            if value is None:
                continue
            if col in FLAG_FIELDS and not value:
                continue
            set_cols.append(f"{col} = ?")
            values.append(value)
        if not set_cols:
            return
        values.append(company.cui)
        self.conn.execute(
            f"UPDATE companies SET {', '.join(set_cols)} WHERE cui = ?", values
        )
        if commit:
            self.conn.commit()

    def commit(self) -> None:
        self.conn.commit()

    # ---------------------------------------------------------------- #
    # Citire simplă                                                     #
    # ---------------------------------------------------------------- #

    def get(self, cui: int) -> Optional[Company]:
        row = self.conn.execute("SELECT * FROM companies WHERE cui = ?", (cui,)).fetchone()
        return Company.from_row(dict(row)) if row else None

    def iter_needing_anaf(self, limit: Optional[int] = None) -> Iterator[Company]:
        yield from self._iter("anaf_verificat = 0", "data_colectare", limit)

    def iter_needing_phone(self, limit: Optional[int] = None) -> Iterator[Company]:
        yield from self._iter(
            "telefon IS NULL AND telefon_cautat = 0 AND anaf_verificat = 1",
            "data_colectare", limit,
        )

    def iter_needing_bilant(self, limit: Optional[int] = None) -> Iterator[Company]:
        yield from self._iter("bilant_verificat = 0", "data_colectare", limit)

    def cui_range(self, sursa: str) -> tuple[Optional[int], Optional[int]]:
        """CUI minim și maxim al firmelor venite dintr-o sursă (sau None)."""
        row = self.conn.execute(
            "SELECT MIN(cui), MAX(cui) FROM companies WHERE sursa = ?", (sursa,)
        ).fetchone()
        return row[0], row[1]

    def iter_all(self) -> Iterator[Company]:
        yield from self._iter("1=1", "data_colectare", None)

    def _iter(self, where: str, order: str, limit: Optional[int]) -> Iterator[Company]:
        sql = f"SELECT * FROM companies WHERE {where} ORDER BY {order}"
        if limit:
            sql += f" LIMIT {int(limit)}"
        for row in self.conn.execute(sql):
            yield Company.from_row(dict(row))

    # ---------------------------------------------------------------- #
    # Motor de filtrare                                                 #
    # ---------------------------------------------------------------- #

    def query(
        self,
        *,
        judet: Optional[str] = None,
        localitate: Optional[str] = None,
        caen: Optional[str] = None,
        caen_prefix: Optional[str] = None,
        sectiune: Optional[str] = None,
        denumire_like: Optional[str] = None,
        with_phone: Optional[bool] = None,
        with_email: Optional[bool] = None,
        platitor_tva: Optional[bool] = None,
        doar_active: bool = False,
        fara_suspecte: bool = False,
        doar_verificate: bool = False,
        min_salariati: Optional[int] = None,
        min_cifra_afaceri: Optional[float] = None,
        inregistrata_dupa: Optional[str] = None,
        inregistrata_inainte: Optional[str] = None,
        order_by: str = "data_colectare",
        desc: bool = False,
        limit: Optional[int] = None,
    ) -> list[Company]:
        clauses: list[str] = []
        params: list = []

        def eq(col, val):
            clauses.append(f"UPPER({col}) = ?")
            params.append(str(val).upper())

        if judet:
            eq("judet", judet)
        if localitate:
            clauses.append("UPPER(localitate) LIKE ?")
            params.append(f"%{localitate.upper()}%")
        if caen:
            clauses.append("cod_caen = ?")
            params.append(str(caen))
        if caen_prefix:
            clauses.append("cod_caen LIKE ?")
            params.append(f"{caen_prefix}%")
        if sectiune:
            eq("caen_sectiune", sectiune)
        if denumire_like:
            clauses.append("UPPER(denumire) LIKE ?")
            params.append(f"%{denumire_like.upper()}%")
        if with_phone is True:
            clauses.append("telefon IS NOT NULL AND telefon <> ''")
        elif with_phone is False:
            clauses.append("(telefon IS NULL OR telefon = '')")
        if with_email is True:
            clauses.append("email IS NOT NULL AND email <> ''")
        if platitor_tva is not None:
            clauses.append("platitor_tva = ?")
            params.append(1 if platitor_tva else 0)
        if doar_active:
            clauses.append("(inactiv IS NULL OR inactiv = 0)")
            clauses.append("(stare_inregistrare IS NULL OR UPPER(stare_inregistrare) NOT LIKE '%RADIAT%')")
        if fara_suspecte:
            clauses.append("(telefon_suspect IS NULL OR telefon_suspect = 0)")
        if doar_verificate:
            clauses.append("anaf_verificat = 1")
        if min_salariati is not None:
            clauses.append("numar_salariati >= ?")
            params.append(int(min_salariati))
        if min_cifra_afaceri is not None:
            clauses.append("cifra_afaceri >= ?")
            params.append(float(min_cifra_afaceri))
        if inregistrata_dupa:
            clauses.append("data_inregistrare >= ?")
            params.append(inregistrata_dupa)
        if inregistrata_inainte:
            clauses.append("data_inregistrare <= ?")
            params.append(inregistrata_inainte)

        where = " AND ".join(clauses) if clauses else "1=1"
        col = order_by if order_by in _ORDERABLE else "data_colectare"
        direction = "DESC" if desc else "ASC"
        sql = f"SELECT * FROM companies WHERE {where} ORDER BY {col} {direction}"
        if limit:
            sql += f" LIMIT {int(limit)}"
        return [Company.from_row(dict(r)) for r in self.conn.execute(sql, params)]

    # ---------------------------------------------------------------- #
    # Statistici + jurnal                                               #
    # ---------------------------------------------------------------- #

    def stats(self) -> dict:
        c = self.conn
        one = lambda sql: c.execute(sql).fetchone()[0]  # noqa: E731
        base = {
            "total": one("SELECT COUNT(*) FROM companies"),
            "verificate_anaf": one("SELECT COUNT(*) FROM companies WHERE anaf_verificat = 1"),
            "cu_telefon": one("SELECT COUNT(*) FROM companies WHERE telefon IS NOT NULL AND telefon <> ''"),
            "telefon_suspect": one("SELECT COUNT(*) FROM companies WHERE telefon_suspect = 1"),
            "cu_email": one("SELECT COUNT(*) FROM companies WHERE email IS NOT NULL AND email <> ''"),
            "cu_website": one("SELECT COUNT(*) FROM companies WHERE website IS NOT NULL AND website <> ''"),
            "platitori_tva": one("SELECT COUNT(*) FROM companies WHERE platitor_tva = 1"),
            "inactive": one("SELECT COUNT(*) FROM companies WHERE inactiv = 1"),
            "cu_bilant": one("SELECT COUNT(*) FROM companies WHERE bilant_verificat = 1"),
        }
        pe_sectiune = {
            r["caen_sectiune"]: r["n"]
            for r in c.execute(
                "SELECT caen_sectiune, COUNT(*) n FROM companies "
                "WHERE caen_sectiune IS NOT NULL GROUP BY caen_sectiune ORDER BY n DESC"
            )
        }
        pe_judet = {
            r["judet"]: r["n"]
            for r in c.execute(
                "SELECT judet, COUNT(*) n FROM companies "
                "WHERE judet IS NOT NULL GROUP BY judet ORDER BY n DESC LIMIT 10"
            )
        }
        return {**base, "pe_sectiune": pe_sectiune, "top_judete": pe_judet}

    def log_run(self, etapa, sursa, inceput, firme_noi=0, firme_procesate=0, detalii="") -> None:
        self.conn.execute(
            "INSERT INTO runs (inceput, sfarsit, etapa, sursa, firme_noi, "
            "firme_procesate, detalii) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (inceput, now_iso(), etapa, sursa, firme_noi, firme_procesate, detalii),
        )
        self.conn.commit()
