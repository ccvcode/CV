"""Sistem automat de colectare a firmelor nou înființate din România.

Fluxul general:
    1. COLECTARE  – se ia lista de firme noi dintr-o sursă (ONRC / Monitorul Oficial).
    2. STOCARE    – firmele noi (necunoscute încă) se salvează în baza de date SQLite.
    3. ÎMBOGĂȚIRE – fiecare firmă se completează cu date oficiale de la ANAF (adresă,
                    CAEN, stare TVA etc.) și, best-effort, cu numărul de telefon.
"""

__version__ = "1.0.0"
