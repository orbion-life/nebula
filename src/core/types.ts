/**
 * Nebula Discover — canonical data contracts.
 *
 * These types are the public schema for the discovery module. They intentionally
 * encode claim-safety into the type system: every hypothesis carries
 * `status: "public_hypothesis_not_validated"` and `privateCandidate: false`, and
 * every simulation output is labeled as a synthetic assumption sweep.
 *
 * Nothing here is a validated sensor, a prediction, or a private candidate.
 */

export const SYNTHETIC_TRACE_LABEL =
  "synthetic assumption sweep, not prediction" as const;

export type ReadoutMode =
  | "fluorescence"
  | "lifetime"
  | "RF_magnetic"
  | "ODMR_like"
  | "redox_electrochemical"
  | "material_state";

export type MaterialContext =
  | "hydrogel"
  | "film"
  | "chip"
  | "cell"
  | "solution"
  | "wearable"
  | "unknown";

export type ExpressionHost =
  | "bacteria"
  | "yeast"
  | "mammalian"
  | "cell_free"
  | "unknown";

export type ScaffoldFamily =
  | "LOV_flavin"
  | "cryptochrome_FAD"
  | "fluorescent_protein"
  | "RFP_plus_flavin"
  | "metal_cofactor"
  | "redox_flavoprotein"
  | "material_composite"
  | "unsupported";

export type ArchitectureKind =
  | "single_scaffold"
  | "fusion_reporter"
  | "co_encapsulated_pair"
  | "surface_immobilized"
  | "electrode_coupled"
  | "material_composite";

export type RouteClass =
  | "LOV_flavin_radical_pair"
  | "cryptochrome_FAD_radical_pair"
  | "triplet_FP"
  | "RFP_flavin_photochemical"
  | "redox_electrochemical"
  | "material_state"
  | "metal_cofactor_confounder"
  | "unsupported";

export type ClaimLevel =
  | "diagnostic_only"
  | "measurement_triage"
  | "partner_ready_dossier";

export type Uncertainty = "low" | "medium" | "high";

export type EvidenceSource =
  | "public_anchor"
  | "demo_assumption"
  | "user_constraint";

/** Raw messy user intent, before compilation. */
export interface RawObjective {
  objectiveText: string;
}

/** Structured constraints produced by the objective compiler. */
export interface ObjectiveInput {
  objectiveText: string;
  desiredReadouts: ReadoutMode[];
  materialContext: MaterialContext;
  expressionHost: ExpressionHost;
  excitationAllowed: string[];
  constraints: string[];
  confidentialSequenceProvided: false;
  missingInformation: string[];
  forbiddenAssumptions: string[];
}

/** A real, checkable public reference. */
export interface Citation {
  authors: string;
  year: number;
  title: string;
  venue: string;
  doi: string;
}

/**
 * A public evidence card. Each card is anchored to a REAL, checkable public
 * citation (see `citations`) or is explicitly flagged as a demo assumption.
 * These are NOT proprietary data. Presence of a citation supports plausibility
 * of a mechanism; it never implies that any specific construct is a validated
 * sensor.
 */
export interface EvidenceCard {
  id: string;
  title: string;
  summary: string;
  routeClasses: RouteClass[];
  scaffoldFamilies: ScaffoldFamily[];
  cofactors: string[];
  provenance: "public_literature" | "demo_assumption";
  citations: Citation[];
  relation:
    | "supports"
    | "requires"
    | "assumes"
    | "contradicts"
    | "confounded_by"
    | "falsified_by"
    | "caps_claim_at";
  capsClaimAt?: ClaimLevel;
  note: string;
}

export type StepSupport = "public_anchor" | "assumption" | "unknown";

export interface CausalStep {
  step: string;
  support: StepSupport;
  failureMode?: string;
}

export interface MechanismRoute {
  id: string;
  name: string;
  routeClass: RouteClass;
  requiredCofactors: string[];
  supportedReadouts: ReadoutMode[];
  causalSteps: CausalStep[];
  simulatorPlugin: SimulatorPlugin;
  controlRequirements: string[];
  confounders: string[];
  maxClaimLevel: ClaimLevel;
  publicAnchors: string[];
}

export type SimulatorPlugin =
  | "photokinetic_ode_proxy"
  | "radical_pair_response_proxy"
  | "triplet_lifetime_proxy"
  | "redox_response_proxy"
  | "material_state_proxy"
  | "confounder_annotation";

export interface ConstructHypothesis {
  id: string;
  title: string;
  status: "public_hypothesis_not_validated";
  scaffoldFamily: ScaffoldFamily;
  architectureKind: ArchitectureKind;
  cofactorOrChromophore: string[];
  readoutModes: ReadoutMode[];
  materialFit: string[];
  expressionContext: string[];
  mechanismRouteId: string;
  whyItMightWork: string[];
  whyItMightFail: string[];
  requiredControls: string[];
  evidenceCardIds: string[];
  privateCandidate: false;
  allowedNextStep:
    | "measurement_planning"
    | "internal_developability_triage"
    | "discard";
}

