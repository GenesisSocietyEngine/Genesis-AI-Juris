import { STUDIO_DRAFT_SERIALIZED_LIMIT, studioJsonBytes } from "./studio-envelope";
import type { StudioDraft } from "./types";

function assertDistinctConnections(links: StudioDraft["links"]) {
  if (new Set(links.map(link => `${link.from}\u0000${link.to}`)).size !== links.length)
    throw new Error("evidence-destination-conflict");
}

/** Only graph links change; evidence bodies, relation rules and all aggregate carriers survive. */
export function rearrangeStudioEvidence(draft: StudioDraft, evidenceIds: readonly string[], from: string | null, to: string | null): StudioDraft {
  const ids = new Set(evidenceIds);
  if (!ids.size || [...ids].some(id => !draft.nodes.some(node => node.id === id && node.type === "evidence"))) throw new Error("Choose existing evidence records");
  if (to && (!draft.nodes.some(node => node.id === to) || ids.has(to))) throw new Error("Choose another destination");
  if (from && (!draft.nodes.some(node => node.id === from) || from === to)) throw new Error("Choose another destination");
  if (from && [...ids].some(id => !draft.links.some(link => link.from === from && link.to === id || link.from === id && link.to === from))) throw new Error("Evidence is no longer attached here");
  const connects = (a: string, b: string) => ids.has(a) && b === from || ids.has(b) && a === from;
  const links = from ? draft.links.flatMap(link => connects(link.from, link.to) ? to ? [{ ...link, from: link.from === from ? to : link.from, to: link.to === from ? to : link.to }] : [] : [link]) : [...draft.links];
  if (!from && to) for (const id of ids) {
    if (!links.some(link => link.from === id && link.to === to || link.to === id && link.from === to)) {
      let linkId = `evidence-${crypto.randomUUID()}`;
      while (links.some(link => link.id === linkId)) linkId = `evidence-${crypto.randomUUID()}`;
      links.push({ id: linkId, from: id, to });
    }
  }
  if (links.length > 500) throw new Error("The case connection limit is 500");
  assertDistinctConnections(links);
  const next = { ...draft, links };
  if (studioJsonBytes(next) > STUDIO_DRAFT_SERIALIZED_LIMIT) throw new Error("The case size limit is 900 KB");
  return next;
}

export function deleteStudioNodeKeepingEvidence(draft: StudioDraft, nodeId: string, target: string | null): StudioDraft {
  const node = draft.nodes.find(item => item.id === nodeId);
  if (!node) throw new Error("This node is no longer present");
  if (node.type !== "evidence" && draft.nodes.some(item => item.runtime?.missedOutcomeNodeId === nodeId)) throw new Error("deadline-fallback-in-use");
  if (target && (target === nodeId || !draft.nodes.some(item => item.id === target && item.type !== "evidence"))) throw new Error("Choose an existing non-evidence node");
  const evidence = new Set(draft.nodes.filter(item => item.type === "evidence" && item.id !== nodeId).map(item => item.id));
  const links = draft.links.flatMap(link => {
    if (link.from !== nodeId && link.to !== nodeId) return [link];
    const other = link.from === nodeId ? link.to : link.from;
    if (!target || !evidence.has(other)) return [];
    return [{ ...link, from: link.from === nodeId ? target : link.from, to: link.to === nodeId ? target : link.to }];
  });
  assertDistinctConnections(links);
  // Evidence deletion means disconnecting its record, never discarding its body.
  return { ...draft, nodes: node.type === "evidence" ? draft.nodes : draft.nodes.filter(item => item.id !== nodeId), links };
}
