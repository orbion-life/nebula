/** Deterministic fingerprint for swarm verification manifests. */
export function stableFingerprint(value: unknown): string {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
