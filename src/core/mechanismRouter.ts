import { MECHANISM_ROUTES, routeById } from "./fixtures/routes";
import type { MechanismRoute, ScaffoldFamily } from "./types";

/**
 * Mechanism router.
 *
 * Maps a scaffold family to its mechanism route. This is a fixed, auditable
 * mapping, no scaffold gets silently upgraded to a stronger claim level than
 * its route allows.
 */
const SCAFFOLD_TO_ROUTE: Record<ScaffoldFamily, string> = {
  LOV_flavin: "route_lov_flavin_rp",
  cryptochrome_FAD: "route_cry_fad_rp",
  fluorescent_protein: "route_triplet_fp",
  RFP_plus_flavin: "route_rfp_flavin_photo",
  redox_flavoprotein: "route_redox_electrochem",
  material_composite: "route_material_state",
  metal_cofactor: "route_metal_confounder",
  unsupported: "route_metal_confounder",
};

export function routeForScaffold(scaffold: ScaffoldFamily): MechanismRoute {
  const id = SCAFFOLD_TO_ROUTE[scaffold];
  const route = routeById(id);
  if (!route) {
    // Defensive: never throw in the demo path; fall back to the confounder route.
    return MECHANISM_ROUTES.find((r) => r.routeClass === "metal_cofactor_confounder")!;
  }
  return route;
}
