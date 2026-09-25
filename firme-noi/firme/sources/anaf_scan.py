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
        # Câte loturi consecutive „goale"/vechi opresc scanarea (10 × 100 CUI).
        self.stop_after = int(options.get("stop_after") or 10)
        # Câte loturi eșuate la rând (după reîncercări) opresc rularea cu eroare.
        self.max_consecutive_failures = int(options.get("max_consecutive_failures") or 3)
        self._failures_in_row = 0
        # Buget total de loturi pe rulare (↑ + ↓). None = până la capăt.
        budget = options.get("max_batches") or os.environ.get("ANAF_SCAN_MAX_BATCHES")
        self.max_batches: Optional[int] = int(budget) if budget else None
        # Un lot „e din perioadă" doar dacă măcar această fracție din firmele
        # găsite sunt înregistrate după `dupa`. Firmele vechi izolate cu dată
        # recentă (ex. mutări de sediu) nu mai țin scanarea pornită prin anii trecuți.
        self.min_recent_share = float(options.get("min_recent_share") or 0.3)
        self.batches_done = 0
        self.up_done = False
        self.down_done = False
        self.complete = False
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
                    self._failures_in_row = 0
                    return found
            if wait is None:
                break
            log.warning("Lot ANAF eșuat (%s–%s); reîncerc în %ss.", cuis[0], cuis[-1], wait)
            time.sleep(wait)
        self.missed.append((cuis[0], cuis[-1]))
        self._failures_in_row += 1
        log.error("Lot ANAF pierdut după reîncercări: %s–%s", cuis[0], cuis[-1])
        if self._failures_in_row >= self.max_consecutive_failures:
            raise RuntimeError(
                f"ANAF nu a răspuns la {self._failures_in_row} loturi consecutive; opresc "
                "rularea (datele colectate până acum sunt salvate și rularea următoare continuă)."
            )
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

    def _budget_left(self) -> bool:
        return self.max_batches is None or self.batches_done < self.max_batches

    def _is_recent_batch(self, found: dict[int, Company], recent: list[Company]) -> bool:
        return bool(recent) and len(recent) >= self.min_recent_share * len(found)

    def scan_up(self, start_base: int) -> Iterator[Company]:
        """În sus, până la `stop_after` loturi consecutive fără nicio firmă."""
        empty = 0
        base = start_base
        while self._budget_left():
            if empty >= self.stop_after:
                self.up_done = True
                break
            found = self._query(range(base, base + self.batch))
            self.batches_done += 1
            self._progress("↑", self.batches_done, cui_from_base(base))
            base += self.batch
            if found is None:
                continue
            empty = 0 if found else empty + 1
            yield from self._emit(self._recent(found))
        else:
            self.up_done = empty >= self.stop_after
        log.info("Scanare ↑ %s la CUI ~%d.", "terminată" if self.up_done else "întreruptă (buget)",
                 cui_from_base(base))

    def scan_down(self, start_base: int) -> Iterator[Company]:
        """În jos, până la `stop_after` loturi consecutive din afara perioadei."""
        old = 0
        top = start_base
        while self._budget_left() and top > 0:
            if old >= self.stop_after:
                self.down_done = True
                break
            low = max(top - self.batch + 1, 1)
            found = self._query(range(low, top + 1))
            self.batches_done += 1
            self._progress("↓", self.batches_done, cui_from_base(low))
            top = low - 1
            if found is None:
                continue
            recent = self._recent(found)
            old = 0 if self._is_recent_batch(found, recent) else old + 1
            yield from self._emit(recent)
        else:
            self.down_done = old >= self.stop_after or top <= 0
        log.info("Scanare ↓ %s la CUI ~%d.", "terminată" if self.down_done else "întreruptă (buget)",
                 cui_from_base(max(top, 1)))

    def collect(self) -> Iterator[Company]:
        seed_base = self.seed // 10
        up_start = max(seed_base, (self.known_max or 0) // 10) + 1
        down_start = (self.known_min // 10 - 1) if self.known_min else seed_base
        log.info("Scanare ANAF: firme înregistrate după %s; ↑ de la CUI %d, ↓ de la CUI %d; "
                 "buget %s loturi.", self.dupa, cui_from_base(up_start),
                 cui_from_base(max(down_start, 1)), self.max_batches or "nelimitat")
        yield from self.scan_up(up_start)
        if self.up_done:
            yield from self.scan_down(down_start)
        self.complete = self.up_done and self.down_done
        log.info("Scanare ANAF: %d firme găsite în această rulare, %d cu telefon, "
                 "%d loturi, %d pierdute. Stare: %s.", self.found_total, self.with_phone,
                 self.batches_done, len(self.missed),
                 "COMPLETĂ" if self.complete else "PARȚIALĂ (continuă la rularea următoare)")
