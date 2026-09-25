"""Surse de descoperire a firmelor noi."""

from .base import Source
from .onrc_opendata import OnrcOpenDataSource
from .monitorul_oficial import MonitorulOficialSource

REGISTRY = {
    "onrc": OnrcOpenDataSource,
    "monitorul_oficial": MonitorulOficialSource,
}

__all__ = ["Source", "OnrcOpenDataSource", "MonitorulOficialSource", "REGISTRY"]
