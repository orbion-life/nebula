let cached: boolean | null = null;

/** Conservative feature test used before importing any heavy Three.js scene. */
export function canUseWebGL(): boolean {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true })
      ?? canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    cached = Boolean(context);
    const lose = context?.getExtension("WEBGL_lose_context");
    lose?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
