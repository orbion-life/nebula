"""Content-addressing for runs.

A run is immutable and keyed by its inputs: the compiled objective, the seed,
the instrument, and a config version. Identical inputs → identical run_id →
identical (cached) result. Provider/model versions fold into provenance at
retrieval time and are recorded per call in the RunState.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from ..contracts.objective import ObjectiveSpec

CONFIG_VERSION = "discover-2026-07-11"

_PIPELINE_SOURCES = (
    "objective/compile.py",
    "retrieval/plan.py",
    "retrieval/assemble.py",
    "physics/eligibility.py",
    "physics/candidate_specific.py",
    "discovery/capability.py",
    "discovery/mechanism.py",
    "discovery/ladder.py",
    "discovery/lanes.py",
    "discovery/scoring.py",
    "physics/cluster.py",
    "jobs/orchestrator.py",
)


def _artifact_hash() -> str:
    p = Path(__file__).resolve().parents[3] / "src" / "data" / "generated" / "radical_pair_mary.v1.json"
    try:
        return json.loads(p.read_text())["contentHash"][:16]
    except Exception:
        return "noartifact"


def _pipeline_hash() -> str:
    """Hash decision-bearing source so code changes cannot replay stale results."""
    app_root = Path(__file__).resolve().parents[1]
    digest = hashlib.sha256()
    try:
        for rel in _PIPELINE_SOURCES:
            path = app_root / rel
            digest.update(rel.encode())
            digest.update(path.read_bytes())
        return digest.hexdigest()[:16]
    except Exception:
        return "source-unavailable"


# Model / provider / config versions folded into the immutable run identity, so a
# provider-API bump or a physics-artifact change yields a different run_id.
def component_versions() -> dict[str, str]:
    return {
        "config": CONFIG_VERSION,
        "pipeline_source": _pipeline_hash(),
        "radical_pair_artifact": _artifact_hash(),
        "esm2_model": "esm2_t6_8M_UR50D",
        "provider_apis": "uniprot=2026_02;interpro;rcsb-v1/v2;alphafold-v4;fpbase",
    }


def input_fingerprint(objective: ObjectiveSpec, seed: int, instrument_id: str | None) -> str:
    payload = {
        "versions": component_versions(),
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


def run_id_for(fingerprint: str, attempt: int = 0) -> str:
    base = f"run_{fingerprint[:16]}"
    return base if attempt == 0 else f"{base}_a{attempt}"
