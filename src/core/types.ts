/**
 * Nebula, canonical data contracts.
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

/** Mandatory adversarial panel consensus, runs on every Discover result. */
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

// ===========================================================================
// Phase 2, counterfactual measurement-studio contracts.
//
// These extend the authoritative schema so the pipeline can SIMULATE every
// candidate/route BEFORE ranking, score the *experiment* (not predicted sensor
// performance), and hand off one decisive measurement. Every numeric parameter
// carries full provenance (source type, citation/assumption, range, unit,
// uncertainty, applicability limits).
// ===========================================================================

export type ParameterSourceType =
  | "database" // e.g. RadicalPy molecule-database hyperfine couplings
  | "literature" // a cited public reference
  | "assumption" // a transparent sandbox assumption
  | "instrument" // an instrument-profile constraint
  | "user_constraint"; // derived from the user's objective

/**
 * Full provenance for one numeric (or database-descriptor) parameter. This is
 * the contract the acceptance test "every numeric parameter has provenance"
 * checks against.
 */
export interface ParameterProvenance {
  name: string;
  value: number | string;
  unit: string;
  range: [number, number];
  uncertainty: Uncertainty;
  sourceType: ParameterSourceType;
  /** DOI/citation string for literature/database, or a labelled assumption. */
  citationOrAssumption: string;
  applicabilityLimits: string;
}

/** A drawn ensemble over provenance parameters producing a signature band. */
export interface ParameterEnsemble {
  routeId: string;
  seed: number;
  nMembers: number;
  members: Array<Record<string, number>>;
  parameters: ParameterProvenance[];
  label: "synthetic_parameter_ensemble_not_validation";
}

/** A public benchmark reference chosen to anchor a route (never proof). */
export interface BenchmarkRef {
  id: string;
  system: string;
  observable: string;
  relevance: string;
  claimCeiling: ClaimLevel;
  citation: Citation;
}

/** A public scaffold analog (retrieval only, never a spin-response prediction). */
export interface PublicAnalog {
  id: string;
  name: string;
  family: string;
  publicRef: string;
  score: number;
}

/** Public evidence assembled for an objective (grounding, not validation). */
export interface EvidenceBundle {
  objectiveText: string;
  cards: EvidenceCard[];
  benchmarks: BenchmarkRef[];
  analogs: PublicAnalog[];
  assembledFrom: EvidenceSource[];
  note: string;
}

/**
 * Instrument capabilities/limits. This is an INPUT to the pipeline: changing it
 * changes observability/SNR per route and therefore the ranking (acceptance
 * test "physics/instrument constraints can change the ranking").
 */
export interface InstrumentProfile {
  id: string;
  label: string;
  readoutModes: ReadoutMode[];
  /** Fractional noise floor; a signature below this is not observable. */
  minDetectableDeltaFOverF: number;
  integrationTimeS: number;
  staticFieldRange_mT: [number, number];
  rfAvailable: boolean;
  rfFreqRange_MHz: [number, number];
  rfB1_mT: number;
  illuminationControllable: boolean;
  oxygenControl: boolean;
  temperatureControl: boolean;
  notes: string;
}

/**
 * Simulation evidence for a single candidate/route, computed BEFORE ranking and
 * under a specific InstrumentProfile. This is what makes the ranking
 * physics-driven rather than heuristic.
 */
export interface SimulationEvidence {
  routeId: string;
  hypothesisId: string;
  source: "generated_artifact" | "analytic_proxy";
  /** e.g. "radical_pair_mary.v1@<hash>" when backed by a generated artifact. */
  artifactRef?: string;
  /** Peak observable signature within the instrument's reachable range. */
  signatureMetric: number;
  signatureUnit: string;
  /** Expected SNR = signatureMetric / instrument noise floor. */
  expectedSNR: number;
  observable: boolean;
  /** Uncertainty-band magnitude (ensemble std, fractional). */
  ensembleStd: number;
  /** 0..1, how distinguishable the signature is from nuisances/controls. */
  mechanismDiscrimination: number;
  /** 0..1, fraction of the route's required controls the instrument can run. */
  controlCompleteness: number;
  /** 0..1, confounder/nuisance swamping risk. */
  nuisanceRisk: number;
  traces: Trace[];
  /** series id -> "public_measurement" | "simulation" | "assumption". */
  seriesProvenance: Record<string, "public_measurement" | "simulation" | "assumption">;
  seed: number;
}

