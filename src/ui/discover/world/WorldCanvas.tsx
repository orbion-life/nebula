/**
 * WorldCanvas, the persistent, full viewport, NON interactive 3D backdrop.
 *
 * One fixed R3F canvas behind all content (pointer-events:none, so the wheel/trackpad pass
 * straight through to the DOM). It renders "the quantum within": a radial PLATINUM mandala
 * shader (secularized from the cosmic reference: atmosphere, never captioned as data), a
 * central light axis, and a field of drifting motes, all lifted by bloom.
 *
 * Honesty: this is pure decorative awe. The truthful molecular "altar" (real structure, the
 * spin density lit ring, the MARY/RF curves) lives in the data scenes, never here.
 *
 * Guardrails: reduced motion renders a single static frame (no animation); bloom self disables
 * on software GL / reduced motion / small viewports (reused from render/effects).
 */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { EffectsLazy } from "../render/EffectsLazy";
import { usePageVisible, useReducedMotion } from "../motion/useReducedMotion";
import { PALETTE } from "../render/palette";
function isSmallViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(max-width: 700px)").matches === true;
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uProgress;
  uniform float uAspect;
  uniform vec3 uNavy;
  uniform vec3 uPlat;
  uniform vec3 uPlatB;
  uniform vec3 uDeep;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }

  void main() {
    vec2 uvp = (vUv - 0.5) * 2.0;
    uvp.x *= uAspect;
    vec2 p = uvp - vec2(0.6, 0.22);                  // core offset into the open space above/beside the hero
    float r = length(p);
    float ang = atan(p.y, p.x);
    float N = 14.0;
    float seg = 6.2831853 / N;
    float a = mod(ang + uTime * 0.02, seg);
    a = abs(a - seg * 0.5);                          // mirror -> symmetric petals
    float f = fbm(vec2(a * 7.0, r * 3.0 - uTime * 0.05));
    float arms = smoothstep(0.52, 0.93, f);
    float radialFade = smoothstep(2.3, 0.06, r);     // filaments fade toward the frame edges
    float ring1 = exp(-abs(r - 0.6) * 9.0) * 0.08;
    float ring2 = exp(-abs(r - 1.2) * 11.0) * 0.05;
    float core = pow(clamp(1.0 - r * 0.8, 0.0, 1.0), 2.8);
    float lum = arms * radialFade * 0.13 + core * 0.16 + (ring1 + ring2) * radialFade;
    vec3 col = mix(uNavy, uPlat, clamp(lum, 0.0, 1.0));
    col = mix(col, uPlatB, clamp(core * 0.11, 0.0, 1.0));            // faint bright platinum core
    float shaft = exp(-abs(uvp.x - 0.6) * 11.0) * smoothstep(1.5, 0.0, r) * 0.06;
    col = mix(col, uPlatB, shaft);                                   // subtle central light axis
    col += uPlat * 0.008;                                            // faint lift so it never reads flat navy
    float l = max(max(col.r, col.g), col.b);
    col = mix(col, uDeep * l * 1.4, uProgress * 0.4);                // tint toward deep steel as you sink
    col *= (1.0 - 0.45 * uProgress);                                 // darken into the deep
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Mandala({ animate }: { animate: boolean }) {
  const { invalidate, viewport, size } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uAspect: { value: size.width / Math.max(1, size.height) },
      uNavy: { value: new THREE.Color(PALETTE.navy) },
      uPlat: { value: new THREE.Color(PALETTE.gold) }, // token 'gold' now holds platinum
      uPlatB: { value: new THREE.Color(PALETTE.goldBright) },
      uDeep: { value: new THREE.Color(PALETTE.steel) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const sT = useRef(0);
  const elapsed = useRef(0);
  const scrollTarget = useRef(0);
  useEffect(() => {
    invalidate();
    if (!animate) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollTarget.current = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [animate, invalidate]);
  useFrame((state, delta) => {
    if (animate) {
      elapsed.current += Math.min(delta, 0.05);
      uniforms.uTime.value = elapsed.current;
      sT.current += (scrollTarget.current - sT.current) * 0.05;
      uniforms.uProgress.value = sT.current;
    }
    uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
  });
  return (
    <mesh scale={[viewport.width, viewport.height, 1]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} depthWrite={false} />
    </mesh>
  );
}

export function WorldCanvas() {
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const animate = !reduced && pageVisible;
  const small = useRef(isSmallViewport()).current;
  return (
    <div className="world-canvas" aria-hidden>
      <Canvas
        dpr={reduced ? 1 : [1, 1.5]}
        frameloop={animate ? "always" : "demand"}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[PALETTE.navy]} />
        <Mandala animate={animate} />
        <Sparkles
          count={small ? 70 : 150}
          scale={[18, 12, 7]}
          size={2.2}
          speed={animate ? 0.18 : 0}
          opacity={0.5}
          color={PALETTE.goldBright}
        />
        <EffectsLazy enabled={animate && !small} />
      </Canvas>
    </div>
  );
}
