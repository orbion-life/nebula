import { DESIGN_ADAPTER_DEMO } from "./fixtures/designAdapterDemo";
import type {
  ConstructHypothesis,
  DesignAdapterOutput,
  DesignAdapterRequest,
} from "./types";

/**
 * Design adapter panel.
 *
 * Shows how a public construct hypothesis COULD hand off to RFdiffusion /
 * LigandMPNN / ProteinMPNN. On Sunday this is precomputed/stub only — the core
 * demo never depends on a live generation run. Output is public-demo-only and
 * carries explicit warnings; it never emits an Orbion candidate.
 */
export function buildAdapterRequest(
  h: ConstructHypothesis,
  materialContext: string,
  constraints: string[],
): DesignAdapterRequest {
  return {
    constructHypothesisId: h.id,
    scaffoldFamily: h.scaffoldFamily,
    cofactorOrChromophore: h.cofactorOrChromophore,
    readoutModes: h.readoutModes,
    materialContext: [materialContext],
    constraints,
    privacyMode: "public_demo_only",
  };
}

export function runDesignAdapter(
  req: DesignAdapterRequest,
): DesignAdapterOutput {
  // Sunday default: return the precomputed public demo for this scaffold family.
  // A live run would replace this; on failure it must degrade to template_stub.
  const demo = DESIGN_ADAPTER_DEMO[req.scaffoldFamily];
  if (!demo) {
    return {
      adapter: "template_stub",
      status: "not_run",
      generatedArtifactType: "none",
      publicDemoOnly: true,
      artifactPreview: "PUBLIC-DEMO-STUB / no adapter mapping",
      warnings: ["No adapter mapping for this scaffold; nothing generated."],
      nextPrivateNebulaStep:
        "Private Nebula continuation is out of scope for this public module",
    };
  }
  return demo;
}
