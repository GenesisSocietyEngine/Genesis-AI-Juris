import type { StudioDraft } from "./types";

export const STUDIO_REVISION_LIMIT = 50;

// Server-attested lineage is an access/integrity control, not an authoring
// revision. Undoing a graph edit must never roll it back or remove its seal.
export type StudioSnapshot = Omit<StudioDraft, "editHistory" | "updatedAt" | "protection">;

export type StudioRevision = {
  id: string;
  label: string;
  source: "prompt" | "visual";
  createdAt: string;
  before: StudioSnapshot;
  after: StudioSnapshot;
};

export type StudioTimeline = {
  revisions: StudioRevision[];
  cursor: number;
};

export type StudioDiff = {
  fields: string[];
  nodesAdded: string[];
  nodesRemoved: string[];
  nodesChanged: string[];
  linksAdded: string[];
  linksRemoved: string[];
};

export function emptyStudioTimeline(): StudioTimeline {
  return { revisions: [], cursor: 0 };
}

export function snapshotStudioDraft(draft: StudioDraft): StudioSnapshot {
  return structuredClone({
    caseId: draft.caseId,
    version: draft.version,
    parent: draft.parent,
    title: draft.title,
    jurisdiction: draft.jurisdiction,
    role: draft.role,
    premise: draft.premise,
    classification: draft.classification,
    taxEconomics: draft.taxEconomics,
    nodes: draft.nodes,
    links: draft.links,
  });
}

export function applyStudioSnapshot(draft: StudioDraft, snapshot: StudioSnapshot, updatedAt: string): StudioDraft {
  return {
    ...structuredClone(snapshot),
    ...(draft.protection ? { protection: structuredClone(draft.protection) } : {}),
    editHistory: draft.editHistory,
    updatedAt,
  };
}

export function studioSnapshotsEqual(left: StudioSnapshot, right: StudioSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function recordStudioRevision(
  timeline: StudioTimeline,
  beforeDraft: StudioDraft,
  afterDraft: StudioDraft,
  options: { label: string; source: "prompt" | "visual"; createdAt: string },
): StudioTimeline {
  const before = snapshotStudioDraft(beforeDraft);
  const after = snapshotStudioDraft(afterDraft);
  if (studioSnapshotsEqual(before, after)) return timeline;
  const retained = timeline.revisions.slice(0, timeline.cursor);
  const stamp = Math.max(0, Date.parse(options.createdAt)).toString(36);
  let sequence = retained.length + 1;
  while (retained.some((revision) => revision.id === `revision-${stamp}-${sequence}`)) sequence += 1;
  const next = [...retained, {
    id: `revision-${stamp}-${sequence}`,
    label: options.label.trim().slice(0, 240) || "Studio edit",
    source: options.source,
    createdAt: new Date(options.createdAt).toISOString(),
    before,
    after,
  }];
  const revisions = next.slice(-STUDIO_REVISION_LIMIT);
  return { revisions, cursor: revisions.length };
}

export function stepStudioTimeline(timeline: StudioTimeline, direction: "undo" | "redo") {
  if (direction === "undo") {
    if (timeline.cursor === 0) return null;
    const revision = timeline.revisions[timeline.cursor - 1];
    return { revision, snapshot: revision.before, timeline: { ...timeline, cursor: timeline.cursor - 1 } };
  }
  if (timeline.cursor >= timeline.revisions.length) return null;
  const revision = timeline.revisions[timeline.cursor];
  return { revision, snapshot: revision.after, timeline: { ...timeline, cursor: timeline.cursor + 1 } };
}

export function diffStudioSnapshots(base: StudioSnapshot, target: StudioSnapshot): StudioDiff {
  const fields = (["caseId", "version", "parent", "title", "jurisdiction", "role", "premise", "classification", "taxEconomics"] as const)
    .filter((key) => JSON.stringify(base[key]) !== JSON.stringify(target[key]));
  const baseNodes = new Map(base.nodes.map((node) => [node.id, node]));
  const targetNodes = new Map(target.nodes.map((node) => [node.id, node]));
  const baseLinks = new Map(base.links.map((link) => [link.id, link]));
  const targetLinks = new Map(target.links.map((link) => [link.id, link]));
  return {
    fields: [...fields],
    nodesAdded: [...targetNodes.keys()].filter((id) => !baseNodes.has(id)),
    nodesRemoved: [...baseNodes.keys()].filter((id) => !targetNodes.has(id)),
    nodesChanged: [...targetNodes.keys()].filter((id) => baseNodes.has(id) && JSON.stringify(baseNodes.get(id)) !== JSON.stringify(targetNodes.get(id))),
    linksAdded: [...targetLinks.keys()].filter((id) => !baseLinks.has(id)),
    linksRemoved: [...baseLinks.keys()].filter((id) => !targetLinks.has(id)),
  };
}

export function diffDraftToRevision(draft: StudioDraft, revision: StudioRevision) {
  return diffStudioSnapshots(snapshotStudioDraft(draft), revision.after);
}
