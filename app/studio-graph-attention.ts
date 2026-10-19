import type { StudioDraft } from "./types";

/** Explain the existing directed-route checks without inventing a connection. */
export function studioGraphAttention(draft: StudioDraft, playable: boolean) {
  const ids = new Set(draft.nodes.map(node => node.id));
  const valid = draft.links.filter(link => ids.has(link.from) && ids.has(link.to));
  const connected = new Set(valid.flatMap(link => [link.from, link.to]));
  const starts = draft.nodes.filter(node => node.type === "trigger").map(node => node.id);
  const reach = (roots: string[]) => {
    const seen = new Set<string>(), pending = [...roots];
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const link of valid) if (link.from === id) pending.push(link.to);
    }
    return seen;
  };
  const reached = reach(starts);
  const decisions = reach(draft.nodes.filter(node => node.type === "decision").map(node => node.id));
  const orphanIds = draft.nodes.filter(node => node.type !== "trigger" && !connected.has(node.id)).map(node => node.id);
  const routeIds = new Set(draft.links.filter(link => !ids.has(link.from) || !ids.has(link.to)).flatMap(link => [link.from, link.to]).filter(id => ids.has(id)));
  // Without a start the correction is case-level; don't falsely mark every node.
  if (starts.length) for (const node of draft.nodes) if (!reached.has(node.id)) routeIds.add(node.id);
  if (playable) for (const node of draft.nodes) {
    if (node.type === "decision" && !valid.some(link => link.from === node.id)
      || node.type === "outcome" && !decisions.has(node.id)) routeIds.add(node.id);
  }
  return { orphanIds, routeIds: [...routeIds], missingStart: !starts.length && draft.nodes.length > 0 };
}
