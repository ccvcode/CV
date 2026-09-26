"""Utilitare: sesiune HTTP cu throttling + retry, normalizare telefoane, dată."""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone
from typing import Iterable, Iterator, Optional, TypeVar

import requests

log = logging.getLogger("firme")

T = TypeVar("T")


def now_iso() -> str:
    """Timestamp ISO 8601 în UTC (fără microsecunde)."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def parse_date(value) -> Optional[str]:
    """Normalizează o dată la YYYY-MM-DD (acceptă și DD.MM.YYYY / DD/MM/YYYY)."""
    if not value:
        return None
    v = str(value).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", v)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{1,2})[./](\d{1,2})[./](\d{4})", v)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    return None


def chunked(items: Iterable[T], size: int) -> Iterator[list[T]]:
    """Împarte un iterabil în blocuri de dimensiune `size`."""
    batch: list[T] = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


# --------------------------------------------------------------------------- #
# Telefoane                                                                     #
# --------------------------------------------------------------------------- #

# Prefixe valide pentru numere naționale din România (după cifra 0 inițială):
#   7 = mobil, 2/3 = fix. Numărul național complet are 10 cifre.
_RO_NATIONAL_RE = re.compile(r"^0[237]\d{8}$")

# Găsire numere într-un text liber (best-effort, pentru scraping).
_PHONE_IN_TEXT_RE = re.compile(
    r"(?:(?:\+?40|0040)[\s.\-]?|0)"      # prefix internațional sau 0
    r"(?:7\d{2}|[23]\d{1,2})"            # zonă (mobil 7xx / fix 2x-3x)
    r"(?:[\s.\-]?\d){6,7}"              # restul cifrelor
)


def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Normalizează un număr de telefon românesc la formatul 0XXXXXXXXX.

    Întoarce None dacă nu e un număr național valid.
    """
    if not raw:
        return None
    digits = re.sub(r"[^\d+]", "", str(raw))
    if digits.startswith("+40"):
        digits = "0" + digits[3:]
    elif digits.startswith("0040"):
        digits = "0" + digits[4:]
    elif digits.startswith("40") and len(digits) == 11:
        digits = "0" + digits[2:]
    digits = re.sub(r"\D", "", digits)
    if _RO_NATIONAL_RE.match(digits):
        return digits
    return None


def extract_phone(text: Optional[str]) -> Optional[str]:
    """Extrage primul număr de telefon românesc valid dintr-un text liber."""
    if not text:
        return None
    for match in _PHONE_IN_TEXT_RE.finditer(text):
        normalized = normalize_phone(match.group(0))
        if normalized:
            return normalized
    return None


_INTL_RE = re.compile(r"(?:\+|\b00)(\d[\d\s.\-/()]{6,20}\d)")


def clean_phone(raw) -> Optional[str]:
    """Primul număr utilizabil dintr-un câmp de telefon completat liber.

    Câmpul ANAF e text liber: poate conține mai multe numere, separatoare
    diverse sau numere din străinătate. Regula:
      - număr românesc  -> 0XXXXXXXXX
      - număr străin    -> +<cifre>   (ex. +37360696333, fondatori din Moldova)
      - altceva         -> None
    """
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    ro = extract_phone(text) or normalize_phone(text)
    if ro:
        return ro
    match = _INTL_RE.search(text)
    if match:
        digits = re.sub(r"\D", "", match.group(1))
        # Prefixele de țară nu încep cu 0; un număr format numai din zerouri e fals.
        if (8 <= len(digits) <= 15 and not digits.startswith("40")
                and digits[0] != "0" and len(set(digits)) > 1):
            return "+" + digits
    return None


_ASC = "0123456789" * 2
_SEQUENCES = {_ASC[i:i + 7] for i in range(10)} | {_ASC[::-1][i:i + 7] for i in range(10)}


def is_suspect_phone(phone: Optional[str]) -> bool:
    """Semnalează numerele aproape sigur completate de formă. Nu le ștergem,
    doar le marcăm (coloana „Calitate telefon").

      0722222222 / 0770000000   – ultimele 7 cifre identice
      0712345678 / +393474567890 – secvență crescătoare/descrescătoare
      0780000001 / 0756000000   – cel puțin 6 zerouri în ultimele 7 cifre

    Numerele „de aur" (ex. 0722222727) NU sunt marcate: pot fi reale.
    """
    if not phone:
        return False
    digits = re.sub(r"\D", "", phone)
    tail = digits[-7:]
    if len(tail) < 7:
        return True
    return len(set(tail)) == 1 or tail in _SEQUENCES or tail.count("0") >= 6


# --------------------------------------------------------------------------- #
# HTTP                                                                          #
# --------------------------------------------------------------------------- #

class ThrottledSession:
    """Sesiune HTTP care respectă un interval minim între cereri și reîncearcă
    automat la erori de rețea sau la răspunsuri 429/5xx (backoff exponențial).

    Respectă variabilele de mediu HTTPS_PROXY/HTTP_PROXY (folosite de requests
    implicit), deci funcționează și în spatele unui proxy.
    """

    def __init__(
        self,
        *,
        min_interval: float = 0.0,
        timeout: int = 30,
        retries: int = 4,
        user_agent: str = "firme-noi/1.0",
    ) -> None:
        self.min_interval = min_interval
        self.timeout = timeout
        self.retries = retries
        self._last_request = 0.0
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent})

    def _throttle(self) -> None:
        if self.min_interval <= 0:
            return
        elapsed = time.monotonic() - self._last_request
        wait = self.min_interval - elapsed
        if wait > 0:
            time.sleep(wait)

    def request(self, method: str, url: str, **kwargs) -> requests.Response:
        kwargs.setdefault("timeout", self.timeout)
        last_exc: Optional[Exception] = None
        for attempt in range(self.retries + 1):
            self._throttle()
            try:
                resp = self.session.request(method, url, **kwargs)
                self._last_request = time.monotonic()
                if resp.status_code in (429, 500, 502, 503, 504):
                    raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
                return resp
            except (requests.RequestException, requests.HTTPError) as exc:
                self._last_request = time.monotonic()
                last_exc = exc
                if attempt >= self.retries:
                    break
                backoff = 2 ** attempt
                log.warning("Cerere eșuată (%s). Reîncercare în %ss...", exc, backoff)
                time.sleep(backoff)
        assert last_exc is not None
        raise last_exc

    def get(self, url: str, **kwargs) -> requests.Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs) -> requests.Response:
        return self.request("POST", url, **kwargs)


_CEDILLA = str.maketrans("ŞşŢţ", "ȘșȚț")


def firma_key(denumire: Optional[str]) -> str:
    """Cheie de comparare a denumirilor: ignoră spațiile, punctuația și
    diferențele ş/ș. Sediile secundare poartă numele firmei-mamă, deci
    „EVI MUSIC S.R.L." și „EVI  MUSIC SRL" sunt aceeași firmă."""
    return re.sub(r"\W", "", (denumire or "").upper().translate(_CEDILLA))
