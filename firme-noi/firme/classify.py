"""Clasificarea înregistrărilor ANAF pe tipuri de entitate.

ANAF alocă CUI nu doar firmelor noi, ci și sediilor secundare ale firmelor
existente, persoanelor fizice autorizate (PFA/II/IF), profesiilor liberale
(avocați, medici, agenți de asigurări) și asociațiilor. Pentru prospectare
contează de regulă doar firmele noi, active — restul se păstrează, marcat.
"""

from __future__ import annotations

import re

from .models import Company

FIRMA = "Firmă"
SEDIU_SECUNDAR = "Sediu secundar"
PFA = "PFA / II / IF"
ASOCIATIE = "Asociație / ONG / altele"
PROFESIE = "Profesie liberală / cabinet"

TIPURI = (FIRMA, SEDIU_SECUNDAR, PFA, PROFESIE, ASOCIATIE)

_SEDIU_RE = re.compile(r"SEDIU\s+SECUNDAR|SUCURSAL[AĂ]\b|PUNCT\s+DE\s+LUCRU")
_PFA_RE = re.compile(
    r"\bP\.?F\.?A\.?(?=\s|$|[,.;)-])|PERSOAN[AĂ]\s+FIZIC[AĂ]\s+AUTORIZAT[AĂ]"
    r"|[IÎ]NTREPRINDERE\s+(?:INDIVIDUAL[AĂ]|FAMILIAL[AĂ])|\bI\.?I\.?$|\bI\.?F\.?$"
)
_FIRMA_NAME_RE = re.compile(r"\b(?:S\.?R\.?L\.?|S\.?A\.?|S\.?N\.?C\.?|S\.?C\.?S\.?)\s*$")
_ASOC_RE = re.compile(
    r"\bASOCIA[TŢȚ]IA\b|\bFUNDA[TŢȚ]IA\b|\bCLUB|\bFEDERA[TŢȚ]IA\b|\bSINDICAT"
    r"|\bPAROHIA\b|\bUNIUNEA\b|\bLIGA\b|\bCOOPERATIV"
)


def tip_entitate(c: Company) -> str:
    name = (c.denumire or "").upper().strip()
    fj = (c.forma_juridica or "").upper()
    if _SEDIU_RE.search(name):
        return SEDIU_SECUNDAR
    if _PFA_RE.search(name) or "FAMILIAL" in fj:
        return PFA
    if "SOCIETATE" in fj and "COOPERATIV" not in fj:
        return FIRMA
    if _FIRMA_NAME_RE.search(name):
        return FIRMA
    if _ASOC_RE.search(name) or fj:
        return ASOCIATIE
    return PROFESIE


def este_activa(c: Company) -> bool:
    """Falsă pentru entitățile radiate, dizolvate sau declarate inactive."""
    stare = (c.stare_inregistrare or "").upper()
    if stare.startswith(("RADIERE", "DIZOLVARE")):
        return False
    return not c.inactiv


def este_firma_noua_activa(c: Company) -> bool:
    return tip_entitate(c) == FIRMA and este_activa(c)
