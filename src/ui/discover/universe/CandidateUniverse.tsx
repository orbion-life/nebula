/**
 * The candidate universe (React Three Fiber), a DATA-DRIVEN spatial overview, not
 * decoration. Each node is a real retrieved protein; its lane (evidence/frontier/
 * excluded) sets which column it flies to, its rank sets height, and its score sets
 * size. On mount the nodes reorganize from a loose cloud into the lane columns, a
 * literal picture of what the ranking just did. Clicking a node selects it (syncs the
 * rail); the selected node lifts toward the camera and shows its accession.
 *
 * Performance/a11y: device-pixel-ratio capped, auto-rotate only when motion is allowed,
 * frame loop paused when the tab is hidden, GL disposed on unmount (R3F). If WebGL is
 * unavailable the parent renders a DOM fallback instead of this module.
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
// troika (drei <Text>) defaults to Roboto; point it at the app's Hanken Grotesk (.woff — troika
// cannot read .woff2) so the 3D accession labels match the one uniform UI typeface.
import hankenFont from "@fontsource/hanken-grotesk/files/hanken-grotesk-latin-500-normal.woff?url";
import * as THREE from "three";
import { PALETTE } from "../render/palette";
import { QuantumField } from "../render/QuantumField";
import { EffectsLazy } from "../render/EffectsLazy";

export interface UNode {
  id: string;
  accession: string;
  lane: "evidence" | "frontier" | "excluded" | "pending";
  rank: number; // 0 = best in lane
  score: number; // 0..1 (drives size)
  candidateSpecific: boolean;
}

interface Props {
  nodes: UNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
  fieldProgress?: number; // drives the quantum-field intensity (real run fraction in Act II)
  effects?: boolean; // enable bloom postprocessing (off for reduced-motion/mobile/software-GL)
}

const COLORS = {
  evidence: PALETTE.evidence,
  frontier: PALETTE.violet,
  excluded: PALETTE.gray,
  pending: PALETTE.grayPending,
  selected: PALETTE.goldBright,
};

function targetPositions(nodes: UNode[]): Map<string, [number, number, number]> {
  const m = new Map<string, [number, number, number]>();
  const lanes: Record<UNode["lane"], UNode[]> = { evidence: [], frontier: [], excluded: [], pending: [] };
  for (const n of nodes) lanes[n.lane].push(n);
  (Object.keys(lanes) as UNode["lane"][]).forEach((k) => lanes[k].sort((a, b) => a.rank - b.rank));
  const column = (arr: UNode[], x: number, z: number) => {
    const mid = (arr.length - 1) / 2;
    arr.forEach((n, i) => m.set(n.id, [x, (mid - i) * 1.5, z]));
  };
  const split = lanes.evidence.length > 0 && lanes.frontier.length > 0;
  column(lanes.evidence, split ? -2.8 : 0, 0);
  column(lanes.frontier, split ? 2.8 : 0, 0);
  // excluded: a faint arc behind the two lanes
  lanes.excluded.forEach((n, i) => {
    const a = (i / Math.max(1, lanes.excluded.length - 1) - 0.5) * Math.PI * 0.8;
    m.set(n.id, [Math.sin(a) * 2.2, Math.cos(a) * 1.6 - 0.5, -4]);
  });
  // pending (still searching, lanes not assigned yet): a loose spherical cloud that the
  // nodes will later fly out of into the lane columns (the "search → rank" beat).
  const N = lanes.pending.length;
  lanes.pending.forEach((n, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(1, N)); // even sphere distribution
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = 2.6;
    m.set(n.id, [r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta) * 0.7, r * Math.cos(phi)]);
  });
  return m;
}

function Node({ node, target, selected, onSelect, reducedMotion }: {
  node: UNode; target: [number, number, number]; selected: boolean;
  onSelect: (id: string) => void; reducedMotion: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const tvec = useMemo(() => new THREE.Vector3(...target), [target[0], target[1], target[2]]);
  // selected node becomes the decision centre; alternatives remain around it.
  const goal = useMemo(() => selected ? new THREE.Vector3(0, 0, 2.2) : tvec.clone(), [tvec, selected]);
  const ONE = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    if (reducedMotion) {
      g.position.copy(goal);
      g.scale.copy(ONE);
    } else {
      g.position.lerp(goal, 0.09);
      g.scale.lerp(ONE, 0.14); // scale-in entrance from 0 when a node arrives
      if (halo.current) {
        halo.current.rotation.x += 0.002;
        halo.current.rotation.y += 0.003;
      }
    }
  });

  const color = selected ? COLORS.selected : COLORS[node.lane];
  const size = 0.28 + node.score * 0.32 + (selected ? 0.15 : 0);
  return (
    <group
      ref={ref}
      scale={reducedMotion ? 1 : 0}
      onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh>
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.9 : hovered ? 0.55 : 0.2}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>
      {selected && (
        <group ref={halo}>
          <mesh rotation={[Math.PI / 2.8, 0.2, 0]}>
            <ringGeometry args={[size + 0.28, size + 0.31, 64]} />
            <meshBasicMaterial color={COLORS.selected} transparent opacity={0.42} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[0.35, Math.PI / 2.4, 0.7]}>
            <ringGeometry args={[size + 0.52, size + 0.55, 64]} />
            <meshBasicMaterial color={PALETTE.steel} transparent opacity={0.32} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {node.candidateSpecific && (
        <mesh>
          <ringGeometry args={[size + 0.08, size + 0.13, 32]} />
          <meshBasicMaterial color={COLORS.selected} side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
      {(selected || hovered || node.lane === "evidence" || node.lane === "frontier") && (
        <Text font={hankenFont} position={[0, size + 0.34, 0]} fontSize={selected ? 0.42 : 0.3} color={selected ? PALETTE.goldBright : PALETTE.ink} anchorX="center" anchorY="bottom" outlineWidth={0.012} outlineColor={PALETTE.navy}>
          {node.accession}
        </Text>
      )}
    </group>
  );
}

function Scene({ nodes, selectedId, onSelect, reducedMotion, fieldProgress = 0.45, effects = false }: Props) {
  const targets = useMemo(() => targetPositions(nodes), [nodes]);
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 8, 8]} intensity={80} />
      <pointLight position={[-8, -4, 4]} intensity={30} color={PALETTE.steel} />
      <QuantumField progress={fieldProgress} reducedMotion={reducedMotion} />
      {nodes.filter((node) => node.id !== selectedId && node.lane !== "excluded").map((node) => (
        <Line
          key={`line-${node.id}`}
          points={[targets.get(node.id) ?? [0, 0, 0], [0, 0, 2.2]]}
          color={node.lane === "evidence" ? COLORS.evidence : COLORS.frontier}
          lineWidth={0.7}
          transparent
          opacity={0.24}
        />
      ))}
      {nodes.map((n) => (
        <Node key={n.id} node={n} target={targets.get(n.id) ?? [0, 0, 0]} selected={n.id === selectedId} onSelect={onSelect} reducedMotion={reducedMotion} />
      ))}
      {/* faint lane axis references */}
      <gridHelper args={[16, 16, PALETTE.line2, PALETTE.line]} position={[0, -4.5, 0]} rotation={[0, 0, 0]} />
      <OrbitControls enablePan={false} enableZoom autoRotate={!reducedMotion} autoRotateSpeed={0.5} minDistance={6} maxDistance={20} />
      <EffectsLazy enabled={effects} />
    </>
  );
}

export default function CandidateUniverse(props: Props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={props.reducedMotion ? "demand" : "always"}
      camera={{ position: [0, 0.5, 12], fov: 45 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
