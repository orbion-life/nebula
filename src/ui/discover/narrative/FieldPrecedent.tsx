/**
 * Field precedent — recent (2024–2026) external results that show the mechanism CLASS is real
 * and benchable. Deliberately, visibly separated from the candidate: every item is something
 * achieved ELSEWHERE, on other proteins or methods, cited as precedent for the route — never a
 * claim about this shortlist. Every citation was verified against the primary literature before
 * shipping (iLOV flavoprotein ODMR, EYFP spin qubit, RFdiffusion2, RadicalPy).
 */
type Precedent = {
  title: string;
  shows: string;
  precedentFor: string;
  venue: string;
  year: string;
  doi: string;
};

const PRECEDENTS: Precedent[] = [
  {
    title: "Optically detected spin chemistry in flavoproteins",
    shows:
      "Flavoproteins that form spin-correlated radical pairs (including iLOV) show optically detected magnetic resonance — ODMR contrast approaching 50% — and radio-wave control of the spin state.",
    precedentFor: "flavin radical-pair route · RF / optical readout",
    venue: "Nature Biotechnology",
    year: "2026",
    doi: "10.1038/s41587-026-03158-5",
  },
  {
    title: "A genetically-encoded fluorescent-protein spin qubit",
    shows:
      "Enhanced yellow fluorescent protein (EYFP) works as an optically-addressable spin qubit, with coherent control in mammalian cells and room-temperature ODMR demonstrated in E. coli.",
    precedentFor: "optical spin contrast (ODMR-like) readout in cells",
    venue: "Nature",
    year: "2025",
    doi: "10.1038/s41586-025-09417-w",
  },
  {
    title: "Atom-level scaffolding with RFdiffusion2",
    shows:
      "De-novo protein backbones can be generated directly from an atom-level functional-group geometry without fixing sequence positions — the class of engine behind the generate-beyond-nature lane.",
    precedentFor: "generated backbones · coordinates only",
    venue: "Nature Methods",
    year: "2025",
    doi: "10.1038/s41592-025-02975-x",
  },
  {
    title: "RadicalPy: a radical-pair spin-dynamics toolbox",
    shows:
      "The open-source spin-dynamics framework this app's reference MARY sweep is built on — classical, semiclassical and quantum radical-pair kinetics for the flavin route.",
    precedentFor: "the reference physics engine (provenance)",
    venue: "J. Chem. Theory Comput.",
    year: "2024",
    doi: "10.1021/acs.jctc.4c00887",
  },
];

export function FieldPrecedent() {
  return (
    <aside className="field-precedent" aria-label="field precedent from recent literature">
      <header className="fp-head">
        <span className="atlas-eyebrow">field precedent · 2024–2026</span>
        <p>
          Recent results, achieved elsewhere on other proteins and methods — external precedent that the mechanism
          class is real and benchable. None of these is this candidate; each supports the route, not the shortlist.
        </p>
      </header>
      <ul className="fp-list">
        {PRECEDENTS.map((p) => (
          <li className="fp-card" key={p.doi}>
            <span className="fp-for">{p.precedentFor}</span>
            <strong className="fp-title">{p.title}</strong>
            <p className="fp-shows">{p.shows}</p>
            <a className="fp-doi" href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer">
              {p.venue} {p.year} · doi:{p.doi}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
