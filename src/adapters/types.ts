/**
 * Research adapter contract.
 *
 * Every optional adapter is a HOOK, not a hard dependency. When it is not
 * configured (the Sunday-safe default), it fails gracefully and returns:
 *   - available: false
 *   - what it WOULD do
 *   - the setup it would require
 *   - a claim boundary
 *   - a safe demo fixture fallback
 *
 * The core demo never depends on any adapter being available.
 */
export interface AdapterConfig {
  /** Set to true (plus any endpoint/binary) to attempt a real call. */
  enabled?: boolean;
  endpoint?: string;
  binaryPath?: string;
}

export interface AdapterResult<T> {
  adapter: string;
  available: boolean;
  status: "unavailable" | "fixture_fallback" | "ran";
  wouldDo: string;
  requiredSetup: string;
  claimBoundary: string;
  fixtureFallback: T;
  /** Populated only when a live adapter actually ran successfully. */
  result?: T;
  note: string;
}

/** Build the graceful "not configured" result with a fixture fallback. */
export function unavailable<T>(args: {
  adapter: string;
  wouldDo: string;
  requiredSetup: string;
  claimBoundary: string;
  fixtureFallback: T;
  note?: string;
}): AdapterResult<T> {
  return {
    adapter: args.adapter,
    available: false,
    status: "fixture_fallback",
    wouldDo: args.wouldDo,
    requiredSetup: args.requiredSetup,
    claimBoundary: args.claimBoundary,
    fixtureFallback: args.fixtureFallback,
    note:
      args.note ??
      "Adapter not configured; returning safe demo fixture fallback. The core demo does not require this adapter.",
  };
}

export function isConfigured(config?: AdapterConfig): boolean {
  return Boolean(config?.enabled && (config.endpoint || config.binaryPath));
}
