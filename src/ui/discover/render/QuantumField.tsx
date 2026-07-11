/**
 * QuantumField — a data-driven navy→gold flow field rendered on a plane BEHIND the
 * candidate nodes, inside the existing universe canvas (no extra WebGL context). It is
 * not decoration-for-decoration's-sake: `progress` (the real run fraction in Act II,
 * or a resting value in the workspace) drives the field's turbulence/brightness, so
 * the "descent into the quantum within" visibly deepens as the computation advances.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime; uniform float uProgress; uniform vec3 uNavy; uniform vec3 uGold;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }
void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  float t = uTime * 0.05;
  float f = fbm(uv * 2.5 + vec2(t, -t * 0.7) + uProgress * 1.5);
  float filaments = smoothstep(0.55, 0.85, f);
  float glow = pow(f, 2.0) * (0.35 + 0.65 * uProgress);
  float vig = clamp(1.0 - dot(uv, uv) * 0.5, 0.0, 1.0);
  vec3 col = mix(uNavy, uGold, filaments * 0.8 * vig) + uGold * glow * 0.25 * vig;
  float alpha = (0.10 + 0.5 * uProgress) * vig;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.7));
}`;

export function QuantumField({ progress = 0.45, reducedMotion = false }: { progress?: number; reducedMotion?: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const target = useRef(progress);
  target.current = progress;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: progress },
      uNavy: { value: new THREE.Color(PALETTE.navy) },
      uGold: { value: new THREE.Color(PALETTE.gold) },
    }),
    [], // created once; values updated in useFrame
  );

  useFrame((s) => {
    if (!mat.current) return;
    if (reducedMotion) {
      mat.current.uniforms.uTime.value = 0;
      mat.current.uniforms.uProgress.value = target.current;
      return;
    }
    mat.current.uniforms.uTime.value = s.clock.elapsedTime;
    const u = mat.current.uniforms.uProgress;
    u.value += (target.current - u.value) * 0.05;
  });

  return (
    <mesh position={[0, 0, -6]} raycast={() => null}>
      <planeGeometry args={[44, 26]} />
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  );
}
