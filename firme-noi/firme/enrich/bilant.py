"""Client pentru indicatorii financiari ANAF (bilanț).

Endpoint:  GET https://webservicesp.anaf.ro/bilant?an={an}&cui={cui}
Întoarce indicatori din situațiile financiare depuse: cifră de afaceri, profit
sau pierdere netă, număr de salariați, active, datorii, capitaluri.

Atenție: firmele NOI nu au încă bilanț depus (îl depun în anul următor), deci
această etapă e utilă mai ales pentru firme cu vechime. Un CUI per cerere.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from ..config import Config
from ..models import Company
from ..util import ThrottledSession

log = logging.getLogger("firme")


def _to_number(value) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


@dataclass
class BilantClient:
    config: Config
    session: ThrottledSession

    @property
    def endpoint(self) -> str:
        return f"{self.config.anaf_base_url.rsplit('/api', 1)[0]}/bilant"

    def fetch(self, cui: int, an: int) -> Optional[dict]:
        try:
            resp = self.session.get(self.endpoint, params={"an": an, "cui": int(cui)})
            resp.raise_for_status()
            body = resp.json()
        except Exception as exc:  # noqa: BLE001
            log.warning("Bilanț ANAF eșuat pentru CUI %s (an %s): %s", cui, an, exc)
            return None
        return self._parse(body, an)

    @staticmethod
    def _parse(body: dict, an: int) -> Optional[dict]:
        indicatori = body.get("i") or []
        if not indicatori:
            return None
        out: dict = {"an_bilant": an, "bilant_verificat": True}
        for ind in indicatori:
            den = str(ind.get("val_den_indicator") or "").lower()
            val = _to_number(ind.get("val_indicator"))
            if val is None:
                continue
            if "cifra de afaceri" in den:
                out["cifra_afaceri"] = val
            elif "profit net" in den:
                out["profit_net"] = val
            elif "pierdere net" in den:
                out["pierdere_neta"] = val
            elif "salariat" in den:
                out["numar_salariati"] = int(val)
            elif "datorii" in den and "total" in den:
                out["datorii_total"] = val
            elif ("capitaluri" in den or "capital" in den) and "total" in den:
                out["capital_total"] = val
            elif "active imobilizate" in den and "total" in den:
                out["active_total"] = val
        return out

    def enrich(self, company: Company, an: int) -> Company:
        data = self.fetch(company.cui, an)
        if data:
            for key, value in data.items():
                setattr(company, key, value)
        else:
            company.bilant_verificat = True  # marcăm că am încercat
        return company
