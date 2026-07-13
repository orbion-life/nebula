/**
 * Backend-backed E2E acceptance tests.
 *
 * These tests use Playwright's HTTP client through the same Vite proxy as the browser.
 * They exercise FastAPI, background orchestration, recorded public fixtures, route
 * selection, scoring, structure verification, and explicit failure semantics.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";

type Candidate = {
  candidate_id: string;
  route_class: string;
  uniprot: { primary_accession: string };
};

type Score = {
  candidate_id: string;
  lane: string;
  suggested_instrument_id: string | null;
  P_plausibility: number;
  M_measurability: number;
  D_developability: number;
};

type Run = {
  run_id: string;
  status: string;
  current_stage: string;
  candidates: Candidate[];
  discovery_scores: Score[];
  measurement_proposals: Array<{
    candidate_id: string;
    discriminating_experiment: {
      what_to_measure: string;
      instrument_id: string | null;
      expected_signature: string;
      null_expectation: string;
      positive_controls: string[];
      negative_controls: string[];
      replicate_plan: string;
      acceptance_rule: string;
      kill_criterion: string;
      information_gained: string;
    };
    claim_ceiling: string;
  }>;
  selected_candidate_id: string | null;
  errors: string[];
};

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const PUBLIC_SEEDS = ["Q8LPD9", "Q43125", "P28861", "P42212"];

function objective(id: string, sensed: string, modalities: string[], updates: Record<string, unknown> = {}) {
  return {
    schema_version: "2.0.0",
    objective_id: `e2e-${id}`,
    objective_text: `Prioritize public protein candidates for ${sensed} measurement.`,
    user_mode: "expert",
    sensed_quantity_or_state: sensed,
    desired_modalities: modalities,
    acceptable_readouts: modalities,
    objective_support: "supported",
    objective_support_note: "Backend-backed E2E objective.",
    seed_accessions: PUBLIC_SEEDS,
    seed: 20260713,
    ...updates,
  };
}

async function runObjective(request: APIRequestContext, spec: Record<string, unknown>): Promise<Run> {
  const created = await request.post("/api/runs", { data: spec });
  expect(created.status(), await created.text()).toBe(201);
  const { run_id } = await created.json() as { run_id: string };
  const deadline = Date.now() + 45_000;
  let run: Run | null = null;
  while (Date.now() < deadline) {
    const response = await request.get(`/api/runs/${run_id}`);
    expect(response.status()).toBe(200);
    run = await response.json() as Run;
    if (TERMINAL.has(run.status)) return run;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`run ${run_id} did not terminate; last state=${JSON.stringify(run)}`);
}

function accessions(run: Run): string[] {
  return run.candidates.map((candidate) => candidate.uniprot.primary_accession).sort();
}

test("objective compilation rejects ambiguity instead of silently choosing a target", async ({ request }) => {
  const response = await request.post("/api/objectives/compile", {
    data: {
      objective_text: "Find a protein that senses a magnetic field or redox potential.",
      user_mode: "novice",
    },
  });
  expect(response.status()).toBe(200);
  const compiled = await response.json();
  expect(compiled.objective_support).toBe("needs_clarification");
  expect(compiled.sensed_quantity_or_state).toBeNull();
  expect(compiled.objective_support_note).toContain("magnetic field");
  expect(compiled.objective_support_note).toContain("redox potential");
});

test("magnetic and RF objectives retain grounded candidates but change measurement semantics", async ({ request }) => {
  const magnetic = await runObjective(
    request,
    objective("magnetic", "magnetic field", ["RF_magnetic", "fluorescence"]),
  );
  const radioFrequency = await runObjective(
    request,
    objective("rf", "radio-frequency field", ["RF_magnetic", "fluorescence"]),
  );

  expect(magnetic.status, magnetic.errors.join("\n")).toBe("completed");
  expect(radioFrequency.status, radioFrequency.errors.join("\n")).toBe("completed");
  expect(accessions(magnetic)).toEqual(["Q43125", "Q8LPD9"]);
  expect(accessions(radioFrequency)).toEqual(accessions(magnetic));
  expect(new Set(magnetic.discovery_scores.map((score) => score.suggested_instrument_id))).toEqual(
    new Set(["benchtop_field_fluorimeter"]),
  );
  expect(new Set(radioFrequency.discovery_scores.map((score) => score.suggested_instrument_id))).toEqual(
    new Set(["odmr_confocal"]),
  );
  expect(magnetic.discovery_scores[0].M_measurability).not.toBe(radioFrequency.discovery_scores[0].M_measurability);
  expect(magnetic.measurement_proposals[0].discriminating_experiment.what_to_measure).toContain("static magnetic field");
  expect(radioFrequency.measurement_proposals[0].discriminating_experiment.what_to_measure).toContain("RF frequency");

  for (const proposal of [...magnetic.measurement_proposals, ...radioFrequency.measurement_proposals]) {
    const experiment = proposal.discriminating_experiment;
    expect(experiment.expected_signature.length).toBeGreaterThan(20);
    expect(experiment.null_expectation.length).toBeGreaterThan(20);
    expect(experiment.positive_controls.length).toBeGreaterThan(0);
    expect(experiment.negative_controls.length).toBeGreaterThanOrEqual(3);
    expect(experiment.replicate_plan).toContain("3 independent preparations");
    expect(experiment.acceptance_rule).toContain("95%");
    expect(experiment.kill_criterion.length).toBeGreaterThan(20);
    expect(experiment.information_gained.length).toBeGreaterThan(20);
    expect(proposal.claim_ceiling).toBeTruthy();
  }
});

test("cofactor exclusions alter the retrieved route and impossible filters fail explicitly", async ({ request }) => {
  const fmnOnly = await runObjective(
    request,
    objective("exclude-fad", "magnetic field", ["RF_magnetic", "fluorescence"], {
      excluded_cofactors: ["FAD"],
    }),
  );
  expect(fmnOnly.status, fmnOnly.errors.join("\n")).toBe("completed");
  expect(accessions(fmnOnly)).toEqual(["Q8LPD9"]);
  expect(fmnOnly.candidates[0].route_class).toBe("LOV_flavin_radical_pair");

  const impossible = await runObjective(
    request,
    objective("exclude-all-flavin", "magnetic field", ["RF_magnetic", "fluorescence"], {
      excluded_cofactors: ["FAD", "FMN"],
    }),
  );
  expect(impossible.status).toBe("failed");
  expect(impossible.current_stage).toBe("no_candidates");
  expect(impossible.candidates).toHaveLength(0);
  expect(impossible.errors.join(" ")).toContain("No public candidates");
});

test("optical-spin objective returns a real GFP hypothesis and a real structure source", async ({ request }) => {
  const run = await runObjective(
    request,
    objective("optical-spin", "optical spin contrast", ["ODMR_like", "fluorescence", "lifetime"]),
  );
  expect(run.status, run.errors.join("\n")).toBe("completed");
  expect(accessions(run)).toEqual(["P42212"]);
  expect(run.candidates[0].route_class).toBe("triplet_FP");
  expect(run.discovery_scores[0].lane).toBe("frontier");
  expect(run.discovery_scores[0].suggested_instrument_id).toBe("odmr_confocal");
  expect(run.measurement_proposals[0].discriminating_experiment.what_to_measure).toContain("RF frequency");
  expect(run.measurement_proposals[0].discriminating_experiment.negative_controls.join(" ")).toContain("RF-detuned");

  const structure = await request.get(`/api/candidates/${run.candidates[0].candidate_id}/structure`);
  expect(structure.status(), await structure.text()).toBe(200);
  const body = await structure.json();
  expect(body.source).toBe("experimental_pdb");
  expect(body.pdb_id).toBe("1B9C");
  expect(body.verified_ligand_comp_id).toBeNull();
  expect(body.inline_cif.length).toBeGreaterThan(100_000);
});

test("redox and light-history objectives produce distinct candidates and measurement plans", async ({ request }) => {
  const redox = await runObjective(
    request,
    objective("redox", "redox potential", ["redox_electrochemical", "fluorescence"]),
  );
  const lightHistory = await runObjective(
    request,
    objective("light-history", "light history", ["fluorescence", "lifetime"]),
  );

  expect(redox.status, redox.errors.join("\n")).toBe("completed");
  expect(lightHistory.status, lightHistory.errors.join("\n")).toBe("completed");
  expect(accessions(redox)).toEqual(["P28861"]);
  expect(redox.candidates[0].route_class).toBe("redox_electrochemical");
  expect(redox.discovery_scores[0].suggested_instrument_id).toBe("potentiostat_optical_bench");
  expect(redox.measurement_proposals[0].discriminating_experiment.what_to_measure).toContain("applied potential");

  expect(accessions(lightHistory)).toEqual(["Q8LPD9"]);
  expect(lightHistory.candidates[0].route_class).toBe("RFP_flavin_photochemical");
  expect(lightHistory.discovery_scores[0].suggested_instrument_id).toBe("plate_reader_screen");
  expect(lightHistory.discovery_scores[0].suggested_instrument_id).not.toBe(
    redox.discovery_scores[0].suggested_instrument_id,
  );
  expect(lightHistory.measurement_proposals[0].discriminating_experiment.what_to_measure).toContain(
    "illumination and dark-recovery",
  );
  expect(lightHistory.selected_candidate_id).not.toBe(redox.selected_candidate_id);
});

test("unsupported controls fail at the API boundary rather than pretending to rank them", async ({ request }) => {
  const response = await request.post("/api/runs", {
    data: objective("unsupported-control", "magnetic field", ["RF_magnetic", "fluorescence"], {
      hard_constraints: ["membrane insertion must succeed"],
    }),
  });
  expect(response.status()).toBe(422);
  expect((await response.json()).detail).toContain("not computationally enforced");
});
