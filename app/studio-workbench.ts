import type { StudioDraft } from "./types";

/** An explicit legacy stage always wins over the new default entry surface. */
export function opensStudioWorkbench(params: URLSearchParams) {
  const panel = params.get("studio_panel");
  return panel === "workbench" || (!panel && !params.get("studio_step"));
}

/** Counts describe the current working model; they do not imply approval or evidence sufficiency. */
export function studioWorkbenchCounts(draft: Pick<StudioDraft, "nodes" | "links">) {
  return {
    records: draft.nodes.length,
    evidence: draft.nodes.filter(node => node.type === "evidence").length,
    connections: draft.links.length,
  };
}
