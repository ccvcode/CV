"""Modelul de date pentru o firmă — versiune bogată.

Grupuri de câmpuri:
  Identificare       : cui, denumire, nr_reg_com, euid, forma juridică/organizare/proprietate
  Activitate         : cod_caen + descriere + secțiune economică
  Stare & fiscal     : stare înregistrare, inactiv/radiat, TVA, split TVA, e-Factura
  Adresă             : sediu social (județ, localitate, stradă, nr, cod poștal) + domiciliu fiscal
  Contact            : telefon, fax, email, website
  Financiar (bilanț) : cifră de afaceri, profit/pierdere, salariați, active, datorii, capital
  Metadate           : sursă, date colectare/actualizare, ce etape s-au rulat
"""

from __future__ import annotations

from dataclasses import dataclass, fields
from typing import Any, Optional

# Câmpuri care sunt booleene opționale (pot fi None = necunoscut).
OPTIONAL_BOOL_FIELDS = {
    "platitor_tva", "tva_la_incasare", "split_tva", "ro_e_factura", "inactiv",
}
# Câmpuri booleene de proces (NULL => False).
FLAG_FIELDS = {"anaf_verificat", "telefon_cautat", "bilant_verificat"}


@dataclass
class Company:
    # --- Identificare ---
    cui: int
    denumire: Optional[str] = None
    nr_reg_com: Optional[str] = None
    euid: Optional[str] = None
    forma_juridica: Optional[str] = None
    forma_organizare: Optional[str] = None
    forma_proprietate: Optional[str] = None

    # --- Activitate (CAEN) ---
    cod_caen: Optional[str] = None
    caen_descriere: Optional[str] = None
    caen_sectiune: Optional[str] = None        # litera A–U
    caen_sectiune_nume: Optional[str] = None

    # --- Stare & fiscal ---
    stare_inregistrare: Optional[str] = None
    data_inregistrare: Optional[str] = None    # data înmatriculării (YYYY-MM-DD)
    act: Optional[str] = None                  # actul de înființare
    inactiv: Optional[bool] = None
    data_inactivare: Optional[str] = None
    data_reactivare: Optional[str] = None
    data_radiere: Optional[str] = None
    platitor_tva: Optional[bool] = None
    tva_data_inceput: Optional[str] = None
    tva_data_sfarsit: Optional[str] = None
    tva_la_incasare: Optional[bool] = None
    split_tva: Optional[bool] = None
    ro_e_factura: Optional[bool] = None
    organ_fiscal: Optional[str] = None
    iban: Optional[str] = None

    # --- Adresă sediu social ---
    judet: Optional[str] = None
    localitate: Optional[str] = None
    strada: Optional[str] = None
    numar: Optional[str] = None
    cod_postal: Optional[str] = None
    tara: Optional[str] = None
    adresa: Optional[str] = None                # adresa completă (text)
    adresa_fiscala: Optional[str] = None        # domiciliu fiscal (dacă diferă)

    # --- Contact ---
    telefon: Optional[str] = None
    telefon_sursa: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

    # --- Financiar (bilanț ANAF) ---
    an_bilant: Optional[int] = None
    cifra_afaceri: Optional[float] = None
    profit_net: Optional[float] = None
    pierdere_neta: Optional[float] = None
    numar_salariati: Optional[int] = None
    active_total: Optional[float] = None
    datorii_total: Optional[float] = None
    capital_total: Optional[float] = None

    # --- Metadate ---
    sursa: Optional[str] = None
    data_colectare: Optional[str] = None
    data_actualizare: Optional[str] = None
    anaf_verificat: bool = False
    telefon_cautat: bool = False
    bilant_verificat: bool = False

    def to_row(self) -> dict[str, Any]:
        row: dict[str, Any] = {}
        for f in fields(self):
            value = getattr(self, f.name)
            if isinstance(value, bool):
                value = int(value)
            row[f.name] = value
        return row

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Company":
        data = {f.name: row.get(f.name) for f in fields(cls)}
        for name in OPTIONAL_BOOL_FIELDS:
            data[name] = None if data.get(name) is None else bool(data[name])
        for name in FLAG_FIELDS:
            data[name] = bool(data.get(name))
        return cls(**data)
