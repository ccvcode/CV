#!/usr/bin/env python3
"""Interfața de linie de comandă pentru sistemul de colectare firme noi.

Exemple:
    python run.py collect --source onrc        # colectează firme noi din ONRC
    python run.py enrich                        # completează cu date ANAF
    python run.py phones                        # caută telefoane (best-effort)
    python run.py run --source onrc             # tot fluxul, o singură comandă
    python run.py import --file lista.xlsx      # importă un fișier existent
    python run.py verify --limit 50             # confruntă datele cu ANAF (real)
    python run.py stats                         # statistici
    python run.py export --out export/firme.csv # exportă în CSV
"""

from __future__ import annotations

import argparse
import csv
import logging
import sys
from pathlib import Path

from firme.config import load_config
from firme.db import Database
from firme.enrich import AnafClient
from firme.importers import iter_companies_from_file
from firme.pipeline import Pipeline
from firme.util import ThrottledSession


def setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )


# --------------------------------------------------------------------------- #
# Comenzi                                                                       #
# --------------------------------------------------------------------------- #

def cmd_collect(args, cfg, db) -> None:
    Pipeline(cfg, db).collect(args.source)


def cmd_enrich(args, cfg, db) -> None:
    Pipeline(cfg, db).enrich_anaf(limit=args.limit)


def cmd_phones(args, cfg, db) -> None:
    Pipeline(cfg, db).find_phones(limit=args.limit)


def cmd_run(args, cfg, db) -> None:
    result = Pipeline(cfg, db).run_all(args.source, limit=args.limit)
    print(f"\nRezultat: {result}")


def cmd_import(args, cfg, db) -> None:
    path = Path(args.file)
    if not path.exists():
        sys.exit(f"Fișierul nu există: {path}")
    noi = 0
    total = 0
    for company in iter_companies_from_file(path, sursa=args.sursa):
        total += 1
        if db.insert_new(company):
            noi += 1
    print(f"Import terminat: {noi} firme noi adăugate din {total} rânduri citite.")


def cmd_verify(args, cfg, db) -> None:
    """Confruntă firmele din baza de date cu API-ul oficial ANAF.

    Pentru fiecare firmă interoghează ANAF și raportează dacă denumirea se
    confirmă și dacă ANAF returnează un telefon. Util ca să vezi ce date
    dintr-un fișier importat sunt reale.
    """
    session = ThrottledSession(
        min_interval=cfg.anaf_min_interval,
        timeout=cfg.http_timeout,
        user_agent=cfg.user_agent,
    )
    client = AnafClient(cfg, session)
    companies = list(db.iter_all())
    if args.limit:
        companies = companies[: args.limit]
    cuis = [c.cui for c in companies]
    print(f"Interoghez ANAF pentru {len(cuis)} firme...\n")
    results = client.lookup(cuis)

    confirmate = 0
    cu_telefon_anaf = 0
    for c in companies:
        anaf = results.get(c.cui)
        if anaf is None:
            print(f"  [NEGĂSIT în ANAF] CUI {c.cui} — {c.denumire}")
            continue
        confirmate += 1
        nume_ok = _norm(anaf.denumire) == _norm(c.denumire) if c.denumire else None
        tel_anaf = "DA" if anaf.telefon else "nu"
        if anaf.telefon:
            cu_telefon_anaf += 1
        flag = "OK" if nume_ok in (True, None) else "DIFERĂ"
        print(
            f"  [{flag}] CUI {c.cui}: fișier='{c.denumire}' | ANAF='{anaf.denumire}' "
            f"| telefon în ANAF: {tel_anaf}"
        )

    print(
        f"\nRezumat: {confirmate}/{len(cuis)} găsite în ANAF; "
        f"{cu_telefon_anaf} au telefon returnat de ANAF."
    )
    db.log_run(
        etapa="verify", sursa="anaf", inceput="",
        firme_procesate=len(cuis),
        detalii=f"{confirmate} confirmate, {cu_telefon_anaf} cu telefon ANAF",
    )


