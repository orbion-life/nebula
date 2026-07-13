/**
 * Library / adapter registry.
 *
 * Nebula is a construct-hypothesis and measurement-worthiness workflow,
 * not a wrapper around one model. Different parts of the question are answered by
 * different tools. This registry is the single source of truth for what runs in
 * the core demo vs. what is an optional research adapter, documented future work,
 * or a stub.
 *
 * IMPORTANT: nothing here is a heavy install pulled into the core app. The core
 * demo stays fast, deterministic, and laptop-runnable. Research tools are
 * represented as adapters/docs/hooks, not core dependencies.
 */

export type LibraryLayer =
  | "core"
  | "public_data"
  | "retrieval"
  | "physics"
  | "design_adapter"
  | "future_research";

export type LibraryStatus =
  | "installed"
  | "optional_adapter"
  | "documented_future"
  | "stubbed";

export interface LibraryEntry {
  name: string;
  category: string;
  layer: LibraryLayer;
  purpose: string;
  currentStatus: LibraryStatus;
  whyItMattersForDiscover: string;
  claimBoundary: string;
  url: string;
}

export const LIBRARY_REGISTRY: LibraryEntry[] = [
  // ---------------------------------------------------------------- core layer
  {
    name: "Vite",
    category: "build tooling",
    layer: "core",
    purpose: "Dev server and production bundler for the local web app.",
    currentStatus: "installed",
    whyItMattersForDiscover: "Keeps the demo fast to start and build on a normal laptop.",
    claimBoundary: "Tooling only; makes no scientific claim.",
    url: "https://vitejs.dev",
  },
  {
    name: "React",
    category: "ui framework",
    layer: "core",
    purpose: "Component UI for the seven-screen discovery flow.",
    currentStatus: "installed",
    whyItMattersForDiscover: "Renders the input to handoff flow interactively.",
    claimBoundary: "Presentation only; makes no scientific claim.",
    url: "https://react.dev",
  },
  {
    name: "TypeScript",
    category: "language",
    layer: "core",
    purpose: "Static types that encode claim-safety into the schema itself.",
    currentStatus: "installed",
    whyItMattersForDiscover:
      "Literal types like status:'public_hypothesis_not_validated' make unsafe states uncompilable.",
    claimBoundary: "Language only; enforces boundaries, claims nothing.",
    url: "https://www.typescriptlang.org",
  },
  {
    name: "zod",
    category: "runtime validation",
    layer: "core",
    purpose: "Runtime validation of objective input at the pipeline boundary.",
    currentStatus: "installed",
    whyItMattersForDiscover:
      "Guards the deterministic pipeline against malformed input without a backend.",
    claimBoundary: "Validation only; does not infer biology.",
    url: "https://zod.dev",
  },
  {
    name: "Fuse.js",
    category: "fuzzy search",
    layer: "core",
    purpose: "Keyword component of the hybrid public analog index (blended with vector cosine).",
    currentStatus: "installed",
    whyItMattersForDiscover:
      "Adds keyword robustness to the deterministic vector analog index (src/core/analogIndex.ts) used as the offline retrieval fallback.",
    claimBoundary:
      "Keyword analog search only; combined with vector cosine, never a spin/property prediction.",
    url: "https://fusejs.io",
  },
  {
    name: "Deterministic TypeScript math / ODE",
    category: "simulation core",
    layer: "core",
    purpose:
      "Seeded PRNG and mechanism-shaped proxy equations (photokinetic, radical-pair, triplet, redox, material-state).",
    currentStatus: "installed",
    whyItMattersForDiscover:
      "Deterministic, reviewable synthetic traces the demo does not need Python/GPU for.",
    claimBoundary:
      "Mechanism-shaped proxies producing synthetic assumption sweeps, not predictions.",
    url: "https://en.wikipedia.org/wiki/Ordinary_differential_equation",
  },
  {
    name: "visx (d3-based) / recharts",
    category: "charting",
    layer: "core",
    purpose: "visx (scale/shape/axis/group) powers the Tufte-style signal charts.",
    currentStatus: "installed",
    whyItMattersForDiscover:
      "Renders the synthetic multimodal traces with real, tested d3-based scales while keeping the minimal Tufte styling.",
    claimBoundary: "Visualization only; a chart is not a measurement.",
    url: "https://airbnb.io/visx/",
  },
  {
    name: "3Dmol.js",
    category: "molecular visualization",
    layer: "core",
    purpose: "Opt-in in-browser 3D viewer that loads public PDB structures on demand (lazy-loaded).",
    currentStatus: "installed",
    whyItMattersForDiscover:
      "Lets users inspect a public scaffold structure (e.g. a LOV2 domain) next to its mechanism route; code-split so it never bloats the core demo.",
    claimBoundary: "Displays public structures only; not a designed or private candidate.",
    url: "https://3dmol.csb.pitt.edu",
  },
  {
    name: "SQLite",
    category: "local storage",
    layer: "core",
    purpose: "Optional local persistence of runs, fixtures, and evidence.",
    currentStatus: "documented_future",
    whyItMattersForDiscover:
      "Optional caching of public fixtures; the demo runs fully in-memory without it.",
    claimBoundary: "Storage only; stores no private data.",
    url: "https://www.sqlite.org",
  },

  // --------------------------------------------------------- public_data layer
  {
    name: "UniProt API",
    category: "public sequence/annotation data",
    layer: "public_data",
    purpose: "Retrieve public protein sequences and annotations for scaffolds.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Grounds construct hypotheses in public, citable scaffold annotations.",
    claimBoundary:
      "Public data retrieval only; presence of an annotation is not a sensing claim.",
    url: "https://www.uniprot.org/help/api",
  },
  {
    name: "RCSB PDB APIs",
    category: "public structural data",
    layer: "public_data",
    purpose: "Fetch public experimental structures for public scaffolds.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Lets a hypothesis reference a real public structure for measurement planning.",
    claimBoundary: "Public structures only; not a designed or private candidate.",
    url: "https://www.rcsb.org/docs/programmatic-access",
  },
  {
    name: "AlphaFold DB",
    category: "public predicted structures",
    layer: "public_data",
    purpose: "Fetch public predicted structures for scaffolds lacking crystals.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Structural context for hypotheses; explicitly a prediction, not a spin/property claim.",
    claimBoundary:
      "A predicted structure informs geometry only; it does NOT determine spin response.",
    url: "https://alphafold.ebi.ac.uk",
  },
  {
    name: "FPbase API",
    category: "fluorescent protein data",
    layer: "public_data",
    purpose: "Retrieve public fluorescent-protein spectra and properties.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Public optical properties (ex/em, brightness) inform readout-route feasibility.",
    claimBoundary: "Public spectral data only; not a proven sensing property.",
    url: "https://www.fpbase.org/api/",
  },
  {
    name: "Biopython",
    category: "sequence/structure parsing",
    layer: "public_data",
    purpose: "Parse public sequence/structure records.",
    currentStatus: "documented_future",
    whyItMattersForDiscover: "Server-side parsing of fetched public records.",
    claimBoundary: "Parsing only; no biological claim.",
    url: "https://biopython.org",
  },
  {
    name: "gemmi",
    category: "structural file handling",
    layer: "public_data",
    purpose: "Fast structure/cif parsing and geometry utilities.",
    currentStatus: "documented_future",
    whyItMattersForDiscover: "Efficient handling of public structural files.",
    claimBoundary: "File handling only; no biological claim.",
    url: "https://gemmi.readthedocs.io",
  },
  {
    name: "biotite",
    category: "structural bioinformatics",
    layer: "public_data",
    purpose: "Structure analysis and public database access.",
    currentStatus: "documented_future",
    whyItMattersForDiscover: "Analysis of public structures for measurement planning.",
    claimBoundary: "Analysis of public data only; no sensing claim.",
    url: "https://www.biotite-python.org",
  },
  {
    name: "RDKit",
    category: "cheminformatics",
    layer: "public_data",
    purpose: "Cofactor/chromophore/ligand cheminformatics.",
    currentStatus: "documented_future",
    whyItMattersForDiscover:
      "Reason about cofactors (FMN/FAD) and ligand environments in public terms.",
    claimBoundary: "Cheminformatics only; not a spin or activity prediction.",
    url: "https://www.rdkit.org",
  },

  // ---------------------------------------------------------- retrieval layer
  {
    name: "ESM-2 / ESMFold",
    category: "protein language model / structure",
    layer: "retrieval",
    purpose:
      "Sequence embeddings for public analog search; ESMFold for structure. Live HTTP wiring in esmAnalogSearchLive(), with a deterministic offline vector index fallback.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Finds public scaffolds ANALOGOUS to a query for measurement triage.",
    claimBoundary:
      "Embeddings are used for public analog search only. Sequence models do NOT predict spin response.",
    url: "https://github.com/facebookresearch/esm",
  },
  {
    name: "EvolutionaryScale ESM-C / ESMC",
    category: "protein language model",
    layer: "retrieval",
    purpose: "Newer protein embeddings for public analog search.",
    currentStatus: "documented_future",
    whyItMattersForDiscover: "Improved analog retrieval over public scaffolds.",
    claimBoundary:
      "Analog search only; embeddings never determine magnetic/spin response.",
    url: "https://www.evolutionaryscale.ai",
  },
  {
    name: "FAISS",
    category: "vector index",
    layer: "retrieval",
    purpose:
      "Similarity index over public embeddings for analog search. Live HTTP wiring in faissSearchLive(); offline it uses the deterministic hybrid vector index (analogIndex.ts).",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover: "Scales public analog search to large public corpora.",
    claimBoundary: "Nearest-neighbour search over public vectors only; predicts nothing.",
    url: "https://github.com/facebookresearch/faiss",
  },
  {
    name: "hnswlib",
    category: "vector index",
    layer: "retrieval",
    purpose: "Lightweight ANN index alternative to FAISS.",
    currentStatus: "documented_future",
    whyItMattersForDiscover: "Laptop-friendly analog search index.",
    claimBoundary: "Nearest-neighbour search only; predicts nothing.",
    url: "https://github.com/nmslib/hnswlib",
  },
  {
    name: "sentence-transformers",
    category: "text embeddings",
    layer: "retrieval",
    purpose: "Embed literature/evidence text for public semantic search.",
    currentStatus: "documented_future",
    whyItMattersForDiscover: "Semantic retrieval over public evidence cards/literature.",
    claimBoundary: "Text search only; not a biological or spin prediction.",
    url: "https://www.sbert.net",
  },

  // ------------------------------------------------------------- physics layer
  {
    name: "RadicalPy",
    category: "spin dynamics",
    layer: "physics",
    purpose:
      "Radical-pair / spin-dynamics simulation. Live subprocess wiring in radicalPyRunLive() (Node); offline it uses the deterministic TS proxy.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Would replace the radical-pair PROXY with a real spin-dynamics sweep when configured.",
    claimBoundary:
      "Produces synthetic assumption sweeps unless anchored to real measured parameters; not a validated prediction.",
    url: "https://radicalpy.readthedocs.io",
  },
  {
    name: "QuTiP",
    category: "open quantum systems",
    layer: "physics",
    purpose: "Master-equation / spin-Hamiltonian simulation.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Would upgrade triplet/ODMR-like proxies to real open-quantum-system dynamics.",
    claimBoundary:
      "Simulation under stated assumptions; synthetic sweep, not a measured result.",
    url: "https://qutip.org",
  },
  {
    name: "PySCF",
    category: "electronic structure",
    layer: "physics",
    purpose: "Quantum-chemistry electronic-structure calculations.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Would provide electronic-structure context for cofactor environments in outliers.",
    claimBoundary:
      "Computed properties are model outputs under assumptions; not experimental validation.",
    url: "https://pyscf.org",
  },
  {
    name: "scipy.integrate.solve_ivp",
    category: "numerical ODE",
    layer: "physics",
    purpose:
      "Reference ODE integration for photokinetic models. An in-repo TS RK4 cross-check (src/core/ode.ts) already validates the proxy; scripts/solve_ivp_crosscheck.py is the optional independent scipy reference.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Confirms the deterministic TS photokinetic proxy is ODE-consistent (TS RK4 always-on; scipy optional).",
    claimBoundary: "Numerical integration only; output is synthetic under assumptions.",
    url: "https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html",
  },
  {
    name: "JAX",
    category: "autodiff / accelerated compute",
    layer: "physics",
    purpose: "Differentiable/accelerated parameter sweeps.",
    currentStatus: "documented_future",
    whyItMattersForDiscover: "Faster/larger synthetic parameter sweeps if needed.",
    claimBoundary: "Compute only; synthetic sweeps remain assumption-driven.",
    url: "https://jax.readthedocs.io",
  },
  {
    name: "NumPyro",
    category: "probabilistic programming",
    layer: "physics",
    purpose: "Bayesian uncertainty over sweep parameters.",
    currentStatus: "documented_future",
    whyItMattersForDiscover:
      "Propagate uncertainty transparently through synthetic sweeps.",
    claimBoundary: "Uncertainty modelling only; not a validated posterior over biology.",
    url: "https://num.pyro.ai",
  },

  // -------------------------------------------------------- design_adapter layer
  {
    name: "RFdiffusion",
    category: "backbone generation",
    layer: "design_adapter",
    purpose: "Generate protein backbones around motifs/cofactor environments.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "A downstream design HANDOFF for a public construct hypothesis, not the discovery engine.",
    claimBoundary:
      "Public demo handoff only; outputs are not Orbion candidates and not validated for sensing.",
    url: "https://github.com/RosettaCommons/RFdiffusion",
  },
  {
    name: "LigandMPNN",
    category: "sequence design",
    layer: "design_adapter",
    purpose: "Sequence design around ligand/cofactor/scaffold constraints.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Best stretch design handoff; shows how a hypothesis could be advanced, not that it works.",
    claimBoundary:
      "Public demo handoff only; never a private mutation list or ready-to-test sequence.",
    url: "https://github.com/dauparas/LigandMPNN",
  },
  {
    name: "ProteinMPNN",
    category: "sequence design",
    layer: "design_adapter",
    purpose: "Sequence design for fixed public template scaffolds.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover: "Simple design handoff for public template scaffolds.",
    claimBoundary:
      "Public demo handoff only; outputs are not commercial candidates.",
    url: "https://github.com/dauparas/ProteinMPNN",
  },
  {
    name: "Boltz",
    category: "structure/complex prediction",
    layer: "design_adapter",
    purpose: "Predict structures/complexes for a proposed design handoff.",
    currentStatus: "optional_adapter",
    whyItMattersForDiscover:
      "Would sanity-check a design handoff's fold/complex; still not a sensing claim.",
    claimBoundary:
      "Design handoff / predicted structure only; not validation and not a spin-response prediction.",
    url: "https://github.com/jwohlwend/boltz",
  },
];

export const LIBRARY_LAYERS: LibraryLayer[] = [
  "core",
  "public_data",
  "retrieval",
  "physics",
  "design_adapter",
  "future_research",
];

export function librariesByLayer(layer: LibraryLayer): LibraryEntry[] {
  return LIBRARY_REGISTRY.filter((l) => l.layer === layer);
}

export function libraryByName(name: string): LibraryEntry | undefined {
  return LIBRARY_REGISTRY.find((l) => l.name === name);
}
