"""Content-addressing for runs.

A run is immutable and keyed by its inputs: the compiled objective, the seed,
the instrument, and a config version. Identical inputs → identical run_id →
identical (cached) result. Provider/model versions fold into provenance at
retrieval time and are recorded per call in the RunState.
"""
from __future__ import annotations

import hashlib
import json

from ..contracts.objective import ObjectiveSpec

CONFIG_VERSION = "phase2-1"


def input_fingerprint(objective: ObjectiveSpec, seed: int, instrument_id: str | None) -> str:
    payload = {
        "config": CONFIG_VERSION,
        "schema": objective.schema_version,
        "seed": seed,
        "instrument_id": instrument_id,
        # normalized objective (exclude volatile provenance/ids)
        "objective": objective.model_dump(
            mode="json",
            exclude={"objective_id", "field_provenance"},
        ),
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()


def run_id_for(fingerprint: str) -> str:
    return f"run_{fingerprint[:16]}"
