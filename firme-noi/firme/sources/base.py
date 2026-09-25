"""Interfața comună pentru orice sursă de firme noi."""

from __future__ import annotations

import abc
from typing import Iterator

from ..config import Config
from ..models import Company
from ..util import ThrottledSession


class Source(abc.ABC):
    """O sursă produce un flux de obiecte `Company` (parțial completate).

    Nu îi revine sarcina de a decide ce e „nou" — asta face baza de date, prin
    verificarea CUI-ului. Sursa doar livrează tot ce găsește.
    """

    #: numele scurt folosit în CLI și în coloana `sursa`
    name: str = "base"

    def __init__(self, config: Config, session: ThrottledSession) -> None:
        self.config = config
        self.session = session

    @abc.abstractmethod
    def collect(self) -> Iterator[Company]:
        """Produce firmele găsite de această sursă."""
        raise NotImplementedError
