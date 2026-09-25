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
from ..util import (
    ThrottledSession, chunked, clean_phone, is_suspect_phone, parse_date, today_str,
)

log = logging.getLogger("firme")


@dataclass
class AnafClient:
    config: Config
    session: ThrottledSession

    @property
    def endpoint(self) -> str:
        return f"{self.config.anaf_base_url}/PlatitorTvaRest/{self.config.anaf_version}/tva"

    def query_raw(self, cuis: Iterable[int]) -> dict:
        """O singură cerere ANAF; întoarce corpul JSON brut."""
        cuis = [int(cui) for cui in cuis]
        payload = [{"cui": cui, "data": today_str()} for cui in cuis]
        resp = self.session.post(
            self.endpoint, json=payload, headers={"Content-Type": "application/json"},
        )
        if resp.status_code == 404:
            # ANAF răspunde 404 când NICIUN CUI din listă nu există (ex. CUI-uri
            # încă nealocate). E un răspuns valid, nu o eroare de rețea.
            try:
                body = resp.json()
            except ValueError:
                body = {}
            return {"found": [], "notFound": (body or {}).get("notFound") or cuis}
        resp.raise_for_status()
        body = resp.json()
        if "found" not in body and "notFound" not in body:
            raise RuntimeError(f"Răspuns ANAF neașteptat: {str(body)[:200]}")
        return body

    def lookup_batches(self, cuis: Iterable[int]):
        """Pentru fiecare lot (max. 100 CUI) produce (lot, găsite, negăsite, ok).

        ok=False înseamnă că cererea a eșuat: firmele din lot NU trebuie marcate
        ca verificate, ca să fie reîncercate la rularea următoare.
        """
        for batch in chunked(list(cuis), self.config.anaf_batch_size):
            try:
                body = self.query_raw(batch)
            except Exception as exc:  # noqa: BLE001 - continuăm cu lotul următor
                log.error("Cerere ANAF eșuată pentru %d CUI-uri: %s", len(batch), exc)
                yield batch, {}, set(), False
                continue

            found: dict[int, Company] = {}
            for entry in body.get("found") or []:
                company = self._parse_entry(entry)
                if company is not None:
                    found[company.cui] = company

            not_found: set[int] = set()
            for item in body.get("notFound") or []:
                value = item.get("cui") if isinstance(item, dict) else item
                try:
                    not_found.add(int(value))
                except (TypeError, ValueError):
                    pass
            yield batch, found, not_found, True

    def lookup(self, cuis: Iterable[int]) -> dict[int, Company]:
        """Interoghează ANAF pentru CUI-urile date și întoarce {cui: Company}."""
        results: dict[int, Company] = {}
        for _, found, _, _ in self.lookup_batches(cuis):
            results.update(found)
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

        telefon = clean_phone(general.get("telefon"))

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
            data_inregistrare=(parse_date(general.get("data_inregistrare"))
                               or general.get("data_inregistrare") or None),
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
            telefon_suspect=is_suspect_phone(telefon) if telefon else None,
            fax=clean_phone(general.get("fax")),
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
