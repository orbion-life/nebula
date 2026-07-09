/**
 * Deterministic pseudo-random number generator (mulberry32).
 *
 * The simulator must be reproducible: for a fixed seed, every trace is
 * identical across runs and machines. This is what lets the tests assert
 * determinism and lets the demo be trustworthy. We never use Math.random in the
 * engine.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic zero-mean noise in [-amp, amp], driven by a seeded rng. */
export function noise(rng: () => number, amp: number): number {
  return (rng() * 2 - 1) * amp;
}

/** Stable string hash -> 32-bit int, for deriving seeds from ids. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Evenly spaced samples on [start, end] inclusive. */
export function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start];
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + step * i);
}

/** Round to a fixed number of decimals to keep traces compact and stable. */
export function round(value: number, decimals = 4): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}
