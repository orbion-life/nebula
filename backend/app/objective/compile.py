"""Deterministic ObjectiveSpec compiler (transparent, rule-based).

This is the honest fallback used when no Anthropic key is configured: a scientist
can read every rule and see why a field was extracted. The LLM-backed parser
(backend tool use) lands in Phase 6 and produces the SAME ObjectiveSpec contract,
with `field_provenance.by == "llm"`. Never claim the fallback is Claude.
"""
from __future__ import annotations

import re
import uuid

from ..contracts.enums import ExpressionHost, MaterialContext, ReadoutMode, ScaffoldFamily
from ..contracts.objective import OBJECTIVE_SCHEMA_VERSION, FieldProvenance, ObjectiveSpec, RawObjective

_READOUT_RULES: list[tuple[ReadoutMode, re.Pattern[str]]] = [
    (ReadoutMode.fluorescence, re.compile(r"\b(fluoresc|optical|gfp|rfp|brightness|intensit)", re.I)),
    (ReadoutMode.lifetime, re.compile(r"\b(lifetime|flim|decay time|nanosecond)", re.I)),
    (ReadoutMode.rf_magnetic, re.compile(r"\b(magnetic|magneto|rf[- ]?link|radio[- ]?frequenc|b[- ]?field|spin)", re.I)),
    (ReadoutMode.odmr_like, re.compile(r"\b(odmr|optically detected|triplet|spin resonance)", re.I)),
    (ReadoutMode.redox_electrochemical, re.compile(r"\b(redox|electrochemical|electrode|potentiostat)", re.I)),
    (ReadoutMode.material_state, re.compile(r"\b(hydrogel|film|swelling|crosslink|material[- ]?state|stiffness|mechanical)", re.I)),
]
_MATERIAL_RULES: list[tuple[MaterialContext, re.Pattern[str]]] = [
    (MaterialContext.hydrogel, re.compile(r"\bhydrogel\b", re.I)),
    (MaterialContext.film, re.compile(r"\bfilm\b", re.I)),
    (MaterialContext.chip, re.compile(r"\bchip|microfluidic|device\b", re.I)),
    (MaterialContext.wearable, re.compile(r"\bwearable|patch|skin\b", re.I)),
    (MaterialContext.cell, re.compile(r"\bin[- ]?cell|intracellular|live cell\b", re.I)),
    (MaterialContext.solution, re.compile(r"\bsolution|in vitro|cuvette\b", re.I)),
]
_HOST_RULES: list[tuple[ExpressionHost, re.Pattern[str]]] = [
    (ExpressionHost.bacteria, re.compile(r"\bbacteri|e\.? ?coli|prokaryot\b", re.I)),
    (ExpressionHost.mammalian, re.compile(r"\bmammalian|hek|cho\b", re.I)),
    (ExpressionHost.yeast, re.compile(r"\byeast|pichia|saccharomyces\b", re.I)),
    (ExpressionHost.cell_free, re.compile(r"\bcell[- ]?free|in vitro translation\b", re.I)),
]
_EXCITATION_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("blue-light", re.compile(r"\bblue[- ]?light|blue excitation|4[0-9]0 ?nm|470 ?nm\b", re.I)),
    ("green-light", re.compile(r"\bgreen[- ]?light|530 ?nm|560 ?nm\b", re.I)),
    ("red-light", re.compile(r"\bred[- ]?light|6[0-9]0 ?nm|far[- ]?red\b", re.I)),
    ("UV", re.compile(r"\buv|ultraviolet|365 ?nm\b", re.I)),
]
# sensed quantity/state — what to SENSE (distinct from how to read it out)
_SENSED_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("magnetic field", re.compile(r"\bmagnetic|magneto|b[- ]?field\b", re.I)),
    ("radio-frequency field", re.compile(r"\brf|radio[- ]?frequenc\b", re.I)),
    ("redox potential", re.compile(r"\bredox|oxidation|reduction|potential\b", re.I)),
    ("material swelling / mechanical state", re.compile(r"\bswelling|crosslink|stiffness|mechanical|strain\b", re.I)),
    ("light history", re.compile(r"\blight history|illumination history|photo[- ]?history\b", re.I)),
]
# scaffold-family hints the user may name explicitly (expert mode)
_FAMILY_RULES: list[tuple[ScaffoldFamily, re.Pattern[str]]] = [
    (ScaffoldFamily.lov_flavin, re.compile(r"\blov\b|flavin|fmn", re.I)),
    (ScaffoldFamily.cryptochrome_fad, re.compile(r"\bcryptochrome|cry\b|fad\b", re.I)),
    (ScaffoldFamily.fluorescent_protein, re.compile(r"\bgfp|yfp|fluorescent protein\b", re.I)),
]


