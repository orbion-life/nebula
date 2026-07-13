/**
 * The rationale as a constellation, not a wall of text. The candidate is the central star; each facet
 * of the case for it (evidence, mechanism, physics, fit, the decisive test) is a satellite whose size
 * and link weight read its strength. It is a NAVIGATOR: pick a star and its detail opens below, so the
 * screen shows one thing at a time. The decisive test glows and is selected first, keeping "what to do
 * next" front and centre. Real data drives every node; no claim is asserted here that the dossier does
 * not also state in words.
 */
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export type FacetId = "why" | "evidence" | "physics" | "fit" | "decisive";
export interface Facet {
  id: FacetId;
  label: string;      // one or two words
  takeaway: string;   // one short line
  metric?: string;    // a compact value to show big (e.g. "12", "~28%", "2/5")
  tone: "evidence" | "physics" | "frontier" | "fit" | "decisive";
}

const TONE: Record<Facet["tone"], string> = {
  evidence: "var(--d-evi)",
  physics: "#7fd6ff",
  frontier: "var(--d-fro)",
  fit: "#c9b7f0",
  decisive: "#9cf7bd",
};

function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function RationaleConstellation({ accession, lane, facets, activeId, onSelect }: {
  accession: string;
  lane: string;               // "evidence" | "frontier"
  facets: Facet[];
  activeId: FacetId;
  onSelect: (id: FacetId) => void;
}) {
  const scope = useRef<SVGSVGElement>(null);
  const W = 640, H = 380, cx = 320, cy = 190, rx = 232, ry = 128;
  // distribute satellites on an ellipse; the decisive test sits at the bottom (the "exit")
  const order: FacetId[] = ["why", "evidence", "physics", "fit", "decisive"];
  const ordered = order.map((id) => facets.find((f) => f.id === id)).filter(Boolean) as Facet[];
  const n = ordered.length;
  const nodes = ordered.map((f, i) => {
    // start at top, go clockwise; force decisive toward the bottom
    const a = f.id === "decisive" ? Math.PI / 2 : (-Math.PI / 2) + (i / n) * Math.PI * 2 + 0.0001;
    return { f, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), r: f.id === "decisive" ? 30 : 25 };
  });

  useGSAP(() => {
    if (reduced() || !scope.current) return;
    const s = scope.current;
    gsap.from(s.querySelectorAll(".rc-link"), { opacity: 0, duration: 0.7, stagger: 0.08, ease: "power2.out" });
    gsap.from(s.querySelectorAll(".rc-sat"), { scale: 0.4, opacity: 0, transformOrigin: "center", duration: 0.55, stagger: 0.09, ease: "back.out(1.7)", delay: 0.15 });
    gsap.to(s.querySelector(".rc-core-glow"), { scale: 1.08, opacity: 0.85, transformOrigin: "center", duration: 2.4, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(s.querySelector('.rc-sat[data-id="decisive"] .rc-node'), { scale: 1.14, transformOrigin: "center", duration: 1.1, repeat: -1, yoyo: true, ease: "sine.inOut" });
    nodes.forEach((nd, i) => {
      gsap.to(s.querySelector(`.rc-sat[data-id="${nd.f.id}"]`), { y: "+=5", duration: 3 + (i % 3), repeat: -1, yoyo: true, ease: "sine.inOut", delay: i * 0.2 });
    });
  }, { scope, dependencies: [accession] });

  return (
    <svg ref={scope} className="rc" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`why ${accession}: pick a facet`}>
      <defs>
        <radialGradient id="rc-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eafff2" />
          <stop offset="42%" stopColor="#9cf7bd" />
          <stop offset="100%" stopColor="rgba(156,247,189,0)" />
        </radialGradient>
      </defs>
      {/* connectors, weighted; the active one brightens */}
      {nodes.map((nd) => (
        <line
          key={`l-${nd.f.id}`}
          className="rc-link"
          x1={cx} y1={cy} x2={nd.x} y2={nd.y}
          stroke={TONE[nd.f.tone]}
          strokeWidth={nd.f.id === activeId ? 2.4 : 1}
          strokeOpacity={nd.f.id === activeId ? 0.9 : 0.3}
        />
      ))}
      {/* central candidate star */}
      <g className="rc-core">
        <circle className="rc-core-glow" cx={cx} cy={cy} r={62} fill="url(#rc-core)" opacity={0.6} />
        <circle cx={cx} cy={cy} r={44} fill="#0a1f16" stroke="#9cf7bd" strokeWidth={1.5} />
        <text x={cx} y={cy - 4} className="rc-core-acc" textAnchor="middle">{accession}</text>
        <text x={cx} y={cy + 15} className="rc-core-lane" textAnchor="middle">{lane} lane</text>
      </g>
      {/* satellite facets */}
      {nodes.map((nd) => {
        const on = nd.f.id === activeId;
        return (
          <g
            key={nd.f.id}
            className={`rc-sat ${on ? "on" : ""}`}
            data-id={nd.f.id}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${nd.f.label}: ${nd.f.takeaway}`}
            onClick={() => onSelect(nd.f.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(nd.f.id); } }}
          >
            <circle className="rc-node" cx={nd.x} cy={nd.y} r={nd.r} fill="#0b1420" stroke={TONE[nd.f.tone]} strokeWidth={on ? 2.4 : 1.4} />
            {nd.f.metric ? (
              <text x={nd.x} y={nd.y + 5} className="rc-metric" textAnchor="middle" fill={TONE[nd.f.tone]}>{nd.f.metric}</text>
            ) : (
              <circle cx={nd.x} cy={nd.y} r={5} fill={TONE[nd.f.tone]} />
            )}
            <text x={nd.x} y={nd.y + nd.r + 16} className="rc-label" textAnchor="middle">{nd.f.label}</text>
            <text x={nd.x} y={nd.y + nd.r + 31} className="rc-take" textAnchor="middle">{nd.f.takeaway}</text>
          </g>
        );
      })}
    </svg>
  );
}
