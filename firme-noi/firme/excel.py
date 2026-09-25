"""Export Excel formatat (.xlsx) din baza de date de firme.

Produce un workbook cu:
  - foaia „Firme"  : toate câmpurile, antet înghețat + filtre, lățimi potrivite;
  - foaia „Sumar"  : totaluri și distribuția pe domenii CAEN și pe județe.

Folosește modul write-only din openpyxl, deci merge și pentru sute de mii de
rânduri fără să consume multă memorie. Necesită openpyxl.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Iterable

from .classify import este_activa, tip_entitate
from .models import Company

# (câmp, antet afișat, lățime coloană, tip)  — tip: text/bool/int/money/mono
_COLS = [
    ("cui", "CUI", 12, "mono"),
    ("denumire", "Denumire", 34, "text"),
    ("tip_entitate", "Tip entitate", 20, "text"),
    ("activa", "Activă", 8, "bool"),
    ("telefon", "Telefon", 15, "mono"),
    ("telefon_suspect", "Tel. suspect", 11, "bool"),
    ("telefon_sursa", "Sursă tel.", 10, "text"),
    ("judet", "Județ", 16, "text"),
    ("localitate", "Localitate", 24, "text"),
    ("cod_caen", "Cod CAEN", 10, "mono"),
    ("caen_descriere", "Activitate (CAEN)", 40, "text"),
    ("caen_sectiune", "Secț.", 7, "mono"),
    ("caen_sectiune_nume", "Domeniu", 32, "text"),
    ("data_inregistrare", "Data înreg.", 13, "mono"),
    ("nr_reg_com", "Nr. Reg. Com.", 18, "mono"),
    ("forma_juridica", "Formă juridică", 14, "text"),
    ("adresa", "Adresă sediu", 46, "text"),
    ("cod_postal", "Cod poștal", 11, "mono"),
    ("email", "Email", 24, "text"),
    ("website", "Website", 22, "text"),
    ("fax", "Fax", 14, "mono"),
    ("stare_inregistrare", "Stare", 26, "text"),
    ("inactiv", "Inactivă", 9, "bool"),
    ("platitor_tva", "Plătitor TVA", 12, "bool"),
    ("tva_la_incasare", "TVA la încasare", 14, "bool"),
    ("split_tva", "Split TVA", 10, "bool"),
    ("ro_e_factura", "RO e-Factura", 12, "bool"),
    ("an_bilant", "An bilanț", 9, "int"),
    ("cifra_afaceri", "Cifră afaceri", 15, "money"),
    ("profit_net", "Profit net", 14, "money"),
    ("numar_salariati", "Nr. salariați", 11, "int"),
    ("sursa", "Sursă", 10, "text"),
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
    from openpyxl.cell import WriteOnlyCell
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    companies = list(companies)
    wb = Workbook(write_only=True)

    header_fill = PatternFill("solid", fgColor="0F6E5C")
    header_font = Font(bold=True, color="FFFFFF")
    mono_font = Font(name="Consolas")
    bold = Font(bold=True)

    # --- Foaia Firme ---
    ws = wb.create_sheet("Firme")
    for i, (_, _, width, _) in enumerate(_COLS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.freeze_panes = "C2"   # CUI + denumire rămân vizibile la derulare
    ws.auto_filter.ref = f"A1:{get_column_letter(len(_COLS))}{len(companies) + 1}"

    header = []
    for _, label, _, _ in _COLS:
        cell = WriteOnlyCell(ws, value=label)
        cell.fill = header_fill
        cell.font = header_font
        header.append(cell)
    ws.append(header)

    for c in companies:
        row = c.to_row()
        row["tip_entitate"] = tip_entitate(c)
        row["activa"] = este_activa(c)
        cells = []
        for field, _, _, kind in _COLS:
            value = row.get(field)
            if kind == "bool":
                value = _bool_ro(value)
            cell = WriteOnlyCell(ws, value=value)
            if kind == "mono":
                cell.font = mono_font
            elif kind == "money":
                cell.number_format = "#,##0"
            elif kind == "int":
                cell.number_format = "0"
            cells.append(cell)
        ws.append(cells)

    # --- Foaia Sumar ---
    s = wb.create_sheet("Sumar")
    s.column_dimensions["A"].width = 44
    s.column_dimensions["B"].width = 16
    total = len(companies)
    cu_tel = sum(1 for c in companies if c.telefon)
    suspecte = sum(1 for c in companies if c.telefon_suspect)
    verificate = sum(1 for c in companies if c.anaf_verificat)
    date = sorted(c.data_inregistrare for c in companies if c.data_inregistrare)

    def line(label, value=None, font=None):
        a = WriteOnlyCell(s, value=label)
        if font:
            a.font = font
        s.append([a, value])

    line("Firme Noi România — sumar", font=Font(bold=True, size=13))
    s.append([])
    line("Total firme", total, bold)
    if date:
        line("Înmatriculate între", f"{date[0]} – {date[-1]}", bold)
    line("Verificate la ANAF", verificate, bold)
    line("Cu telefon", f"{cu_tel} ({round(100 * cu_tel / total) if total else 0}%)", bold)
    line("  din care de verificat (suspecte)", suspecte)
    line("Plătitori TVA", sum(1 for c in companies if c.platitor_tva), bold)
    line("Județe distincte", len({c.judet for c in companies if c.judet}), bold)
    s.append([])

    line("Pe tip de entitate", "înregistrări", bold)
    for name, n in Counter(tip_entitate(c) for c in companies).most_common():
        line(name, n)
    s.append([])

    line("Pe domenii (secțiune CAEN)", "firme", bold)
    sec = Counter((c.caen_sectiune, c.caen_sectiune_nume) for c in companies if c.caen_sectiune)
    for (letter, name), n in sec.most_common():
        line(f"{letter} — {name}", n)
    s.append([])

    line("Pe județe", "firme", bold)
    for name, n in Counter(c.judet for c in companies if c.judet).most_common():
        line(name, n)

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return total
