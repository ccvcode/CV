"""Configurare încărcată din variabile de mediu (opțional dintr-un fișier .env)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# Rădăcina proiectului (folderul firme-noi/)
ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Încărcător .env minimal, ca să nu depindem de python-dotenv.

    Nu suprascrie variabilele deja setate în mediu.
    """
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_dotenv(ROOT / ".env")


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


@dataclass
class Config:
    # Baza de date
    db_path: Path = field(
        default_factory=lambda: (ROOT / os.environ.get("FIRME_DB", "data/firme.db"))
    )

    # ANAF
    anaf_base_url: str = os.environ.get("ANAF_BASE_URL", "https://webservicesp.anaf.ro/api")
    anaf_version: str = os.environ.get("ANAF_VERSION", "v9")
    anaf_batch_size: int = _env_int("ANAF_BATCH_SIZE", 100)
    anaf_min_interval: float = _env_float("ANAF_MIN_INTERVAL", 1.2)

    # ONRC / data.gov.ro
    onrc_csv_url: str = os.environ.get("ONRC_CSV_URL", "").strip()

    # Telefoane
    phone_providers: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            p.strip()
            for p in os.environ.get("PHONE_PROVIDERS", "anaf").split(",")
            if p.strip()
        )
    )
    google_maps_api_key: str = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()

    # HTTP
    http_timeout: int = _env_int("HTTP_TIMEOUT", 30)
    user_agent: str = os.environ.get("USER_AGENT", "firme-noi/1.0 (colectare date publice)")

    def ensure_dirs(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)


def load_config() -> Config:
    cfg = Config()
    cfg.ensure_dirs()
    return cfg
