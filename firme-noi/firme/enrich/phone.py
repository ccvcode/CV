"""Găsirea numerelor de telefon (best-effort).

IMPORTANT — de citit cu atenție:
    Sursa principală și gratuită de telefon este chiar API-ul ANAF: câmpul
    `telefon` din `date_generale`, populat când firma l-a declarat. Acoperirea
    variază (nu toate firmele au telefon la ANAF). Pentru restul, providerii de
    mai jos (Google, web) completează best-effort, cu acoperire parțială.

Provideri disponibili (se încearcă în ordinea din PHONE_PROVIDERS):
    anaf   – folosește telefonul adus de ANAF (câmpul `telefon`), fără cost.
    google – Google Places API. Cel mai fiabil, dar necesită GOOGLE_MAPS_API_KEY
             (are cost după cota gratuită). Caută firma după denumire+localitate.
    web    – căutare web + extragere din pagini (DuckDuckGo). Gratuit, dar fragil
             și supus limitărilor; de folosit doar orientativ.

Folosește aceste date responsabil, în conformitate cu GDPR și cu scopul declarat.
"""

from __future__ import annotations

import abc
import logging
import re
from typing import Optional

from ..config import Config
from ..models import Company
from ..util import ThrottledSession, extract_phone, normalize_phone

log = logging.getLogger("firme")


class PhoneFinder(abc.ABC):
    name: str = "base"

    def __init__(self, config: Config, session: ThrottledSession) -> None:
        self.config = config
        self.session = session

    @abc.abstractmethod
    def find(self, company: Company) -> Optional[str]:
        """Întoarce un număr normalizat (0XXXXXXXXX) sau None."""
        raise NotImplementedError


class AnafFieldPhoneFinder(PhoneFinder):
    """Reutilizează telefonul adus de ANAF (de regulă gol în v9)."""

    name = "anaf"

    def find(self, company: Company) -> Optional[str]:
        return normalize_phone(company.telefon)


class GooglePlacesPhoneFinder(PhoneFinder):
    """Caută firma pe Google Places și preia numărul de telefon."""

    name = "google"
    FIND = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"

    def find(self, company: Company) -> Optional[str]:
        if not self.config.google_maps_api_key:
            return None
        if not company.denumire:
            return None
        query = company.denumire
        if company.localitate:
            query += f" {company.localitate}"
        elif company.judet:
            query += f" {company.judet}"

        try:
            resp = self.session.get(
                self.FIND,
                params={
                    "input": query,
                    "inputtype": "textquery",
                    "fields": "place_id",
                    "language": "ro",
                    "region": "ro",
                    "key": self.config.google_maps_api_key,
                },
            )
            resp.raise_for_status()
            candidates = resp.json().get("candidates", [])
            if not candidates:
                return None
            place_id = candidates[0].get("place_id")
            if not place_id:
                return None

            resp = self.session.get(
                self.DETAILS,
                params={
                    "place_id": place_id,
                    "fields": "formatted_phone_number,international_phone_number,website",
                    "language": "ro",
                    "key": self.config.google_maps_api_key,
                },
            )
            resp.raise_for_status()
            result = resp.json().get("result", {})
            phone = normalize_phone(
                result.get("formatted_phone_number")
                or result.get("international_phone_number")
            )
            # bonus: reținem website-ul dacă îl avem
            if result.get("website") and not company.website:
                company.website = result["website"]
            return phone
        except Exception as exc:  # noqa: BLE001
            log.warning("Google Places a eșuat pentru %s: %s", company.denumire, exc)
            return None


class WebSearchPhoneFinder(PhoneFinder):
    """Caută pe web (DuckDuckGo HTML) și extrage un telefon din rezultate.

    Fragil și „best-effort": poate fi blocat/limitat. Nu garantează acuratețe.
    """

    name = "web"
    ENDPOINT = "https://html.duckduckgo.com/html/"
    _TAG_RE = re.compile(r"<[^>]+>")

    def find(self, company: Company) -> Optional[str]:
        if not company.denumire:
            return None
        loc = company.localitate or company.judet or ""
        query = f'"{company.denumire}" {loc} telefon contact'
        try:
            resp = self.session.post(self.ENDPOINT, data={"q": query})
            resp.raise_for_status()
            text = self._TAG_RE.sub(" ", resp.text)
            return extract_phone(text)
        except Exception as exc:  # noqa: BLE001
            log.warning("Căutarea web a eșuat pentru %s: %s", company.denumire, exc)
            return None


_PROVIDERS: dict[str, type[PhoneFinder]] = {
    "anaf": AnafFieldPhoneFinder,
    "google": GooglePlacesPhoneFinder,
    "web": WebSearchPhoneFinder,
}


def build_phone_finders(config: Config, session: ThrottledSession) -> list[PhoneFinder]:
    finders: list[PhoneFinder] = []
    for name in config.phone_providers:
        cls = _PROVIDERS.get(name)
        if cls is None:
            log.warning("Provider de telefon necunoscut: %s (ignorat)", name)
            continue
        finders.append(cls(config, session))
    return finders