/**
 * Retrospective benchmark comparison. Public/measured signatures are described
 * QUALITATIVELY and never fabricated as numbers; a qualitative reproduction is
 * only ever labelled as such.
 */
export interface BenchmarkComparison {
  benchmarkId: string;
  citation: Citation;
  measuredObservable: string;
  measuredQualitative: string;
  simulatedFeature: string;
  agreementKind: "qualitative_reproduction" | "quantitative" | "no_comparison";
  /** Whether the simulated feature is consistent with the benchmark's mechanism
   *  CLASS. Deliberately not named "matches": this is never a validated match to
   *  measured values (a different system, qualitative only). */
  mechanismClassConsistent: boolean;
  residualUncertainty: string;
  disclaimer: string;
}

/** Transparent experiment-value scoring components (replaces heuristic worthiness). */
export interface ExperimentScoreComponents {
  expectedInformationGain: number;
  expectedObservabilitySNR: number;
  instrumentCompatibility: number;
  mechanismDiscrimination: number;
  uncertaintyReduction: number;
  controlCompleteness: number;
  /** subtracted */
  executionBurden: number;
  /** subtracted */
  nuisanceConfounderRisk: number;
}

export interface ExperimentScore {
  hypothesisId: string;
  routeId: string;
  score: number;
  rank: number;
  components: ExperimentScoreComponents;
  /** Provenance of the signature the score used: the generated spin-dynamics
   *  artifact, or a transparent (uncited, illustrative) mechanism-shaped proxy. */
  evidenceSource: "generated_artifact" | "analytic_proxy";
  label: "ranked_for_experiment_value_not_predicted_performance";
  rationaleOneLine: string;
}

/** The decisive next-experiment plan, the top product output. */
export interface MeasurementPlan {
  hypothesisId: string;
  routeId: string;
  rank: number;
  instrumentId: string;
  whatToMeasure: string;
  expectedSignature: string;
  expectedUncertainty: string;
  nullExpectation: string;
  positiveControls: string[];
  negativeControls: string[];
  competingExplanations: string[];
  killCriterion: string;
  informationGained: string;
}

/**
 * The full end-to-end result of the Discover pipeline.
 *
 * Pipeline order (Phase 2): objective → evidence bundle → construct hypotheses →
 * mechanism routes → parameter ensembles → SIMULATION EVIDENCE for every
 * candidate → experiment-value ranking → selected → measurement plan → benchmark
 * comparison → claim audit. Simulation happens BEFORE ranking; the ranking is
 * derived from the simulation evidence and the instrument, not a heuristic.
 */
export interface DiscoverResult {
  product: "Nebula";
  status: "diagnostic_only_not_validated";
  objective: ObjectiveInput;
  /** Instrument whose limits gate observability and shape the ranking. */
  instrument: InstrumentProfile;
  evidenceBundle: EvidenceBundle;
  hypotheses: ConstructHypothesis[];
  parameterEnsembles: ParameterEnsemble[];
  /** Simulation evidence for EVERY candidate, computed before ranking. */
  simulationEvidence: SimulationEvidence[];
  /** Experiment-value ranking (replaces heuristic worthiness; no offset). */
  ranking: ExperimentScore[];
  selectedHypothesisId: string;
  selectedRoute: MechanismRoute;
  parameterSpace: PhysicsParameterSpace;
  /** Display traces for the selected route (synthetic assumption sweep). */
  simulation: SimulationOutput;
  rationale: RationaleCard[];
  /** The decisive next-experiment card for the top-ranked hypothesis. */
  measurementPlan: MeasurementPlan;
  /** Retrospective public-benchmark comparison for the selected route. */
  benchmarkComparisons: BenchmarkComparison[];
  designAdapter: DesignAdapterOutput;
  requiredControls: string[];
  confounders: string[];
  blockedClaimExample: ClaimAudit;
  allowedClaimExample: string;
  /** Mandatory post-pipeline adversarial swarm review (deterministic release audit). */
  swarmReview: SwarmConsensus;
}
