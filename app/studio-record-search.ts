import type { StudioDraft, StudioNode } from "./types";

export type RecordScope = "all" | "planning" | "evidence" | "options" | "scenarios";
export function studioRecordScope(node: StudioNode, converted = false): Exclude<RecordScope, "all"> | "context" {
  if (node.type === "deadline" || converted && node.type === "decision" && node.id.startsWith("stage-")) return "planning";
  if (node.type === "fact" || node.type === "evidence") return "evidence";
  if (node.type === "decision") return "options";
  if (node.type === "outcome") return "scenarios";
  return "context";
}
/** Pure search of authored content. Never infers dates, completion, priority or approval. */
export function searchStudioRecords(draft: StudioDraft, query: string, scope: RecordScope = "all") {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return draft.nodes.filter(node => {
    if (scope !== "all" && studioRecordScope(node, Boolean(draft.classification?.tags.includes("converted-example"))) !== scope) return false;
    const text = [node.id, node.title, node.detail].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
