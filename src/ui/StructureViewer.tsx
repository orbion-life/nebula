import { useRef, useState } from "react";

/**
 * Optional public-structure viewer (3Dmol.js).
 *
 * This is an opt-in enhancement: it does NOT auto-load on render, so the core
 * demo stays offline and deterministic. On demand it loads a PUBLIC structure by
 * PDB id from the RCSB PDB and renders it with 3Dmol.js (dynamically imported).
 * It shows public structures only — never a designed or private candidate.
 */
type Status = "idle" | "loading" | "ok" | "error";

export function StructureViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdbId, setPdbId] = useState("2V0U");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState(
    "Optional: load a public PDB structure (e.g. 2V0U, a phototropin LOV2 domain).",
  );

  async function load() {
    if (!containerRef.current) return;
    setStatus("loading");
    setMessage(`Loading public structure ${pdbId.toUpperCase()} from RCSB…`);
    try {
      const mod = (await import("3dmol")) as unknown as {
        createViewer: (el: HTMLElement, cfg: Record<string, unknown>) => any;
        download: (
          q: string,
          viewer: any,
          opts: Record<string, unknown>,
          cb: () => void,
        ) => void;
      };
      containerRef.current.innerHTML = "";
      const viewer = mod.createViewer(containerRef.current, {
        backgroundColor: "#fdfdfb",
      });
      mod.download(`pdb:${pdbId.trim()}`, viewer, {}, () => {
        viewer.setStyle({}, { cartoon: { color: "spectrum" } });
        viewer.addStyle({ hetflag: true }, { stick: {} });
        viewer.zoomTo();
        viewer.render();
        setStatus("ok");
        setMessage(
          `Public structure ${pdbId.toUpperCase()} (RCSB PDB). Public data only — not a designed or private candidate.`,
        );
      });
    } catch (err) {
      setStatus("error");
      setMessage(
        `Could not load 3D viewer / structure (${(err as Error).message}). This is an optional feature; the core demo does not require it.`,
      );
    }
  }

  return (
    <div className="panel">
      <h2>Public structure viewer (optional)</h2>
      <div className="controls" style={{ marginTop: 0 }}>
        <input
          className="seed-input"
          style={{ width: 120 }}
          value={pdbId}
          onChange={(e) => setPdbId(e.target.value)}
          aria-label="PDB id"
        />
        <button className="ghost" onClick={load} disabled={status === "loading"}>
          {status === "loading" ? "Loading…" : "Load public structure"}
        </button>
      </div>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: 260,
          marginTop: 12,
          border: "1px solid var(--rule)",
          borderRadius: 8,
          background: "#fdfdfb",
        }}
      />
      <p className="footnote">{message}</p>
    </div>
  );
}
