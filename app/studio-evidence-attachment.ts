import type { StudioDraft } from "./types";

export const STUDIO_EVIDENCE_DRAG_TYPE = "application/x-casevant-evidence-link";
export type EvidenceAttachmentPlan = { evidenceIds: string[]; targetNodeId: string };

/** Ephemeral, same-owner gesture. External payloads never name or import evidence. */
export function createStudioEvidenceDrag(draft: StudioDraft, allowed: boolean, context?: object) {
  let gesture: { token: string; ids: string[] } | null = null;
  return {
    context,
    begin(ids: readonly string[]) {
      const selected = [...new Set(ids)];
      gesture = null;
      if (!allowed || !selected.length || selected.some(id => !draft.nodes.some(node => node.id === id && node.type === "evidence"))) return null;
      gesture = { token: crypto.randomUUID(), ids: selected };
      return gesture.token;
    },
    canDrop(target: string) {
      return Boolean(allowed && gesture && draft.nodes.some(node => node.id === target) && !gesture.ids.includes(target));
    },
    drop(token: string, target: string): EvidenceAttachmentPlan | null {
      const active = gesture; gesture = null;
      if (!allowed || !active || token !== active.token || active.ids.includes(target) || !draft.nodes.some(node => node.id === target)) return null;
      const ids = active.ids.filter(id => !draft.links.some(link => link.from === id && link.to === target || link.to === id && link.from === target));
      return ids.length ? { evidenceIds: ids, targetNodeId: target } : null;
    },
    active() { return Boolean(gesture); },
    clear() { gesture = null; },
  };
}
