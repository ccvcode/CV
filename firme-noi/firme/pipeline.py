"""Orchestrarea fluxului: colectare → îmbogățire ANAF → găsire telefoane."""

from __future__ import annotations

import logging
from typing import Optional

from .config import Config
from .db import Database
from .enrich import AnafClient, BilantClient, build_phone_finders
from .models import Company
from .sources import REGISTRY
from .util import ThrottledSession, now_iso

log = logging.getLogger("firme")


class Pipeline:
    def __init__(self, config: Config, db: Database) -> None:
        self.config = config
        self.db = db

    def _session(self, min_interval: float = 0.0) -> ThrottledSession:
        return ThrottledSession(
            min_interval=min_interval,
            timeout=self.config.http_timeout,
            user_agent=self.config.user_agent,
        )

    # ------------------------------------------------------------------ #
    # 1. COLECTARE                                                        #
    # ------------------------------------------------------------------ #

    def collect(self, source_name: str) -> int:
        """Colectează dintr-o sursă și salvează firmele NOI. Întoarce nr. noi."""
        source_cls = REGISTRY.get(source_name)
        if source_cls is None:
            raise ValueError(
                f"Sursă necunoscută: {source_name}. Disponibile: {list(REGISTRY)}"
            )
        started = now_iso()
        session = self._session(min_interval=0.0)
        source = source_cls(self.config, session)

        noi = 0
        vazute = 0
        for company in source.collect():
            vazute += 1
            if self.db.insert_new(company):
                noi += 1
            if vazute % 5000 == 0:
                log.info("Procesate %d firme din sursă (%d noi)...", vazute, noi)

        self.db.log_run(
            etapa="collect", sursa=source_name, inceput=started,
            firme_noi=noi, firme_procesate=vazute,
            detalii=f"{vazute} firme văzute în sursă",
        )
        log.info("Colectare terminată: %d firme noi din %d văzute.", noi, vazute)
        return noi

    # ------------------------------------------------------------------ #
    # 2. ÎMBOGĂȚIRE ANAF                                                  #
    # ------------------------------------------------------------------ #

    def enrich_anaf(self, limit: Optional[int] = None) -> int:
        """Completează firmele neverificate cu date oficiale de la ANAF."""
        started = now_iso()
        session = self._session(min_interval=self.config.anaf_min_interval)
        client = AnafClient(self.config, session)

        pending = list(self.db.iter_needing_anaf(limit=limit))
        if not pending:
            log.info("Nu există firme de verificat la ANAF.")
            return 0

        cuis = [c.cui for c in pending]
        log.info("Interoghez ANAF pentru %d firme...", len(cuis))
        results = client.lookup(cuis)

        procesate = 0
        for cui in cuis:
            found = results.get(cui)
            if found is not None:
                self.db.update(found)
            else:
                # Marcăm ca verificat ca să nu reinterogăm la infinit.
                self.db.update(Company(cui=cui, anaf_verificat=True))
            procesate += 1

        self.db.log_run(
            etapa="enrich", sursa="anaf", inceput=started,
            firme_procesate=procesate,
            detalii=f"{len(results)} găsite din {len(cuis)} interogate",
        )
        log.info("Îmbogățire ANAF: %d găsite din %d.", len(results), len(cuis))
        return len(results)

    # ------------------------------------------------------------------ #
    # 3. GĂSIRE TELEFOANE                                                 #
    # ------------------------------------------------------------------ #

    def find_phones(self, limit: Optional[int] = None) -> int:
        """Încearcă să găsească telefoane pentru firmele fără număr."""
        started = now_iso()
        session = self._session(min_interval=1.0)
        finders = build_phone_finders(self.config, session)
        if not finders:
            log.warning("Niciun provider de telefon configurat (PHONE_PROVIDERS).")
            return 0

        pending = list(self.db.iter_needing_phone(limit=limit))
        log.info(
            "Caut telefoane pentru %d firme cu providerii: %s",
            len(pending), [f.name for f in finders],
        )

        gasite = 0
        for company in pending:
            phone = None
            source = None
            for finder in finders:
                phone = finder.find(company)
                if phone:
                    source = finder.name
                    break
            company.telefon = phone
            company.telefon_sursa = source
            company.telefon_cautat = True
            self.db.update(company)
            if phone:
                gasite += 1

        self.db.log_run(
            etapa="phone", sursa=",".join(f.name for f in finders), inceput=started,
            firme_procesate=len(pending),
            detalii=f"{gasite} telefoane găsite din {len(pending)}",
        )
        log.info("Telefoane găsite: %d din %d firme.", gasite, len(pending))
        return gasite

    # ------------------------------------------------------------------ #
    # 4. ÎMBOGĂȚIRE FINANCIARĂ (bilanț)                                   #
    # ------------------------------------------------------------------ #

    def enrich_bilant(self, an: int, limit: Optional[int] = None) -> int:
        """Adaugă indicatori financiari (cifră de afaceri, profit, salariați)
        pentru firmele care nu au fost încă verificate financiar.
        """
        started = now_iso()
        session = self._session(min_interval=self.config.anaf_min_interval)
        client = BilantClient(self.config, session)

        pending = list(self.db.iter_needing_bilant(limit=limit))
        if not pending:
            log.info("Nu există firme de verificat financiar.")
            return 0

        log.info("Interoghez bilanțul (an %s) pentru %d firme...", an, len(pending))
        cu_date = 0
        for company in pending:
            client.enrich(company, an)
            self.db.update(company)
            if company.cifra_afaceri is not None or company.numar_salariati is not None:
                cu_date += 1

        self.db.log_run(
            etapa="bilant", sursa="anaf", inceput=started,
            firme_procesate=len(pending),
            detalii=f"{cu_date} cu date financiare (an {an}) din {len(pending)}",
        )
        log.info("Bilanț: %d firme cu date financiare din %d.", cu_date, len(pending))
        return cu_date

    # ------------------------------------------------------------------ #
    # Flux complet                                                        #
    # ------------------------------------------------------------------ #

    def run_all(self, source_name: str, limit: Optional[int] = None) -> dict[str, int]:
        noi = self.collect(source_name)
        gasite_anaf = self.enrich_anaf(limit=limit)
        telefoane = self.find_phones(limit=limit)
        return {"firme_noi": noi, "verificate_anaf": gasite_anaf, "telefoane": telefoane}
