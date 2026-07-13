import { auditClaim, exportAffirmativeViolations, EXPORT_AFFIRMATIVE_CLAIMS } from "../claimFirewall";
import { exportMarkdown } from "../export";
import { evidenceById } from "../fixtures/evidenceCards";
import { runDiscoverCore } from "../discoverCore";
import type { DiscoverResult, RawObjective, SwarmFinding } from "../types";

export type LensTier = "sentry" | "committee";

export interface LensContext {
  result: DiscoverResult;
  raw: RawObjective;
  seed: number;
}

export interface SwarmLensDefinition {
  id: string;
  persona: string;
  tier: LensTier;
  trustWeight: number;
  themes: string[];
  run: (ctx: LensContext) => SwarmFinding[];
}

const SOLID_MATERIALS = ["hydrogel", "film", "chip", "wearable"];
const AA_RUN = /\b[ACDEFGHIKLMNPQRSTVWY]{12,}\b/;

const PLACEHOLDER_SWARM_REVIEW = {
  architecture: "hierarchical-map-reduce-producer-reviewer" as const,
  version: "1.0.0",
  verdict: "pass" as const,
  lenses: [],
  counts: { blocker: 0, warning: 0, info: 0 },
  escalations: [],
  arbiter: {
    verdict: "pass" as const,
    rationale: "pre-panel export audit",
    requiredPatches: [],
    acceptedWarnings: [],
  },
  stages: [],
  verification: {
    inputFingerprint: "00000000",
    outputFingerprint: "00000000",
    deterministic: true as const,
  },
  summary: "pre-panel export audit",
};

