"""Sursă: parcurgerea CUI-urilor consecutive prin API-ul public ANAF.

CUI-urile se alocă în ordine: un număr de bază crescător + o cifră de control.
Pornind de la un CUI recent, interogăm ANAF în loturi de 100 de CUI-uri:
  - în sus, până la ultimul CUI alocat (firmele din ultimele zile);
  - în jos, până când firmele găsite sunt înregistrate înainte de `dupa`.

ANAF întoarce direct datele complete (denumire, adresă, CAEN, TVA, telefon),
deci fiecare firmă găsită e deja îmbogățită. Sursa e utilă când data.gov.ro
nu e accesibil (ex. de pe servere din afara României) și dă date mai proaspete
decât setul ONRC, care se publică lunar. Respectă limita ANAF de o cerere pe
secundă (ANAF_MIN_INTERVAL).
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Iterable, Iterator, Optional

from ..enrich.anaf import AnafClient
from ..models import Company
from ..util import ThrottledSession
from .base import Source

log = logging.getLogger("firme")

# Cheia de control pentru CUI/CIF (algoritmul oficial).
_KEY = (7, 5, 3, 2, 1, 7, 5, 3, 2)


def cui_from_base(base: int) -> int:
    """CUI complet (cu cifra de control) pentru un număr de bază."""
    digits = str(base).zfill(9)
    if len(digits) > 9 or base <= 0:
        raise ValueError(f"Număr de bază CUI invalid: {base}")
    total = sum(int(d) * k for d, k in zip(digits, _KEY))
    control = (total * 10) % 11
    return base * 10 + (0 if control == 10 else control)


def is_valid_cui(cui: int) -> bool:
    return cui > 10 and cui_from_base(cui // 10) == cui


class AnafScanSource(Source):
    name = "anaf_scan"

    #: CUI de pornire implicit: firmă înregistrată pe 24.09.2026.
    DEFAULT_SEED = 55626258

    def __init__(self, config, session, **options) -> None:
        super().__init__(config, session, **options)
        year = datetime.now(timezone.utc).year
        self.dupa: str = options.get("dupa") or f"{year}-01-01"
        self.seed = int(options.get("seed") or os.environ.get("ANAF_SCAN_SEED") or self.DEFAULT_SEED)
        self.known_min: Optional[int] = options.get("known_min")
        self.known_max: Optional[int] = options.get("known_max")
        self.stop_after = int(options.get("stop_after") or 5)
        self.max_batches = int(options.get("max_batches")
                               or os.environ.get("ANAF_SCAN_MAX_BATCHES") or 5000)
        self.retry_waits = options.get("retry_waits", (10, 30, 60))
        self.batch = config.anaf_batch_size
        self.client = options.get("client") or AnafClient(
            config,
            ThrottledSession(min_interval=config.anaf_min_interval,
                             timeout=config.http_timeout, user_agent=config.user_agent),
        )
        self.missed: list[tuple[int, int]] = []
        self.found_total = 0
        self.with_phone = 0

    # ------------------------------------------------------------------ #

    def _query(self, bases: Iterable[int]) -> Optional[dict[int, Company]]:
        """Interoghează un lot; reîncearcă la eșec. None = lot pierdut."""
        cuis = [cui_from_base(b) for b in bases]
        waits = list(self.retry_waits) + [None]
        for wait in waits:
            for _, found, _, ok in self.client.lookup_batches(cuis):
                if ok:
                    return found
            if wait is None:
                break
            log.warning("Lot ANAF eșuat (%s–%s); reîncerc în %ss.", cuis[0], cuis[-1], wait)
            time.sleep(wait)
        self.missed.append((cuis[0], cuis[-1]))
        log.error("Lot ANAF pierdut după reîncercări: %s–%s", cuis[0], cuis[-1])
        return None

    def _recent(self, found: dict[int, Company]) -> list[Company]:
        out = []
        for c in found.values():
            if (c.data_inregistrare or "") >= self.dupa:
                c.sursa = self.name
                out.append(c)
        return out

    def _emit(self, companies: list[Company]) -> Iterator[Company]:
        for c in companies:
            self.found_total += 1
            self.with_phone += 1 if c.telefon else 0
            yield c

    def _progress(self, direction: str, batches: int, cui: int) -> None:
        if batches % 25 == 0:
            log.info("Scanare %s: %d loturi, CUI curent %d | firme găsite %d, cu telefon %d",
                     direction, batches, cui, self.found_total, self.with_phone)

    def scan_up(self, start_base: int) -> Iterator[Company]:
        """În sus, până la `stop_after` loturi consecutive fără nicio firmă."""
        empty = batches = 0
        base = start_base
        while empty < self.stop_after and batches < self.max_batches:
            found = self._query(range(base, base + self.batch))
            batches += 1
            self._progress("↑", batches, cui_from_base(base))
            base += self.batch
            if found is None:
                continue
            empty = 0 if found else empty + 1
            yield from self._emit(self._recent(found))
        log.info("Scanare ↑ terminată la CUI ~%d (%d loturi).", cui_from_base(base), batches)

    def scan_down(self, start_base: int) -> Iterator[Company]:
        """În jos, până la `stop_after` loturi consecutive fără firme din perioadă."""
        old = batches = 0
        top = start_base
        while old < self.stop_after and batches < self.max_batches and top > 0:
            low = max(top - self.batch + 1, 1)
            found = self._query(range(low, top + 1))
            batches += 1
            self._progress("↓", batches, cui_from_base(low))
            top = low - 1
            if found is None:
                continue
            recent = self._recent(found)
            old = 0 if recent else old + 1
            yield from self._emit(recent)
        log.info("Scanare ↓ terminată la CUI ~%d (%d loturi).", cui_from_base(max(top, 1)), batches)

    def collect(self) -> Iterator[Company]:
        seed_base = self.seed // 10
        up_start = max(seed_base, (self.known_max or 0) // 10) + 1
        down_start = (self.known_min // 10 - 1) if self.known_min else seed_base
        log.info("Scanare ANAF: firme înregistrate după %s; pornire de la CUI %d "
                 "(↑ de la %d, ↓ de la %d).", self.dupa, self.seed,
                 cui_from_base(up_start), cui_from_base(max(down_start, 1)))
        yield from self.scan_up(up_start)
        yield from self.scan_down(down_start)
        log.info("Scanare ANAF: %d firme găsite, %d cu telefon, %d loturi pierdute.",
                 self.found_total, self.with_phone, len(self.missed))
