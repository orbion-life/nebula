/**
 * Lazy boundary for the bloom postprocessing.
 *
 * The @react-three/postprocessing bundle (EffectComposer + Bloom + Vignette) is heavy,
 * so we defer it into its own async chunk: the WebGL scene paints immediately without
 * effects, then bloom fades in once the chunk arrives. Bloom still runs on every WebGL
 * client where it is enabled today (reduced-motion / mobile / software-GL opt out exactly
 * as before, gated inside Effects), only the *load timing* changes, never the coverage.
 */
import { Suspense, lazy } from "react";

const Effects = lazy(() => import("./effects").then((m) => ({ default: m.Effects })));

export function EffectsLazy({ enabled }: { enabled: boolean }) {
  if (!enabled) return null; // gated off (reduced-motion / mobile), never fetch the chunk
  return (
    <Suspense fallback={null}>
      <Effects enabled={enabled} />
    </Suspense>
  );
}
