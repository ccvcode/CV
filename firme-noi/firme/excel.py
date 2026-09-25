"""Export Excel formatat (.xlsx) din baza de date de firme.

Produce un workbook cu:
  - foaia „Firme"  : toate câmpurile, antet înghețat + filtre, lățimi potrivite;
  - foaia „Sumar"  : totaluri și distribuția pe domenii CAEN și pe județe.

Necesită openpyxl (pip install openpyxl).
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Iterable

from .models import Company

# (câmp, antet afișat, lățime coloană, tip)  — tip: text/bool/int/money/mono
_COLS = [
    ("cui", "CUI", 12, "mono"),
    ("denumire", "Denumire", 34, "text"),
    ("nr_reg_com", "Nr. Reg. Com.", 18, "mono"),
    ("forma_juridica", "Formă juridică", 14, "text"),
    ("cod_caen", "Cod CAEN", 10, "mono"),
    ("caen_descriere", "Activitate (CAEN)", 40, "text"),
    ("caen_sectiune", "Secț.", 7, "mono"),
    ("caen_sectiune_nume", "Domeniu", 32, "text"),
    ("telefon", "Telefon", 15, "mono"),
    ("telefon_sursa", "Sursă tel.", 11, "text"),
    ("email", "Email", 24, "text"),
    ("website", "Website", 22, "text"),
    ("judet", "Județ", 16, "text"),
    ("localitate", "Localitate", 24, "text"),
    ("adresa", "Adresă sediu", 46, "text"),
    ("cod_postal", "Cod poștal", 11, "mono"),
    ("stare_inregistrare", "Stare", 26, "text"),
    ("data_inregistrare", "Data înreg.", 13, "mono"),
    ("inactiv", "Inactivă", 9, "bool"),
    ("platitor_tva", "Plătitor TVA", 12, "bool"),
    ("tva_la_incasare", "TVA la încasare", 14, "bool"),
    ("split_tva", "Split TVA", 10, "bool"),
    ("ro_e_factura", "RO e-Factura", 12, "bool"),
    ("an_bilant", "An bilanț", 9, "int"),
    ("cifra_afaceri", "Cifră afaceri", 15, "money"),
    ("profit_net", "Profit net", 14, "money"),
    ("numar_salariati", "Nr. salariați", 11, "int"),
    ("sursa", "Sursă", 12, "text"),
    ("data_colectare", "Colectat", 20, "text"),
    ("anaf_verificat", "Verificat ANAF", 13, "bool"),
]


def _bool_ro(v) -> str:
    if v in (1, True):
        return "Da"
    if v in (0, False):
        return "Nu"
    return ""


def build_workbook(companies: Iterable[Company], path: Path | str) -> int:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    companies = list(companies)
    wb = Workbook()

    # --- Foaia Firme ---
    ws = wb.active
    ws.title = "Firme"

    header_fill = PatternFill("solid", fgColor="0F6E5C")
    header_font = Font(bold=True, color="FFFFFF")
    mono_font = Font(name="Consolas")

    ws.append([h for _, h, _, _ in _COLS])
    for i, (_, _, width, _) in enumerate(_COLS, start=1):
        cell = ws.cell(row=1, column=i)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.row_dimensions[1].height = 20

    for c in companies:
        row = c.to_row()
        values = []
        for field, _, _, kind in _COLS:
            v = row.get(field)
            if kind == "bool":
                v = _bool_ro(v)
            values.append(v)
        ws.append(values)

    # Formatare pe coloane (mono, bani, întreg)
    for i, (_, _, _, kind) in enumerate(_COLS, start=1):
        letter = get_column_letter(i)
        for r in range(2, ws.max_row + 1):
            cell = ws.cell(row=r, column=i)
            if kind == "mono":
                cell.font = mono_font
            elif kind == "money":
                cell.number_format = "#,##0"
            elif kind == "int":
                cell.number_format = "0"

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(_COLS))}{ws.max_row}"

    # --- Foaia Sumar ---
    s = wb.create_sheet("Sumar")
    total = len(companies)
    cu_tel = sum(1 for c in companies if c.telefon)
    cu_tva = sum(1 for c in companies if c.platitor_tva)
    title_font = Font(bold=True, size=13)
    lbl = Font(bold=True)

    s["A1"] = "Firme Noi România — sumar"
    s["A1"].font = title_font
    rows = [
        ("Total firme", total),
        ("Cu telefon", f"{cu_tel} ({round(100*cu_tel/total) if total else 0}%)"),
        ("Plătitori TVA", cu_tva),
        ("Județe distincte", len({c.judet for c in companies if c.judet})),
    ]
    for i, (k, v) in enumerate(rows, start=3):
        s.cell(row=i, column=1, value=k).font = lbl
        s.cell(row=i, column=2, value=v)

    # Distribuția pe domenii CAEN
    r0 = 3 + len(rows) + 1
    s.cell(row=r0, column=1, value="Pe domenii (secțiune CAEN)").font = lbl
    sec = Counter((c.caen_sectiune, c.caen_sectiune_nume) for c in companies if c.caen_sectiune)
    r = r0 + 1
    for (letter, name), n in sec.most_common():
        s.cell(row=r, column=1, value=f"{letter} — {name}")
        s.cell(row=r, column=2, value=n)
        r += 1

    # Distribuția pe județe
    r0 = r + 1
    s.cell(row=r0, column=1, value="Pe județe").font = lbl
    jud = Counter(c.judet for c in companies if c.judet)
    r = r0 + 1
    for name, n in jud.most_common():
        s.cell(row=r, column=1, value=name)
        s.cell(row=r, column=2, value=n)
        r += 1

    s.column_dimensions["A"].width = 42
    s.column_dimensions["B"].width = 14

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return total