export interface PhysicsParameter {
  name: string;
  route: string;
  valueRange: [number, number];
  unit: string;
  source: EvidenceSource;
  uncertainty: Uncertainty;
  canBeInterpretedAsValidation: false;
}

export interface PhysicsParameterSpace {
  routeId: string;
  label: "synthetic_parameter_space_not_validation";
  parameters: PhysicsParameter[];
}

export interface Trace {
  id: string;
  title: string;
  xLabel: string;
  yLabel: string;
  x: number[];
  y: number[];
  condition: string;
  requiredControl: string;
  isControl: boolean;
  isNuisance: boolean;
}

export interface SimulationOutput {
  label: typeof SYNTHETIC_TRACE_LABEL;
  routeId: string;
  seed: number;
  traces: Trace[];
  confounders: string[];
}

export interface WorthinessComponents {
  routeSupport: number;
  readoutCompatibility: number;
  constructExecutability: number;
  cofactorFeasibility: number;
  controlQuality: number;
  nuisanceRiskPenalty: number;
  uncertaintyPenalty: number;
}

export interface MeasurementWorthiness {
  hypothesisId: string;
  score: number;
  rank: number;
  components: WorthinessComponents;
  label: "ranked_for_measurement_triage_not_performance";
  rationaleOneLine: string;
}

export interface RationaleCard {
  kind:
    | "why_measure_first"
    | "mechanism_route"
    | "evidence_anchors"
    | "failure_modes"
    | "required_controls"
    | "falsification_criteria"
    | "claim_boundary";
  title: string;
  bullets: string[];
}

export interface ClaimAudit {
  input: string;
  blocked: boolean;
  matchedPatterns: string[];
  reason: string;
  rewrite: string;
}

export interface DesignAdapterRequest {
  constructHypothesisId: string;
  scaffoldFamily: ScaffoldFamily;
  cofactorOrChromophore: string[];
  readoutModes: ReadoutMode[];
  materialContext: string[];
  constraints: string[];
  privacyMode: "public_demo_only";
}

export interface DesignAdapterOutput {
  adapter: "RFdiffusion" | "LigandMPNN" | "ProteinMPNN" | "template_stub";
  status: "not_run" | "precomputed_demo" | "ran_successfully" | "failed";
  generatedArtifactType: "backbone" | "sequence" | "template" | "none";
  publicDemoOnly: true;
  artifactPreview: string;
  warnings: string[];
  nextPrivateNebulaStep: string;
}

export type SwarmSeverity = "blocker" | "warning" | "info";
export type SwarmVerdict = "pass" | "warn" | "fail";

export interface SwarmFinding {
  severity: SwarmSeverity;
  message: string;
  /** Thematic bucket used for cross-lens escalation (assigned at reduce). */
  theme?: string;
}

export interface SwarmLensReport {
  lens: string;
  persona: string;
  tier: "sentry" | "committee";
  trustWeight: number;
  verdict: SwarmVerdict;
  findings: SwarmFinding[];
}

export type SwarmArchitectureId =
  | "hierarchical-map-reduce-producer-reviewer";

export type SwarmStageId = "orchestrate" | "map" | "reduce" | "synthesize";

export interface SwarmStageRecord {
  stage: SwarmStageId;
  status: "completed";
  detail: string;
}

export interface SwarmEscalation {
  theme: string;
  lenses: string[];
  fromSeverity: SwarmSeverity;
  toSeverity: SwarmSeverity;
  message: string;
}

export interface SwarmArbiterDecision {
  verdict: SwarmVerdict;
  rationale: string;
  requiredPatches: string[];
  acceptedWarnings: string[];
}

export interface SwarmVerification {
  inputFingerprint: string;
  outputFingerprint: string;
  deterministic: true;
}

/** Mandatory adversarial panel consensus — runs on every Discover result. */
export interface SwarmConsensus {
  architecture: SwarmArchitectureId;
  version: string;
  verdict: SwarmVerdict;
  lenses: SwarmLensReport[];
  counts: { blocker: number; warning: number; info: number };
  escalations: SwarmEscalation[];
  arbiter: SwarmArbiterDecision;
  stages: SwarmStageRecord[];
  verification: SwarmVerification;
  summary: string;
}

/** The full end-to-end result of the Discover pipeline. */
export interface DiscoverResult {
  product: "Nebula Discover";
  status: "diagnostic_only_not_validated";
  objective: ObjectiveInput;
  hypotheses: ConstructHypothesis[];
  ranking: MeasurementWorthiness[];
  selectedHypothesisId: string;
  selectedRoute: MechanismRoute;
  parameterSpace: PhysicsParameterSpace;
  simulation: SimulationOutput;
  rationale: RationaleCard[];
  designAdapter: DesignAdapterOutput;
  requiredControls: string[];
  confounders: string[];
  blockedClaimExample: ClaimAudit;
  allowedClaimExample: string;
  /** Mandatory post-pipeline adversarial swarm review (deterministic). */
  swarmReview: SwarmConsensus;
}