def cmd_stats(args, cfg, db) -> None:
    s = db.stats()
    print("Statistici bază de date")
    print("-" * 30)
    print(f"  Total firme:             {s['total']}")
    print(f"  Verificate la ANAF:      {s['verificate_anaf']}")
    print(f"  Cu telefon:              {s['cu_telefon']}")
    print(f"  Telefon căutat:          {s['telefon_cautat']}")
    print(f"  Plătitori de TVA:        {s['platitori_tva']}")
    if s["total"]:
        pct = 100 * s["cu_telefon"] / s["total"]
        print(f"  Acoperire telefon:       {pct:.1f}%")


def cmd_export(args, cfg, db) -> None:
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    companies = list(db.iter_all())
    if args.only_with_phone:
        companies = [c for c in companies if c.telefon]
    if args.judet:
        companies = [c for c in companies if (c.judet or "").upper() == args.judet.upper()]

    columns = [
        "cui", "denumire", "nr_reg_com", "cod_caen", "judet", "localitate",
        "telefon", "telefon_sursa", "email", "website", "adresa",
        "stare_inregistrare", "data_inregistrare", "scop_tva", "sursa",
        "data_colectare", "anaf_verificat",
    ]

    if args.format == "xlsx" or out.suffix.lower() == ".xlsx":
        _export_xlsx(out, companies, columns)
    else:
        with out.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh)
            writer.writerow(columns)
            for c in companies:
                row = c.to_row()
                writer.writerow([row.get(col) for col in columns])
    print(f"Export scris: {out} ({len(companies)} firme)")


def _export_xlsx(out: Path, companies, columns) -> None:
    try:
        import openpyxl  # type: ignore
    except ImportError:
        sys.exit("Pentru export .xlsx: pip install openpyxl (sau folosește .csv)")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Firme"
    ws.append(columns)
    for c in companies:
        row = c.to_row()
        ws.append([row.get(col) for col in columns])
    wb.save(out)


def _norm(text) -> str:
    return "".join((text or "").upper().split())


# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Colectare firme noi (ONRC/Monitorul Oficial) + ANAF")
    p.add_argument("-v", "--verbose", action="store_true", help="log detaliat")
    sub = p.add_subparsers(dest="command", required=True)

    sp = sub.add_parser("collect", help="colectează firme noi dintr-o sursă")
    sp.add_argument("--source", default="onrc", choices=["onrc", "monitorul_oficial"])
    sp.set_defaults(func=cmd_collect)

    sp = sub.add_parser("enrich", help="completează firmele cu date de la ANAF")
    sp.add_argument("--limit", type=int, default=None)
    sp.set_defaults(func=cmd_enrich)

    sp = sub.add_parser("phones", help="caută telefoane (best-effort)")
    sp.add_argument("--limit", type=int, default=None)
    sp.set_defaults(func=cmd_phones)

    sp = sub.add_parser("run", help="fluxul complet: collect + enrich + phones")
    sp.add_argument("--source", default="onrc", choices=["onrc", "monitorul_oficial"])
    sp.add_argument("--limit", type=int, default=None)
    sp.set_defaults(func=cmd_run)

    sp = sub.add_parser("import", help="importă firme dintr-un fișier .xlsx/.csv")
    sp.add_argument("--file", required=True)
    sp.add_argument("--sursa", default="import")
    sp.set_defaults(func=cmd_import)

    sp = sub.add_parser("verify", help="confruntă datele cu API-ul oficial ANAF")
    sp.add_argument("--limit", type=int, default=None)
    sp.set_defaults(func=cmd_verify)

    sp = sub.add_parser("stats", help="statistici")
    sp.set_defaults(func=cmd_stats)

    sp = sub.add_parser("export", help="exportă în CSV/XLSX")
    sp.add_argument("--out", default="export/firme.csv")
    sp.add_argument("--format", choices=["csv", "xlsx"], default="csv")
    sp.add_argument("--only-with-phone", action="store_true")
    sp.add_argument("--judet", default=None)
    sp.set_defaults(func=cmd_export)

    return p


def main(argv=None) -> None:
    args = build_parser().parse_args(argv)
    setup_logging(args.verbose)
    cfg = load_config()
    with Database(cfg.db_path) as db:
        args.func(args, cfg, db)


if __name__ == "__main__":
    main()
