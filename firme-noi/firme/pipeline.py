"""Orchestrarea fluxului: colectare → îmbogățire ANAF → găsire telefoane."""

from __future__ import annotations

import logging
import time
from typing import Optional

from .config import Config
from .db import Database
from .enrich import AnafClient, BilantClient, build_phone_finders
from .models import Company
from .sources import REGISTRY
from .util import ThrottledSession, is_suspect_phone, now_iso

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

    def collect(self, source_name: str, **options) -> int:
        """Colectează dintr-o sursă și salvează firmele NOI. Întoarce nr. noi.

        `options` merg la sursă (ex. dupa="2026-01-01", cui_min=..., judet=...).
        """
        source_cls = REGISTRY.get(source_name)
        if source_cls is None:
            raise ValueError(
                f"Sursă necunoscută: {source_name}. Disponibile: {list(REGISTRY)}"
            )
        started = now_iso()
        if source_name == "anaf_scan":
            # Continuăm de unde am rămas: în sus de la cel mai mare CUI știut,
            # în jos de la cel mai mic (dacă nu s-a ajuns încă la începutul anului).
            known_min, known_max = self.db.cui_range("anaf_scan")
            options.setdefault("known_min", known_min)
            options.setdefault("known_max", known_max)
        source = source_cls(self.config, self._session(min_interval=0.0), **options)
        self.last_source = source

        noi = vazute = 0
        buf: list[Company] = []
        try:
            for company in source.collect():
                vazute += 1
                buf.append(company)
                if len(buf) >= 1000:
                    noi += self.db.insert_many(buf)
                    buf = []
                    if vazute % 5000 == 0:
                        log.info("Citite %d firme din sursă (%d noi)...", vazute, noi)
        finally:
            # Salvăm ce avem chiar dacă rularea e întreruptă (ex. anulare, timeout).
            noi += self.db.insert_many(buf)

        self.db.log_run(
            etapa="collect", sursa=source_name, inceput=started,
            firme_noi=noi, firme_procesate=vazute,
            detalii=f"{vazute} firme în sursă (filtre: {options or 'niciunul'})",
        )
        log.info("Colectare terminată: %d firme noi din %d găsite în sursă.", noi, vazute)
        return noi

    # ------------------------------------------------------------------ #
    # 2. ÎMBOGĂȚIRE ANAF                                                  #
    # ------------------------------------------------------------------ #

    def enrich_anaf(self, limit: Optional[int] = None) -> int:
        """Completează firmele neverificate cu date oficiale de la ANAF.

        Salvează după fiecare lot de 100: dacă rularea se întrerupe, progresul
        rămâne. Loturile eșuate nu se marchează, deci se reîncearcă data viitoare.
        """
        started = now_iso()
        client = AnafClient(self.config, self._session(min_interval=self.config.anaf_min_interval))

        cuis = [c.cui for c in self.db.iter_needing_anaf(limit=limit)]
        if not cuis:
            log.info("Nu există firme de verificat la ANAF.")
            return 0

        total = len(cuis)
        est_min = total / max(self.config.anaf_batch_size, 1) * self.config.anaf_min_interval / 60
        log.info("Interoghez ANAF pentru %d firme (~%.0f minute)...", total, est_min)

        gasite = negasite = esuate = cu_tel = procesate = 0
        loturi = 0
        t0 = time.monotonic()
        for batch, found, _not_found, ok in client.lookup_batches(cuis):
            loturi += 1
            procesate += len(batch)
            if not ok:
                esuate += len(batch)
            else:
                for cui in batch:
                    company = found.get(cui)
                    if company is not None:
                        self.db.update(company, commit=False)
                        gasite += 1
                        cu_tel += 1 if company.telefon else 0
                    else:
                        # ANAF a răspuns, dar nu cunoaște CUI-ul: nu mai reîncercăm.
                        self.db.update(Company(cui=cui, anaf_verificat=True), commit=False)
                        negasite += 1
                self.db.commit()
            if loturi % 25 == 0 or procesate == total:
                elapsed = time.monotonic() - t0
                eta = elapsed / procesate * (total - procesate) / 60 if procesate else 0
                log.info(
                    "ANAF %d/%d | găsite %d | cu telefon %d | negăsite %d | eșuate %d | ETA %.0f min",
                    procesate, total, gasite, cu_tel, negasite, esuate, eta,
                )

        self.db.log_run(
            etapa="enrich", sursa="anaf", inceput=started, firme_procesate=procesate,
            detalii=(f"{gasite} găsite, {cu_tel} cu telefon, {negasite} negăsite, "
                     f"{esuate} eșuate (se reîncearcă)"),
        )
        log.info("Îmbogățire ANAF: %d găsite din %d, dintre care %d cu telefon.",
                 gasite, total, cu_tel)
        return gasite

    # ------------------------------------------------------------------ #
    # 3. GĂSIRE TELEFOANE                                                 #
    # ------------------------------------------------------------------ #

    def find_phones(self, limit: Optional[int] = None) -> int:
        """Caută telefoane din surse suplimentare (Google, web) pentru firmele
        pe care ANAF le-a verificat, dar fără telefon declarat.

        Telefonul ANAF se completează deja la `enrich`; aici rulează doar
        providerii externi. Fără ei nu marcăm nimic, ca o configurare ulterioară
        (ex. cheie Google) să poată reîncerca aceleași firme.
        """
        started = now_iso()
        session = self._session(min_interval=1.0)
        finders = [f for f in build_phone_finders(self.config, session) if f.name != "anaf"]
        if not finders:
            log.info("Niciun provider extern de telefon configurat (PHONE_PROVIDERS=google,web).")
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
            company.telefon_suspect = is_suspect_phone(phone) if phone else None
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

    def run_all(self, source_name: str, limit: Optional[int] = None, **options) -> dict[str, int]:
        noi = self.collect(source_name, **options)
        gasite_anaf = self.enrich_anaf(limit=limit)
        telefoane = self.find_phones(limit=limit)
        return {"firme_noi": noi, "gasite_anaf": gasite_anaf, "telefoane_extra": telefoane}