def compile_objective(raw: RawObjective) -> ObjectiveSpec:
    text = raw.objective_text
    fp: list[FieldProvenance] = []

    def rule(field: str, hit: bool) -> None:
        fp.append(FieldProvenance(field=field, source="inferred" if hit else "defaulted", by="rule"))

    readouts = [m for m, rx in _READOUT_RULES if rx.search(text)]
    if not readouts:
        readouts = [ReadoutMode.fluorescence]
        rule("desired_modalities", False)
    else:
        rule("desired_modalities", True)

    material = next((m for m, rx in _MATERIAL_RULES if rx.search(text)), MaterialContext.unknown)
    rule("material_context", material is not MaterialContext.unknown)
    host = next((h for h, rx in _HOST_RULES if rx.search(text)), ExpressionHost.unknown)
    rule("expression_host", host is not ExpressionHost.unknown)
    excitation = [n for n, rx in _EXCITATION_RULES if rx.search(text)]
    sensed = next((s for s, rx in _SENSED_RULES if rx.search(text)), None)
    rule("sensed_quantity_or_state", sensed is not None)
    families = [f for f, rx in _FAMILY_RULES if rx.search(text)]

    oxygen = "unknown"
    if re.search(r"\banaerobic|deoxygenat|oxygen[- ]?free\b", text, re.I):
        oxygen = "anaerobic"
    elif re.search(r"\baerobic|oxygen|o2\b", text, re.I):
        oxygen = "controlled" if re.search(r"\btolerate|control", text, re.I) else "aerobic"

    constraints: list[str] = []
    if re.search(r"\bopen[- ]?source|public|synthetic\b", text, re.I):
        constraints.append("public/synthetic evidence only")
    if re.search(r"\bcontrols?\b", text, re.I):
        constraints.append("controls required")
    if re.search(r"\bno confidential|no proprietary|no private sequence\b", text, re.I):
        constraints.append("no confidential sequences")

    missing: list[str] = []
    if material is MaterialContext.unknown:
        missing.append("material context not specified")
    if host is ExpressionHost.unknown:
        missing.append("expression host not specified (assume bacterial-first)")
    if not excitation:
        missing.append("excitation wavelength not specified")
    if sensed is None:
        missing.append("the quantity to SENSE was not stated (only the readout modality)")
    if not re.search(r"\b(mT|tesla|MHz|noise|limit of detection|LoD|sensitivity|effect size)\b", text, re.I):
        missing.append("no sensitivity target / limit-of-detection stated")

    return ObjectiveSpec(
        schema_version=OBJECTIVE_SCHEMA_VERSION,
        objective_id=f"obj_{uuid.uuid4().hex[:12]}",
        objective_text=text,
        user_mode=raw.user_mode,
        sensed_quantity_or_state=sensed,
        desired_modalities=readouts,
        acceptable_readouts=readouts,
        material_context=material,
        expression_host=host,
        excitation_allowed=excitation,
        oxygen_condition=oxygen,  # type: ignore[arg-type]
        target_scaffold_families=families,
        instrument_id=raw.instrument_id,
        constraints=constraints,
        missing_information=missing,
        forbidden_assumptions=[
            "do not assume any listed protein already works as a sensor",
            "do not assume sequence alone predicts spin response",
            "do not assume simulated traces are measured data",
        ],
        field_provenance=fp,
        seed=raw.seed,
    )
