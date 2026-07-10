/**
 * Scientifically accurate protein structure viewer (3Dmol.js, lazy-loaded WebGL).
 *
 * Loads THIS candidate's real structure — the experimental cofactor-bound PDB when
 * one exists (inline mmCIF so it works offline), otherwise the AlphaFold model — and
 * highlights the cofactor/chromophore that carries the proposed spin center. The
 * protein is a muted cartoon; the cofactor is emphasised as sticks + translucent
 * surface so the redox-active core reads at a glance. WebGL resources are disposed
 * on unmount and rendering pauses when the tab is hidden.
 */
import { useEffect, useRef, useState } from "react";
import type { StructureResponse } from "../../api/client";

interface Props {
  structure: StructureResponse | null;
  loading: boolean;
  cofactorLabel?: string | null;
}

export function StructureViewer({ structure, loading, cofactorLabel }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<{ clear: () => void; render: () => void; resize?: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    if (!structure || !hostRef.current) return;
    setReady(false);
    setError(null);

    (async () => {
      try {
        const mod = await import("3dmol");
        const $3Dmol = (mod as { default?: unknown }).default ?? mod;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const create = ($3Dmol as any).createViewer as (el: HTMLElement, cfg: unknown) => any;
        if (!hostRef.current || disposed) return;
        hostRef.current.innerHTML = "";
        const viewer = create(hostRef.current, { backgroundColor: "0x0b0f17" });
        viewerRef.current = viewer;

        const cif = structure.inline_cif ?? (await (await fetch(structure.provider_url)).text());
        if (disposed) return;
        viewer.addModel(cif, "cif");
        // muted protein cartoon
        viewer.setStyle({}, { cartoon: { color: "0x3b5b7a", opacity: 0.9 } });
        // emphasise the cofactor / hetero groups (the proposed spin center)
        viewer.setStyle({ hetflag: true }, { stick: { colorscheme: "yellowCarbon", radius: 0.22 } });
        viewer.addSurface?.(2 /* VDW */, { opacity: 0.28, color: "0xf6c945" }, { hetflag: true });
        const hasHet = (viewer.selectedAtoms?.({ hetflag: true }) ?? []).length > 0;
        viewer.zoomTo(hasHet ? { hetflag: true } : {});
        viewer.zoom(0.85);
        viewer.render();
        if (!disposed) setReady(true);
      } catch (err) {
        if (!disposed) setError((err as Error).message || "structure failed to load");
      }
    })();

    const onVisibility = () => {
      // pause GPU work when hidden
      if (document.hidden) return;
      viewerRef.current?.render();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        viewerRef.current?.clear();
      } catch {
        /* viewer already torn down */
      }
      viewerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [structure]);

  return (
    <div className="struct">
      <div className="struct-canvas" ref={hostRef} aria-label="protein structure viewer" role="img" />
      {loading && <div className="struct-overlay">loading structure…</div>}
      {error && (
        <div className="struct-overlay struct-error">
          structure unavailable — {error}
          {structure && (
            <>
              {" "}
              <a href={structure.provider_url} target="_blank" rel="noreferrer">
                open source
              </a>
            </>
          )}
        </div>
      )}
      {structure && ready && (
        <div className="struct-caption">
          {structure.source === "experimental_pdb" ? (
            <>
              <strong>{structure.pdb_id}</strong> · experimental {structure.method ?? ""}{" "}
              {structure.resolution ? `· ${structure.resolution.toFixed(2)} Å` : ""}
            </>
          ) : (
            <>
              AlphaFold prediction {structure.mean_plddt ? `· mean pLDDT ${structure.mean_plddt.toFixed(0)}` : ""}
            </>
          )}
          {cofactorLabel ? <span className="struct-cofactor"> · cofactor {cofactorLabel} highlighted</span> : null}
        </div>
      )}
      {!structure && !loading && <div className="struct-overlay">no interactive structure for this candidate</div>}
    </div>
  );
}
