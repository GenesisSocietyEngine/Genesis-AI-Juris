import type { CanopyScenarioId } from "./canopy-fixture";

/** Standalone launch versions differ from the authored scenario-parent chain. */
export const CANOPY_INDEPENDENT_VERSIONS: Record<CanopyScenarioId, string> = {
  base: "2.0.0", upside: "2.5.0", hard_stop: "2.6.0", hard_stop_unavailable: "2.7.0", downside: "2.4.0",
};
