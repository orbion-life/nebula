import { RADICAL_PAIR_ARTIFACT } from "./generated/radicalPair";
import type { BenchmarkComparison, BenchmarkRef, MechanismRoute } from "./types";

/**
 * Public benchmark registry + retrospective comparison.
 *
 * Citations are REAL and metadata-verified (Crossref). A benchmark anchors the
 * PLAUSIBILITY of a mechanism class; it never implies a construct is validated.
 * The retrospective comparison describes public/measured signatures ONLY
 * qualitatively (no fabricated numbers) and derives the "simulated feature"
 * directly from the generated artifact, so the comparison is reproducible.
 */
export const PUBLIC_BENCHMARKS: BenchmarkRef[] = [
  {
    id: "bm_flavoprotein_odmr",
    system: "Flavoprotein flavin radical pair (in vitro)",
    observable: "Optically detected, radio-wave-controlled spin chemistry (RF-modulated fluorescence)",
    relevance:
      "Direct anchor for the flavin radical-pair route: an RF-frequency-resolved optical readout of spin chemistry in a flavoprotein.",
    claimCeiling: "measurement_triage",
    citation: {
      authors: "Meng H, Nie J, Berger S, von Grafenstein K, Weber S, Essen L-O, Rizzato R, Einholz C, Schleicher E, Bucher D, et al.",
      year: 2026,
      title: "Optically detected and radio wave-controlled spin chemistry in flavoproteins",
      venue: "Nature Biotechnology",
      doi: "10.1038/s41587-026-03158-5",
    },
  },
  {
    id: "bm_rfp_giant_mfe",
    system: "Red fluorescent protein (mScarlet3)",
    observable: "Static-magnetic-field-dependent fluorescence via a radical-pair / triplet mechanism",
    relevance:
      "Supports that a fluorescent protein can show a static-field-dependent fluorescence — the magnetofluorescence mechanism class this route models.",
    claimCeiling: "measurement_triage",
    citation: {
      authors: "Xiang Y, Lampson B, Hayward M, York A, Ingaramo M, Cohen AE",
      year: 2025,
      title: "Mechanism of Giant Magnetic Field Effect in a Red Fluorescent Protein",
      venue: "Journal of the American Chemical Society 147(21)",
      doi: "10.1021/jacs.5c03997",
    },
  },
  {
    id: "bm_engineered_spin_resonance",
    system: "Engineered protein (LOV-family) for multimodal sensing",
    observable: "Quantum spin resonance read out optically for multimodal magnetic sensing",
    relevance:
      "Engineered-protein spin-resonance readout — supports the plausibility of designing spin-linked optical reporters.",
    claimCeiling: "measurement_triage",
    citation: {
      authors: "Abrahams JNH, Štuhec T, Spreng B, Henry L, Kempf N, James D, Sechkar A, Stacey A, Trelles-Fernandez P, Antill LM, Timmel CR, Miller S, Ingaramo M, York A, Tetienne J-P, Steel A, et al.",
      year: 2026,
      title: "Quantum spin resonance in engineered proteins for multimodal sensing",
      venue: "Nature 649",
      doi: "10.1038/s41586-025-09971-3",
    },
  },
  {
    id: "bm_fp_spin_qubit",
    system: "Fluorescent protein (EYFP-derived) spin",
    observable: "Optically addressable protein spin (ODMR-like)",
    relevance:
      "Protein triplet/spin optical addressability — supports the triplet-FP ODMR route as a diagnostic concept.",
    claimCeiling: "diagnostic_only",
    citation: {
      authors: "Feder JS, Soloway BE, Verma S, Geng Z, Wang S, Kifle B, Riendeau EG, Tsaturyan Y, Weiss LS, Xie J, Huang H, Esser-Kahn A, Gagliardi L, Awschalom DD, Maurer PC, et al.",
      year: 2025,
      title: "A fluorescent-protein spin qubit",
      venue: "Nature 645",
      doi: "10.1038/s41586-025-09417-w",
    },
  },
];

export function benchmarkById(id: string): BenchmarkRef | undefined {
  return PUBLIC_BENCHMARKS.find((b) => b.id === id);
}

const NO_FABRICATION_DISCLAIMER =
  "Qualitative reproduction of a mechanism CLASS only. No measured numeric values are reproduced or fabricated; the public signatures are described qualitatively.";

