"""Surse de descoperire a firmelor noi."""

from .anaf_scan import AnafScanSource
from .base import Source
from .monitorul_oficial import MonitorulOficialSource
from .onrc_opendata import OnrcOpenDataSource

REGISTRY = {
    "onrc": OnrcOpenDataSource,
    "anaf_scan": AnafScanSource,
    "monitorul_oficial": MonitorulOficialSource,
}

__all__ = ["Source", "OnrcOpenDataSource", "AnafScanSource", "MonitorulOficialSource", "REGISTRY"]
