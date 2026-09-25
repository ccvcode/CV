"""Modelul de date pentru o firmă."""

from __future__ import annotations

from dataclasses import dataclass, field, fields
from typing import Any, Optional


@dataclass
class Company:
    """O firmă colectată și (parțial) îmbogățită.

    `cui` (Codul Unic de Identificare) este cheia primară și singurul câmp obligatoriu.
    """

    cui: int
    denumire: Optional[str] = None
    nr_reg_com: Optional[str] = None          # ex: J40/1234/2025
    cod_caen: Optional[str] = None            # activitatea principală
    judet: Optional[str] = None
    localitate: Optional[str] = None
    adresa: Optional[str] = None
    cod_postal: Optional[str] = None
    stare_inregistrare: Optional[str] = None  # ex: INREGISTRAT / RADIAT
    data_inregistrare: Optional[str] = None   # data înmatriculării (de la ANAF), YYYY-MM-DD
    scop_tva: Optional[bool] = None           # plătitor de TVA?
    telefon: Optional[str] = None
    telefon_sursa: Optional[str] = None       # ce provider a găsit telefonul
    email: Optional[str] = None
    website: Optional[str] = None

    # Metadate de proces
    sursa: Optional[str] = None               # unde a fost descoperită (onrc / monitorul_oficial)
    data_colectare: Optional[str] = None      # când a fost văzută prima dată (ISO)
    data_actualizare: Optional[str] = None    # ultima actualizare (ISO)
    anaf_verificat: bool = False              # a fost îmbogățită de la ANAF?
    telefon_cautat: bool = False              # s-a încercat găsirea telefonului?

    def to_row(self) -> dict[str, Any]:
        row = {}
        for f in fields(self):
            value = getattr(self, f.name)
            if isinstance(value, bool):
                value = int(value)
            row[f.name] = value
        return row

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Company":
        data = {f.name: row.get(f.name) for f in fields(cls)}
        for bool_field in ("anaf_verificat", "telefon_cautat"):
            data[bool_field] = bool(data.get(bool_field))
        if data.get("scop_tva") is not None:
            data["scop_tva"] = bool(data["scop_tva"])
        return cls(**data)
