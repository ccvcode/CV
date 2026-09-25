#!/usr/bin/env python3
"""Interfața de linie de comandă pentru sistemul de colectare firme noi.

Exemple:
    python run.py collect --source onrc          # colectează firme noi din ONRC
    python run.py enrich                          # date generale de la ANAF
    python run.py phones                          # caută telefoane (best-effort)
    python run.py bilant --an 2024                # indicatori financiari
    python run.py run --source onrc               # collect + enrich + phones
    python run.py import --file lista.xlsx        # importă un fișier existent
    python run.py verify --limit 50               # confruntă datele cu ANAF real
    python run.py stats                           # statistici detaliate
    python run.py filter --sectiune F --with-phone --judet Cluj   # filtrare
    python run.py export --out firme.xlsx --sectiune J --min-salariati 5
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
from firme.webpage import render_artifact, render_standalone

# Coloanele exportate, în ordine.
EXPORT_COLUMNS = [
    "cui", "denumire", "nr_reg_com", "forma_juridica",
    "cod_caen", "caen_descriere", "caen_sectiune", "caen_sectiune_nume",
    "telefon", "telefon_sursa", "telefon_suspect", "email", "website",
    "judet", "localitate", "strada", "numar", "cod_postal", "adresa",
    "stare_inregistrare", "data_inregistrare", "inactiv",
    "platitor_tva", "tva_la_incasare", "split_tva", "ro_e_factura",
    "an_bilant", "cifra_afaceri", "profit_net", "numar_salariati",
    "sursa", "data_colectare", "anaf_verificat",
]


def setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )


# --------------------------------------------------------------------------- #
# Filtre partajate                                                              #
# --------------------------------------------------------------------------- #

def add_filter_args(sp: argparse.ArgumentParser) -> None:
    sp.add_argument("--judet")
    sp.add_argument("--localitate")
    sp.add_argument("--caen", help="cod CAEN exact (ex. 6201)")
    sp.add_argument("--caen-prefix", help="prefix CAEN (ex. 62 pentru tot IT-ul)")
    sp.add_argument("--sectiune", help="secțiune CAEN A–U (ex. F = construcții)")
    sp.add_argument("--denumire", help="parte din denumire")
    sp.add_argument("--with-phone", action="store_true", help="doar cu telefon")
    sp.add_argument("--without-phone", action="store_true", help="doar fără telefon")
    sp.add_argument("--with-email", action="store_true")
    sp.add_argument("--platitor-tva", action="store_true")
    sp.add_argument("--active", action="store_true", help="exclude radiate/inactive")
    sp.add_argument("--fara-suspecte", action="store_true",
                    help="exclude telefoanele de formă (ex. 0770000000)")
    sp.add_argument("--doar-verificate", action="store_true",
                    help="doar firmele confirmate de ANAF")
    sp.add_argument("--min-salariati", type=int)
    sp.add_argument("--min-cifra", type=float, help="cifră de afaceri minimă")
    sp.add_argument("--dupa", help="înregistrate după data (YYYY-MM-DD)")
    sp.add_argument("--inainte", help="înregistrate înainte de (YYYY-MM-DD)")
    sp.add_argument("--order-by", default="data_colectare")
    sp.add_argument("--desc", action="store_true")
    sp.add_argument("--limit", type=int)


def filters_from_args(args) -> dict:
    with_phone = True if args.with_phone else (False if args.without_phone else None)
    return dict(
        judet=args.judet,
        localitate=args.localitate,
        caen=args.caen,
        caen_prefix=args.caen_prefix,
        sectiune=args.sectiune,
        denumire_like=args.denumire,
        with_phone=with_phone,
        with_email=True if args.with_email else None,
        platitor_tva=True if args.platitor_tva else None,
        doar_active=args.active,
        fara_suspecte=args.fara_suspecte,
        doar_verificate=args.doar_verificate,
        min_salariati=args.min_salariati,
        min_cifra_afaceri=args.min_cifra,
        inregistrata_dupa=args.dupa,
        inregistrata_inainte=args.inainte,
        order_by=args.order_by,
        desc=args.desc,
        limit=args.limit,
    )


# --------------------------------------------------------------------------- #
# Comenzi                                                                       #
# --------------------------------------------------------------------------- #

def source_options(args) -> dict:
    """Opțiunile de filtrare a sursei (an / dată / CUI minim)."""
    opts = {}
    dupa = args.dupa or (f"{args.an}-01-01" if args.an else None)
    if dupa:
        opts["dupa"] = dupa
    if args.cui_min:
        opts["cui_min"] = args.cui_min
    if getattr(args, "seed", None):
        opts["seed"] = args.seed
    if getattr(args, "max_batches", None):
        opts["max_batches"] = args.max_batches
    return opts


def cmd_collect(args, cfg, db):
    pipeline = Pipeline(cfg, db)
    pipeline.collect(args.source, **source_options(args))
    complete = getattr(pipeline.last_source, "complete", None)
    if complete is not None:
        # Folosit de workflow ca să decidă dacă mai pornește o tranșă.
        status = "complete" if complete else "partial"
        (Path(cfg.db_path).parent / "scan_status.txt").write_text(status + "\n", encoding="utf-8")
        print(f"Stare scanare: {status}")


def cmd_probe(args, cfg, db):
    """Verifică accesul la ANAF și ONRC și ce câmpuri întorc.

    Implicit NU afișează date de contact (sigur pentru loguri publice).
    """
    from firme.sources.onrc_opendata import OnrcOpenDataSource

    ok = True
    session = ThrottledSession(min_interval=cfg.anaf_min_interval,
                               timeout=cfg.http_timeout, user_agent=cfg.user_agent)
    client = AnafClient(cfg, session)
    cuis = args.cui or [55625503, 55625490, 55622590]
    print(f"ANAF: {client.endpoint}")
    try:
        body = client.query_raw(cuis)
        found = body.get("found") or []
        print(f"  răspuns OK: {len(found)} găsite din {len(cuis)}")
        if found:
            general = found[0].get("date_generale") or {}
            print(f"  secțiuni: {', '.join(sorted(found[0].keys()))}")
            print(f"  câmpuri date_generale: {', '.join(sorted(general.keys()))}")
            tel = [str((e.get('date_generale') or {}).get('telefon') or '').strip() for e in found]
            print(f"  câmpul 'telefon' există: {'telefon' in general}; "
                  f"completat la {sum(1 for t in tel if t)} din {len(found)}")
            if args.arata:
                for e in found:
                    g = e.get("date_generale") or {}
                    print(f"    {g.get('cui')} {g.get('denumire')} | tel: {g.get('telefon')}")
    except Exception as exc:  # noqa: BLE001
        print(f"  EROARE ANAF: {exc}")
        ok = False

    if args.doar_anaf:
        if not ok:
            sys.exit(1)
        return

    try:
        src = OnrcOpenDataSource(cfg, ThrottledSession(timeout=cfg.http_timeout,
                                                       user_agent=cfg.user_agent))
        url, title = src.discover()
        print(f"ONRC: {title}\n  URL: {url}")
        print(f"  coloane: {', '.join(src.read_header(url))}")
    except Exception as exc:  # noqa: BLE001
        # Nu e blocant: lista de firme se poate lua și prin sursa anaf_scan.
        print(f"  AVERTISMENT ONRC (indisponibil, se poate folosi --source anaf_scan): {exc}")

    if not ok:
        sys.exit(1)


def cmd_enrich(args, cfg, db):
    Pipeline(cfg, db).enrich_anaf(limit=args.limit)


def cmd_phones(args, cfg, db):
    Pipeline(cfg, db).find_phones(limit=args.limit)


def cmd_bilant(args, cfg, db):
    Pipeline(cfg, db).enrich_bilant(an=args.an, limit=args.limit)


def cmd_run(args, cfg, db):
    result = Pipeline(cfg, db).run_all(args.source, limit=args.limit, **source_options(args))
    print(f"\nRezultat: {result}")


def cmd_import(args, cfg, db):
    path = Path(args.file)
    if not path.exists():
        sys.exit(f"Fișierul nu există: {path}")
    noi = total = 0
    for company in iter_companies_from_file(path, sursa=args.sursa):
        total += 1
        noi += 1 if db.insert_new(company) else 0
    print(f"Import terminat: {noi} firme noi din {total} rânduri citite.")


def cmd_verify(args, cfg, db):
    session = ThrottledSession(
        min_interval=cfg.anaf_min_interval, timeout=cfg.http_timeout,
        user_agent=cfg.user_agent,
    )
    client = AnafClient(cfg, session)
    companies = list(db.iter_all())
    if args.limit:
        companies = companies[: args.limit]
    cuis = [c.cui for c in companies]
    print(f"Interoghez ANAF pentru {len(cuis)} firme...\n")
    results = client.lookup(cuis)
    confirmate = cu_tel = 0
    for c in companies:
        anaf = results.get(c.cui)
        if anaf is None:
            print(f"  [NEGĂSIT] CUI {c.cui} — {c.denumire}")
            continue
        confirmate += 1
        cu_tel += 1 if anaf.telefon else 0
        nume_ok = _norm(anaf.denumire) == _norm(c.denumire) if c.denumire else True
        flag = "OK" if nume_ok else "DIFERĂ"
        print(f"  [{flag}] CUI {c.cui}: fișier='{c.denumire}' | ANAF='{anaf.denumire}' "
              f"| tel ANAF: {'DA' if anaf.telefon else 'nu'}")
    print(f"\nRezumat: {confirmate}/{len(cuis)} în ANAF; {cu_tel} cu telefon la ANAF.")


def cmd_stats(args, cfg, db):
    s = db.stats()
    print("Statistici bază de date")
    print("=" * 40)
    print(f"  Total firme:          {s['total']}")
    print(f"  Verificate ANAF:      {s['verificate_anaf']}")
    print(f"  Cu telefon:           {s['cu_telefon']}")
    print(f"  Cu email:             {s['cu_email']}")
    print(f"  Cu website:           {s['cu_website']}")
    print(f"  Plătitori TVA:        {s['platitori_tva']}")
    print(f"  Inactive/radiate:     {s['inactive']}")
    print(f"  Cu bilanț:            {s['cu_bilant']}")
    if s["total"]:
        print(f"  Acoperire telefon:    {100 * s['cu_telefon'] / s['total']:.1f}%")
    if s["pe_sectiune"]:
        print("\n  Pe secțiuni CAEN:")
        for sec, n in list(s["pe_sectiune"].items())[:12]:
            print(f"    {sec}: {n}")
    if s["top_judete"]:
        print("\n  Top județe:")
        for jud, n in s["top_judete"].items():
            print(f"    {jud}: {n}")


def cmd_filter(args, cfg, db):
    companies = db.query(**filters_from_args(args))
    print(f"{len(companies)} firme găsite:\n")
    for c in companies:
        tel = c.telefon or "-"
        caen = f"{c.cod_caen or '-'} {c.caen_descriere or ''}".strip()
        print(f"  {c.cui} | {c.denumire or '-'} | {c.judet or '-'}/{c.localitate or '-'} "
              f"| tel: {tel} | CAEN: {caen}")


def cmd_export(args, cfg, db):
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    companies = db.query(**filters_from_args(args))
    if args.format == "xlsx" or out.suffix.lower() == ".xlsx":
        _export_xlsx(out, companies)
    else:
        with out.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh)
            writer.writerow(EXPORT_COLUMNS)
            for c in companies:
                row = c.to_row()
                writer.writerow([row.get(col) for col in EXPORT_COLUMNS])
    print(f"Export scris: {out} ({len(companies)} firme)")


def cmd_page(args, cfg, db):
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    companies = db.query(**filters_from_args(args))
    html = render_artifact(companies) if args.artifact else render_standalone(companies)
    out.write_text(html, encoding="utf-8")
    print(f"Pagină generată: {out} ({len(companies)} firme). "
          f"Deschide-o în browser (dublu-click).")


def _export_xlsx(out: Path, companies):
    try:
        from firme.excel import build_workbook
    except ImportError:
        sys.exit("Pentru export .xlsx: pip install openpyxl (sau folosește .csv)")
    build_workbook(companies, out)


def _norm(text) -> str:
    return "".join((text or "").upper().split())


# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Colectare firme noi (ONRC/Monitorul Oficial) + ANAF")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="command", required=True)

    def add_source_args(sp):
        sp.add_argument("--source", default="onrc",
                        choices=["onrc", "anaf_scan", "monitorul_oficial"],
                        help="onrc = lista oficială data.gov.ro; anaf_scan = parcurgere CUI prin ANAF")
        sp.add_argument("--an", type=int, help="doar firmele înmatriculate din acest an (ex. 2026)")
        sp.add_argument("--dupa", help="doar firmele înmatriculate după data YYYY-MM-DD")
        sp.add_argument("--cui-min", type=int, help="filtru de rezervă (onrc): CUI minim")
        sp.add_argument("--seed", type=int, help="anaf_scan: CUI recent de la care pornește scanarea")
        sp.add_argument("--max-batches", type=int,
                        help="anaf_scan: câte loturi de 100 CUI pe rulare (restul continuă data viitoare)")

    sp = sub.add_parser("collect", help="colectează firme noi dintr-o sursă")
    add_source_args(sp)
    sp.set_defaults(func=cmd_collect)

    sp = sub.add_parser("probe", help="verifică accesul la ANAF și ONRC (fără date personale)")
    sp.add_argument("--cui", type=int, action="append", help="CUI de test (se poate repeta)")
    sp.add_argument("--arata", action="store_true", help="afișează și telefoanele (doar local)")
    sp.add_argument("--doar-anaf", action="store_true", help="nu verifica ONRC (data.gov.ro)")
    sp.set_defaults(func=cmd_probe)

    sp = sub.add_parser("enrich", help="date generale de la ANAF")
    sp.add_argument("--limit", type=int)
    sp.set_defaults(func=cmd_enrich)

    sp = sub.add_parser("phones", help="caută telefoane (best-effort)")
    sp.add_argument("--limit", type=int)
    sp.set_defaults(func=cmd_phones)

    sp = sub.add_parser("bilant", help="indicatori financiari de la ANAF")
    sp.add_argument("--an", type=int, required=True)
    sp.add_argument("--limit", type=int)
    sp.set_defaults(func=cmd_bilant)

    sp = sub.add_parser("run", help="collect + enrich + phones")
    add_source_args(sp)
    sp.add_argument("--limit", type=int)
    sp.set_defaults(func=cmd_run)

    sp = sub.add_parser("import", help="importă firme dintr-un fișier .xlsx/.csv")
    sp.add_argument("--file", required=True)
    sp.add_argument("--sursa", default="import")
    sp.set_defaults(func=cmd_import)

    sp = sub.add_parser("verify", help="confruntă datele cu ANAF real")
    sp.add_argument("--limit", type=int)
    sp.set_defaults(func=cmd_verify)

    sp = sub.add_parser("stats", help="statistici detaliate")
    sp.set_defaults(func=cmd_stats)

    sp = sub.add_parser("filter", help="filtrează și afișează firme")
    add_filter_args(sp)
    sp.set_defaults(func=cmd_filter)

    sp = sub.add_parser("export", help="exportă (filtrat) în CSV/XLSX")
    sp.add_argument("--out", default="export/firme.csv")
    sp.add_argument("--format", choices=["csv", "xlsx"], default="csv")
    add_filter_args(sp)
    sp.set_defaults(func=cmd_export)

    sp = sub.add_parser("page", help="generează o pagină web (dashboard) din baza de date")
    sp.add_argument("--out", default="export/index.html")
    sp.add_argument("--artifact", action="store_true",
                    help="variantă pentru publicare (fără doctype/head/body)")
    add_filter_args(sp)
    sp.set_defaults(func=cmd_page)

    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    setup_logging(args.verbose)
    cfg = load_config()
    with Database(cfg.db_path) as db:
        args.func(args, cfg, db)


if __name__ == "__main__":
    main()
