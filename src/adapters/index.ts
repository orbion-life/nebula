export * from "./types";

export { fetchUniProt } from "./publicData/uniprot";
export { fetchRcsb } from "./publicData/rcsb";
export { fetchAlphaFold } from "./publicData/alphafold";
export { fetchFpbase } from "./publicData/fpbase";

export { esmAnalogSearch, esmAnalogSearchLive } from "./retrieval/esm";
export { faissSearch, faissSearchLive } from "./retrieval/faiss";

export { radicalPySimulate, radicalPyRunLive } from "./physics/radicalpy";
export { qutipSimulate } from "./physics/qutip";
export { pyscfCompute } from "./physics/pyscf";

export { rfdiffusionGenerate } from "./design/rfdiffusion";
export { ligandMpnnDesign } from "./design/ligandmpnn";
export { proteinMpnnDesign } from "./design/proteinmpnn";
export { boltzPredict } from "./design/boltz";

import { fetchUniProt } from "./publicData/uniprot";
import { fetchRcsb } from "./publicData/rcsb";
import { fetchAlphaFold } from "./publicData/alphafold";
import { fetchFpbase } from "./publicData/fpbase";
import { esmAnalogSearch } from "./retrieval/esm";
import { faissSearch } from "./retrieval/faiss";
import { radicalPySimulate } from "./physics/radicalpy";
import { qutipSimulate } from "./physics/qutip";
import { pyscfCompute } from "./physics/pyscf";
import { rfdiffusionGenerate } from "./design/rfdiffusion";
import { ligandMpnnDesign } from "./design/ligandmpnn";
import { proteinMpnnDesign } from "./design/proteinmpnn";
import { boltzPredict } from "./design/boltz";
import type { AdapterResult } from "./types";

/**
 * All adapters as zero-arg (unconfigured) invocations, for the UI status board
 * and for boundary tests that assert every adapter fails gracefully.
 */
export function allAdapterProbes(): AdapterResult<unknown>[] {
  return [
    fetchUniProt("P0DP23"),
    fetchRcsb("2V0U"),
    fetchAlphaFold("P0DP23"),
    fetchFpbase("EGFP"),
    esmAnalogSearch("blue-light flavin sensor"),
    faissSearch("blue-light flavin sensor"),
    radicalPySimulate(),
    qutipSimulate(),
    pyscfCompute(),
    rfdiffusionGenerate(),
    ligandMpnnDesign(),
    proteinMpnnDesign(),
    boltzPredict(),
  ];
}