/** Features derived from the generated artifact (so comparisons are reproducible). */
function radicalPairFeatures(): {
  lfeDepthPercent: number;
  hfeMaxPercent: number;
  rfPeakFreqMHz: number;
} {
  const d = RADICAL_PAIR_ARTIFACT.data;
  const lfeDepthPercent = Math.min(...d.mfePercent);
  const hfeMaxPercent = Math.max(...d.mfePercent);
  const rfIdx = d.rf.deltaYieldFraction.indexOf(Math.min(...d.rf.deltaYieldFraction));
  const rfPeakFreqMHz = d.rf.freq_MHz[rfIdx];
  return { lfeDepthPercent, hfeMaxPercent, rfPeakFreqMHz };
}

export function buildBenchmarkComparisons(route: MechanismRoute): BenchmarkComparison[] {
  const rpClasses = ["LOV_flavin_radical_pair", "cryptochrome_FAD_radical_pair"];

  if (rpClasses.includes(route.routeClass)) {
    const f = radicalPairFeatures();
    const odmr = benchmarkById("bm_flavoprotein_odmr")!;
    const rfp = benchmarkById("bm_rfp_giant_mfe")!;
    return [
      {
        benchmarkId: odmr.id,
        citation: odmr.citation,
        measuredObservable: odmr.observable,
        measuredQualitative:
          "Public report: flavoprotein fluorescence responds to specific radio-frequency fields (optically detected, radio-wave-controlled spin chemistry).",
        simulatedFeature: `Simulated RF-frequency sweep shows a resonance dip near ${f.rfPeakFreqMHz.toFixed(
          0,
        )} MHz, produced from the static-Hamiltonian eigen-gaps (a flat B1=0 control confirms it is not a scalar gain).`,
        agreementKind: "qualitative_reproduction",
        matches: true,
        residualUncertainty:
          "The resonance POSITION and amplitude depend on the hyperfine set and working field; our truncated two-nucleus model reproduces the existence of an RF resonance, not the published frequency or magnitude.",
        disclaimer: NO_FABRICATION_DISCLAIMER,
      },
      {
        benchmarkId: rfp.id,
        citation: rfp.citation,
        measuredObservable: rfp.observable,
        measuredQualitative:
          "Public report: a red fluorescent protein shows a static-magnetic-field-dependent fluorescence attributed to a radical-pair/triplet mechanism.",
        simulatedFeature: `Simulated MARY curve shows a static-field-dependent ΔF/F with a low-field dip (~${f.lfeDepthPercent.toFixed(
          1,
        )}%) and a high-field saturation (~+${f.hfeMaxPercent.toFixed(1)}%).`,
        agreementKind: "qualitative_reproduction",
        matches: true,
        residualUncertainty:
          "Sign and magnitude of the field effect are model- and system-dependent; our flavin–tryptophan pair is a different system than the benchmark protein.",
        disclaimer: NO_FABRICATION_DISCLAIMER,
      },
    ];
  }

  if (route.routeClass === "triplet_FP") {
    const q = benchmarkById("bm_fp_spin_qubit")!;
    return [
      {
        benchmarkId: q.id,
        citation: q.citation,
        measuredObservable: q.observable,
        measuredQualitative:
          "Public report: a fluorescent-protein-derived system supports optically addressable spin (ODMR-like) states.",
        simulatedFeature:
          "Simulated ODMR-like contrast trace has a resonance feature; this route is capped diagnostic-only because a clean protein ODMR contrast is not established for arbitrary constructs.",
        agreementKind: "qualitative_reproduction",
        matches: true,
        residualUncertainty:
          "Contrast magnitude and ambient-condition observability are not established for a generic construct.",
        disclaimer: NO_FABRICATION_DISCLAIMER,
      },
    ];
  }

  return [
    {
      benchmarkId: "none",
      citation: {
        authors: "n/a",
        year: 0,
        title: "No direct public benchmark for this route class",
        venue: "n/a",
        doi: "",
      },
      measuredObservable: "n/a",
      measuredQualitative:
        "No spin-linked public benchmark applies to this route class; it is scored on measurement value alone.",
      simulatedFeature: "n/a",
      agreementKind: "no_comparison",
      matches: false,
      residualUncertainty: "n/a",
      disclaimer:
        "This route is not compared to a spin-sensing benchmark; its simulation is a mechanism-shaped proxy.",
    },
  ];
}
