import { useEffect, useRef, useState } from "react";
import { PALETTE, hex0x } from "./render/palette";
import { canUseWebGL } from "./render/webgl";

interface Props {
  pdb: string | null;
  label: string;
  residues?: number | null;
}

export function GeneratedBackboneViewer({ pdb, label, residues }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<{ clear: () => void; render: () => void; stopAnimate?: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    setReady(false);
    setError(null);
    if (!pdb || !hostRef.current) return;
    if (!canUseWebGL()) {
      setError("interactive structure rendering is unavailable");
      return;
    }

    (async () => {
      try {
        const mod = await import("3dmol");
        const $3Dmol = (mod as { default?: unknown }).default ?? mod;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const create = ($3Dmol as any).createViewer as (el: HTMLElement, cfg: unknown) => any;
        if (!hostRef.current || disposed) return;
        hostRef.current.innerHTML = "";
        const viewer = create(hostRef.current, { backgroundColor: hex0x(PALETTE.navy) });
        viewerRef.current = viewer;
        viewer.addModel(pdb, "pdb");
        viewer.setStyle({}, {
          cartoon: {
            color: hex0x(PALETTE.evidence),
            opacity: 0.95,
          },
        });
        viewer.zoomTo();
        viewer.zoom(0.78);
        viewer.spin?.("y", 0.35);
        viewer.render();
        if (!disposed) setReady(true);
      } catch (err) {
        if (!disposed) setError((err as Error).message || "generated backbone failed to render");
      }
    })();

    return () => {
      disposed = true;
      try {
        viewerRef.current?.stopAnimate?.();
        viewerRef.current?.clear();
      } catch {
        /* viewer already released */
      }
      viewerRef.current = null;
      try {
        const canvas = hostRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
        const gl = (canvas?.getContext("webgl") ?? canvas?.getContext("webgl2")) as WebGLRenderingContext | null;
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        /* best effort */
      }
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [pdb]);

  if (!pdb) {
    return (
      <div className="gen-seed" role="img" aria-label={`${label}: generation brief without coordinates`}>
        <div className="gen-seed-orbit" aria-hidden>
          <i /><i /><i /><b />
        </div>
        <div className="gen-seed-copy">
          <span>generation brief</span>
          <strong>Backbone not generated in this run.</strong>
          <small>Connect the RFdiffusion adapter to turn this brief into coordinates.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="gen-viewer">
      <div className="gen-viewer-canvas" ref={hostRef} role="img" aria-label={`generated RFdiffusion backbone ${label}`} />
      {!ready && !error && <div className="gen-viewer-overlay">resolving generated backbone…</div>}
      {error && <div className="gen-viewer-overlay gen-viewer-error">{error}</div>}
      {ready && (
        <div className="gen-viewer-caption">
          <strong>{label}</strong>
          <span>RFdiffusion backbone{residues ? ` · ${residues} residues` : ""}</span>
          <em>coordinates only · no designed sequence</em>
        </div>
      )}
    </div>
  );
}
