import type { DesignAdapterOutput, ScaffoldFamily } from "../types";

/**
 * Precomputed, public-demo-only design-adapter outputs.
 *
 * These are deliberately NOT runnable protein designs and NOT Orbion candidates.
 * They demonstrate the handoff shape only. The `artifactPreview` is an obviously
 * synthetic placeholder, never a real orderable sequence.
 */
export const DESIGN_ADAPTER_DEMO: Record<ScaffoldFamily, DesignAdapterOutput> = {
  LOV_flavin: adapter("LigandMPNN", "sequence", "PUBLIC-DEMO-STUB / not a real sequence / LOV+FMN pocket handoff"),
  cryptochrome_FAD: adapter("LigandMPNN", "sequence", "PUBLIC-DEMO-STUB / not a real sequence / FAD pocket handoff"),
  fluorescent_protein: adapter("ProteinMPNN", "sequence", "PUBLIC-DEMO-STUB / not a real sequence / FP scaffold handoff"),
  RFP_plus_flavin: adapter("RFdiffusion", "backbone", "PUBLIC-DEMO-STUB / not a real backbone / RFP+flavin fusion handoff"),
  redox_flavoprotein: adapter("LigandMPNN", "sequence", "PUBLIC-DEMO-STUB / not a real sequence / flavin redox pocket handoff"),
  material_composite: adapter("template_stub", "template", "PUBLIC-DEMO-STUB / material-composite template handoff"),
  metal_cofactor: adapter("template_stub", "none", "PUBLIC-DEMO-STUB / metal route blocked before design handoff"),
  unsupported: adapter("template_stub", "none", "PUBLIC-DEMO-STUB / no supported design handoff"),
};

function adapter(
  name: DesignAdapterOutput["adapter"],
  artifact: DesignAdapterOutput["generatedArtifactType"],
  preview: string,
): DesignAdapterOutput {
  return {
    adapter: name,
    status: "precomputed_demo",
    generatedArtifactType: artifact,
    publicDemoOnly: true,
    artifactPreview: preview,
    warnings: [
      "Demo artifact only; not an Orbion commercial candidate",
      "Not validated for expression, stability, or sensing",
      "Requires private developability and spin scoring before any real use",
    ],
    nextPrivateNebulaStep:
      "Private Nebula continuation (developability/thermostability triage, then spin scoring) is out of scope for this public module",
  };
}
