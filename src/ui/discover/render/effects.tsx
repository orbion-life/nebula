/**
 * Postprocessing for the universe canvas, selective bloom rides the emissive node
 * materials so the gold candidates glow, plus a soft vignette. Mounted inside the
 * existing Canvas (no extra context).
 *
 * Disabled on software WebGL (SwiftShader/llvmpipe, the CI/no-GPU case) and when the
 * caller passes enabled=false (reduced-motion / mobile). The scene renders normally
 * without it, so the non-blank canvas guarantee holds everywhere.
 */
import { useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

export function Effects({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  let software = false;
  try {
    const ctx = gl.getContext();
    const renderer = String(ctx.getParameter(ctx.RENDERER) ?? "");
    software = /swiftshader|llvmpipe|software|angle \(software/i.test(renderer);
  } catch {
    software = true;
  }
  if (!enabled || software) return null;
  return (
    <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={0.55} intensity={0.9} radius={0.7} />
      <Vignette eskil={false} offset={0.25} darkness={0.72} />
    </EffectComposer>
  );
}
