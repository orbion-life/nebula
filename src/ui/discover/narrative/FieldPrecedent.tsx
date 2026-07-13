/**
 * Field precedent, recent (2024 to 2026) external results that show a mechanism CLASS is real and
 * benchable, ROUTE-GATED to the selected candidate's route. Deliberately, visibly separated from
 * the candidate: every item is something achieved ELSEWHERE, on other proteins or methods, cited as
 * precedent for the route, never a claim about this shortlist. A redox candidate no longer shows
 * spin-qubit papers; a flavin one shows iLOV + RadicalPy. Every citation was verified against the
 * primary literature before shipping.
 */
type Precedent = {
  title: string;
  shows: string;
  precedentFor: string;
  venue: string;
  year: string;
  doi: string;
};

type PrecedentKey = "ilov" | "eyfp" | "radicalpy" | "rfdiffusion2";

const PRECEDENTS: Record<PrecedentKey, Precedent> = {
  ilov: {
    title: "Optically detected spin chemistry in flavoproteins",
    shows:
      "Flavoproteins that form spin-correlated radical pairs (including iLOV) show optically detected magnetic resonance (ODMR contrast approaching 50%) and radio-wave control of the spin state.",
    precedentFor: "flavin radical-pair route · RF / optical readout",
    venue: "Nature Biotechnology",
    year: "2026",
    doi: "10.1038/s41587-026-03158-5",
  },
  eyfp: {
    title: "A genetically-encoded fluorescent-protein spin qubit",
    shows:
      "Enhanced yellow fluorescent protein (EYFP) works as an optically-addressable spin qubit, with coherent control in mammalian cells and room-temperature ODMR demonstrated in E. coli.",
    precedentFor: "optical spin contrast (ODMR-like) readout in cells",
    venue: "Nature",
    year: "2025",
    doi: "10.1038/s41586-025-09417-w",
  },
  radicalpy: {
    title: "RadicalPy: a radical-pair spin-dynamics toolbox",
    shows:
      "The open-source spin-dynamics framework this app's reference MARY sweep is built on, classical, semiclassical and quantum radical-pair kinetics for the flavin route.",
    precedentFor: "the reference physics engine (provenance)",
    venue: "J. Chem. Theory Comput.",
    year: "2024",
    doi: "10.1021/acs.jctc.4c00887",
  },
  rfdiffusion2: {
    title: "Atom-level scaffolding with RFdiffusion2",
    shows:
      "De-novo protein backbones can be generated directly from an atom-level functional-group geometry without fixing sequence positions, the class of engine behind the generate-beyond-nature lane.",
    precedentFor: "generated backbones · coordinates only",
    venue: "Nature Methods",
    year: "2025",
    doi: "10.1038/s41592-025-02975-x",
  },
};

// route_class → the precedents that actually apply to THAT mechanism. Routes with no spin-dynamics
// precedent (redox, material, metal) map to nothing, so they never show off-mechanism spin papers.
const ROUTE_PRECEDENT: Record<string, PrecedentKey[]> = {
  LOV_flavin_radical_pair: ["ilov", "radicalpy"],
  cryptochrome_FAD_radical_pair: ["ilov", "radicalpy"],
  RFP_flavin_photochemical: ["ilov", "radicalpy"],
  triplet_FP: ["eyfp"],
};

// the generation-lane precedent (RFdiffusion2), surfaced with the designs, not a protein's physics.
export const GENERATE_PRECEDENT = PRECEDENTS.rfdiffusion2;

function PrecedentCard({ p }: { p: Precedent }) {
  return (
    <li className="fp-card">
      <span className="fp-for">{p.precedentFor}</span>
      <strong className="fp-title">{p.title}</strong>
      <p className="fp-shows">{p.shows}</p>
      <a className="fp-doi" href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer">
        {p.venue} {p.year} · doi:{p.doi}
      </a>
    </li>
  );
}

export function FieldPrecedent({ route }: { route?: string }) {
  const keys = (route && ROUTE_PRECEDENT[route]) || [];
  return (
    <aside className="field-precedent" aria-label="field precedent for this candidate's route">
      <header className="fp-head">
        <span className="atlas-eyebrow">field precedent · this route</span>
        <p>
          Recent results for this candidate's mechanism route, achieved elsewhere on other proteins or
          methods, external precedent that the route is real and benchable. None of these is this
          candidate; each supports the route, not the shortlist.
        </p>
      </header>
      {keys.length ? (
        <ul className="fp-list">{keys.map((k) => <PrecedentCard key={k} p={PRECEDENTS[k]} />)}</ul>
      ) : (
        <p className="fp-empty">
          No spin-dynamics field precedent applies to this route in the current build. This candidate is
          scored on public annotation and measurement value, not on an off-mechanism analogue.
        </p>
      )}
    </aside>
  );
}
