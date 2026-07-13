import type { EvidenceCard } from "../types";

/**
 * Public evidence cards.
 *
 * Each card summarizes a publicly known mechanism motif and is anchored to a
 * REAL, checkable citation (author, year, venue, DOI). These are NOT proprietary
 * data, NOT Orbion internal results, and NOT a claim that any listed protein is a
 * working sensor. Two cards are honestly flagged `demo_assumption` because they
 * describe sandbox choices, not literature results.
 *
 * A citation supports the PLAUSIBILITY of a mechanism route. It never implies
 * that a specific construct hypothesis is validated.
 */
export const EVIDENCE_CARDS: EvidenceCard[] = [
  {
    id: "ev_radical_pair_mfe",
    title: "Radical-pair reactions can be magnetically sensitive",
    summary:
      "Spin-correlated radical pairs formed by photochemistry can show reaction yields/lifetimes that depend on weak magnetic fields, an in-vitro-demonstrated, widely reviewed public mechanism for magnetosensitivity.",
    routeClasses: ["LOV_flavin_radical_pair", "cryptochrome_FAD_radical_pair"],
    scaffoldFamilies: ["LOV_flavin", "cryptochrome_FAD"],
    cofactors: ["FMN", "FAD"],
    provenance: "public_literature",
    citations: [
      {
        authors: "Hore PJ, Mouritsen H",
        year: 2016,
        title: "The Radical-Pair Mechanism of Magnetoreception",
        venue: "Annual Review of Biophysics 45:299-344",
        doi: "10.1146/annurev-biophys-032116-094545",
      },
      {
        authors: "Maeda K, Henbest KB, Cintolesi F, et al.",
        year: 2008,
        title: "Chemical compass model of avian magnetoreception",
        venue: "Nature 453:387-390",
        doi: "10.1038/nature06834",
      },
    ],
    relation: "supports",
    capsClaimAt: "measurement_triage",
    note: "Supports plausibility of a field-dependent optical readout; does not prove any specific construct responds.",
  },
  {
    id: "ev_flavin_photochemistry",
    title: "Flavin cofactors are photochemically active",
    summary:
      "FMN/FAD absorb blue light and undergo well-characterized public photochemistry (one- and two-electron transfers, transient radical states), making them common anchors for light-driven mechanism routes.",
    routeClasses: [
      "LOV_flavin_radical_pair",
      "RFP_flavin_photochemical",
      "cryptochrome_FAD_radical_pair",
    ],
    scaffoldFamilies: ["LOV_flavin", "RFP_plus_flavin", "cryptochrome_FAD"],
    cofactors: ["FMN", "FAD"],
    provenance: "public_literature",
    citations: [
      {
        authors: "Massey V",
        year: 2000,
        title: "The chemical and biological versatility of riboflavin",
        venue: "Biochemical Society Transactions 28(4):283-296",
        doi: "10.1042/bst0280283",
      },
    ],
    relation: "requires",
    note: "Blue-light excitation is compatible; requires the flavin cofactor to be present and photoactive in context.",
  },
  {
    id: "ev_lov_photocycle",
    title: "LOV domains have a characterized blue-light photocycle",
    summary:
      "Light-Oxygen-Voltage domains form a reversible covalent FMN-cysteinyl (C4a) adduct under blue light and recover in the dark, a public, reproducible photocycle used broadly in optogenetics.",
    routeClasses: ["LOV_flavin_radical_pair"],
    scaffoldFamilies: ["LOV_flavin"],
    cofactors: ["FMN"],
    provenance: "public_literature",
    citations: [
      {
        authors: "Salomon M, Christie JM, Knieb E, Lempert U, Briggs WR",
        year: 2000,
        title:
          "Photochemical and Mutational Analysis of the FMN-Binding Domains of the Plant Blue Light Receptor, Phototropin",
        venue: "Biochemistry 39(31):9401-9410",
        doi: "10.1021/bi000585+",
      },
    ],
    relation: "supports",
    capsClaimAt: "measurement_triage",
    note: "Gives a concrete, controllable light-history handle for measurement design.",
  },
  {
    id: "ev_cryptochrome_fad",
    title: "Cryptochrome/FAD is the leading candidate radical-pair magnetoreceptor",
    summary:
      "Cryptochrome-like flavoproteins form FAD-based radical pairs via a tryptophan electron-transfer chain; this is the leading (still-unproven-in-cells) candidate for a protein radical-pair magnetic compass.",
    routeClasses: ["cryptochrome_FAD_radical_pair"],
    scaffoldFamilies: ["cryptochrome_FAD"],
    cofactors: ["FAD"],
    provenance: "public_literature",
    citations: [
      {
        authors: "Maeda K, Henbest KB, Cintolesi F, et al.",
        year: 2008,
        title: "Chemical compass model of avian magnetoreception",
        venue: "Nature 453:387-390",
        doi: "10.1038/nature06834",
      },
    ],
    relation: "assumes",
    capsClaimAt: "diagnostic_only",
    note: "Stays diagnostic-only for engineered constructs: an in-cell, readout-coupled magnetic effect is not established for arbitrary scaffolds.",
  },
  {
    id: "ev_fp_triplet",
    title: "Fluorescent proteins populate triplet/dark states",
    summary:
      "GFP-like proteins transiently enter dark and triplet states (single-molecule blinking, photoswitching). Triplet-state spin physics is the public basis for any ODMR-like discussion.",
    routeClasses: ["triplet_FP"],
    scaffoldFamilies: ["fluorescent_protein"],
    cofactors: ["intrinsic chromophore"],
    provenance: "public_literature",
    citations: [
      {
        authors: "Dickson RM, Cubitt AB, Tsien RY, Moerner WE",
        year: 1997,
        title:
          "On/off blinking and switching behaviour of single molecules of green fluorescent protein",
        venue: "Nature 388:355-358",
        doi: "10.1038/41048",
      },
    ],
    relation: "assumes",
    capsClaimAt: "diagnostic_only",
    note: "Triplet/dark-state population is real; a clean spin-addressable optical (ODMR) readout in a protein is not established and stays diagnostic-only.",
  },
  {
    id: "ev_oxygen_quenching",
    title: "Oxygen quenches triplet and radical states",
    summary:
      "Ground-state molecular oxygen efficiently quenches excited triplet states (and scavenges radicals), which can suppress or confound a spin-linked optical signal.",
    routeClasses: [
      "triplet_FP",
      "LOV_flavin_radical_pair",
      "cryptochrome_FAD_radical_pair",
    ],
    scaffoldFamilies: ["fluorescent_protein", "LOV_flavin", "cryptochrome_FAD"],
    cofactors: [],
    provenance: "public_literature",
    citations: [
      {
        authors: "Wilkinson F, Helman WP, Ross AB",
        year: 1993,
        title:
          "Quantum Yields for the Photosensitized Formation of the Lowest Electronically Excited Singlet State of Molecular Oxygen in Solution",
        venue: "Journal of Physical and Chemical Reference Data 22(1):113-262",
        doi: "10.1063/1.555934",
      },
    ],
    relation: "confounded_by",
    note: "Mandatory oxygen control; a small spin-linked signal can be swamped by oxygen variation.",
  },
  {
    id: "ev_photobleaching",
    title: "Photobleaching produces (often non-single-exponential) signal decay",
    summary:
      "Continuous illumination bleaches chromophores, producing intensity decay that can be mistaken for a stimulus response if not controlled; kinetics are frequently non-single-exponential.",
    routeClasses: [
      "LOV_flavin_radical_pair",
      "triplet_FP",
      "RFP_flavin_photochemical",
    ],
    scaffoldFamilies: ["LOV_flavin", "fluorescent_protein", "RFP_plus_flavin"],
    cofactors: [],
    provenance: "public_literature",
    citations: [
      {
        authors: "Song L, Hennink EJ, Young IT, Tanke HJ",
        year: 1995,
        title: "Photobleaching kinetics of fluorescein in quantitative fluorescence microscopy",
        venue: "Biophysical Journal 68(6):2588-2600",
        doi: "10.1016/S0006-3495(95)80442-X",
      },
    ],
    relation: "confounded_by",
    note: "Requires a no-field / no-RF illuminated control to separate bleaching from any response.",
  },
  {
    id: "ev_field_effect_falsified",
    title: "Flat field response under controls falsifies spin-linked readout",
    summary:
      "If optical contrast does not change with static field under photobleach and oxygen controls, a radical-pair or spin-linked interpretation is falsified for that construct context.",
    routeClasses: [
      "LOV_flavin_radical_pair",
      "cryptochrome_FAD_radical_pair",
    ],
    scaffoldFamilies: ["LOV_flavin", "cryptochrome_FAD"],
    cofactors: ["FMN", "FAD"],
    provenance: "public_literature",
    citations: [
      {
        authors: "Hore PJ, Mouritsen H",
        year: 2016,
        title: "The Radical-Pair Mechanism of Magnetoreception",
        venue: "Annual Review of Biophysics 45:299-344",
        doi: "10.1146/annurev-biophys-032116-094545",
      },
    ],
    relation: "falsified_by",
    capsClaimAt: "diagnostic_only",
    note: "Kill criterion: no field-dependent signal after mandatory controls → abandon spin-linked route for this scaffold.",
  },
  {
    id: "ev_redox_flavoprotein",
    title: "Flavin fluorescence is redox- and environment-dependent",
    summary:
      "Flavin redox state modulates absorbance and fluorescence; FMN-based fluorescent proteins (FbFPs) exploit flavin fluorescence and are oxygen-independent, a public basis for redox/electrochemical readouts of flavoprotein constructs.",
    routeClasses: ["redox_electrochemical"],
    scaffoldFamilies: ["redox_flavoprotein"],
    cofactors: ["FAD", "FMN"],
    provenance: "public_literature",
    citations: [
      {
        authors: "Drepper T, Eggert T, Circolone F, et al.",
        year: 2007,
        title: "Reporter proteins for in vivo fluorescence without oxygen",
        venue: "Nature Biotechnology 25(4):443-445",
        doi: "10.1038/nbt1293",
      },
    ],
    relation: "supports",
    capsClaimAt: "measurement_triage",
    note: "Redox readout is well posed; ties signal to a controllable chemical variable.",
  },
  {
    id: "ev_metal_confounder",
    title: "A genuine spin mechanism has stringent requirements",
    summary:
      "The radical-pair/spin literature sets specific requirements (appropriate radical lifetimes, hyperfine couplings, coherent spin dynamics, a readout-coupled reaction). Mere presence of a metal/paramagnetic cofactor meets none of these on its own.",
    routeClasses: ["metal_cofactor_confounder"],
    scaffoldFamilies: ["metal_cofactor"],
    cofactors: ["metal ion"],
    provenance: "public_literature",
    citations: [
      {
        authors: "Hore PJ, Mouritsen H",
        year: 2016,
        title: "The Radical-Pair Mechanism of Magnetoreception",
        venue: "Annual Review of Biophysics 45:299-344",
        doi: "10.1146/annurev-biophys-032116-094545",
      },
    ],
    relation: "caps_claim_at",
    capsClaimAt: "diagnostic_only",
    note: "Presence is an annotation, not a mechanism. Stays confounder/diagnostic-only unless an explicit optical or electrical spin-transduction path is supplied.",
  },
  {
    id: "ev_material_state",
    title: "Demo assumption: material state modulates embedded-fluorophore signal",
    summary:
      "For the sandbox we assume hydrogel/film swelling, crosslink density, or local viscosity shift an embedded fluorophore's intensity/lifetime. Environment-sensitive fluorescence is well established generally, but the specific material-coupling here is a demo assumption, not a cited result.",
    routeClasses: ["material_state"],
    scaffoldFamilies: ["material_composite"],
    cofactors: [],
    provenance: "demo_assumption",
    citations: [],
    relation: "assumes",
    capsClaimAt: "measurement_triage",
    note: "Demo assumption to shape the material-state trace; must be separated from bleaching and temperature drift by measurement.",
  },
  {
    id: "ev_demo_field_window",
    title: "Demo assumption: usable field/RF window",
    summary:
      "For the sandbox we assume a modest static field sweep and an RF modulation window. These are demo assumptions to shape traces, not measured device parameters.",
    routeClasses: [
      "LOV_flavin_radical_pair",
      "cryptochrome_FAD_radical_pair",
    ],
    scaffoldFamilies: ["LOV_flavin", "cryptochrome_FAD"],
    cofactors: [],
    provenance: "demo_assumption",
    citations: [],
    relation: "assumes",
    note: "Chosen to make the synthetic sweep legible; not a claim about any real instrument or protein.",
  },
];

export function evidenceById(id: string): EvidenceCard | undefined {
  return EVIDENCE_CARDS.find((c) => c.id === id);
}
