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

from .. import caen as caen_ref
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
        fiscal = entry.get("adresa_domiciliu_fiscal") or {}
        tva = entry.get("inregistrare_scop_Tva") or {}
        rtvai = entry.get("inregistrare_RTVAI") or {}
        inactiv = entry.get("stare_inactiv") or {}
        split = entry.get("inregistrare_SplitTVA") or {}

        cod_caen = general.get("cod_CAEN") or None
        caen_info = caen_ref.enrich_caen(cod_caen)

        # Adresa completă: preferăm câmpul din date_generale, altfel o compunem.
        adresa = general.get("adresa") or _compose_address(sediu, "s")
        adresa_fiscala = _compose_address(fiscal, "d")

        telefon = normalize_phone(general.get("telefon"))

        # Perioada TVA (dacă există, luăm ultima).
        tva_inceput = tva_sfarsit = None
        perioade = tva.get("perioade_TVA") or []
        if perioade:
            ultima = perioade[-1]
            tva_inceput = ultima.get("data_inceput_ScpTVA") or None
            tva_sfarsit = ultima.get("data_sfarsit_ScpTVA") or None

        return Company(
            cui=int(cui),
            denumire=general.get("denumire") or None,
            nr_reg_com=general.get("nrRegCom") or None,
            forma_juridica=general.get("forma_juridica") or None,
            forma_organizare=general.get("forma_organizare") or None,
            forma_proprietate=general.get("forma_de_proprietate") or None,
            cod_caen=cod_caen,
            caen_descriere=caen_info["caen_descriere"],
            caen_sectiune=caen_info["caen_sectiune"],
            caen_sectiune_nume=caen_info["caen_sectiune_nume"],
            stare_inregistrare=general.get("stare_inregistrare") or None,
            data_inregistrare=general.get("data_inregistrare") or None,
            act=general.get("act") or None,
            inactiv=bool(inactiv.get("statusInactivi")) if "statusInactivi" in inactiv else None,
            data_inactivare=inactiv.get("dataInactivare") or None,
            data_reactivare=inactiv.get("dataReactivare") or None,
            data_radiere=inactiv.get("dataRadiere") or None,
            platitor_tva=bool(tva.get("scpTVA")) if "scpTVA" in tva else None,
            tva_data_inceput=tva_inceput,
            tva_data_sfarsit=tva_sfarsit,
            tva_la_incasare=bool(rtvai.get("statusTvaIncasare")) if "statusTvaIncasare" in rtvai else None,
            split_tva=bool(split.get("statusSplitTVA")) if "statusSplitTVA" in split else None,
            ro_e_factura=bool(general.get("statusRO_e_Factura")) if "statusRO_e_Factura" in general else None,
            organ_fiscal=general.get("organFiscalCompetent") or None,
            iban=general.get("iban") or None,
            judet=sediu.get("sdenumire_Judet") or None,
            localitate=sediu.get("sdenumire_Localitate") or None,
            strada=sediu.get("sdenumire_Strada") or None,
            numar=sediu.get("snumar_Strada") or None,
            cod_postal=general.get("codPostal") or sediu.get("scod_Postal") or None,
            tara=sediu.get("stara") or None,
            adresa=adresa or None,
            adresa_fiscala=adresa_fiscala,
            telefon=telefon,
            telefon_sursa="anaf" if telefon else None,
            fax=general.get("fax") or None,
            anaf_verificat=True,
        )


def _compose_address(adr: dict, prefix: str) -> Optional[str]:
    """Compune o adresă din componentele ANAF. `prefix` = 's' (sediu) sau 'd' (fiscal)."""
    parts = [
        adr.get(f"{prefix}denumire_Strada"),
        adr.get(f"{prefix}numar_Strada"),
        adr.get(f"{prefix}detalii_Adresa"),
        adr.get(f"{prefix}denumire_Localitate"),
        adr.get(f"{prefix}denumire_Judet"),
    ]
    text = ", ".join(str(p).strip() for p in parts if p)
    return text or None
