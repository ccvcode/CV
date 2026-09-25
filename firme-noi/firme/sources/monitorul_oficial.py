"""Sursă (best-effort): Monitorul Oficial, Partea a IV-a.

Actele de înființare ale firmelor se publică în Monitorul Oficial Partea a IV-a,
însă exclusiv ca PDF-uri nestructurate. Extragerea automată de aici este
nesigură și fragilă (formatul textului variază), de aceea sursa recomandată
rămâne ONRC (vezi onrc_opendata.py).

Acest modul oferă schela: descarcă un PDF de Monitorul Oficial și încearcă să
extragă CUI-uri și denumiri prin expresii regulate. Funcționează doar dacă ai
instalat un extractor de text PDF (pdfplumber sau PyPDF2). Fără el, sursa se
dezactivează elegant și te îndrumă către ONRC.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Iterator, Optional

from ..models import Company
from .base import Source

log = logging.getLogger("firme")

# CUI (2–10 cifre) precedat de eticheta uzuală din acte.
_CUI_RE = re.compile(r"C\.?U\.?I\.?[:\s]*([0-9]{2,10})", re.IGNORECASE)
# Denumire tip „SC ... SRL/SA"
_NAME_RE = re.compile(r"\b((?:S\.?C\.?\s+)?[A-ZĂÂÎȘȚ0-9][\w .,'&-]{2,120}?\s+(?:S\.?R\.?L\.?|S\.?A\.?))")


def _load_pdf_text(pdf_bytes: bytes) -> Optional[str]:
    """Extrage textul dintr-un PDF folosind orice bibliotecă disponibilă."""
    try:
        import pdfplumber  # type: ignore

        import io

        text_parts = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")
        return "\n".join(text_parts)
    except ImportError:
        pass
    try:
        import io

        from PyPDF2 import PdfReader  # type: ignore

        reader = PdfReader(io.BytesIO(pdf_bytes))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except ImportError:
        return None


class MonitorulOficialSource(Source):
    name = "monitorul_oficial"

    def __init__(self, config, session) -> None:
        super().__init__(config, session)
        # URL direct către un PDF de Monitorul Oficial (Partea a IV-a).
        self.pdf_url = os.environ.get("MONITOR_PDF_URL", "").strip()

    def collect(self) -> Iterator[Company]:
        if not self.pdf_url:
            log.warning(
                "Sursa Monitorul Oficial necesită MONITOR_PDF_URL. "
                "Recomandat: folosește sursa 'onrc'."
            )
            return

        resp = self.session.get(self.pdf_url)
        resp.raise_for_status()
        text = _load_pdf_text(resp.content)
        if text is None:
            log.warning(
                "Lipsă extractor PDF. Instalează 'pdfplumber' (pip install pdfplumber) "
                "pentru a folosi sursa Monitorul Oficial."
            )
            return

        seen: set[int] = set()
        # Împărțim textul în blocuri, câte unul per apariție de CUI, și încercăm
        # să prindem denumirea cea mai apropiată.
        for match in _CUI_RE.finditer(text):
            try:
                cui = int(match.group(1))
            except ValueError:
                continue
            if cui in seen:
                continue
            seen.add(cui)

            window = text[max(0, match.start() - 200): match.start() + 50]
            name_match = _NAME_RE.search(window)
            denumire = name_match.group(1).strip() if name_match else None

            yield Company(cui=cui, denumire=denumire, sursa=self.name)
