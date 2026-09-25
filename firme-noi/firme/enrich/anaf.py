"""Client pentru API-ul public ANAF (PlatitorTvaRest).

Endpoint:  POST {base}/PlatitorTvaRest/{versiune}/tva
Corp:      [{"cui": 12345, "data": "2025-09-25"}, ...]   (maxim 100 / cerere)
Limite:    ANAF acceptă ~1 cerere/secundă. Depășirea → HTTP 429.

Ce aduce ANAF: denumire, nr. reg. com., adresă, cod CAEN, stare înregistrare,
data înmatriculării, stare TVA/inactivi și — în `date_generale` — câmpurile
`telefon` și `fax`, atunci când firma le-a declarat. Acoperirea telefonului
variază de la o firmă la alta (nu toate au declarat unul), dar acesta este
principalul provider gratuit de telefon din sistem.

Citim câmpul `telefon` defensiv (poate lipsi la unele firme sau versiuni de
API). Pentru firmele fără telefon în ANAF, vezi providerii suplimentari din
phone.py (Google Places, căutare web).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, Optional

from ..config import Config
from ..models import Company
from ..util import ThrottledSession, chunked, normalize_phone, today_str

log = logging.getLogger("firme")


@dataclass
class AnafClient:
    config: Config
    session: ThrottledSession

    @property
    def endpoint(self) -> str:
        return f"{self.config.anaf_base_url}/PlatitorTvaRest/{self.config.anaf_version}/tva"

    def lookup(self, cuis: Iterable[int]) -> dict[int, Company]:
        """Interoghează ANAF pentru CUI-urile date și întoarce {cui: Company}."""
        results: dict[int, Company] = {}
        data = today_str()
        for batch in chunked(list(cuis), self.config.anaf_batch_size):
            payload = [{"cui": int(cui), "data": data} for cui in batch]
            try:
                resp = self.session.post(
                    self.endpoint,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
                body = resp.json()
            except Exception as exc:  # noqa: BLE001 - vrem să continuăm cu următorul batch
                log.error("Cerere ANAF eșuată pentru %d CUI-uri: %s", len(batch), exc)
                continue

            for entry in body.get("found", []):
                company = self._parse_entry(entry)
                if company is not None:
                    results[company.cui] = company

            not_found = body.get("notFound", [])
            if not_found:
                log.info("ANAF: %d CUI-uri negăsite în acest batch.", len(not_found))
        return results

    # ------------------------------------------------------------------ #

    @staticmethod
    def _parse_entry(entry: dict) -> Optional[Company]:
        general = entry.get("date_generale") or {}
        cui = general.get("cui")
        if cui is None:
            return None

        sediu = entry.get("adresa_sediu_social") or {}
        tva = entry.get("inregistrare_scop_Tva") or {}

        # Adresa: preferăm câmpul complet, altfel compunem din componente.
        adresa = general.get("adresa") or _compose_address(sediu)

        # Telefon: câmp din date_generale, populat când firma l-a declarat.
        telefon = normalize_phone(general.get("telefon"))

        return Company(
            cui=int(cui),
            denumire=general.get("denumire") or None,
            nr_reg_com=general.get("nrRegCom") or None,
            cod_caen=general.get("cod_CAEN") or None,
            judet=sediu.get("sdenumire_Judet") or None,
            localitate=sediu.get("sdenumire_Localitate") or None,
            adresa=adresa or None,
            cod_postal=general.get("codPostal") or sediu.get("scod_Postal") or None,
            stare_inregistrare=general.get("stare_inregistrare") or None,
            data_inregistrare=general.get("data_inregistrare") or None,
            scop_tva=bool(tva.get("scpTVA")) if "scpTVA" in tva else None,
            telefon=telefon,
            telefon_sursa="anaf" if telefon else None,
            anaf_verificat=True,
        )


def _compose_address(sediu: dict) -> Optional[str]:
    parts = [
        sediu.get("sdenumire_Strada"),
        sediu.get("snumar_Strada"),
        sediu.get("sdenumire_Localitate"),
        sediu.get("sdenumire_Judet"),
    ]
    text = ", ".join(p for p in parts if p)
    return text or None
