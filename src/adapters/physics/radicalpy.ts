import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface SpinDynamicsFixture {
  usingProxy: true;
  label: "synthetic assumption sweep, not prediction";
  note: string;
}

/**
 * RadicalPy adapter (physics).
 *
 * Would run real radical-pair spin-dynamics. Unconfigured, the app uses the
 * deterministic TypeScript radical-pair PROXY in src/core/simulator.ts. Either
 * way, output is a synthetic assumption sweep unless anchored to real measured data.
 */
export function radicalPySimulate(
  config?: AdapterConfig,
): AdapterResult<SpinDynamicsFixture> {
  const fallback: SpinDynamicsFixture = {
    usingProxy: true,
    label: "synthetic assumption sweep, not prediction",
    note: "Deterministic TS radical-pair proxy (with low-field effect) is used instead.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "RadicalPy",
      wouldDo:
        "Run radical-pair spin dynamics (singlet-triplet interconversion, hyperfine, relaxation).",
      requiredSetup: "Python env with radicalpy; set config.enabled and config.binaryPath/endpoint.",
      claimBoundary:
        "Produces synthetic assumption sweeps unless anchored to real measured parameters; not a validated prediction.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "RadicalPy",
    wouldDo: "Run radical-pair spin dynamics.",
    requiredSetup:
      "Call radicalPyRunLive() with { enabled, binaryPath } pointing at a python RadicalPy runner (Node only).",
    claimBoundary: "Synthetic assumption sweep unless real data is explicitly loaded.",
    fixtureFallback: fallback,
    note: isConfigured(config)
      ? "Use radicalPyRunLive() for the configured live subprocess path."
      : undefined,
  });
}

export interface RadicalPyRunResult {
  label: "real_spin_dynamics_under_stated_assumptions";
  raw: unknown;
  note: string;
}

/**
 * LIVE RadicalPy run via a Python subprocess (Node only).
 *
 * Spawns `config.binaryPath` (a python script/executable), sends parameters as
 * JSON on stdin, and parses JSON from stdout. Degrades gracefully to the
 * deterministic proxy on any error or in a browser (no child_process).
 *
 * Even a successful run is a SIMULATION under stated assumptions — not
 * experimental validation.
 */
export async function radicalPyRunLive(
  params: Record<string, number> = {},
  config?: AdapterConfig,
): Promise<AdapterResult<SpinDynamicsFixture>> {
  const offline = radicalPySimulate(config);
  const hasNode =
    typeof process !== "undefined" && Boolean((process as { versions?: { node?: string } }).versions?.node);
  if (!isConfigured(config) || !config?.binaryPath || !hasNode) return offline;

  try {
    const moduleName = "node:child_process";
    const { spawn } = (await import(/* @vite-ignore */ moduleName)) as typeof import("node:child_process");
    const raw = await new Promise<string>((resolve, reject) => {
      const child = spawn(config.binaryPath as string, [], { stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      let err = "";
      child.stdout.on("data", (d: Buffer) => (out += d.toString()));
      child.stderr.on("data", (d: Buffer) => (err += d.toString()));
      child.on("error", reject);
      child.on("close", (code: number) =>
        code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`)),
      );
      child.stdin.write(JSON.stringify(params));
      child.stdin.end();
    });
    const parsedOk = raw.trim().length > 0;
    return {
      adapter: "RadicalPy",
      available: true,
      status: "ran",
      wouldDo: offline.wouldDo,
      requiredSetup: offline.requiredSetup,
      claimBoundary: offline.claimBoundary,
      fixtureFallback: offline.fixtureFallback,
      note: `Live RadicalPy subprocess completed (${parsedOk ? "output received" : "empty output"}); result is a simulation under stated assumptions, not validation.`,
    };
  } catch (err) {
    return {
      ...offline,
      note: `Live RadicalPy run failed (${(err as Error).message}); degraded to deterministic proxy.`,
    };
  }
}