export const SWARM_LENSES: SwarmLensDefinition[] = [
  {
    id: "reproducibility-engineer",
    persona: "Reproducibility engineer",
    tier: "sentry",
    trustWeight: 100,
    themes: ["determinism"],
    run: ({ result, raw, seed }) => {
      const findings: SwarmFinding[] = [];
      const again = runDiscoverCore(raw, seed);
      // Compare the full core deterministically (robust to added fields): strip
      // the swarm layer from the panel's view of the result and re-run the core.
      const { swarmReview: _omitSwarm, ...core } = result;
      void _omitSwarm;
      if (JSON.stringify(again) !== JSON.stringify(core)) {
        findings.push({
          severity: "blocker",
          message: "Pipeline is not deterministic for a fixed seed.",
          theme: "determinism",
        });
      }
      const bad = result.parameterSpace.parameters.find(
        (p) => p.canBeInterpretedAsValidation !== false,
      );
      if (bad) {
        findings.push({
          severity: "blocker",
          message: `Parameter ${bad.name} is not flagged non-validation.`,
          theme: "determinism",
        });
      }
      return findings;
    },
  },
  {
    id: "claim-ip-auditor",
    persona: "IP / claim-boundary auditor",
    tier: "sentry",
    trustWeight: 95,
    themes: ["claim-boundary"],
    run: ({ result }) => {
      const findings: SwarmFinding[] = [];
      if (auditClaim(result.allowedClaimExample).blocked) {
        findings.push({
          severity: "blocker",
          message: "The 'allowed' claim example is itself blocked by the firewall.",
          theme: "claim-boundary",
        });
      }
      if (!result.blockedClaimExample.blocked) {
        findings.push({
          severity: "warning",
          message: "The demo blocked-claim example was not actually blocked.",
          theme: "claim-boundary",
        });
      }
      const md = exportMarkdown({
        ...result,
        swarmReview: result.swarmReview ?? PLACEHOLDER_SWARM_REVIEW,
      });
      const violations = exportAffirmativeViolations(md);
      if (violations.length > 0) {
        findings.push({
          severity: "blocker",
          message: `Export contains an affirmative unsafe claim: ${violations[0]}`,
          theme: "claim-boundary",
        });
      }
      return findings;
    },
  },
  {
    id: "protein-engineer",
    persona: "Protein engineer",
    tier: "sentry",
    trustWeight: 90,
    themes: ["construct-safety"],
    run: ({ result }) => {
      const findings: SwarmFinding[] = [];
      const blob = JSON.stringify(result.hypotheses);
      if (AA_RUN.test(blob)) {
        findings.push({
          severity: "blocker",
          message: "A hypothesis contains a sequence-like amino-acid run.",
          theme: "construct-safety",
        });
      }
      if (/mutation list|→[A-Z]\d+[A-Z]/.test(blob)) {
        findings.push({
          severity: "blocker",
          message: "A hypothesis contains a mutation list.",
          theme: "construct-safety",
        });
      }
      for (const h of result.hypotheses) {
        if (h.privateCandidate !== false) {
          findings.push({
            severity: "blocker",
            message: `${h.id} is flagged as a private candidate.`,
            theme: "construct-safety",
          });
        }
        if (h.status !== "public_hypothesis_not_validated") {
          findings.push({
            severity: "blocker",
            message: `${h.id} is not marked public/unvalidated.`,
            theme: "construct-safety",
          });
        }
      }
      return findings;
    },
  },
  {
    id: "hackathon-judge",
    persona: "Hackathon judge (life sciences)",
    tier: "sentry",
    trustWeight: 85,
    themes: ["claim-boundary", "product-identity"],
    run: ({ result }) => {
      const findings: SwarmFinding[] = [];
      if (result.product !== "Nebula") {
        findings.push({
          severity: "blocker",
          message: "Product identity is not Nebula.",
          theme: "product-identity",
        });
      }
      if (result.status !== "diagnostic_only_not_validated") {
        findings.push({
          severity: "blocker",
          message: "Result status does not declare diagnostic-only / not validated.",
          theme: "product-identity",
        });
      }
      const prose =
        result.rationale
          .filter((c) => c.kind !== "claim_boundary")
          .flatMap((c) => c.bullets)
          .join("\n") + result.allowedClaimExample;
      for (const re of EXPORT_AFFIRMATIVE_CLAIMS) {
        if (re.test(prose)) {
          findings.push({
            severity: "blocker",
            message: `Rationale or allowed-claim text contains validation language (${re}).`,
            theme: "claim-boundary",
          });
          break;
        }
      }
      if (
        result.ranking.some(
          (r) => r.label !== "ranked_for_experiment_value_not_predicted_performance",
        )
      ) {
        findings.push({
          severity: "blocker",
          message: "Ranking is not labeled experiment-value (not predicted performance).",
          theme: "product-identity",
        });
      }
      return findings;
    },
  },
  {
    id: "quantum-sensing-physicist",
    persona: "Quantum-sensing physicist",
    tier: "committee",
    trustWeight: 70,
    themes: ["physics-simulation"],
    run: ({ result }) => {
      const findings: SwarmFinding[] = [];
      if (result.simulation.label !== "synthetic assumption sweep, not prediction") {
        findings.push({
          severity: "blocker",
          message: "Simulation is not labeled a synthetic assumption sweep.",
          theme: "physics-simulation",
        });
      }
      const rp = result.simulation.traces.find((t) => t.id === "delta_f_vs_b");
      if (rp) {
        const minIdx = rp.y.indexOf(Math.min(...rp.y));
        if (minIdx === 0) {
          findings.push({
            severity: "warning",
            message: "Radical-pair field curve looks monotonic (missing low-field effect).",
            theme: "physics-simulation",
          });
        }
      }
      return findings;
    },
  },
  {
    id: "protein-design-scientist",
    persona: "Protein-design / construct-design scientist",
    tier: "committee",
    trustWeight: 65,
    themes: ["construct-safety", "design-adapter"],
    run: ({ result }) => {
      const findings: SwarmFinding[] = [];
      const da = result.designAdapter;
      if (!da.publicDemoOnly) {
        findings.push({
          severity: "blocker",
          message: "Design adapter output is not flagged public-demo-only.",
          theme: "design-adapter",
        });
      }
      if (AA_RUN.test(da.artifactPreview)) {
        findings.push({
          severity: "blocker",
          message: "Design adapter preview contains an exact-looking sequence.",
          theme: "construct-safety",
        });
      }
      if (da.warnings.length === 0) {
        findings.push({
          severity: "warning",
          message: "Design adapter carries no public-demo warnings.",
          theme: "design-adapter",
        });
      }
      if (da.status === "ran_successfully") {
        findings.push({
          severity: "warning",
          message: "Design adapter claims a live successful run in the public demo.",
          theme: "design-adapter",
        });
      }
      return findings;
    },
  },
  {
    id: "biomaterials-customer",
    persona: "Biomaterials / bio-optoelectronics customer",
    tier: "committee",
    trustWeight: 60,
    themes: ["material-fit"],
    run: ({ result }) => {
      const findings: SwarmFinding[] = [];
      if (SOLID_MATERIALS.includes(result.objective.materialContext)) {
        const hasMaterial = result.hypotheses.some(
          (h) => h.scaffoldFamily === "material_composite",
        );
        if (!hasMaterial) {
          findings.push({
            severity: "warning",
            message: `Objective targets a ${result.objective.materialContext} but no material-state hypothesis was surfaced.`,
            theme: "material-fit",
          });
        }
      }
      return findings;
    },
  },
  {
    id: "controls-reviewer",
    persona: "Measurement-controls reviewer",
    tier: "committee",
    trustWeight: 75,
    themes: ["controls"],
    run: ({ result }) => {
      const findings: SwarmFinding[] = [];
      const plugin = result.selectedRoute.simulatorPlugin;
      if (plugin !== "confounder_annotation") {
        const ids = result.simulation.traces.map((t) => t.id);
        for (const req of [
          "photobleach_control",
          "oxygen_nuisance",
          "temperature_nuisance",
        ]) {
          if (!ids.includes(req)) {
            findings.push({
              severity: "warning",
              message: `Missing mandatory control/nuisance trace: ${req}.`,
              theme: "controls",
            });
          }
        }
      }
      return findings;
    },
  },
  {
    id: "evidence-auditor",
    persona: "Evidence auditor",
    tier: "committee",
    trustWeight: 80,
    themes: ["evidence"],
    run: ({ result }) => {
      const findings: SwarmFinding[] = [];
      for (const id of result.selectedRoute.publicAnchors) {
        const card = evidenceById(id);
        if (!card) {
          findings.push({
            severity: "blocker",
            message: `Route anchor ${id} has no evidence card.`,
            theme: "evidence",
          });
          continue;
        }
        if (card.provenance === "public_literature" && card.citations.length === 0) {
          findings.push({
            severity: "warning",
            message: `Evidence ${id} claims literature support but has no citation.`,
            theme: "evidence",
          });
        }
      }
      return findings;
    },
  },
  {
    id: "ui-clarity-critic",
    persona: "UI clarity critic",
    tier: "committee",
    trustWeight: 50,
    themes: ["ux"],
    run: ({ result }) => {
      const findings: SwarmFinding[] = [];
      for (const r of result.ranking) {
        if (!r.rationaleOneLine || r.rationaleOneLine.length < 5) {
          findings.push({
            severity: "warning",
            message: `Ranking ${r.hypothesisId} has no one-line rationale.`,
            theme: "ux",
          });
        }
      }
      return findings;
    },
  },
];

export const SWARM_LENS_COUNT = SWARM_LENSES.length;
