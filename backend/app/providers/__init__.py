"""Public-data providers (real clients over the locked ProviderBase).

Each fetches live → cache → recorded fixture → explicit unavailable, and returns
a normalized Pydantic record with retrieval Provenance. Fixtures are committed so
the demo runs offline; nothing is imputed.
"""
from __future__ import annotations

from .alphafold import AlphaFoldProvider
from .base import Fetched, ProviderBase, ProviderUnavailable
from .fpbase import FpbaseProvider
from .interpro import InterProProvider
from .rcsb import RcsbProvider
from .uniprot import UniProtProvider

__all__ = [
    "ProviderBase",
    "ProviderUnavailable",
    "Fetched",
    "UniProtProvider",
    "InterProProvider",
    "RcsbProvider",
    "AlphaFoldProvider",
    "FpbaseProvider",
]
