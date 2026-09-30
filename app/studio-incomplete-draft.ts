import { isRecord, normalizeStudioDraft } from "./case-integrity";
import type { StudioDraft } from "./types";

/** Authoring storage can precede a title or first node. Validation placeholders
 * are removed immediately and never become case content or tax source identity.
 * Publication and sealed export still use the strict normalizer. */
export function normalizeIncompleteStudioDraft(value: unknown): StudioDraft {
  if (!isRecord(value)) throw new Error("Invalid incomplete Studio draft");
  const emptyTitle = typeof value.title === "string" && value.title.trim() === "";
  const emptyGraph = Array.isArray(value.nodes) && value.nodes.length === 0;
  if (!emptyTitle && !emptyGraph) return normalizeStudioDraft(value);
  if (emptyTitle && (value.title as string).length > 200) throw new Error("Invalid incomplete Studio title");
  if (emptyGraph && (!Array.isArray(value.links) || value.links.length !== 0)) throw new Error("An empty Studio graph cannot have links");
  const normalized = normalizeStudioDraft({
    ...value,
    title: emptyTitle ? "Untitled case" : value.title,
    nodes: emptyGraph ? [{ id: "continuation-validation", type: "trigger", title: "Validation only", detail: "", x: 0, y: 0 }] : value.nodes,
  });
  return { ...normalized, title: emptyTitle ? value.title as string : normalized.title, nodes: emptyGraph ? [] : normalized.nodes };
}
