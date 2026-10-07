"""Interfața comună pentru orice sursă de firme noi."""

from __future__ import annotations

import abc
from typing import Iterator

from ..config import Config
from ..models import Company
from ..util import ThrottledSession


class Source(abc.ABC):
    """O sursă produce un flux de obiecte `Company` (parțial completate).

    Deduplicarea (ce e „nou") o face baza de date, după CUI. Opțiunile
    specifice sursei (ex. filtrul de dată) vin prin `options`.
    """

    #: numele scurt folosit în CLI și în coloana `sursa`
    name: str = "base"

    def __init__(self, config: Config, session: ThrottledSession, **options) -> None:
        self.config = config
        self.session = session
        self.options = options

    @abc.abstractmethod
    def collect(self) -> Iterator[Company]:
        """Produce firmele găsite de această sursă."""
        raise NotImplementedError
